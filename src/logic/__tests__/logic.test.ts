import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, pressKey } from "../amount.ts";
import { buildRecurring, buildTransaction } from "../drafts.ts";
import { isAppState, reduce, type AppState } from "../state.ts";
import { localToday, monthLabel, parseDayMonth, shiftMonth, shortDate } from "../today.ts";
import { groupByDay, monthView, nextOccurrence } from "../views.ts";
import { computeProgress } from "../../engine/xp.ts";
import { available } from "../../engine/finances.ts";

test("parseAmount lit les montants saisis à la française", () => {
  assert.equal(parseAmount("4,99"), 499);
  assert.equal(parseAmount("4.9"), 490);
  assert.equal(parseAmount("12"), 1200);
  assert.equal(parseAmount("1 250,5 €"), 125050);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("4,999"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("100000"), null);
});

test("le pavé numérique refuse les saisies impossibles", () => {
  const type = (keys: string[]) => keys.reduce(pressKey, "");
  assert.equal(type(["4", ",", "9", "9"]), "4,99");
  assert.equal(type(["4", ",", "9", "9", "9"]), "4,99");
  assert.equal(type([",", "5"]), "0,5");
  assert.equal(type(["0", "7"]), "7");
  assert.equal(type(["1", ",", ","]), "1,");
  assert.equal(type(["9", "9", "9", "9", "9", "9"]), "99999");
  assert.equal(type(["1", "2", "⌫"]), "1");
});

test("une dépense demande un montant et une catégorie", () => {
  const base = { kind: "out" as const, amountText: "3,50", date: "2026-10-26" };
  assert.deepEqual(buildTransaction({ ...base, amountText: "" }, "a"), { ok: false, error: "Indique un montant." });
  assert.deepEqual(buildTransaction(base, "a"), { ok: false, error: "Choisis une catégorie." });
  const ok = buildTransaction({ ...base, category: "nourriture", planned: true }, "a");
  assert.deepEqual(ok, {
    ok: true,
    value: { id: "a", kind: "out", amount: 350, date: "2026-10-26", label: "Nourriture & snacks", category: "nourriture", planned: true },
  });
});

test("une rentrée prend le nom de sa source par défaut", () => {
  const r = buildTransaction({ kind: "in", amountText: "20", date: "2026-10-26", source: "job" }, "b");
  assert.ok(r.ok && r.value.kind === "in" && r.value.label === "Petit boulot");
});

test("un abonnement est une récurrence de dépense marquée comme telle", () => {
  const r = buildRecurring(
    { kind: "out", label: " Musique ", amountText: "4,99", frequency: "monthly", startDate: "2026-10-01", category: "jeux", isSubscription: true },
    "r",
  );
  assert.ok(r.ok);
  assert.equal(r.value.label, "Musique");
  assert.equal(r.value.isSubscription, true);
  const income = buildRecurring({ kind: "in", label: "Poche", amountText: "40", frequency: "monthly", startDate: "2026-10-01", isSubscription: true }, "p");
  assert.ok(income.ok && income.value.isSubscription === undefined && income.value.category === undefined);
});

function started(): AppState {
  return reduce(null, {
    type: "init",
    settings: { openingBalance: 2000, openingDate: "2026-10-01" },
    profile: { gender: "f" },
  }) as AppState;
}

test("saisir une opération l'enregistre et rapporte un événement d'XP", () => {
  let s = started();
  const tx = buildTransaction({ kind: "out", amountText: "3", date: "2026-10-02", category: "sorties" }, "t1");
  assert.ok(tx.ok);
  s = reduce(s, { type: "addTransaction", tx: tx.value, today: "2026-10-02" }) as AppState;
  s = reduce(s, { type: "addTransaction", tx: tx.value, today: "2026-10-02" }) as AppState;
  assert.equal(s.finance.transactions.length, 1, "la même opération n'est jamais ajoutée deux fois");
  assert.equal(computeProgress(s.events).total, 2);
  assert.equal(available(s.finance, "2026-10-02"), 1700);
});

test("la connexion n'est comptée qu'une fois par jour", () => {
  let s = started();
  for (const today of ["2026-10-02", "2026-10-02", "2026-10-03"]) s = reduce(s, { type: "login", today }) as AppState;
  assert.equal(s.events.length, 2);
});

test("résilier un abonnement pose une date de fin, jamais avant son début", () => {
  let s = started();
  s = reduce(s, {
    type: "addRecurring",
    rec: { id: "m", kind: "out", label: "Musique", amount: 499, frequency: "monthly", startDate: "2026-10-05", isSubscription: true },
  }) as AppState;
  s = reduce(s, { type: "endRecurring", id: "m", endDate: "2026-10-01" }) as AppState;
  assert.equal(s.finance.recurrings[0]?.endDate, "2026-10-05");
  s = reduce(s, { type: "setSubscriptionUsed", id: "m", used: false }) as AppState;
  assert.equal(s.finance.recurrings[0]?.used, false);
});

test("un objectif qui contient de l'argent ne peut pas être supprimé", () => {
  let s = started();
  s = reduce(s, { type: "addGoal", goal: { id: "g", label: "Écouteurs", target: 6000, createdAt: "2026-10-01", deadline: "2026-12-01" } }) as AppState;
  s = reduce(s, { type: "addTransaction", tx: { id: "s", kind: "save", amount: 500, date: "2026-10-02", goalId: "g" }, today: "2026-10-02" }) as AppState;
  s = reduce(s, { type: "removeGoal", id: "g", today: "2026-10-03" }) as AppState;
  assert.equal(s.finance.goals.length, 1);
  s = reduce(s, { type: "addTransaction", tx: { id: "w", kind: "withdraw", amount: 500, date: "2026-10-03", goalId: "g" }, today: "2026-10-03" }) as AppState;
  s = reduce(s, { type: "removeGoal", id: "g", today: "2026-10-03" }) as AppState;
  assert.equal(s.finance.goals.length, 0);
});

test("isAppState rejette un fichier qui n'est pas une sauvegarde", () => {
  assert.equal(isAppState(started()), true);
  assert.equal(isAppState({ version: 2 }), false);
  assert.equal(isAppState(null), false);
});

test("la vue du mois mêle opérations et récurrences, des plus récentes aux plus anciennes", () => {
  let s = started();
  s = reduce(s, { type: "addRecurring", rec: { id: "poche", kind: "in", label: "Argent de poche", amount: 4000, frequency: "monthly", startDate: "2026-10-01" } }) as AppState;
  s = reduce(s, { type: "addTransaction", tx: { id: "a", kind: "out", amount: 350, date: "2026-10-12", label: "Ciné", category: "sorties" }, today: "2026-10-12" }) as AppState;
  s = reduce(s, { type: "addTransaction", tx: { id: "b", kind: "out", amount: 2000, date: "2026-10-12", label: "Baskets", category: "vetements", paidByRelative: true }, today: "2026-10-12" }) as AppState;
  s = reduce(s, { type: "addTransaction", tx: { id: "c", kind: "save", amount: 1000, date: "2026-10-15" }, today: "2026-10-15" }) as AppState;
  const v = monthView(s.finance, "2026-10");
  assert.deepEqual(v.lines.map((l) => l.label), ["Mise de côté", "Ciné", "Baskets", "Argent de poche"]);
  assert.equal(v.totalIn, 4000);
  assert.equal(v.totalOut, 350, "une dépense payée par un proche est affichée mais pas comptée");
  assert.equal(v.totalSaved, 1000);
  assert.deepEqual(groupByDay(v.lines).map((g) => [g.date, g.lines.length]), [
    ["2026-10-15", 1],
    ["2026-10-12", 2],
    ["2026-10-01", 1],
  ]);
  assert.equal(monthView(s.finance, "2026-09").lines.length, 0, "rien avant la date de départ");
});

test("prochaine échéance d'une récurrence", () => {
  const rec = { id: "m", kind: "out" as const, label: "M", amount: 499, frequency: "monthly" as const, startDate: "2026-08-31" };
  assert.equal(nextOccurrence(rec, "2026-11-01"), "2026-11-30");
  assert.equal(nextOccurrence({ ...rec, endDate: "2026-10-31" }, "2026-11-01"), null);
});

test("dates affichées", () => {
  assert.equal(localToday(new Date(2026, 9, 26, 23, 30)), "2026-10-26");
  assert.equal(monthLabel("2026-10"), "octobre 2026");
  assert.equal(shortDate("2026-10-26"), "26 oct.");
  assert.equal(shortDate("2026-07-03"), "3 juil.");
  assert.equal(shortDate("2026-05-09"), "9 mai");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("lecture d'une date courte JJ/MM", () => {
  assert.equal(parseDayMonth("5/11", "2026-10-26"), "2026-11-05");
  assert.equal(parseDayMonth("05/01/2027", "2026-10-26"), "2027-01-05");
  assert.equal(parseDayMonth("31/11", "2026-10-26"), null);
  assert.equal(parseDayMonth("demain", "2026-10-26"), null);
});

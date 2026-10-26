import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates.ts";
import {
  computeProgress,
  goalXp,
  levelFor,
  levelThreshold,
  reserveStreakEvents,
  titleFor,
  type XpEvent,
} from "../xp.ts";
import { makeState, save } from "./helpers.ts";

const logins = (dates: string[]): XpEvent[] => dates.map((date) => ({ type: "login", date }));

test("une seule prime de connexion par jour, quel que soit le nombre d'ouvertures", () => {
  const p = computeProgress(logins(["2026-10-01", "2026-10-01", "2026-10-01"]));
  assert.equal(p.total, 4);
  assert.equal(p.loginDays, 1);
  assert.equal(p.nextRavitaillementIn, 6);
});

test("le Ravitaillement tombe au 7e jour de connexion cumulé, même avec des trous", () => {
  const dates = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-09", "2026-10-10", "2026-10-15", "2026-10-20"];
  const p = computeProgress(logins(dates));
  assert.equal(p.ravitaillements.length, 1);
  assert.equal(p.ravitaillements[0]?.date, "2026-10-20");
  assert.equal(p.ravitaillements[0]?.reward?.id, "veste-neon");
  assert.equal(p.total, 7 * 4 + 20);
  assert.equal(p.nextRavitaillementIn, 7);
});

test("les récompenses du Ravitaillement suivent une liste fixe, sans tirage", () => {
  const dates = Array.from({ length: 21 }, (_, i) => addDays("2026-10-01", i));
  const a = computeProgress(logins(dates)).ravitaillements.map((r) => r.reward?.id);
  const b = computeProgress(logins([...dates].reverse())).ravitaillements.map((r) => r.reward?.id);
  assert.deepEqual(a, ["veste-neon", "lampe-qg", "casquette-holo"]);
  assert.deepEqual(b, a);
});

test("la connexion seule reste sous un tiers de l'XP d'un premier mois actif", () => {
  const days = Array.from({ length: 30 }, (_, i) => addDays("2026-10-01", i));
  const events: XpEvent[] = [
    ...logins(days),
    ...days.flatMap((date, d) =>
      Array.from({ length: 5 }, (_, k) => ({ type: "entry" as const, date, ref: `tx-${d}-${k}` })),
    ),
    ...["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"].map((date) => ({ type: "weekly_review" as const, date })),
    { type: "glitch_neutralized", date: "2026-10-20", ref: "boucle:musique" },
    { type: "mission", date: "2026-10-03", ref: "quiz-budget", xp: 30 },
  ];
  const p = computeProgress(events);
  const fromLogin = p.ledger
    .filter((l) => l.source === "login" || l.source === "ravitaillement")
    .reduce((s, l) => s + l.xp, 0);
  assert.equal(fromLogin, 30 * 4 + 4 * 20);
  assert.ok(fromLogin / p.total <= 1 / 3 + 0.01, `${fromLogin} / ${p.total}`);
  assert.equal(p.total, 650);
  assert.equal(p.level, 3);
});

test("la saisie rapporte 2 XP, plafonnée à 10 XP par jour, et une opération ne compte qu'une fois", () => {
  const entries: XpEvent[] = Array.from({ length: 8 }, (_, i) => ({ type: "entry", date: "2026-10-01", ref: `t${i}` }));
  entries.push({ type: "entry", date: "2026-10-01", ref: "t0" });
  const p = computeProgress(entries);
  assert.equal(p.total, 10);
  assert.ok(p.ledger.some((l) => l.note === "Plafond de saisie du jour atteint"));
});

test("une revue par semaine ISO", () => {
  const p = computeProgress([
    { type: "weekly_review", date: "2026-10-26" },
    { type: "weekly_review", date: "2026-11-01" },
    { type: "weekly_review", date: "2026-11-02" },
  ]);
  assert.equal(p.total, 40);
});

test("un Glitch ne rapporte qu'une fois, et au plus 2 Glitchs par semaine", () => {
  const p = computeProgress([
    { type: "glitch_neutralized", date: "2026-10-26", ref: "a" },
    { type: "glitch_neutralized", date: "2026-10-27", ref: "a" },
    { type: "glitch_neutralized", date: "2026-10-27", ref: "b" },
    { type: "glitch_neutralized", date: "2026-10-28", ref: "c" },
    { type: "glitch_neutralized", date: "2026-11-02", ref: "d" },
  ]);
  assert.equal(p.total, 3 * 40);
});

test("un objectif rapporte selon sa durée, jamais selon son montant", () => {
  assert.equal(goalXp(20), 0);
  assert.equal(goalXp(21), 30);
  assert.equal(goalXp(35), 50);
  assert.equal(goalXp(200), 80);
  const p = computeProgress([{ type: "goal_completed", date: "2026-11-05", ref: "ecouteurs", startedOn: "2026-10-01" }]);
  assert.equal(p.total, 50);
});

test("l'XP d'une mission est bornée entre 15 et 50", () => {
  const p = computeProgress([
    { type: "mission", date: "2026-10-01", ref: "m1", xp: 500 },
    { type: "mission", date: "2026-10-01", ref: "m2", xp: 1 },
    { type: "mission", date: "2026-10-02", ref: "m1", xp: 50 },
  ]);
  assert.equal(p.total, 65);
});

test("niveaux : 100 × n^1,4 XP cumulés, et titres selon le niveau", () => {
  assert.equal(levelThreshold(1), 0);
  assert.equal(levelThreshold(2), 264);
  assert.equal(levelThreshold(5), 952);
  assert.equal(levelFor(263), 1);
  assert.equal(levelFor(264), 2);
  assert.equal(titleFor(1), "Recrue");
  assert.equal(titleFor(5, "f"), "Opératrice");
  assert.equal(titleFor(6, "m"), "Opérateur");
  assert.equal(titleFor(12, "n"), "Architecte");
});

test("le résultat ne dépend pas de l'ordre de réception des événements", () => {
  const events: XpEvent[] = [
    ...logins(["2026-10-01", "2026-10-02"]),
    ...Array.from({ length: 7 }, (_, i) => ({ type: "entry" as const, date: "2026-10-01", ref: `t${i}` })),
    { type: "weekly_review", date: "2026-10-02" },
  ];
  assert.equal(computeProgress(events).total, computeProgress([...events].reverse()).total);
});

test("réserve en progression : un événement par bloc de 4 semaines de hausse, quel que soit le montant", () => {
  // Départ le lundi 2026-09-07 ; +1 € chaque mercredi pendant 8 semaines.
  const saves = Array.from({ length: 8 }, (_, i) => save(addDays("2026-09-09", 7 * i), 100));
  const state = makeState({ openingDate: "2026-09-07" }, saves);
  // Au mercredi 28/10, 7 semaines de hausse sont terminées : un seul bloc de 4.
  assert.equal(reserveStreakEvents(state, "2026-10-28").length, 1);
  // Au 04/11, la 8e semaine est terminée : deuxième bloc.
  const later = reserveStreakEvents(state, "2026-11-04");
  assert.equal(later.length, 2);
  assert.equal(computeProgress([...later, ...later]).total, 60);
});

test("une semaine sans hausse remet le bloc en cours à zéro", () => {
  const dates = ["2026-09-09", "2026-09-16", "2026-09-23", "2026-10-07", "2026-10-14", "2026-10-21"];
  const state = makeState({ openingDate: "2026-09-07" }, dates.map((d) => save(d, 100)));
  // 3 hausses, une semaine sans (fin 04/10), puis 3 hausses : aucun bloc complet.
  assert.equal(reserveStreakEvents(state, "2026-10-28").length, 0);
});

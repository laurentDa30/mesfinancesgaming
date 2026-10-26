import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHealth, healthLosses, scale } from "../health.ts";
import type { FinanceState, Recurring, Transaction } from "../types.ts";
import { makeState, out, pocketMoney } from "./helpers.ts";

const TODAY = "2026-10-15";

/** Lycéenne type : 40 €/mois d'argent de poche, budget 30 €, réserve pleine. */
function healthy(factor = 1, extra: Transaction[] = [], reserve = 3000): FinanceState {
  return makeState(
    {
      openingBalance: 3000 * factor,
      openingDate: "2026-09-01",
      openingReserve: reserve * factor,
      monthlyBudget: 3000 * factor,
    },
    [out("2026-09-20", 2500 * factor), out("2026-10-10", 1000 * factor), ...extra],
    [pocketMoney(4000 * factor)],
  );
}

const points = (state: FinanceState) =>
  Object.fromEntries(computeHealth(state, TODAY).criteria.map((c) => [c.id, c.points]));

test("scale interpole entre les bornes et plafonne", () => {
  assert.equal(scale(-1, 0, 0.1), 0);
  assert.equal(scale(0.05, 0, 0.1), 12.5);
  assert.equal(scale(2, 0, 0.1), 25);
});

test("une situation équilibrée vaut 100", () => {
  const h = computeHealth(healthy(), TODAY);
  assert.equal(h.score, 100);
  assert.equal(h.calibrating, false);
  assert.equal(healthLosses(h).length, 0);
});

test("une dépense prévue et couverte ne coûte aucun point", () => {
  const planned = out("2026-10-25", 6000, { label: "Écouteurs", planned: true });
  assert.equal(computeHealth(healthy(1, [planned]), TODAY).score, 100);
});

test("la même dépense, imprévue et hors budget, fait baisser le rythme", () => {
  const impulse = out(TODAY, 6000, { label: "Écouteurs" });
  const p = points(healthy(1, [impulse]));
  assert.equal(p.rythme, 0);
  assert.equal(p.anticipation, 25);
});

test("la note ne dépend pas du niveau de revenu, seulement des proportions", () => {
  const modest = computeHealth(healthy(1, [], 1500), TODAY);
  const wealthy = computeHealth(healthy(10, [], 1500), TODAY);
  assert.equal(modest.score, 88);
  assert.equal(wealthy.score, modest.score);
});

test("chaque point perdu est expliqué en une phrase", () => {
  const h = computeHealth(healthy(1, [], 1500), TODAY);
  const losses = healthLosses(h);
  assert.equal(losses.length, 1);
  assert.equal(losses[0]?.id, "reserve");
  assert.equal(losses[0]?.explanation, "Réserve à 50 % de sa cible (15,00 € sur 30,00 €).");
});

test("un déficit prévu met l'équilibre à zéro avec le montant manquant", () => {
  const phone: Recurring = {
    id: "forfait",
    kind: "out",
    label: "Forfait",
    amount: 12000,
    frequency: "monthly",
    startDate: "2026-09-20",
  };
  const state = makeState(
    { openingBalance: 0, openingDate: "2026-09-01", monthlyBudget: 3000 },
    [],
    [pocketMoney(4000), phone],
  );
  const eq = computeHealth(state, TODAY).criteria.find((c) => c.id === "equilibre");
  assert.equal(eq?.points, 0);
  assert.match(eq?.explanation ?? "", /Il manquerait/);
});

test("la jauge est en calibrage les 14 premiers jours", () => {
  assert.equal(computeHealth(healthy(), "2026-09-10").calibrating, true);
  assert.equal(computeHealth(healthy(), "2026-09-14").calibrating, false);
});

test("sans rentrée saisie, la jauge reste en calibrage", () => {
  const state = makeState({ openingBalance: 2000, openingDate: "2026-09-01" });
  assert.equal(computeHealth(state, TODAY).calibrating, true);
});

test("sans budget, le rythme n'est pas noté et la note porte sur 3 critères", () => {
  const state = healthy();
  delete state.settings.monthlyBudget;
  const h = computeHealth(state, TODAY);
  assert.equal(h.criteria.find((c) => c.id === "rythme")?.points, null);
  // Sans budget, la cible de réserve suit les dépenses réelles des 30 derniers jours (35 €) :
  // 30 € de réserve = 21,4 pts ; (25 + 25 + 21,4) / 75 = 95.
  assert.equal(h.score, 95);
});

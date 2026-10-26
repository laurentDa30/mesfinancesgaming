import { test } from "node:test";
import assert from "node:assert/strict";
import {
  available,
  goalSaved,
  monthlyEquivalent,
  occurrences,
  reserveBalance,
  reserveTarget,
  upcoming,
} from "../finances.ts";
import { euros } from "../format.ts";
import type { Recurring } from "../types.ts";
import { inc, makeState, out, pocketMoney, save } from "./helpers.ts";

const sub = (extra: Partial<Recurring> = {}): Recurring => ({
  id: "musique",
  kind: "out",
  label: "Appli musique",
  amount: 499,
  frequency: "monthly",
  startDate: "2026-08-31",
  isSubscription: true,
  ...extra,
});

test("une récurrence mensuelle au 31 tombe le dernier jour des mois courts", () => {
  assert.deepEqual(occurrences(sub(), "2026-09-01", "2026-12-31"), [
    "2026-09-30",
    "2026-10-31",
    "2026-11-30",
    "2026-12-31",
  ]);
});

test("une récurrence s'arrête à sa date de fin", () => {
  assert.deepEqual(occurrences(sub({ endDate: "2026-10-15" }), "2026-09-01", "2026-12-31"), ["2026-09-30"]);
});

test("équivalents mensuels : annuel divisé par 12, hebdomadaire × 52 / 12", () => {
  assert.equal(monthlyEquivalent(sub({ amount: 6000, frequency: "yearly" })), 500);
  assert.equal(monthlyEquivalent(sub({ amount: 300, frequency: "weekly" })), 1300);
});

test("le disponible additionne départ, rentrées et récurrences, et retire dépenses et mises de côté", () => {
  const state = makeState(
    { openingBalance: 1000, openingDate: "2026-09-01" },
    [inc("2026-09-10", 2500), out("2026-09-12", 800), save("2026-09-15", 500)],
    [pocketMoney(4000)],
  );
  // 10 € + 40 € (argent de poche du 1er) + 25 € − 8 € − 5 €
  assert.equal(available(state, "2026-09-30"), 6200);
  // L'argent de poche du 1er octobre arrive ensuite.
  assert.equal(available(state, "2026-10-01"), 10200);
});

test("une dépense payée par un proche n'entre pas dans le budget", () => {
  const state = makeState({ openingBalance: 5000 }, [out("2026-09-05", 3000, { paidByRelative: true })]);
  assert.equal(available(state, "2026-09-30"), 5000);
});

test("réserve et objectifs sont des poches séparées", () => {
  const state = makeState({ openingReserve: 1000 }, [save("2026-09-02", 500), save("2026-09-03", 700, "ecouteurs")]);
  assert.equal(reserveBalance(state, "2026-09-30"), 1500);
  assert.equal(goalSaved(state, "ecouteurs", "2026-09-30"), 700);
});

test("les dépenses à venir couvrent récurrences et achats prévus, triées par date", () => {
  const state = makeState(
    {},
    [out("2026-10-20", 6000, { label: "Écouteurs", planned: true })],
    [sub({ startDate: "2026-09-05" })],
  );
  const items = upcoming(state, "2026-10-01", 30);
  assert.deepEqual(
    items.map((i) => [i.date, i.label]),
    [
      ["2026-10-05", "Appli musique"],
      ["2026-10-20", "Écouteurs"],
    ],
  );
});

test("la cible de réserve ne descend jamais sous 20 €", () => {
  assert.equal(reserveTarget(makeState(), "2026-09-30"), 2000);
  assert.equal(reserveTarget(makeState({ reserveTarget: 5000 }), "2026-09-30"), 5000);
});

test("formatage des montants en euros", () => {
  assert.equal(euros(1299), "12,99 €");
  assert.equal(euros(-500), "−5,00 €");
  assert.equal(euros(123456), "1 234,56 €");
});

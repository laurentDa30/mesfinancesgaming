import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBoucles, detectFailles, detectGlitches, detectSiphons, isNeutralized } from "../glitchs.ts";
import type { Recurring } from "../types.ts";
import { makeState, out, pocketMoney, save } from "./helpers.ts";

const TODAY = "2026-10-15";
const snack = (date: string) => out(date, 300, { category: "nourriture", label: "Snack" });

test("le Siphon apparaît avec 4 petites dépenses répétées qui pèsent", () => {
  const state = makeState({}, ["2026-09-20", "2026-09-28", "2026-10-03", "2026-10-08", "2026-10-12"].map(snack), [pocketMoney(4000)]);
  const [siphon] = detectSiphons(state, TODAY);
  assert.equal(siphon?.type, "siphon");
  assert.equal(siphon?.id, "siphon:nourriture:2026-10");
  assert.match(siphon?.message ?? "", /5 petites dépenses « Nourriture & snacks » en 30 jours : 15,00 €/);
});

test("trois petites dépenses ne suffisent pas à faire un Siphon", () => {
  const state = makeState({}, ["2026-10-03", "2026-10-08", "2026-10-12"].map(snack), [pocketMoney(4000)]);
  assert.equal(detectSiphons(state, TODAY).length, 0);
});

test("une dépense prévue n'alimente jamais le Siphon", () => {
  const planned = ["2026-10-01", "2026-10-03", "2026-10-08", "2026-10-12", "2026-10-14"].map((d) =>
    out(d, 300, { category: "nourriture", planned: true }),
  );
  assert.equal(detectSiphons(makeState({}, planned), TODAY).length, 0);
});

test("le Siphon n'est neutralisé qu'après un vrai changement constaté sur au moins 21 jours", () => {
  const before = ["2026-09-20", "2026-09-28", "2026-10-03", "2026-10-08", "2026-10-12"].map(snack);
  const after = ["2026-10-22", "2026-11-02"].map(snack);
  const state = makeState({}, [...before, ...after], [pocketMoney(4000)]);
  const [siphon] = detectSiphons(state, TODAY);
  assert.ok(siphon);
  assert.equal(isNeutralized(state, siphon, "2026-10-30"), false, "trop tôt pour juger");
  assert.equal(isNeutralized(state, siphon, "2026-11-09"), true);

  const relapse = makeState({}, [...before, ...["2026-10-20", "2026-10-25", "2026-10-30", "2026-11-04"].map(snack)]);
  assert.equal(isNeutralized(relapse, siphon, "2026-11-09"), false);
});

const music = (extra: Partial<Recurring> = {}): Recurring => ({
  id: "musique",
  kind: "out",
  label: "Appli musique",
  amount: 499,
  frequency: "monthly",
  startDate: "2026-09-01",
  isSubscription: true,
  ...extra,
});

test("la Boucle pose la question après 30 jours, puis se confirme si l'abonnement ne sert pas", () => {
  assert.equal(detectBoucles(makeState({}, [], [music()]), "2026-09-20").length, 0);
  const [suspected] = detectBoucles(makeState({}, [], [music()]), TODAY);
  assert.equal(suspected?.type === "boucle" && suspected.status, "suspected");
  const [confirmed] = detectBoucles(makeState({}, [], [music({ used: false })]), "2026-09-05");
  assert.equal(confirmed?.type === "boucle" && confirmed.status, "confirmed");
  assert.match(confirmed?.message ?? "", /4,99 € par mois \(59,88 € par an\)/);
  assert.equal(detectBoucles(makeState({}, [], [music({ used: true })]), TODAY).length, 0);
});

test("la Boucle est neutralisée par une date de fin, pas par la suppression de la fiche", () => {
  const [boucle] = detectBoucles(makeState({}, [], [music({ used: false })]), TODAY);
  assert.ok(boucle);
  assert.equal(isNeutralized(makeState({}, [], [music({ used: false })]), boucle, TODAY), false);
  assert.equal(isNeutralized(makeState({}, [], [music({ used: false, endDate: "2026-10-31" })]), boucle, TODAY), true);
  assert.equal(isNeutralized(makeState({}, [], []), boucle, TODAY), false);
});

test("la Faille apparaît quand un imprévu tombe sans réserve, et se referme quand la réserve remonte", () => {
  const shock = out("2026-10-10", 2000, { label: "Écran cassé" });
  const state = makeState({}, [shock], [pocketMoney(4000)]);
  const [faille] = detectFailles(state, TODAY);
  assert.equal(faille?.type, "faille");
  assert.equal(faille?.id, `faille:${shock.id}`);
  assert.equal(isNeutralized(state, faille!, TODAY), false);

  const rebuilt = makeState({}, [shock, save("2026-10-20", 1000)], [pocketMoney(4000)]);
  assert.equal(isNeutralized(rebuilt, faille!, "2026-10-21"), true);
});

test("pas de Faille si la réserve couvre au moins la moitié de sa cible", () => {
  const state = makeState({ openingReserve: 1500 }, [out("2026-10-10", 2000)], [pocketMoney(4000)]);
  assert.equal(detectFailles(state, TODAY).length, 0);
});

test("detectGlitches ne lit les finances qu'en lecture seule", () => {
  const state = makeState({}, [out("2026-10-10", 2000)], [pocketMoney(4000), music({ used: false })]);
  const snapshot = JSON.stringify(state);
  const found = detectGlitches(state, TODAY);
  assert.deepEqual(found.map((g) => g.type), ["faille", "boucle"]);
  assert.equal(JSON.stringify(state), snapshot);
});

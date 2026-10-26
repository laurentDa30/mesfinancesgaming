import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, daysBetween, isIsoDate, isoWeek } from "../dates.ts";

test("addMonths garde le jour d'ancrage et le ramène au dernier jour du mois", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2, 31), "2026-03-31");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
});

test("addDays et daysBetween traversent les changements de mois et d'année", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-10-01", "2026-10-31"), 30);
  assert.equal(daysBetween("2026-10-31", "2026-10-01"), -30);
});

test("isoWeek suit la norme ISO (2026 compte 53 semaines)", () => {
  assert.equal(isoWeek("2026-01-01"), "2026-W01");
  assert.equal(isoWeek("2026-10-26"), "2026-W44");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
});

test("isIsoDate refuse les dates impossibles", () => {
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("26-1-1"), false);
});

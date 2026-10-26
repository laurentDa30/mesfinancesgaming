import {
  addDays,
  addMonths,
  daysBetween,
  inRange,
  parts,
  type IsoDate,
} from "./dates.ts";
import type { Cents, FinanceState, Recurring, Transaction } from "./types.ts";

/** Plancher de la cible de réserve : 20 €. */
export const MIN_RESERVE_TARGET: Cents = 2000;

/** Dates où une récurrence tombe, entre `from` et `to` inclus. */
export function occurrences(rec: Recurring, from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const last = rec.endDate && rec.endDate < to ? rec.endDate : to;
  if (last < from || rec.startDate > last) return out;
  const anchorDay = parts(rec.startDate).d;
  let date = rec.startDate;
  let i = 0;
  // 5 000 itérations couvrent ~100 ans d'hebdomadaire : garde-fou contre une boucle infinie.
  while (date <= last && i < 5000) {
    if (date >= from) out.push(date);
    i += 1;
    date =
      rec.frequency === "weekly"
        ? addDays(rec.startDate, 7 * i)
        : rec.frequency === "monthly"
          ? addMonths(rec.startDate, i, anchorDay)
          : addMonths(rec.startDate, 12 * i, anchorDay);
  }
  return out;
}

/** Montant ramené au mois (un abonnement annuel de 60 € = 5 €/mois). */
export function monthlyEquivalent(rec: Recurring): Cents {
  if (rec.frequency === "monthly") return rec.amount;
  if (rec.frequency === "yearly") return Math.round(rec.amount / 12);
  return Math.round((rec.amount * 52) / 12);
}

export function isActive(rec: Recurring, today: IsoDate): boolean {
  return rec.startDate <= today && (!rec.endDate || rec.endDate >= today);
}

const countsInBudget = (t: Transaction): boolean =>
  !(t.kind === "out" && t.paidByRelative === true);

function txBetween(state: FinanceState, from: IsoDate, to: IsoDate): Transaction[] {
  const start = state.settings.openingDate > from ? state.settings.openingDate : from;
  return state.transactions.filter((t) => inRange(t.date, start, to) && countsInBudget(t));
}

function recurringSum(state: FinanceState, kind: "in" | "out", from: IsoDate, to: IsoDate): Cents {
  const start = state.settings.openingDate > from ? state.settings.openingDate : from;
  if (start > to) return 0;
  let total = 0;
  for (const rec of state.recurrings) {
    if (rec.kind === kind) total += rec.amount * occurrences(rec, start, to).length;
  }
  return total;
}

/** Rentrées (ponctuelles + récurrentes) entre deux dates incluses. */
export function incomeBetween(state: FinanceState, from: IsoDate, to: IsoDate): Cents {
  const tx = txBetween(state, from, to).filter((t) => t.kind === "in");
  return sum(tx.map((t) => t.amount)) + recurringSum(state, "in", from, to);
}

/** Dépenses (ponctuelles + récurrentes) entre deux dates incluses, hors dépenses payées par un proche. */
export function spendingBetween(state: FinanceState, from: IsoDate, to: IsoDate): Cents {
  const tx = txBetween(state, from, to).filter((t) => t.kind === "out");
  return sum(tx.map((t) => t.amount)) + recurringSum(state, "out", from, to);
}

/**
 * Dépenses courantes : ponctuelles, non prévues, non payées par un proche.
 * C'est ce qui est comparé au budget mensuel.
 */
export function variableSpendingBetween(state: FinanceState, from: IsoDate, to: IsoDate): Cents {
  return sum(
    txBetween(state, from, to)
      .filter((t) => t.kind === "out" && t.planned !== true)
      .map((t) => t.amount),
  );
}

/** Argent disponible (hors réserve et objectifs) à la fin de la journée `today`. */
export function available(state: FinanceState, today: IsoDate): Cents {
  const { openingBalance, openingDate } = state.settings;
  if (today < openingDate) return openingBalance;
  let total = openingBalance;
  for (const t of txBetween(state, openingDate, today)) {
    if (t.kind === "in" || t.kind === "withdraw") total += t.amount;
    else total -= t.amount;
  }
  total += recurringSum(state, "in", openingDate, today);
  total -= recurringSum(state, "out", openingDate, today);
  return total;
}

function pocket(state: FinanceState, today: IsoDate, goalId: string | undefined): Cents {
  let total = 0;
  for (const t of txBetween(state, state.settings.openingDate, today)) {
    if ((t.kind === "save" || t.kind === "withdraw") && t.goalId === goalId) {
      total += t.kind === "save" ? t.amount : -t.amount;
    }
  }
  return total;
}

/** Réserve de sécurité (argent mis de côté sans objectif précis). */
export function reserveBalance(state: FinanceState, today: IsoDate): Cents {
  return (state.settings.openingReserve ?? 0) + pocket(state, today, undefined);
}

export function goalSaved(state: FinanceState, goalId: string, today: IsoDate): Cents {
  return pocket(state, today, goalId);
}

export type UpcomingItem = {
  date: IsoDate;
  label: string;
  amount: Cents;
  origin: "recurring" | "planned";
  refId: string;
};

/** Dépenses déjà connues dans les `days` prochains jours (après aujourd'hui). */
export function upcoming(state: FinanceState, today: IsoDate, days = 30): UpcomingItem[] {
  const from = addDays(today, 1);
  const to = addDays(today, days);
  const items: UpcomingItem[] = [];
  for (const rec of state.recurrings) {
    if (rec.kind !== "out") continue;
    for (const date of occurrences(rec, from, to)) {
      items.push({ date, label: rec.label, amount: rec.amount, origin: "recurring", refId: rec.id });
    }
  }
  for (const t of state.transactions) {
    if (t.kind === "out" && t.paidByRelative !== true && inRange(t.date, from, to)) {
      items.push({ date: t.date, label: t.label, amount: t.amount, origin: "planned", refId: t.id });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Rentrées attendues dans les `days` prochains jours. */
export function expectedIncome(state: FinanceState, today: IsoDate, days = 30): Cents {
  return incomeBetween(state, addDays(today, 1), addDays(today, days));
}

/** Coût mensuel des abonnements et dépenses récurrentes actives. */
export function monthlyFixedSpending(state: FinanceState, today: IsoDate): Cents {
  return sum(
    state.recurrings.filter((r) => r.kind === "out" && isActive(r, today)).map(monthlyEquivalent),
  );
}

/** Dépenses courantes attendues sur un mois : le budget s'il existe, sinon la moyenne des 30 derniers jours. */
export function expectedMonthlyVariable(state: FinanceState, today: IsoDate): Cents {
  if (state.settings.monthlyBudget !== undefined) return state.settings.monthlyBudget;
  return variableSpendingBetween(state, addDays(today, -29), today);
}

/** Cible de réserve : choisie par l'Opérateur, sinon un mois de dépenses, au moins 20 €. */
export function reserveTarget(state: FinanceState, today: IsoDate): Cents {
  if (state.settings.reserveTarget !== undefined) return state.settings.reserveTarget;
  return Math.max(
    MIN_RESERVE_TARGET,
    monthlyFixedSpending(state, today) + expectedMonthlyVariable(state, today),
  );
}

/** Nombre de jours d'utilisation, jour de départ compris. */
export function daysOfData(state: FinanceState, today: IsoDate): number {
  return Math.max(0, daysBetween(state.settings.openingDate, today) + 1);
}

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

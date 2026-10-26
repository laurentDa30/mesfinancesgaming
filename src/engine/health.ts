import { addDays, daysInMonth, makeIso, parts, type IsoDate } from "./dates.ts";
import {
  available,
  daysOfData,
  expectedIncome,
  expectedMonthlyVariable,
  incomeBetween,
  reserveBalance,
  reserveTarget,
  sum,
  upcoming,
  variableSpendingBetween,
} from "./finances.ts";
import { euros, percent } from "./format.ts";
import type { FinanceState } from "./types.ts";

/**
 * Santé financière sur 100, en 4 critères de 25 points.
 * Tous les critères sont des ratios : ils ne dépendent pas du niveau de revenu.
 * Une dépense prévue ne coûte rien en soi : elle est déjà comptée dans l'Anticipation.
 */

export const CRITERION_MAX = 25;
/** Sous ce nombre de jours d'utilisation, la jauge est « en calibrage ». */
export const CALIBRATION_DAYS = 14;

export type CriterionId = "equilibre" | "anticipation" | "reserve" | "rythme";

export type Criterion = {
  id: CriterionId;
  label: string;
  /** null = pas assez de données pour noter ce critère. */
  points: number | null;
  max: number;
  /** Une phrase lisible par l'Opérateur, qui explique la note. */
  explanation: string;
};

export type Health = {
  /** Note sur 100, ou null si aucun critère n'est calculable. */
  score: number | null;
  /** Vrai tant que les données sont trop pauvres pour que la note soit fiable. */
  calibrating: boolean;
  criteria: Criterion[];
};

/** Interpolation linéaire bornée : `low` → 0 point, `high` → 25 points. */
export function scale(value: number, low: number, high: number): number {
  if (high === low) return value >= high ? CRITERION_MAX : 0;
  const t = (value - low) / (high - low);
  return Math.round(Math.min(1, Math.max(0, t)) * CRITERION_MAX * 10) / 10;
}

const HORIZON = 30;

export function equilibre(state: FinanceState, today: IsoDate): Criterion {
  const base = { id: "equilibre" as const, label: "Équilibre", max: CRITERION_MAX };
  const incoming = expectedIncome(state, today, HORIZON);
  const reference = Math.max(incoming, incomeBetween(state, addDays(today, 1 - HORIZON), today));
  const outgoing = sum(upcoming(state, today, HORIZON).map((u) => u.amount));
  const variable = expectedMonthlyVariable(state, today);
  const projected = available(state, today) + incoming - outgoing - variable;

  if (reference <= 0) {
    if (projected < 0) {
      return { ...base, points: 0, explanation: `Il manquerait ${euros(-projected)} dans 30 jours, sans rentrée prévue.` };
    }
    return { ...base, points: null, explanation: "Ajoute tes rentrées d'argent pour mesurer ton équilibre." };
  }
  const ratio = projected / reference;
  const points = scale(ratio, 0, 0.1);
  const explanation =
    projected < 0
      ? `Il manquerait ${euros(-projected)} dans 30 jours : tes sorties prévues dépassent tes rentrées.`
      : points < CRITERION_MAX
        ? `Il te resterait ${euros(projected)} dans 30 jours, soit ${percent(ratio)} de tes rentrées. Vise 10 %.`
        : `Il te resterait ${euros(projected)} dans 30 jours : ton budget tient.`;
  return { ...base, points, explanation };
}

export function anticipation(state: FinanceState, today: IsoDate): Criterion {
  const base = { id: "anticipation" as const, label: "Anticipation", max: CRITERION_MAX };
  const due = sum(upcoming(state, today, HORIZON).map((u) => u.amount));
  if (due === 0) {
    return { ...base, points: CRITERION_MAX, explanation: "Aucune dépense connue dans les 30 prochains jours." };
  }
  const cash = available(state, today);
  const coverage = cash / due;
  const points = scale(coverage, 0.5, 1);
  const explanation =
    coverage >= 1
      ? `Tes ${euros(due)} de dépenses à venir sont couvertes.`
      : `Tu as ${euros(Math.max(0, cash))} pour ${euros(due)} de dépenses à venir (${percent(Math.max(0, coverage))} couvert).`;
  return { ...base, points, explanation };
}

export function reserve(state: FinanceState, today: IsoDate): Criterion {
  const base = { id: "reserve" as const, label: "Réserve", max: CRITERION_MAX };
  const target = reserveTarget(state, today);
  const balance = Math.max(0, reserveBalance(state, today));
  const ratio = target > 0 ? balance / target : 1;
  const points = scale(ratio, 0, 1);
  const explanation =
    ratio >= 1
      ? `Ta réserve de ${euros(balance)} atteint sa cible.`
      : `Réserve à ${percent(ratio)} de sa cible (${euros(balance)} sur ${euros(target)}).`;
  return { ...base, points, explanation };
}

export function rythme(state: FinanceState, today: IsoDate): Criterion {
  const base = { id: "rythme" as const, label: "Rythme", max: CRITERION_MAX };
  const budget = state.settings.monthlyBudget;
  if (budget === undefined) {
    return { ...base, points: null, explanation: "Fixe un budget mensuel pour suivre ton rythme de dépense." };
  }
  const { y, m, d } = parts(today);
  const monthStart = makeIso(y, m, 1);
  const spent = variableSpendingBetween(state, monthStart, today);
  if (budget <= 0) {
    const points = spent > 0 ? 0 : CRITERION_MAX;
    return { ...base, points, explanation: points ? "Aucune dépense courante ce mois-ci." : `${euros(spent)} dépensés pour un budget de 0 €.` };
  }
  // Les premiers jours du mois, une projection serait trop bruitée : on compare au budget entier.
  const projected = d < 5 ? spent : Math.round((spent * daysInMonth(y, m)) / d);
  const overrun = projected / budget - 1;
  const points = Math.round((CRITERION_MAX - scale(overrun, 0, 0.2)) * 10) / 10;
  const explanation =
    overrun <= 0
      ? `${euros(spent)} dépensés sur ${euros(budget)} : tu es dans le rythme.`
      : `À ce rythme, tu dépenserais environ ${euros(projected)} ce mois-ci pour un budget de ${euros(budget)}.`;
  return { ...base, points, explanation };
}

export function hasAnyIncome(state: FinanceState): boolean {
  return (
    state.transactions.some((t) => t.kind === "in") ||
    state.recurrings.some((r) => r.kind === "in")
  );
}

export function computeHealth(state: FinanceState, today: IsoDate): Health {
  const criteria = [
    equilibre(state, today),
    anticipation(state, today),
    reserve(state, today),
    rythme(state, today),
  ];
  const scored = criteria.filter((c) => c.points !== null);
  const score =
    scored.length === 0
      ? null
      : Math.round((sum(scored.map((c) => c.points as number)) / (scored.length * CRITERION_MAX)) * 100);
  const calibrating = daysOfData(state, today) < CALIBRATION_DAYS || !hasAnyIncome(state);
  return { score, calibrating, criteria };
}

/** Les critères qui font perdre des points, du plus coûteux au moins coûteux. */
export function healthLosses(health: Health): Criterion[] {
  return health.criteria
    .filter((c) => c.points !== null && c.points < c.max)
    .sort((a, b) => (a.points as number) - (b.points as number));
}

import { addDays, daysBetween, parts, type IsoDate } from "./dates.ts";
import {
  incomeBetween,
  isActive,
  monthlyEquivalent,
  reserveBalance,
  reserveTarget,
} from "./finances.ts";
import { euros } from "./format.ts";
import { CATEGORY_LABELS, type Category, type Cents, type FinanceState } from "./types.ts";

/**
 * Les Glitchs du réseau Nexa matérialisent des mécanismes financiers.
 * Ils sont détectés uniquement à partir des données réelles de l'Opérateur,
 * ne modifient jamais ses finances, et ne sont « neutralisés » que lorsqu'un
 * changement réel est constaté dans ses données.
 */

export type GlitchType = "siphon" | "boucle" | "faille";

export type Glitch =
  | {
      id: string;
      type: "siphon";
      detectedOn: IsoDate;
      category: Category;
      count: number;
      total: Cents;
      message: string;
      action: string;
    }
  | {
      id: string;
      type: "boucle";
      detectedOn: IsoDate;
      recurringId: string;
      /** confirmed = l'Opérateur a dit ne pas s'en servir ; suspected = question pas encore posée. */
      status: "confirmed" | "suspected";
      monthlyCost: Cents;
      message: string;
      action: string;
    }
  | {
      id: string;
      type: "faille";
      detectedOn: IsoDate;
      transactionId: string;
      amount: Cents;
      reserve: Cents;
      target: Cents;
      message: string;
      action: string;
    };

export const GLITCH_NAMES: Record<GlitchType, string> = {
  siphon: "Le Siphon",
  boucle: "La Boucle",
  faille: "La Faille",
};

const WINDOW = 30;
/** Une « petite » dépense pour le Siphon : 5 € ou moins. */
export const SIPHON_SMALL: Cents = 500;
export const SIPHON_MIN_COUNT = 4;
export const SIPHON_MIN_TOTAL: Cents = 1000;
/** Le Siphon est neutralisé si la catégorie baisse d'au moins 30 % sur les 30 jours suivants. */
export const SIPHON_NEUTRAL_RATIO = 0.7;
/** Un abonnement sans réponse devient suspect après 30 jours. */
export const BOUCLE_DELAY_DAYS = 30;
export const FAILLE_MIN_AMOUNT: Cents = 1500;

function monthKey(date: IsoDate): string {
  const { y, m } = parts(date);
  return `${y}-${String(m).padStart(2, "0")}`;
}

function smallSpendingByCategory(state: FinanceState, from: IsoDate, to: IsoDate) {
  const groups = new Map<Category, { count: number; total: Cents }>();
  for (const t of state.transactions) {
    if (t.kind !== "out" || t.planned || t.paidByRelative) continue;
    if (t.date < from || t.date > to || t.amount > SIPHON_SMALL) continue;
    const g = groups.get(t.category) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += t.amount;
    groups.set(t.category, g);
  }
  return groups;
}

export function detectSiphons(state: FinanceState, today: IsoDate): Glitch[] {
  const from = addDays(today, 1 - WINDOW);
  const income = incomeBetween(state, from, today);
  const threshold = Math.max(SIPHON_MIN_TOTAL, Math.round(income * 0.1));
  const found: Glitch[] = [];
  for (const [category, g] of smallSpendingByCategory(state, from, today)) {
    if (g.count < SIPHON_MIN_COUNT || g.total < threshold) continue;
    found.push({
      id: `siphon:${category}:${monthKey(today)}`,
      type: "siphon",
      detectedOn: today,
      category,
      count: g.count,
      total: g.total,
      message: `${g.count} petites dépenses « ${CATEGORY_LABELS[category]} » en 30 jours : ${euros(g.total)} au total.`,
      action: "Fixe-toi un plafond pour cette catégorie le mois prochain.",
    });
  }
  return found;
}

export function detectBoucles(state: FinanceState, today: IsoDate): Glitch[] {
  const found: Glitch[] = [];
  for (const rec of state.recurrings) {
    if (rec.kind !== "out" || !rec.isSubscription || !isActive(rec, today)) continue;
    if (rec.used === true) continue;
    const status = rec.used === false ? "confirmed" : "suspected";
    if (status === "suspected" && daysBetween(rec.startDate, today) < BOUCLE_DELAY_DAYS) continue;
    const monthlyCost = monthlyEquivalent(rec);
    found.push({
      id: `boucle:${rec.id}`,
      type: "boucle",
      detectedOn: today,
      recurringId: rec.id,
      status,
      monthlyCost,
      message:
        status === "confirmed"
          ? `${rec.label} te coûte ${euros(monthlyCost)} par mois (${euros(monthlyCost * 12)} par an) et tu ne t'en sers pas.`
          : `${rec.label} : ${euros(monthlyCost)} par mois. Tu t'en sers vraiment ?`,
      action: status === "confirmed" ? "Résilie-le, puis indique la date de fin." : "Réponds : je l'utilise, ou non.",
    });
  }
  return found;
}

export function detectFailles(state: FinanceState, today: IsoDate): Glitch[] {
  const from = addDays(today, 1 - WINDOW);
  const target = reserveTarget(state, today);
  const reserve = reserveBalance(state, today);
  if (reserve >= target / 2) return [];
  const income = incomeBetween(state, from, today);
  const threshold = Math.max(FAILLE_MIN_AMOUNT, Math.round(income * 0.15));
  const shocks = state.transactions.filter(
    (t) => t.kind === "out" && !t.planned && !t.paidByRelative && t.date >= from && t.date <= today && t.amount >= threshold,
  );
  if (shocks.length === 0) return [];
  const biggest = shocks.reduce((a, b) => (b.amount > a.amount ? b : a));
  return [
    {
      id: `faille:${biggest.id}`,
      type: "faille",
      detectedOn: today,
      transactionId: biggest.id,
      amount: biggest.amount,
      reserve,
      target,
      message: `Une dépense imprévue de ${euros(biggest.amount)} est tombée alors que ta réserve n'est qu'à ${euros(Math.max(0, reserve))}.`,
      action: `Remonte ta réserve à ${euros(Math.ceil(target / 2))} (la moitié de sa cible).`,
    },
  ];
}

export function detectGlitches(state: FinanceState, today: IsoDate): Glitch[] {
  return [...detectFailles(state, today), ...detectBoucles(state, today), ...detectSiphons(state, today)];
}

/**
 * Vrai quand les données montrent que le problème est réellement traité.
 * C'est la seule condition pour gagner l'XP de neutralisation.
 */
export function isNeutralized(state: FinanceState, glitch: Glitch, today: IsoDate): boolean {
  switch (glitch.type) {
    case "siphon": {
      // On attend au moins 21 jours pour juger d'un vrai changement d'habitude.
      if (daysBetween(glitch.detectedOn, today) < 21) return false;
      const from = addDays(glitch.detectedOn, 1);
      const to = addDays(glitch.detectedOn, WINDOW);
      const after = smallSpendingByCategory(state, from, to < today ? to : today).get(glitch.category);
      const days = Math.min(WINDOW, daysBetween(glitch.detectedOn, today));
      const projected = ((after?.total ?? 0) * WINDOW) / days;
      return projected <= glitch.total * SIPHON_NEUTRAL_RATIO;
    }
    case "boucle": {
      const rec = state.recurrings.find((r) => r.id === glitch.recurringId);
      // Une fiche supprimée ne prouve pas une résiliation : il faut une date de fin.
      if (!rec) return false;
      return rec.endDate !== undefined && rec.endDate <= addDays(today, 31);
    }
    case "faille":
      return reserveBalance(state, today) >= Math.ceil(glitch.target / 2);
  }
}

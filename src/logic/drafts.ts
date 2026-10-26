import { addDays, isIsoDate, type IsoDate } from "../engine/dates.ts";
import {
  CATEGORY_LABELS,
  type Category,
  type Frequency,
  type IncomeSource,
  type Recurring,
  type Transaction,
} from "../engine/types.ts";
import { parseAmount } from "./amount.ts";

export type EntryKind = "out" | "in" | "save" | "withdraw";

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  poche: "Argent de poche",
  job: "Petit boulot",
  cadeau: "Cadeau",
  autre: "Autre rentrée",
};

/** Ce que l'écran de saisie a rempli, avant validation. */
export type EntryDraft = {
  kind: EntryKind;
  amountText: string;
  date: IsoDate;
  label?: string;
  category?: Category;
  source?: IncomeSource;
  planned?: boolean;
  paidByRelative?: boolean;
  /** Pour une mise de côté : absent = réserve, sinon l'objectif visé. */
  goalId?: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Construit une opération à partir d'un brouillon, ou explique pourquoi c'est impossible. */
export function buildTransaction(draft: EntryDraft, id: string): Result<Transaction> {
  const amount = parseAmount(draft.amountText);
  if (amount === null) return { ok: false, error: "Indique un montant." };
  if (!isIsoDate(draft.date)) return { ok: false, error: "Date invalide." };
  const label = draft.label?.trim();
  switch (draft.kind) {
    case "out": {
      if (!draft.category) return { ok: false, error: "Choisis une catégorie." };
      return {
        ok: true,
        value: {
          id,
          kind: "out",
          amount,
          date: draft.date,
          label: label || CATEGORY_LABELS[draft.category],
          category: draft.category,
          ...(draft.planned ? { planned: true } : {}),
          ...(draft.paidByRelative ? { paidByRelative: true } : {}),
        },
      };
    }
    case "in": {
      const source = draft.source ?? "autre";
      return {
        ok: true,
        value: { id, kind: "in", amount, date: draft.date, label: label || INCOME_SOURCE_LABELS[source], source },
      };
    }
    case "save":
    case "withdraw":
      return {
        ok: true,
        value: { id, kind: draft.kind, amount, date: draft.date, ...(draft.goalId ? { goalId: draft.goalId } : {}) },
      };
  }
}

export type RecurringDraft = {
  kind: "in" | "out";
  label: string;
  amountText: string;
  frequency: Frequency;
  startDate: IsoDate;
  category?: Category;
  isSubscription?: boolean;
};

export function buildRecurring(draft: RecurringDraft, id: string): Result<Recurring> {
  const amount = parseAmount(draft.amountText);
  const label = draft.label.trim();
  if (!label) return { ok: false, error: "Donne-lui un nom." };
  if (amount === null) return { ok: false, error: "Indique un montant." };
  if (!isIsoDate(draft.startDate)) return { ok: false, error: "Date invalide." };
  if (draft.kind === "out" && !draft.category) return { ok: false, error: "Choisis une catégorie." };
  return {
    ok: true,
    value: {
      id,
      kind: draft.kind,
      label,
      amount,
      frequency: draft.frequency,
      startDate: draft.startDate,
      ...(draft.kind === "out" ? { category: draft.category } : {}),
      ...(draft.kind === "out" && draft.isSubscription ? { isSubscription: true } : {}),
    },
  };
}

/** Échéance d'un objectif à partir d'un nombre de semaines. */
export function deadlineIn(today: IsoDate, weeks: number): IsoDate {
  return addDays(today, weeks * 7);
}

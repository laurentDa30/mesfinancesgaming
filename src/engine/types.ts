import type { IsoDate } from "./dates.ts";

/** Montants toujours en centimes entiers : 4,99 € = 499. */
export type Cents = number;

export const CATEGORIES = [
  "nourriture",
  "sorties",
  "jeux",
  "vetements",
  "transport",
  "telephone",
  "cadeaux",
  "autre",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  nourriture: "Nourriture & snacks",
  sorties: "Sorties",
  jeux: "Jeux & applis",
  vetements: "Vêtements",
  transport: "Transport",
  telephone: "Téléphone",
  cadeaux: "Cadeaux",
  autre: "Autre",
};

export type IncomeSource = "poche" | "job" | "cadeau" | "autre";

/**
 * Opération ponctuelle.
 * - `in` : rentrée d'argent.
 * - `out` : dépense. `planned` = prévue à l'avance (elle ne pénalise jamais la santé).
 *   `paidByRelative` = payée par un proche : affichée mais hors budget.
 * - `save` : argent mis de côté vers la réserve (`goalId` absent) ou un objectif.
 * - `withdraw` : argent repris depuis la réserve ou un objectif.
 */
export type Transaction =
  | {
      id: string;
      kind: "in";
      amount: Cents;
      date: IsoDate;
      label: string;
      source: IncomeSource;
    }
  | {
      id: string;
      kind: "out";
      amount: Cents;
      date: IsoDate;
      label: string;
      category: Category;
      planned?: boolean;
      paidByRelative?: boolean;
    }
  | {
      id: string;
      kind: "save" | "withdraw";
      amount: Cents;
      date: IsoDate;
      goalId?: string;
    };

export type Frequency = "weekly" | "monthly" | "yearly";

/**
 * Rentrée ou dépense qui revient : argent de poche, forfait, abonnement.
 * `used` ne concerne que les abonnements : `true` je m'en sers, `false` non,
 * absent = pas encore répondu.
 */
export type Recurring = {
  id: string;
  kind: "in" | "out";
  label: string;
  amount: Cents;
  frequency: Frequency;
  startDate: IsoDate;
  endDate?: IsoDate;
  category?: Category;
  isSubscription?: boolean;
  used?: boolean;
};

export type Goal = {
  id: string;
  label: string;
  target: Cents;
  createdAt: IsoDate;
  deadline: IsoDate;
};

export type Settings = {
  /** Argent disponible au moment où l'Opérateur commence à utiliser l'app. */
  openingBalance: Cents;
  openingDate: IsoDate;
  /** Réserve déjà constituée au départ. */
  openingReserve?: Cents;
  /** Budget mensuel pour les dépenses courantes (hors abonnements et dépenses prévues). */
  monthlyBudget?: Cents;
  /** Cible de réserve choisie ; à défaut, calculée. */
  reserveTarget?: Cents;
};

export type FinanceState = {
  settings: Settings;
  transactions: Transaction[];
  recurrings: Recurring[];
  goals: Goal[];
};

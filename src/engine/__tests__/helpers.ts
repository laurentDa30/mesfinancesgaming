import type { FinanceState, Recurring, Settings, Transaction } from "../types.ts";

let counter = 0;
export const nextId = (prefix = "id"): string => `${prefix}-${++counter}`;

export function makeState(
  settings: Partial<Settings> = {},
  transactions: Transaction[] = [],
  recurrings: Recurring[] = [],
): FinanceState {
  return {
    settings: { openingBalance: 0, openingDate: "2026-09-01", ...settings },
    transactions,
    recurrings,
    goals: [],
  };
}

export const out = (
  date: string,
  amount: number,
  extra: Partial<Extract<Transaction, { kind: "out" }>> = {},
): Transaction => ({
  id: nextId("out"),
  kind: "out",
  date,
  amount,
  label: "Dépense",
  category: "autre",
  ...extra,
});

export const inc = (date: string, amount: number): Transaction => ({
  id: nextId("in"),
  kind: "in",
  date,
  amount,
  label: "Rentrée",
  source: "autre",
});

export const save = (date: string, amount: number, goalId?: string): Transaction => ({
  id: nextId("save"),
  kind: "save",
  date,
  amount,
  ...(goalId ? { goalId } : {}),
});

export const pocketMoney = (amount: number, startDate = "2026-09-01"): Recurring => ({
  id: nextId("rec"),
  kind: "in",
  label: "Argent de poche",
  amount,
  frequency: "monthly",
  startDate,
});

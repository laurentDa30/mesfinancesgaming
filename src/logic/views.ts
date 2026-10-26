import { daysInMonth, type IsoDate } from "../engine/dates.ts";
import { occurrences } from "../engine/finances.ts";
import type { Category, Cents, FinanceState } from "../engine/types.ts";

export type Line = {
  key: string;
  date: IsoDate;
  label: string;
  /** Positif pour une entrée d'argent disponible, négatif pour une sortie. */
  signed: Cents;
  kind: "in" | "out" | "save" | "withdraw";
  origin: "transaction" | "recurring";
  /** Identifiant de l'opération (pour la supprimer) ou de la récurrence. */
  refId: string;
  category?: Category;
  planned?: boolean;
  paidByRelative?: boolean;
  goalId?: string;
};

export type MonthView = {
  lines: Line[];
  totalIn: Cents;
  totalOut: Cents;
  totalSaved: Cents;
};

/** Toutes les lignes d'un mois « AAAA-MM », opérations et récurrences, les plus récentes d'abord. */
export function monthView(state: FinanceState, month: string): MonthView {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  const start = state.settings.openingDate > from ? state.settings.openingDate : from;
  const lines: Line[] = [];

  for (const t of state.transactions) {
    if (t.date < start || t.date > to) continue;
    if (t.kind === "out") {
      lines.push({
        key: t.id,
        date: t.date,
        label: t.label,
        signed: t.paidByRelative ? 0 : -t.amount,
        kind: "out",
        origin: "transaction",
        refId: t.id,
        category: t.category,
        ...(t.planned ? { planned: true } : {}),
        ...(t.paidByRelative ? { paidByRelative: true } : {}),
      });
    } else if (t.kind === "in") {
      lines.push({ key: t.id, date: t.date, label: t.label, signed: t.amount, kind: "in", origin: "transaction", refId: t.id });
    } else {
      lines.push({
        key: t.id,
        date: t.date,
        label: t.kind === "save" ? "Mise de côté" : "Argent repris",
        signed: t.kind === "save" ? -t.amount : t.amount,
        kind: t.kind,
        origin: "transaction",
        refId: t.id,
        ...(t.goalId ? { goalId: t.goalId } : {}),
      });
    }
  }

  for (const rec of state.recurrings) {
    if (start > to) break;
    for (const date of occurrences(rec, start, to)) {
      lines.push({
        key: `${rec.id}@${date}`,
        date,
        label: rec.label,
        signed: rec.kind === "in" ? rec.amount : -rec.amount,
        kind: rec.kind,
        origin: "recurring",
        refId: rec.id,
        ...(rec.category ? { category: rec.category } : {}),
      });
    }
  }

  lines.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? 1 : -1));
  let totalIn = 0;
  let totalOut = 0;
  let totalSaved = 0;
  for (const l of lines) {
    if (l.kind === "in") totalIn += l.signed;
    else if (l.kind === "out") totalOut -= l.signed;
    else totalSaved -= l.signed;
  }
  return { lines, totalIn, totalOut, totalSaved };
}

/** Regroupe des lignes par jour, dans l'ordre reçu. */
export function groupByDay(lines: Line[]): { date: IsoDate; lines: Line[] }[] {
  const groups: { date: IsoDate; lines: Line[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.date === line.date) last.lines.push(line);
    else groups.push({ date: line.date, lines: [line] });
  }
  return groups;
}

/** Prochaine échéance d'une récurrence à partir d'aujourd'hui inclus, ou null si elle est terminée. */
export function nextOccurrence(
  rec: FinanceState["recurrings"][number],
  today: IsoDate,
): IsoDate | null {
  const horizon = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  return occurrences(rec, today, horizon)[0] ?? null;
}

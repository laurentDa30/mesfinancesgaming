import { isIsoDate, makeIso, type IsoDate } from "../engine/dates.ts";

/** Date du jour dans le fuseau du téléphone (et non en UTC). */
export function localToday(now: Date = new Date()): IsoDate {
  return makeIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 2026-10 » → « octobre 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1] ?? ""} ${y}`;
}

/** « 2026-10-26 » → « 26 oct. ». */
export function shortDate(date: IsoDate): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  const name = MONTHS[m - 1] ?? "";
  return `${d} ${name.length > 4 ? `${name.slice(0, name === "juillet" ? 4 : 3)}.` : name}`;
}

/** Lit « 26/10 » ou « 26/10/2026 » (année en cours par défaut). Renvoie null si la date est invalide. */
export function parseDayMonth(text: string, today: IsoDate): IsoDate | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const year = match[3] ? Number(match[3]) : Number(today.slice(0, 4));
  const iso = makeIso(year, Number(match[2]), Number(match[1]));
  return isIsoDate(iso) ? iso : null;
}

/** Décale un mois « AAAA-MM » de n mois. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

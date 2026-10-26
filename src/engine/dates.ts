/**
 * Dates au format ISO « AAAA-MM-JJ », calculées en jours UTC pour éviter
 * tout décalage de fuseau horaire.
 */
export type IsoDate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  return toIso(toDayNumber(value)) === value;
}

/** Nombre de jours depuis le 1970-01-01. */
export function toDayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function toIso(dayNumber: number): IsoDate {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(toDayNumber(date) + days);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parts(date: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

export function makeIso(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ajoute des mois en gardant le jour d'ancrage, ramené au dernier jour du mois si besoin. */
export function addMonths(date: IsoDate, months: number, anchorDay?: number): IsoDate {
  const { y, m, d } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return makeIso(ny, nm, day);
}

/** Semaine ISO, ex. « 2026-W44 ». Sert à limiter les actions hebdomadaires. */
export function isoWeek(date: IsoDate): string {
  const day = toDayNumber(date);
  const weekday = (((day + 3) % 7) + 7) % 7; // 0 = lundi
  const thursday = day - weekday + 3;
  const year = parts(toIso(thursday)).y;
  const jan4 = toDayNumber(makeIso(year, 1, 4));
  const jan4Weekday = (((jan4 + 3) % 7) + 7) % 7;
  const week = 1 + Math.floor((thursday - (jan4 - jan4Weekday + 3)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Vrai si `date` est dans l'intervalle [from, to] (bornes incluses). */
export function inRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return date >= from && date <= to;
}

import type { Cents } from "./types.ts";

/** 1299 → « 12,99 € » ; -500 → « −5,00 € ». */
export function euros(amount: Cents): string {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(Math.round(amount));
  const units = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${units},${String(abs % 100).padStart(2, "0")} €`;
}

/** 0.6 → « 60 % ». */
export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

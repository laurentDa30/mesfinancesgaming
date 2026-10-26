import type { Cents } from "../engine/types.ts";

/** Montant maximal accepté à la saisie : 99 999,99 €. */
export const MAX_AMOUNT: Cents = 9_999_999;

/**
 * Lit un montant tapé par l'utilisateur (« 4,99 », « 4.99 », « 12 », « 1 250 »)
 * et le renvoie en centimes. Renvoie null si la saisie est invalide ou nulle.
 */
export function parseAmount(text: string): Cents | null {
  const clean = text.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [units = "0", decimals = ""] = clean.split(".");
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_AMOUNT) return null;
  return cents;
}

/**
 * Applique une touche du pavé numérique au texte en cours.
 * Touches : « 0 » à « 9 », « , » et « ⌫ ». Refuse ce qui donnerait un montant invalide.
 */
export function pressKey(current: string, key: string): string {
  if (key === "⌫") return current.slice(0, -1);
  if (key === ",") {
    if (current.includes(",")) return current;
    return current === "" ? "0," : `${current},`;
  }
  if (!/^\d$/.test(key)) return current;
  const [, decimals] = current.split(",");
  if (decimals !== undefined && decimals.length >= 2) return current;
  const next = current === "0" ? key : current + key;
  // Trop grand : on ignore la touche.
  if (Math.round(Number(next.replace(",", ".")) * 100) > MAX_AMOUNT) return current;
  return next;
}

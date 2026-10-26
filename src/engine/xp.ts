import { addDays, daysBetween, isoWeek, toDayNumber, toIso, type IsoDate } from "./dates.ts";
import { reserveBalance } from "./finances.ts";
import type { FinanceState } from "./types.ts";

/**
 * Système d'XP : une couche séparée, qui ne lit les finances que pour vérifier
 * des comportements et ne les modifie jamais. Dépenser, gagner plus ou épargner
 * une grosse somme d'un coup ne rapporte rien.
 *
 * L'app enregistre des événements ; `computeProgress` les rejoue avec les
 * plafonds, de façon déterministe. Rejouer deux fois le même événement ne
 * rapporte jamais deux fois.
 */

export const XP = {
  /** Connexion + Ravitaillement doivent rester sous un tiers de l'XP d'un mois actif (testé). */
  login: 4,
  ravitaillement: 20,
  entry: 2,
  entryDailyCap: 10,
  weeklyReview: 20,
  glitch: 40,
  glitchWeeklyCap: 2,
  goalMin: 30,
  goalMax: 80,
  goalMinDays: 21,
  missionMin: 15,
  missionMax: 50,
  reserveStreak: 30,
} as const;

/** Un Ravitaillement tous les 7 jours de connexion cumulés (pas forcément consécutifs). */
export const RAVITAILLEMENT_EVERY = 7;

/** Récompenses cosmétiques du Ravitaillement, connues à l'avance et jamais tirées au sort. */
export const RAVITAILLEMENT_TRACK = [
  { id: "veste-neon", label: "Veste néon" },
  { id: "lampe-qg", label: "Lampe de QG" },
  { id: "casquette-holo", label: "Casquette holo" },
  { id: "poster-nexa", label: "Poster Nexa" },
  { id: "baskets-led", label: "Baskets LED" },
  { id: "plante-bio", label: "Plante bioluminescente" },
  { id: "drone-skin-cyan", label: "Coque de drone cyan" },
  { id: "ecran-qg", label: "Écran mural du QG" },
  { id: "gants-tactiles", label: "Gants tactiles" },
  { id: "tapis-grille", label: "Tapis grille" },
  { id: "visiere-ambre", label: "Visière ambre" },
  { id: "drone-skin-violet", label: "Coque de drone violette" },
] as const;

export type XpEvent =
  | { type: "login"; date: IsoDate }
  | { type: "entry"; date: IsoDate; ref: string }
  | { type: "weekly_review"; date: IsoDate }
  | { type: "glitch_neutralized"; date: IsoDate; ref: string }
  | { type: "goal_completed"; date: IsoDate; ref: string; startedOn: IsoDate }
  | { type: "mission"; date: IsoDate; ref: string; xp: number }
  | { type: "reserve_streak"; date: IsoDate; ref: string };

export type LedgerLine = {
  date: IsoDate;
  source: XpEvent["type"] | "ravitaillement";
  xp: number;
  /** Raison lisible : pourquoi ces points, ou pourquoi aucun. */
  note: string;
};

export type Ravitaillement = {
  number: number;
  date: IsoDate;
  xp: number;
  reward: { id: string; label: string } | null;
};

export type Gender = "f" | "m" | "n";

export type Progress = {
  total: number;
  level: number;
  title: string;
  /** XP cumulée nécessaire pour le niveau suivant. */
  nextLevelAt: number;
  /** XP cumulée au début du niveau actuel. */
  levelStartsAt: number;
  loginDays: number;
  /** Connexions restantes avant le prochain Ravitaillement (1 à 7). */
  nextRavitaillementIn: number;
  ravitaillements: Ravitaillement[];
  ledger: LedgerLine[];
};

/** XP cumulée pour atteindre le niveau n : 100 × n^1,4 (niveau 1 = 0). */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * level ** 1.4);
}

export function levelFor(total: number): number {
  let level = 1;
  while (levelThreshold(level + 1) <= total) level += 1;
  return level;
}

const TITLES: { from: number; f: string; m: string; n: string }[] = [
  { from: 1, f: "Recrue", m: "Recrue", n: "Recrue" },
  { from: 3, f: "Éclaireuse", m: "Éclaireur", n: "Éclaireur·se" },
  { from: 5, f: "Opératrice", m: "Opérateur", n: "Opérateur·rice" },
  { from: 8, f: "Stratège", m: "Stratège", n: "Stratège" },
  { from: 12, f: "Architecte", m: "Architecte", n: "Architecte" },
];

export function titleFor(level: number, gender: Gender = "n"): string {
  let title = TITLES[0]!;
  for (const t of TITLES) if (level >= t.from) title = t;
  return title[gender];
}

export function goalXp(days: number): number {
  if (days < XP.goalMinDays) return 0;
  const weeks = Math.floor(days / 7);
  return Math.min(XP.goalMax, Math.max(XP.goalMin, XP.goalMin + (weeks - 3) * 10));
}

const ORDER: Record<XpEvent["type"], number> = {
  login: 0,
  entry: 1,
  weekly_review: 2,
  mission: 3,
  goal_completed: 4,
  glitch_neutralized: 5,
  reserve_streak: 6,
};

export function computeProgress(events: XpEvent[], gender: Gender = "n"): Progress {
  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : ORDER[a.e.type] - ORDER[b.e.type] || a.i - b.i,
    )
    .map(({ e }) => e);

  const ledger: LedgerLine[] = [];
  const ravitaillements: Ravitaillement[] = [];
  const loginDates = new Set<string>();
  const seenRefs = new Set<string>();
  const entryXpByDay = new Map<string, number>();
  const reviewWeeks = new Set<string>();
  const glitchesByWeek = new Map<string, number>();
  let total = 0;

  const grant = (date: IsoDate, source: LedgerLine["source"], xp: number, note: string) => {
    ledger.push({ date, source, xp, note });
    total += xp;
  };
  const once = (key: string): boolean => {
    if (seenRefs.has(key)) return false;
    seenRefs.add(key);
    return true;
  };

  for (const e of sorted) {
    switch (e.type) {
      case "login": {
        if (loginDates.has(e.date)) break;
        loginDates.add(e.date);
        grant(e.date, "login", XP.login, "Connexion du jour");
        if (loginDates.size % RAVITAILLEMENT_EVERY === 0) {
          const number = loginDates.size / RAVITAILLEMENT_EVERY;
          const reward = RAVITAILLEMENT_TRACK[number - 1] ?? null;
          ravitaillements.push({ number, date: e.date, xp: XP.ravitaillement, reward: reward ? { ...reward } : null });
          grant(e.date, "ravitaillement", XP.ravitaillement, `Ravitaillement n°${number}${reward ? ` : ${reward.label}` : ""}`);
        }
        break;
      }
      case "entry": {
        if (!once(`entry:${e.ref}`)) break;
        const used = entryXpByDay.get(e.date) ?? 0;
        const xp = Math.min(XP.entry, XP.entryDailyCap - used);
        if (xp <= 0) {
          grant(e.date, "entry", 0, "Plafond de saisie du jour atteint");
          break;
        }
        entryXpByDay.set(e.date, used + xp);
        grant(e.date, "entry", xp, "Opération saisie");
        break;
      }
      case "weekly_review": {
        const week = isoWeek(e.date);
        if (reviewWeeks.has(week)) break;
        reviewWeeks.add(week);
        grant(e.date, "weekly_review", XP.weeklyReview, "Revue de la semaine");
        break;
      }
      case "glitch_neutralized": {
        if (!once(`glitch:${e.ref}`)) break;
        const week = isoWeek(e.date);
        const count = glitchesByWeek.get(week) ?? 0;
        if (count >= XP.glitchWeeklyCap) {
          grant(e.date, "glitch_neutralized", 0, "Glitch neutralisé (plafond de la semaine atteint)");
          break;
        }
        glitchesByWeek.set(week, count + 1);
        grant(e.date, "glitch_neutralized", XP.glitch, "Glitch neutralisé");
        break;
      }
      case "goal_completed": {
        if (!once(`goal:${e.ref}`)) break;
        const xp = goalXp(daysBetween(e.startedOn, e.date));
        grant(e.date, "goal_completed", xp, xp ? "Objectif tenu jusqu'au bout" : "Objectif trop court pour rapporter de l'XP (3 semaines minimum)");
        break;
      }
      case "mission": {
        if (!once(`mission:${e.ref}`)) break;
        const xp = Math.min(XP.missionMax, Math.max(XP.missionMin, Math.round(e.xp)));
        grant(e.date, "mission", xp, "Mission terminée");
        break;
      }
      case "reserve_streak": {
        if (!once(`streak:${e.ref}`)) break;
        grant(e.date, "reserve_streak", XP.reserveStreak, "Réserve en progression 4 semaines d'affilée");
        break;
      }
    }
  }

  const level = levelFor(total);
  const loginDays = loginDates.size;
  return {
    total,
    level,
    title: titleFor(level, gender),
    levelStartsAt: levelThreshold(level),
    nextLevelAt: levelThreshold(level + 1),
    loginDays,
    nextRavitaillementIn: RAVITAILLEMENT_EVERY - (loginDays % RAVITAILLEMENT_EVERY),
    ravitaillements,
    ledger,
  };
}

/**
 * Événements « réserve en progression » : un par bloc de 4 semaines complètes
 * d'affilée où la réserve finit plus haut que la semaine d'avant, quel que soit
 * le montant ajouté. Seules les semaines terminées (avant celle de `today`) comptent.
 */
export function reserveStreakEvents(state: FinanceState, today: IsoDate): XpEvent[] {
  const day = toDayNumber(today);
  const weekday = (((day + 3) % 7) + 7) % 7; // 0 = lundi
  const lastSunday = day - weekday - 1;
  const firstSunday = toDayNumber(state.settings.openingDate);
  const events: XpEvent[] = [];
  let streak = 0;
  // Point de comparaison de la première semaine : la réserve au départ.
  let previous: number | null = state.settings.openingReserve ?? 0;
  for (let sunday = lastSunday - 7 * 104; sunday <= lastSunday; sunday += 7) {
    if (sunday < firstSunday) continue;
    const date = toIso(sunday);
    const balance = reserveBalance(state, date);
    if (previous !== null && balance > previous) {
      streak += 1;
      if (streak % 4 === 0) {
        events.push({ type: "reserve_streak", date: addDays(date, 1), ref: isoWeek(date) });
      }
    } else if (previous !== null) {
      streak = 0;
    }
    previous = balance;
  }
  return events;
}

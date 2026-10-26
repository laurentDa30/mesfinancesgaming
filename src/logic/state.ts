import type { IsoDate } from "../engine/dates.ts";
import { goalSaved } from "../engine/finances.ts";
import type { FinanceState, Goal, Recurring, Settings, Transaction } from "../engine/types.ts";
import type { Gender, XpEvent } from "../engine/xp.ts";

/**
 * État complet de l'app, tel qu'il est enregistré sur le téléphone.
 * Les finances et les événements d'XP restent deux blocs séparés.
 */
export type AppState = {
  version: 1;
  profile: { gender: Gender; pseudo?: string };
  finance: FinanceState;
  events: XpEvent[];
};

export type Action =
  | { type: "hydrate"; state: AppState | null }
  | { type: "init"; settings: Settings; profile: AppState["profile"]; recurrings?: Recurring[] }
  | { type: "login"; today: IsoDate }
  | { type: "addTransaction"; tx: Transaction; today: IsoDate }
  | { type: "removeTransaction"; id: string }
  | { type: "addRecurring"; rec: Recurring }
  | { type: "setSubscriptionUsed"; id: string; used: boolean }
  | { type: "endRecurring"; id: string; endDate: IsoDate }
  | { type: "removeRecurring"; id: string }
  | { type: "addGoal"; goal: Goal }
  | { type: "removeGoal"; id: string; today: IsoDate }
  | { type: "updateSettings"; settings: Partial<Settings> };

export function initialState(settings: Settings, profile: AppState["profile"], recurrings: Recurring[] = []): AppState {
  return {
    version: 1,
    profile,
    finance: { settings, transactions: [], recurrings, goals: [] },
    events: [],
  };
}

/** Réducteur pur : la même action sur le même état donne toujours le même résultat. */
export function reduce(state: AppState | null, action: Action): AppState | null {
  if (action.type === "hydrate") return action.state;
  if (action.type === "init") return initialState(action.settings, action.profile, action.recurrings);
  if (!state) return state;
  const f = state.finance;
  const withFinance = (finance: FinanceState): AppState => ({ ...state, finance });

  switch (action.type) {
    case "login":
      // Un seul événement de connexion par jour est conservé.
      if (state.events.some((e) => e.type === "login" && e.date === action.today)) return state;
      return { ...state, events: [...state.events, { type: "login", date: action.today }] };

    case "addTransaction": {
      if (f.transactions.some((t) => t.id === action.tx.id)) return state;
      const next = withFinance({ ...f, transactions: [...f.transactions, action.tx] });
      // L'XP récompense le fait de saisir (le jour où l'on saisit), pas le montant.
      return { ...next, events: [...next.events, { type: "entry", date: action.today, ref: action.tx.id }] };
    }

    case "removeTransaction":
      return withFinance({ ...f, transactions: f.transactions.filter((t) => t.id !== action.id) });

    case "addRecurring":
      if (f.recurrings.some((r) => r.id === action.rec.id)) return state;
      return withFinance({ ...f, recurrings: [...f.recurrings, action.rec] });

    case "setSubscriptionUsed":
      return withFinance({
        ...f,
        recurrings: f.recurrings.map((r) => (r.id === action.id ? { ...r, used: action.used } : r)),
      });

    case "endRecurring":
      return withFinance({
        ...f,
        recurrings: f.recurrings.map((r) =>
          r.id === action.id ? { ...r, endDate: action.endDate < r.startDate ? r.startDate : action.endDate } : r,
        ),
      });

    case "removeRecurring":
      return withFinance({ ...f, recurrings: f.recurrings.filter((r) => r.id !== action.id) });

    case "addGoal":
      if (f.goals.some((g) => g.id === action.goal.id)) return state;
      return withFinance({ ...f, goals: [...f.goals, action.goal] });

    case "removeGoal":
      // On ne supprime pas un objectif qui contient encore de l'argent : il serait perdu.
      if (goalSaved(f, action.id, action.today) !== 0) return state;
      return withFinance({ ...f, goals: f.goals.filter((g) => g.id !== action.id) });

    case "updateSettings":
      return withFinance({ ...f, settings: { ...f.settings, ...action.settings } });
  }
}

/** Contrôle minimal d'un état relu depuis le stockage ou importé d'une sauvegarde. */
export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppState>;
  return (
    v.version === 1 &&
    !!v.finance &&
    Array.isArray(v.finance.transactions) &&
    Array.isArray(v.finance.recurrings) &&
    Array.isArray(v.finance.goals) &&
    typeof v.finance.settings?.openingDate === "string" &&
    Array.isArray(v.events)
  );
}

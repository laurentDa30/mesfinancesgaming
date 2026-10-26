import * as Crypto from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import type { IsoDate } from "../engine/dates.ts";
import { reduce, type Action, type AppState } from "../logic/state.ts";
import { localToday } from "../logic/today.ts";
import { loadState, saveState } from "./storage.ts";

type Store = {
  /** false tant que le stockage n'a pas été relu. */
  ready: boolean;
  state: AppState | null;
  today: IsoDate;
  dispatch: (action: Action) => void;
  newId: () => string;
};

const StoreContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<IsoDate>(() => localToday());
  const lastSaved = useRef<AppState | null>(null);

  // 1. Relire le stockage au démarrage.
  useEffect(() => {
    let alive = true;
    loadState()
      .catch(() => null)
      .then((saved) => {
        if (!alive) return;
        lastSaved.current = saved;
        dispatch({ type: "hydrate", state: saved });
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2. Enregistrer chaque changement.
  useEffect(() => {
    if (!ready || state === lastSaved.current) return;
    lastSaved.current = state;
    saveState(state).catch(() => undefined);
  }, [ready, state]);

  // 3. Changer de jour quand l'app revient au premier plan.
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (status) => {
      if (status === "active") setToday(localToday());
    });
    return () => sub.remove();
  }, []);

  // 4. Une connexion par jour (le réducteur ignore les doublons).
  const hasState = state !== null;
  useEffect(() => {
    if (ready && hasState) dispatch({ type: "login", today });
  }, [ready, hasState, today]);

  const newId = useCallback(() => Crypto.randomUUID(), []);
  const value = useMemo(() => ({ ready, state, today, dispatch, newId }), [ready, state, today, newId]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore doit être utilisé dans AppStoreProvider");
  return store;
}

/** Pour les écrans qui ne s'affichent qu'une fois le démarrage fait. */
export function useAppState(): AppState {
  const { state } = useStore();
  if (!state) throw new Error("L'Opérateur n'a pas encore démarré");
  return state;
}

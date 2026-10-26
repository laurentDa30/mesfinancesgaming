import * as SQLite from "expo-sqlite";
import { isAppState, type AppState } from "../logic/state.ts";

/**
 * Stockage local : une base SQLite sur le téléphone, rien n'est envoyé ailleurs.
 * Les données d'un Opérateur tiennent en quelques centaines de Ko : on enregistre
 * l'état complet en JSON dans une seule ligne, ce qui reste simple et atomique.
 */

const DB_NAME = "nexa.db";
const KEY = "state";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await database.execAsync(
        "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);",
      );
      return database;
    })();
  }
  return dbPromise;
}

export async function loadState(): Promise<AppState | null> {
  const row = await (await db()).getFirstAsync<{ v: string }>("SELECT v FROM kv WHERE k = ?", [KEY]);
  if (!row) return null;
  try {
    const parsed: unknown = JSON.parse(row.v);
    return isAppState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

let queue: Promise<void> = Promise.resolve();

/** Enregistre l'état ; les écritures sont faites l'une après l'autre, dans l'ordre. */
export function saveState(state: AppState | null): Promise<void> {
  queue = queue
    .catch(() => undefined)
    .then(async () => {
      const database = await db();
      if (state === null) {
        await database.runAsync("DELETE FROM kv WHERE k = ?", [KEY]);
      } else {
        await database.runAsync(
          "INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
          [KEY, JSON.stringify(state)],
        );
      }
    });
  return queue;
}

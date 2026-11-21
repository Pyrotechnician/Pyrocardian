import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS: string[] = [
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL)",
  `CREATE TABLE IF NOT EXISTS player_cards (
    instance_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('character', 'skill', 'word')),
    def_id TEXT NOT NULL,
    rarity TEXT NOT NULL,
    class_id TEXT,
    name TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS word_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id TEXT NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0,
    interval_ms INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, word_id)
  )`,
  "ALTER TABLE users ADD COLUMN magic_stones INTEGER NOT NULL DEFAULT 0",
  `CREATE TABLE IF NOT EXISTS visitor (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    affinity_points INTEGER NOT NULL DEFAULT 0,
    affinity TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE player_cards_v2 (
    instance_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('character', 'skill', 'word', 'ancient')),
    def_id TEXT NOT NULL,
    rarity TEXT NOT NULL,
    class_id TEXT,
    name TEXT,
    created_at INTEGER NOT NULL
  )`,
  "INSERT INTO player_cards_v2 SELECT * FROM player_cards",
  "DROP TABLE player_cards",
  "ALTER TABLE player_cards_v2 RENAME TO player_cards",
];

export function openDb(dbPath: string): SqliteDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const version = db.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i]);
  }
  db.pragma(`user_version = ${MIGRATIONS.length}`);
  return db;
}

export function getMeta(db: SqliteDatabase, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(db: SqliteDatabase, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

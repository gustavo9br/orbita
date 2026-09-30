import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'todo', 'done')),
    quadrant INTEGER CHECK (quadrant BETWEEN 1 AND 4),
    estimate INTEGER NOT NULL DEFAULT 1,
    context TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    planned_date TEXT,
    ai_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    done_at TEXT,
    notion_page_id TEXT
  );

  CREATE TABLE IF NOT EXISTS pomodoros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    interrupted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'google')),
    external_id TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS checkins (
    date TEXT PRIMARY KEY,
    energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
    sleep_hours REAL,
    habits TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS ai_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('openai', 'claude', 'heuristica')),
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migração: bancos criados antes do suporte à OpenAI têm um CHECK que só aceita 'claude'.
const sqlLog = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'ai_log'").get() as { sql: string }).sql;
if (!sqlLog.includes("'openai'")) {
  db.exec(`
    BEGIN;
    ALTER TABLE ai_log RENAME TO ai_log_antigo;
    CREATE TABLE ai_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('openai', 'claude', 'heuristica')),
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    INSERT INTO ai_log SELECT * FROM ai_log_antigo;
    DROP TABLE ai_log_antigo;
    COMMIT;
  `);
}

export interface Settings {
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Pomodoros de foco que cabem num dia útil, usados pelo planejamento semanal. */
  dailyCapacity: number;
  habits: string[];
  workStart: string;
  workEnd: string;
}

const PADRAO: Settings = {
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  dailyCapacity: 8,
  habits: ["Água (2L)", "Pausa longe da tela", "Exercício", "Desligar às 19h", "Leitura"],
  workStart: "08:00",
  workEnd: "18:00",
};

export function lerSettings(): Settings {
  const linha = db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as { value: string } | undefined;
  return linha ? { ...PADRAO, ...JSON.parse(linha.value) } : PADRAO;
}

export function salvarSettings(parcial: Partial<Settings>): Settings {
  const permitidos = Object.fromEntries(Object.entries(parcial).filter(([k]) => k in PADRAO));
  const novo = { ...lerSettings(), ...permitidos };
  db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(novo),
  );
  return novo;
}

export function lerValor(chave: string): string | undefined {
  const linha = db.prepare("SELECT value FROM settings WHERE key = ?").get(chave) as { value: string } | undefined;
  return linha?.value;
}

export function gravarValor(chave: string, valor: string): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    chave,
    valor,
  );
}

export function registrarIA(kind: string, mode: "openai" | "claude" | "heuristica", summary: string): void {
  db.prepare("INSERT INTO ai_log (kind, mode, summary) VALUES (?, ?, ?)").run(kind, mode, summary);
}

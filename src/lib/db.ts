import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { runMigrations } from '../migrations/migrate';
import type { Timer, TimerSession } from './schemas';

// Database location: ~/.stint/stint.db
const DB_DIR = join(homedir(), '.stint');
const DB_PATH = join(DB_DIR, 'stint.db');

// Singleton database instance
let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    // Ensure directory exists
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
    }

    _db = new Database(DB_PATH, { create: true });
    _db.exec('PRAGMA foreign_keys = ON');

    // Run migrations on first initialization
    runMigrations(_db);
  }
  return _db;
}

// Raw query types for database results (snake_case from SQLite)
type TimerRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

type TimerSessionRow = {
  id: string;
  timer_id: string;
  start: number;
  end: number | null;
  created_at: number;
};

// Helper to convert database row to camelCase
export function timerFromRow(row: TimerRow): Timer {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export function sessionFromRow(row: TimerSessionRow): TimerSession {
  return {
    id: row.id,
    timerId: row.timer_id,
    start: row.start,
    end: row.end,
    createdAt: row.created_at,
  };
}

// Prepared statements and queries
export const queries = {
  // Timers
  getAllTimers: () => {
    const db = getDb();
    return db.query<TimerRow, []>('SELECT * FROM timers ORDER BY name');
  },

  getTimerByName: () => {
    const db = getDb();
    return db.query<TimerRow, [string]>('SELECT * FROM timers WHERE name = ?');
  },

  getTimerById: () => {
    const db = getDb();
    return db.query<TimerRow, [string]>('SELECT * FROM timers WHERE id = ?');
  },

  createTimer: () => {
    const db = getDb();
    return db.prepare('INSERT INTO timers (id, name, color) VALUES (?, ?, ?)');
  },

  updateTimer: () => {
    const db = getDb();
    return db.prepare('UPDATE timers SET name = ?, color = ? WHERE id = ?');
  },

  deleteTimer: () => {
    const db = getDb();
    return db.prepare('DELETE FROM timers WHERE id = ?');
  },

  // Timer Sessions
  startSession: () => {
    const db = getDb();
    return db.prepare('INSERT INTO timer_sessions (id, timer_id, start) VALUES (?, ?, ?)');
  },

  stopSession: () => {
    const db = getDb();
    return db.prepare('UPDATE timer_sessions SET end = ? WHERE id = ?');
  },

  getActiveSession: () => {
    const db = getDb();
    return db.query<TimerSessionRow, [string]>(
      'SELECT * FROM timer_sessions WHERE timer_id = ? AND end IS NULL LIMIT 1'
    );
  },

  getAllActiveSessions: () => {
    const db = getDb();
    return db.query<TimerSessionRow, []>(
      'SELECT * FROM timer_sessions WHERE end IS NULL ORDER BY start DESC'
    );
  },

  getSessionsInRange: () => {
    const db = getDb();
    return db.query<TimerSessionRow, [number, number]>(
      'SELECT * FROM timer_sessions WHERE start >= ? AND start <= ? ORDER BY start DESC'
    );
  },

  getSessionsForTimer: () => {
    const db = getDb();
    return db.query<TimerSessionRow, [string, number, number]>(
      'SELECT * FROM timer_sessions WHERE timer_id = ? AND start >= ? AND start <= ? ORDER BY start DESC'
    );
  },
};

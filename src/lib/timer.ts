import { nanoid } from 'nanoid';
import { getDb, queries, timerFromRow, sessionFromRow } from './db';
import { TimerSchema, TimerSessionSchema } from './schemas';
import type { Timer, TimerSession } from './schemas';

/**
 * Get timer by name
 */
export function getTimerByName(name: string): Timer | null {
  const result = queries.getTimerByName().get(name);
  if (!result) return null;

  const timer = timerFromRow(result);
  return TimerSchema.parse(timer);
}

/**
 * Get all timers
 */
export function getAllTimers(): Timer[] {
  const results = queries.getAllTimers().all();
  return results.map((row) => {
    const timer = timerFromRow(row);
    return TimerSchema.parse(timer);
  });
}

/**
 * Create a new timer
 */
export function createTimer(name: string, color: string = '#f5f5f4'): Timer {
  const id = nanoid();

  queries.createTimer().run(id, name, color);

  const result = queries.getTimerById().get(id);
  if (!result) {
    throw new Error('Failed to create timer');
  }

  const timer = timerFromRow(result);
  return TimerSchema.parse(timer);
}

/**
 * Start a timer (creates session)
 * Auto-creates timer if it doesn't exist
 * Returns { session, created } where created = true if timer was just created
 */
export function startTimer(timerName: string): { session: TimerSession; created: boolean } {
  let timer = getTimerByName(timerName);
  let created = false;

  // Auto-create timer if it doesn't exist
  if (!timer) {
    timer = createTimer(timerName); // Uses default gray color
    created = true;
  }

  // Check if timer already has an active session
  const activeSession = queries.getActiveSession().get(timer.id);
  if (activeSession) {
    throw new Error(`Timer "${timerName}" is already running`);
  }

  // Create new session
  const now = Math.floor(Date.now() / 1000);
  const sessionId = nanoid();

  queries.startSession().run(sessionId, timer.id, now);

  const db = getDb();
  const result = db.query('SELECT * FROM timer_sessions WHERE id = ?').get(sessionId);
  if (!result) {
    throw new Error('Failed to create session');
  }

  return {
    session: TimerSessionSchema.parse(sessionFromRow(result as any)),
    created,
  };
}

/**
 * Stop a timer (ends active session)
 */
export function stopTimer(timerName: string): TimerSession {
  const timer = getTimerByName(timerName);

  if (!timer) {
    throw new Error(`Timer "${timerName}" not found`);
  }

  // Find active session
  const activeSession = queries.getActiveSession().get(timer.id);
  if (!activeSession) {
    throw new Error(`Timer "${timerName}" is not running`);
  }

  // Stop the session
  const now = Math.floor(Date.now() / 1000);
  queries.stopSession().run(now, activeSession.id);

  const db = getDb();
  const result = db.query('SELECT * FROM timer_sessions WHERE id = ?').get(activeSession.id);
  if (!result) {
    throw new Error('Failed to stop session');
  }

  return TimerSessionSchema.parse(sessionFromRow(result as any));
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): TimerSession[] {
  const results = queries.getAllActiveSessions().all();
  return results.map((row) => TimerSessionSchema.parse(sessionFromRow(row)));
}

/**
 * Get timers with their active sessions
 */
export function getTimersWithActiveSessions(): Array<Timer & { activeSession: TimerSession }> {
  const timers = getAllTimers();

  return timers
    .map((timer) => {
      const session = queries.getActiveSession().get(timer.id);
      return session ? { ...timer, activeSession: sessionFromRow(session) } : null;
    })
    .filter((item): item is Timer & { activeSession: TimerSession } => item !== null);
}

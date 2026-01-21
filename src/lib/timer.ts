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
 * @param timerName - Name of the timer to start
 * @param startAt - Optional Unix timestamp to start at (for retroactive entry)
 */
export function startTimer(
  timerName: string,
  startAt?: number
): { session: TimerSession; created: boolean } {
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

  // Determine start time
  const startTimestamp = startAt ?? Math.floor(Date.now() / 1000);

  // Validate: cannot start before the latest end across ALL sessions
  if (startAt) {
    const latestEnd = getLatestEndTimestamp();
    if (latestEnd && startTimestamp < latestEnd) {
      const latestEndDate = new Date(latestEnd * 1000);
      const latestEndFormatted = latestEndDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      throw new Error(
        `Cannot start at specified time - latest session ended at ${latestEndFormatted}. ` +
          `Start time must be after the last stop event.`
      );
    }
  }

  // Create new session
  const sessionId = nanoid();

  queries.startSession().run(sessionId, timer.id, startTimestamp);

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
 * @param timerName - Name of the timer to stop
 * @param stopAt - Optional Unix timestamp to stop at (for retroactive entry)
 */
export function stopTimer(timerName: string, stopAt?: number): TimerSession {
  const timer = getTimerByName(timerName);

  if (!timer) {
    throw new Error(`Timer "${timerName}" not found`);
  }

  // Find active session
  const activeSession = queries.getActiveSession().get(timer.id);
  if (!activeSession) {
    throw new Error(`Timer "${timerName}" is not running`);
  }

  // Determine stop time
  const stopTimestamp = stopAt ?? Math.floor(Date.now() / 1000);

  // Validate: stop time must be after session start
  if (stopAt && stopTimestamp <= activeSession.start) {
    const startDate = new Date(activeSession.start * 1000);
    const startFormatted = startDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    throw new Error(
      `Stop time is before or equal to start time. Session started at ${startFormatted}.`
    );
  }

  // Stop the session
  queries.stopSession().run(stopTimestamp, activeSession.id);

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

/**
 * Create a manual timer session (for retroactive time entry)
 * Auto-creates timer if it doesn't exist
 */
export function createSession(timerName: string, start: number, end: number): TimerSession {
  if (start >= end) {
    throw new Error('Session end time must be after start time');
  }

  let timer = getTimerByName(timerName);

  // Auto-create timer if it doesn't exist
  if (!timer) {
    timer = createTimer(timerName);
  }

  // Create session with both start and end times
  const sessionId = nanoid();
  queries.createSession().run(sessionId, timer.id, start, end);

  const db = getDb();
  const result = db.query('SELECT * FROM timer_sessions WHERE id = ?').get(sessionId);
  if (!result) {
    throw new Error('Failed to create session');
  }

  return TimerSessionSchema.parse(sessionFromRow(result as any));
}

/**
 * Get all sessions in a date range (only completed sessions with end times)
 * Returns sessions grouped by timer
 */
export function getSessionsByTimer(startTime: number, endTime: number): Map<Timer, TimerSession[]> {
  const results = queries.getSessionsInRange().all(startTime, endTime);
  const sessions = results
    .map((row) => sessionFromRow(row))
    .filter((session) => session.end !== null); // Only completed sessions

  // Group by timer
  const timerMap = new Map<string, Timer>();
  const sessionsByTimer = new Map<Timer, TimerSession[]>();

  for (const session of sessions) {
    // Get or cache timer
    let timer = timerMap.get(session.timerId);
    if (!timer) {
      const timerRow = queries.getTimerById().get(session.timerId);
      if (timerRow) {
        timer = TimerSchema.parse(timerFromRow(timerRow));
        timerMap.set(session.timerId, timer);
      }
    }

    if (timer) {
      const existing = sessionsByTimer.get(timer) || [];
      sessionsByTimer.set(timer, [...existing, session]);
    }
  }

  return sessionsByTimer;
}

/**
 * Get the latest end timestamp across ALL sessions
 * Used to validate that new start times don't overlap with history
 */
export function getLatestEndTimestamp(): number | null {
  const db = getDb();
  const result = db
    .query<{ max_end: number | null }, []>('SELECT MAX(end) as max_end FROM timer_sessions WHERE end IS NOT NULL')
    .get();
  return result?.max_end ?? null;
}

/**
 * Get all sessions in a date range INCLUDING active (running) sessions
 * Returns sessions grouped by timer
 */
export function getAllSessionsByTimer(startTime: number, endTime: number): Map<Timer, TimerSession[]> {
  const db = getDb();

  // Get all sessions in range (completed AND active)
  // Active sessions: started within range OR started before range and still running
  const results = db
    .query<any, [number, number, number]>(
      `SELECT * FROM timer_sessions
       WHERE (start >= ? AND start <= ?)
          OR (start < ? AND end IS NULL)
       ORDER BY start DESC`
    )
    .all(startTime, endTime, endTime);

  const sessions = results.map((row: any) => sessionFromRow(row));

  // Group by timer
  const timerMap = new Map<string, Timer>();
  const sessionsByTimer = new Map<Timer, TimerSession[]>();

  for (const session of sessions) {
    // Get or cache timer
    let timer = timerMap.get(session.timerId);
    if (!timer) {
      const timerRow = queries.getTimerById().get(session.timerId);
      if (timerRow) {
        timer = TimerSchema.parse(timerFromRow(timerRow));
        timerMap.set(session.timerId, timer);
      }
    }

    if (timer) {
      const existing = sessionsByTimer.get(timer) || [];
      sessionsByTimer.set(timer, [...existing, session]);
    }
  }

  return sessionsByTimer;
}

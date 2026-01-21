import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { setDbPath, resetDb, getDb } from '../../lib/db';
import { startTimer, createSession, getAllSessionsByTimer } from '../../lib/timer';
import { getSessionDuration, formatDuration } from '../../lib/format';
import { startOfDay, endOfDay } from 'date-fns';
import type { TimerSession } from '../../lib/schemas';

describe('status command', () => {
  beforeEach(() => {
    // Use in-memory database for each test
    setDbPath(':memory:');
  });

  afterEach(() => {
    resetDb();
    setDbPath(null);
  });

  describe('getAllSessionsByTimer', () => {
    test('returns empty map when no sessions exist', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(0);
    });

    test('returns completed sessions grouped by timer', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Create a completed session
      createSession('work', dayStart + 3600, dayStart + 7200); // 1 hour session

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(1);
      const timers = Array.from(result.keys());
      const firstTimer = timers[0];
      expect(firstTimer).toBeDefined();
      expect(firstTimer!.name).toBe('work');

      const sessions = result.get(firstTimer!);
      expect(sessions).toBeDefined();
      expect(sessions!.length).toBe(1);
      expect(sessions![0]!.end).not.toBeNull();
    });

    test('includes active (running) sessions', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Start a timer (creates active session)
      startTimer('work');

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(1);
      const timers = Array.from(result.keys());
      const firstTimer = timers[0];
      expect(firstTimer).toBeDefined();

      const sessions = result.get(firstTimer!);
      expect(sessions).toBeDefined();
      expect(sessions!.length).toBe(1);
      expect(sessions![0]!.end).toBeNull(); // Active session has no end
    });

    test('includes both completed and active sessions', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Create a completed session
      createSession('work', dayStart + 3600, dayStart + 7200);

      // Start a new session (active)
      startTimer('work');

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(1);
      const timers = Array.from(result.keys());
      const firstTimer = timers[0];
      expect(firstTimer).toBeDefined();

      const sessions = result.get(firstTimer!);
      expect(sessions).toBeDefined();
      expect(sessions!.length).toBe(2);

      // One should be completed, one active
      const completedSessions = sessions!.filter((s) => s.end !== null);
      const activeSessions = sessions!.filter((s) => s.end === null);

      expect(completedSessions.length).toBe(1);
      expect(activeSessions.length).toBe(1);
    });

    test('groups sessions by different timers', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Create sessions for different timers
      createSession('work', dayStart + 3600, dayStart + 7200);
      createSession('music', dayStart + 7200, dayStart + 9000);

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(2);

      const timerNames = Array.from(result.keys()).map((t) => t.name);
      expect(timerNames).toContain('work');
      expect(timerNames).toContain('music');
    });

    test('includes running session started before range but still active', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Manually create an active session that started "yesterday" but is still running
      const db = getDb();
      const yesterdayStart = dayStart - 86400; // 24 hours before today start

      db.run('INSERT INTO timers (id, name, color) VALUES (?, ?, ?)', ['timer1', 'overnight', '#ff0000']);
      db.run('INSERT INTO timer_sessions (id, timer_id, start, end) VALUES (?, ?, ?, ?)', [
        'session1',
        'timer1',
        yesterdayStart,
        null, // Still running
      ]);

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(1);
      const timers = Array.from(result.keys());
      const firstTimer = timers[0];
      expect(firstTimer).toBeDefined();
      expect(firstTimer!.name).toBe('overnight');

      const sessions = result.get(firstTimer!);
      expect(sessions).toBeDefined();
      expect(sessions!.length).toBe(1);
      expect(sessions![0]!.end).toBeNull();
      expect(sessions![0]!.start).toBe(yesterdayStart);
    });

    test('excludes sessions outside date range', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      // Create a session from yesterday (completed)
      const yesterdayStart = dayStart - 86400;
      createSession('work', yesterdayStart, yesterdayStart + 3600);

      const result = getAllSessionsByTimer(dayStart, dayEnd);

      expect(result.size).toBe(0);
    });
  });

  describe('session IDs for edit/delete', () => {
    test('session IDs are unique and stable', () => {
      const dayStart = Math.floor(startOfDay(new Date()).getTime() / 1000);
      const dayEnd = Math.floor(endOfDay(new Date()).getTime() / 1000);

      createSession('work', dayStart + 3600, dayStart + 7200);
      createSession('work', dayStart + 7200, dayStart + 10800);

      const result = getAllSessionsByTimer(dayStart, dayEnd);
      const firstTimer = Array.from(result.keys())[0];
      expect(firstTimer).toBeDefined();

      const sessions = result.get(firstTimer!);
      expect(sessions).toBeDefined();
      expect(sessions!.length).toBeGreaterThanOrEqual(2);

      const session0 = sessions![0];
      const session1 = sessions![1];
      expect(session0).toBeDefined();
      expect(session1).toBeDefined();

      // Both sessions should have unique IDs
      expect(session0!.id).not.toBe(session1!.id);

      // IDs should be non-empty strings (nanoid)
      expect(session0!.id.length).toBeGreaterThan(0);
      expect(session1!.id.length).toBeGreaterThan(0);
    });
  });

  describe('running timer in total', () => {
    test('getSessionDuration calculates duration for active sessions using current time', () => {
      const now = Math.floor(Date.now() / 1000);

      // Active session (no end time)
      const activeSession: TimerSession = {
        id: 'test',
        timerId: 'timer1',
        start: now - 3600, // Started 1 hour ago
        end: null,
        createdAt: now,
      };

      const duration = getSessionDuration(activeSession);

      // Should be approximately 3600 seconds (1 hour)
      expect(duration).toBeGreaterThanOrEqual(3599);
      expect(duration).toBeLessThanOrEqual(3602);
    });

    test('getSessionDuration calculates duration for completed sessions', () => {
      const now = Math.floor(Date.now() / 1000);

      const completedSession: TimerSession = {
        id: 'test',
        timerId: 'timer1',
        start: now - 7200, // Started 2 hours ago
        end: now - 3600, // Ended 1 hour ago
        createdAt: now,
      };

      const duration = getSessionDuration(completedSession);

      // Should be exactly 3600 seconds (1 hour)
      expect(duration).toBe(3600);
    });
  });

  describe('formatDuration', () => {
    test('formats short durations correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(90)).toBe('1m'); // seconds ignored when minutes present
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(7380)).toBe('2h 3m'); // 2*3600 + 3*60 = 7380
    });

    test('formats durations over 24 hours correctly', () => {
      // 25 hours
      expect(formatDuration(25 * 3600)).toBe('25h');

      // 36 hours 41 minutes (like the weekly total)
      expect(formatDuration(36 * 3600 + 41 * 60)).toBe('36h 41m');

      // 48 hours (2 days worth)
      expect(formatDuration(48 * 3600)).toBe('48h');

      // 60 hours 8 minutes
      expect(formatDuration(60 * 3600 + 8 * 60)).toBe('60h 8m');

      // 100 hours
      expect(formatDuration(100 * 3600)).toBe('100h');
    });

    test('does not lose hours when duration exceeds 24 hours', () => {
      // This was the bug - 60+ hours was showing as ~12h because days were lost
      const sixtyHoursInSeconds = 60 * 60 * 60; // 216000 seconds
      const result = formatDuration(sixtyHoursInSeconds);

      // Must contain "60h", not "12h" or any smaller number
      expect(result).toContain('60h');
      expect(result).not.toContain('12h');
    });
  });
});

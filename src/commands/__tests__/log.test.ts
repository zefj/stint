import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { setDbPath, resetDb, getDb } from '../../lib/db';
import { startTimer, createSession, getAllSessionsByTimer } from '../../lib/timer';
import {
  getSessionDuration,
  formatDuration,
  formatDateShort,
  formatDateLong,
  formatTime,
  formatDate,
} from '../../lib/format';
import { generateLogOutput } from '../log';
import { startOfDay, endOfDay } from 'date-fns';
import type { TimerSession, Timer } from '../../lib/schemas';

describe('log command', () => {
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

  describe('formatTime', () => {
    test('formats time in 24-hour format', () => {
      // 14:30 on any day
      const timestamp = new Date(2026, 0, 21, 14, 30, 0).getTime() / 1000;
      const result = formatTime(timestamp);

      expect(result).toBe('14:30');
    });

    test('formats midnight correctly', () => {
      const timestamp = new Date(2026, 0, 21, 0, 0, 0).getTime() / 1000;
      const result = formatTime(timestamp);

      expect(result).toBe('00:00');
    });

    test('formats morning time with leading zero', () => {
      const timestamp = new Date(2026, 0, 21, 9, 5, 0).getTime() / 1000;
      const result = formatTime(timestamp);

      expect(result).toBe('09:05');
    });
  });

  describe('formatDate', () => {
    test('formats date from timestamp', () => {
      const timestamp = new Date(2026, 0, 21, 14, 30, 0).getTime() / 1000;
      const result = formatDate(timestamp);

      // Should be DD/MM/YYYY format (en-GB default, not American)
      expect(result).toMatch(/21.*01.*2026/);
      // Should NOT be American format MM/DD/YYYY
      expect(result).not.toMatch(/^01.*21.*2026/);
    });
  });

  describe('formatDateShort', () => {
    test('formats date in short format', () => {
      const date = new Date(2026, 0, 21);
      const result = formatDateShort(date);

      // Should contain day, month, year in some format
      expect(result).toMatch(/21.*01.*2026/);
      // Should NOT be American format
      expect(result).not.toMatch(/^01.*21.*2026/);
    });

    test('formats single digit days and months with padding', () => {
      const date = new Date(2026, 0, 5); // 5th January
      const result = formatDateShort(date);

      // Should have padded day and month
      expect(result).toMatch(/05.*01.*2026/);
    });
  });

  describe('formatDateLong', () => {
    test('includes weekday in long format', () => {
      const date = new Date(2026, 0, 21); // Wednesday
      const result = formatDateLong(date);

      // Should contain Wednesday (or locale equivalent)
      expect(result.toLowerCase()).toContain('wednesday');
    });

    test('includes full month name', () => {
      const date = new Date(2026, 0, 21); // January
      const result = formatDateLong(date);

      // Should contain January (or locale equivalent)
      expect(result.toLowerCase()).toContain('january');
    });

    test('includes year', () => {
      const date = new Date(2026, 0, 21);
      const result = formatDateLong(date);

      expect(result).toContain('2026');
    });

    test('day comes before month in output (not American format)', () => {
      const date = new Date(2026, 0, 21);
      const result = formatDateLong(date);

      // In en-GB: "Wednesday, 21 January 2026"
      // The day number (21) should come before the month name
      const dayIndex = result.indexOf('21');
      const monthIndex = result.toLowerCase().indexOf('january');

      expect(dayIndex).toBeLessThan(monthIndex);
    });
  });

  describe('date formatting never uses American format', () => {
    test('formatDateShort does not use MM/DD/YYYY', () => {
      // Test a date where day > 12 to catch American format
      const date = new Date(2026, 0, 21); // 21st January
      const result = formatDateShort(date);

      // If it was American format, 21 would be in month position (invalid)
      // or it would show as 01/21/2026
      // We expect 21/01/2026 or similar non-American format
      const parts = result.split(/[\/\.\-]/);
      const firstPart = parts[0];

      // First part should be the day (21), not month (01)
      expect(firstPart).toBe('21');
    });

    test('formatDate does not use MM/DD/YYYY', () => {
      const timestamp = new Date(2026, 0, 21).getTime() / 1000;
      const result = formatDate(timestamp);

      const parts = result.split(/[\/\.\-]/);
      const firstPart = parts[0];

      // First part should be the day (21), not month (01)
      expect(firstPart).toBe('21');
    });
  });

  describe('generateLogOutput', () => {
    test('returns no sessions message when empty', () => {
      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });

      expect(output).toHaveLength(1);
      expect(output[0]).toBe('No sessions found for Today');
    });

    test('shows single timer without per-timer breakdown', () => {
      const now = Math.floor(Date.now() / 1000);
      const timer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: now };
      const session: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: now - 3600,
        end: now,
        createdAt: now,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(timer, [session]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      // Should have "Total: 1h" but NOT "Total work: 1h"
      expect(text).toContain('Total: 1h');
      expect(text).not.toContain('Total work:');
    });

    test('shows multiple timers with per-timer breakdown', () => {
      const now = Math.floor(Date.now() / 1000);
      const workTimer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: now };
      const musicTimer: Timer = { id: 't2', name: 'music', color: '#fff', createdAt: now };

      const workSession: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: now - 7200,
        end: now - 3600,
        createdAt: now,
      };
      const musicSession: TimerSession = {
        id: 's2',
        timerId: 't2',
        start: now - 3600,
        end: now,
        createdAt: now,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(workTimer, [workSession]);
      sessionsByTimer.set(musicTimer, [musicSession]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      // Should have per-timer breakdown
      expect(text).toContain('Total work: 1h');
      expect(text).toContain('Total music: 1h');
      expect(text).toContain('Total: 2h');
    });

    test('shows running session with → now', () => {
      const now = Math.floor(Date.now() / 1000);
      const timer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: now };
      const session: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: now - 3600,
        end: null, // Running
        createdAt: now,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(timer, [session]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      expect(text).toContain('→ now');
    });

    test('shows session times in correct format', () => {
      // Create a session from 09:00 to 17:00
      const date = new Date(2026, 0, 21, 9, 0, 0);
      const start = Math.floor(date.getTime() / 1000);
      const end = start + 8 * 3600; // 8 hours later = 17:00

      const timer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: start };
      const session: TimerSession = {
        id: 's1',
        timerId: 't1',
        start,
        end,
        createdAt: start,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(timer, [session]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      expect(text).toContain('09:00 - 17:00');
      expect(text).toContain('(8h)');
    });

    test('shows day total for each day', () => {
      const now = Math.floor(Date.now() / 1000);
      const timer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: now };
      const session: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: now - 7200,
        end: now,
        createdAt: now,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(timer, [session]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      // Should have a day total line
      expect(text).toMatch(/Total: 2h/);
    });

    test('sorts sessions by start time within a day', () => {
      const baseDate = new Date(2026, 0, 21, 0, 0, 0);
      const dayStart = Math.floor(baseDate.getTime() / 1000);

      const timer: Timer = { id: 't1', name: 'work', color: '#fff', createdAt: dayStart };

      // Create sessions out of order
      const afternoon: TimerSession = {
        id: 's2',
        timerId: 't1',
        start: dayStart + 14 * 3600, // 14:00
        end: dayStart + 17 * 3600,   // 17:00
        createdAt: dayStart,
      };
      const morning: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: dayStart + 9 * 3600,  // 09:00
        end: dayStart + 12 * 3600,   // 12:00
        createdAt: dayStart,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(timer, [afternoon, morning]); // Out of order

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      // Morning should appear before afternoon in output
      const morningIndex = text.indexOf('09:00');
      const afternoonIndex = text.indexOf('14:00');

      expect(morningIndex).toBeLessThan(afternoonIndex);
    });

    test('sorts timers alphabetically', () => {
      const now = Math.floor(Date.now() / 1000);

      const zTimer: Timer = { id: 't2', name: 'zebra', color: '#fff', createdAt: now };
      const aTimer: Timer = { id: 't1', name: 'apple', color: '#fff', createdAt: now };

      const zSession: TimerSession = {
        id: 's2',
        timerId: 't2',
        start: now - 3600,
        end: now,
        createdAt: now,
      };
      const aSession: TimerSession = {
        id: 's1',
        timerId: 't1',
        start: now - 7200,
        end: now - 3600,
        createdAt: now,
      };

      const sessionsByTimer = new Map<Timer, TimerSession[]>();
      sessionsByTimer.set(zTimer, [zSession]);
      sessionsByTimer.set(aTimer, [aSession]);

      const output = generateLogOutput(sessionsByTimer, 'Today', { useColor: false });
      const text = output.join('\n');

      // Apple should appear before zebra
      const appleIndex = text.indexOf('apple');
      const zebraIndex = text.indexOf('zebra');

      expect(appleIndex).toBeLessThan(zebraIndex);
    });
  });
});

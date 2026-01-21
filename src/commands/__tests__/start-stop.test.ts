import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { setDbPath, resetDb } from '../../lib/db';
import {
  startTimer,
  stopTimer,
  getLatestEndTimestamp,
  createSession,
  getTimerByName,
  getAllTimers,
  getActiveSessions,
  getTimersWithActiveSessions,
} from '../../lib/timer';
import { parseTimeToday } from '../../lib/format';

describe('start and stop commands', () => {
  beforeEach(() => {
    setDbPath(':memory:');
  });

  afterEach(() => {
    resetDb();
    setDbPath(null);
  });

  describe('startTimer', () => {
    test('starts a new timer', () => {
      const { session, created } = startTimer('work');

      expect(created).toBe(true);
      expect(session.end).toBeNull();
      expect(session.start).toBeGreaterThan(0);
    });

    test('starts an existing timer', () => {
      // First create the timer
      startTimer('work');
      stopTimer('work');

      // Start again
      const { session, created } = startTimer('work');

      expect(created).toBe(false);
      expect(session.end).toBeNull();
    });

    test('auto-creates timer if it does not exist', () => {
      const { created } = startTimer('brandnew');

      expect(created).toBe(true);
      const timer = getTimerByName('brandnew');
      expect(timer).not.toBeNull();
      expect(timer!.name).toBe('brandnew');
    });

    test('throws error if timer is already running', () => {
      startTimer('work');

      expect(() => startTimer('work')).toThrow('already running');
    });

    test('allows starting different timer while another is running', () => {
      startTimer('work');

      const { session } = startTimer('music');

      expect(session.end).toBeNull();
    });

    test('creates timer with default gray color', () => {
      startTimer('work');

      const timer = getTimerByName('work');
      expect(timer).not.toBeNull();
      expect(timer!.color).toBe('#f5f5f4');
    });
  });

  describe('startTimer with startAt (retroactive)', () => {
    test('starts timer at specified time', () => {
      const now = Math.floor(Date.now() / 1000);
      const startAt = now - 3600; // 1 hour ago

      const { session } = startTimer('work', startAt);

      expect(session.start).toBe(startAt);
      expect(session.end).toBeNull();
    });

    test('prevents starting before latest end time', () => {
      const now = Math.floor(Date.now() / 1000);

      // Create a completed session that ended 30 min ago
      createSession('work', now - 7200, now - 1800);

      // Try to start a new session 1 hour ago (before the previous end)
      expect(() => startTimer('music', now - 3600)).toThrow(
        'Cannot start at specified time'
      );
    });

    test('allows starting after latest end time', () => {
      const now = Math.floor(Date.now() / 1000);

      // Create a completed session that ended 2 hours ago
      createSession('work', now - 7200, now - 7200 + 3600);

      // Start a new session 1 hour ago (after the previous end)
      const { session } = startTimer('music', now - 3600);

      expect(session.start).toBe(now - 3600);
    });

    test('auto-creates timer when starting at specific time', () => {
      const now = Math.floor(Date.now() / 1000);

      const { session, created } = startTimer('newTimer', now - 1800);

      expect(created).toBe(true);
      expect(session.start).toBe(now - 1800);
    });

    test('allows starting at current time when no previous sessions', () => {
      const now = Math.floor(Date.now() / 1000);

      const { session } = startTimer('work', now);

      expect(session.start).toBe(now);
    });
  });

  describe('stopTimer', () => {
    test('stops a running timer', () => {
      startTimer('work');

      const session = stopTimer('work');

      expect(session.end).not.toBeNull();
      expect(session.end).toBeGreaterThanOrEqual(session.start);
    });

    test('throws error if timer does not exist', () => {
      expect(() => stopTimer('nonexistent')).toThrow('not found');
    });

    test('throws error if timer is not running', () => {
      startTimer('work');
      stopTimer('work');

      expect(() => stopTimer('work')).toThrow('not running');
    });

    test('returns session with correct duration', () => {
      const before = Math.floor(Date.now() / 1000);
      startTimer('work');
      const session = stopTimer('work');
      const after = Math.floor(Date.now() / 1000);

      expect(session.start).toBeGreaterThanOrEqual(before);
      expect(session.end).toBeLessThanOrEqual(after);
      expect(session.end! - session.start).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stopTimer with stopAt (retroactive)', () => {
    test('stops timer at specified time', () => {
      const now = Math.floor(Date.now() / 1000);
      const startAt = now - 3600;
      const stopAt = now - 1800;

      startTimer('work', startAt);
      const session = stopTimer('work', stopAt);

      expect(session.start).toBe(startAt);
      expect(session.end).toBe(stopAt);
    });

    test('prevents stopping before start time', () => {
      const now = Math.floor(Date.now() / 1000);

      startTimer('work', now - 1800); // Started 30 min ago

      // Try to stop at 1 hour ago (before start)
      expect(() => stopTimer('work', now - 3600)).toThrow(
        'Stop time is before or equal to start time'
      );
    });

    test('prevents stopping at same time as start', () => {
      const now = Math.floor(Date.now() / 1000);
      const startAt = now - 1800;

      startTimer('work', startAt);

      expect(() => stopTimer('work', startAt)).toThrow(
        'Stop time is before or equal to start time'
      );
    });

    test('allows stopping after start time', () => {
      const now = Math.floor(Date.now() / 1000);
      const startAt = now - 3600;
      const stopAt = now - 1800;

      startTimer('work', startAt);
      const session = stopTimer('work', stopAt);

      expect(session.end).toBe(stopAt);
    });

    test('calculates correct duration with retroactive stop', () => {
      const now = Math.floor(Date.now() / 1000);
      const startAt = now - 3600; // 1 hour ago
      const stopAt = now - 1800; // 30 min ago

      startTimer('work', startAt);
      const session = stopTimer('work', stopAt);

      expect(session.end! - session.start).toBe(1800); // 30 minutes
    });
  });

  describe('parseTimeToday', () => {
    test('parses valid HH:MM format', () => {
      const timestamp = parseTimeToday('14:30');
      const date = new Date(timestamp * 1000);

      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
    });

    test('parses single digit hour', () => {
      const timestamp = parseTimeToday('9:15');
      const date = new Date(timestamp * 1000);

      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(15);
    });

    test('parses midnight', () => {
      const timestamp = parseTimeToday('00:00');
      const date = new Date(timestamp * 1000);

      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    });

    test('parses 23:59', () => {
      const timestamp = parseTimeToday('23:59');
      const date = new Date(timestamp * 1000);

      expect(date.getHours()).toBe(23);
      expect(date.getMinutes()).toBe(59);
    });

    test('returns timestamp for today', () => {
      const timestamp = parseTimeToday('12:00');
      const date = new Date(timestamp * 1000);
      const today = new Date();

      expect(date.getFullYear()).toBe(today.getFullYear());
      expect(date.getMonth()).toBe(today.getMonth());
      expect(date.getDate()).toBe(today.getDate());
    });

    test('throws on invalid format - missing colon', () => {
      expect(() => parseTimeToday('1430')).toThrow('Invalid time format');
    });

    test('throws on invalid format - only hours', () => {
      expect(() => parseTimeToday('14')).toThrow('Invalid time format');
    });

    test('throws on invalid format - extra characters', () => {
      expect(() => parseTimeToday('14:30:00')).toThrow('Invalid time format');
    });

    test('throws on invalid hours (>23)', () => {
      expect(() => parseTimeToday('24:00')).toThrow('Invalid time');
    });

    test('throws on invalid minutes (>59)', () => {
      expect(() => parseTimeToday('14:60')).toThrow('Invalid time');
    });

    test('throws on negative hours', () => {
      expect(() => parseTimeToday('-1:30')).toThrow('Invalid time format');
    });

    test('throws on non-numeric input', () => {
      expect(() => parseTimeToday('ab:cd')).toThrow('Invalid time format');
    });

    test('throws on 69:420 (invalid format - 3 digit minutes)', () => {
      expect(() => parseTimeToday('69:420')).toThrow('Invalid time format');
    });

    test('throws on 69:42 (invalid hours)', () => {
      expect(() => parseTimeToday('69:42')).toThrow('Invalid time: 69:42');
    });
  });

  describe('getLatestEndTimestamp', () => {
    test('returns null when no sessions exist', () => {
      const result = getLatestEndTimestamp();
      expect(result).toBeNull();
    });

    test('returns null when only active sessions exist', () => {
      startTimer('work');
      const result = getLatestEndTimestamp();
      expect(result).toBeNull();
    });

    test('returns latest end timestamp from completed sessions', () => {
      const now = Math.floor(Date.now() / 1000);
      createSession('work', now - 7200, now - 3600); // Ended 1 hour ago
      createSession('music', now - 3600, now - 1800); // Ended 30 min ago

      const result = getLatestEndTimestamp();
      expect(result).toBe(now - 1800); // Should be the most recent end
    });

    test('ignores active sessions when finding latest end', () => {
      const now = Math.floor(Date.now() / 1000);
      createSession('work', now - 7200, now - 3600); // Ended 1 hour ago
      startTimer('music'); // Active session

      const result = getLatestEndTimestamp();
      expect(result).toBe(now - 3600); // Should ignore active session
    });
  });

  describe('getAllTimers', () => {
    test('returns empty array when no timers exist', () => {
      const timers = getAllTimers();
      expect(timers).toEqual([]);
    });

    test('returns all created timers', () => {
      startTimer('work');
      stopTimer('work');
      startTimer('music');
      stopTimer('music');
      startTimer('exercise');
      stopTimer('exercise');

      const timers = getAllTimers();
      expect(timers.length).toBe(3);

      const names = timers.map((t) => t.name);
      expect(names).toContain('work');
      expect(names).toContain('music');
      expect(names).toContain('exercise');
    });
  });

  describe('getActiveSessions', () => {
    test('returns empty array when no sessions are active', () => {
      const sessions = getActiveSessions();
      expect(sessions).toEqual([]);
    });

    test('returns only active sessions', () => {
      startTimer('work');
      startTimer('music');

      const sessions = getActiveSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.every((s) => s.end === null)).toBe(true);
    });

    test('excludes stopped sessions', () => {
      startTimer('work');
      stopTimer('work');
      startTimer('music');

      const sessions = getActiveSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('getTimersWithActiveSessions', () => {
    test('returns empty array when no timers are running', () => {
      const result = getTimersWithActiveSessions();
      expect(result).toEqual([]);
    });

    test('returns timers with their active sessions', () => {
      startTimer('work');
      startTimer('music');

      const result = getTimersWithActiveSessions();
      expect(result.length).toBe(2);

      const names = result.map((t) => t.name);
      expect(names).toContain('work');
      expect(names).toContain('music');

      // Each result should have activeSession property
      result.forEach((timer) => {
        expect(timer.activeSession).toBeDefined();
        expect(timer.activeSession.end).toBeNull();
      });
    });

    test('excludes timers that are not running', () => {
      startTimer('work');
      stopTimer('work');
      startTimer('music');

      const result = getTimersWithActiveSessions();
      expect(result.length).toBe(1);
      expect(result[0]!.name).toBe('music');
    });
  });

  describe('chronology validation', () => {
    test('full workflow - retroactive entries must be chronological', () => {
      const now = Math.floor(Date.now() / 1000);
      const baseTime = now - 36000; // 10 hours ago as base

      // Morning session: 09:00 - 12:30
      startTimer('work', baseTime);
      stopTimer('work', baseTime + 3.5 * 3600); // 3.5 hours later

      // Afternoon session: 14:00 - 17:30
      startTimer('work', baseTime + 5 * 3600); // 5 hours after base
      stopTimer('work', baseTime + 8.5 * 3600); // 8.5 hours after base

      // Now trying to start at 13:00 should FAIL (latest end is at 8.5 hours after base)
      expect(() => startTimer('music', baseTime + 4 * 3600)).toThrow(
        'Cannot start at specified time'
      );
    });

    test('can start new session after stopping another', () => {
      const now = Math.floor(Date.now() / 1000);

      // Complete a session
      startTimer('work', now - 7200);
      stopTimer('work', now - 3600);

      // Start a new session after the previous one ended
      const { session } = startTimer('music', now - 1800);
      expect(session.start).toBe(now - 1800);
    });

    test('validates across different timers', () => {
      const now = Math.floor(Date.now() / 1000);

      // Work session ends at now - 1800
      startTimer('work', now - 7200);
      stopTimer('work', now - 1800);

      // Cannot start music before work ended
      expect(() => startTimer('music', now - 3600)).toThrow(
        'Cannot start at specified time'
      );

      // Can start music after work ended
      const { session } = startTimer('music', now - 1200);
      expect(session.start).toBe(now - 1200);
    });
  });

  describe('multiple timers running simultaneously', () => {
    test('can have multiple timers running at once', () => {
      startTimer('work');
      startTimer('music');
      startTimer('exercise');

      const active = getActiveSessions();
      expect(active.length).toBe(3);
    });

    test('stopping one timer does not affect others', () => {
      startTimer('work');
      startTimer('music');

      stopTimer('work');

      const active = getActiveSessions();
      expect(active.length).toBe(1);

      const running = getTimersWithActiveSessions();
      expect(running[0]!.name).toBe('music');
    });
  });
});

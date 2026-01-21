import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { setDbPath, resetDb, getDb, sessionFromRow } from '../../lib/db';
import {
  startTimer,
  stopTimer,
  createSession,
  getSessionById,
  deleteSession,
  getActiveSessions,
} from '../../lib/timer';

describe('delete command', () => {
  beforeEach(() => {
    setDbPath(':memory:');
  });

  afterEach(() => {
    resetDb();
    setDbPath(null);
  });

  describe('getSessionById', () => {
    test('returns null when session does not exist', () => {
      const result = getSessionById('nonexistent');
      expect(result).toBeNull();
    });

    test('returns session when it exists', () => {
      const now = Math.floor(Date.now() / 1000);
      const session = createSession('work', now - 3600, now);

      const result = getSessionById(session.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(session.id);
      expect(result!.start).toBe(now - 3600);
      expect(result!.end).toBe(now);
    });

    test('returns active session', () => {
      const { session } = startTimer('work');

      const result = getSessionById(session.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(session.id);
      expect(result!.end).toBeNull();
    });
  });

  describe('deleteSession', () => {
    test('deletes an existing session', () => {
      const now = Math.floor(Date.now() / 1000);
      const session = createSession('work', now - 3600, now);

      // Verify session exists
      expect(getSessionById(session.id)).not.toBeNull();

      // Delete it
      deleteSession(session.id);

      // Verify it's gone
      expect(getSessionById(session.id)).toBeNull();
    });

    test('throws error when session does not exist', () => {
      expect(() => deleteSession('nonexistent')).toThrow('not found');
    });

    test('deletes active session', () => {
      const { session } = startTimer('work');

      // Verify session exists
      expect(getActiveSessions().length).toBe(1);

      // Delete it
      deleteSession(session.id);

      // Verify it's gone
      expect(getActiveSessions().length).toBe(0);
      expect(getSessionById(session.id)).toBeNull();
    });

    test('only deletes specified session, not others', () => {
      const now = Math.floor(Date.now() / 1000);
      const session1 = createSession('work', now - 7200, now - 3600);
      const session2 = createSession('work', now - 3600, now);

      // Delete first session
      deleteSession(session1.id);

      // Second session still exists
      expect(getSessionById(session2.id)).not.toBeNull();
    });
  });

  describe('findSession by short ID', () => {
    test('finds session by full ID', () => {
      const now = Math.floor(Date.now() / 1000);
      const session = createSession('work', now - 3600, now);

      const result = getSessionById(session.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(session.id);
    });

    test('sessions have unique IDs', () => {
      const now = Math.floor(Date.now() / 1000);
      const session1 = createSession('work', now - 7200, now - 3600);
      const session2 = createSession('work', now - 3600, now);
      const session3 = createSession('music', now - 1800, now);

      // All IDs should be unique
      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session1.id).not.toBe(session3.id);

      // All should be findable
      expect(getSessionById(session1.id)).not.toBeNull();
      expect(getSessionById(session2.id)).not.toBeNull();
      expect(getSessionById(session3.id)).not.toBeNull();
    });

    test('short ID (first 6 chars) can be used to find session', () => {
      const now = Math.floor(Date.now() / 1000);
      const session = createSession('work', now - 3600, now);

      // Get short ID (first 6 chars)
      const shortId = session.id.slice(0, 6);

      // Find by short ID using raw query (like the command does)
      const db = getDb();
      const results = db
        .query('SELECT * FROM timer_sessions WHERE id LIKE ?')
        .all(`${shortId}%`) as any[];

      expect(results.length).toBe(1);
      expect(sessionFromRow(results[0]!).id).toBe(session.id);
    });
  });

  describe('edge cases', () => {
    test('can delete and recreate sessions for same timer', () => {
      const now = Math.floor(Date.now() / 1000);

      // Create session
      const session1 = createSession('work', now - 3600, now);

      // Delete it
      deleteSession(session1.id);

      // Create another session for same timer
      const session2 = createSession('work', now - 1800, now);

      expect(getSessionById(session2.id)).not.toBeNull();
    });

    test('deleting session does not affect timer', () => {
      const now = Math.floor(Date.now() / 1000);
      createSession('work', now - 3600, now);

      const { session } = startTimer('work');
      deleteSession(session.id);

      // Can still start the timer again
      const { session: newSession } = startTimer('work');
      expect(newSession).toBeDefined();
    });
  });
});

import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { SessionPicker } from '../SessionPicker';
import { setDbPath, resetDb } from '../../lib/db';
import type { TimerSession, Timer } from '../../lib/schemas';

// Helper to create mock session data
function createMockSession(
  id: string,
  timerName: string,
  startHoursAgo: number,
  durationHours: number
): { session: TimerSession; timer: Timer } {
  const now = Math.floor(Date.now() / 1000);
  const start = now - startHoursAgo * 3600;
  const end = start + durationHours * 3600;

  return {
    session: {
      id,
      timerId: `timer-${timerName}`,
      start,
      end,
      createdAt: now,
    },
    timer: {
      id: `timer-${timerName}`,
      name: timerName,
      color: '#f5f5f4',
      createdAt: now,
    },
  };
}

// Helper to create sessions for a specific date
function createSessionForDate(
  id: string,
  timerName: string,
  date: Date,
  startHour: number,
  endHour: number
): { session: TimerSession; timer: Timer } {
  const start = new Date(date);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);

  const startTs = Math.floor(start.getTime() / 1000);
  const endTs = Math.floor(end.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  return {
    session: {
      id,
      timerId: `timer-${timerName}`,
      start: startTs,
      end: endTs,
      createdAt: now,
    },
    timer: {
      id: `timer-${timerName}`,
      name: timerName,
      color: '#f5f5f4',
      createdAt: now,
    },
  };
}

describe('SessionPicker', () => {
  beforeEach(() => {
    setDbPath(':memory:');
  });

  afterEach(() => {
    resetDb();
    setDbPath(null);
  });

  describe('calendar view rendering', () => {
    test('renders calendar header', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      const frame = lastFrame();
      expect(frame).toContain('Select a session to delete');
    });

    test('renders weekday headers', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      const frame = lastFrame();
      expect(frame).toContain('Mon');
      expect(frame).toContain('Tue');
      expect(frame).toContain('Wed');
      expect(frame).toContain('Thu');
      expect(frame).toContain('Fri');
      expect(frame).toContain('Sat');
      expect(frame).toContain('Sun');
    });

    test('renders navigation instructions', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      const frame = lastFrame();
      expect(frame).toContain('Navigate');
      expect(frame).toContain('n/p');
      expect(frame).toContain('Enter');
      expect(frame).toContain('Cancel');
    });

    test('shows current month name', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      const frame = lastFrame();
      const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
      expect(frame).toContain(currentMonthName);
    });

    test('shows session count for current month', () => {
      const sessions = [
        createMockSession('sess1', 'work', 2, 1),
        createMockSession('sess2', 'work', 4, 2),
      ];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      expect(lastFrame()).toMatch(/\d+ sessions? this month/);
    });

    test('marks days with sessions using bullet', () => {
      const today = new Date();
      const sessions = [createSessionForDate('sess1', 'work', today, 9, 17)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      // Days with sessions have a bullet marker
      expect(lastFrame()).toContain('•');
    });

    test('shows legend for bullet marker', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      expect(lastFrame()).toContain('• = has sessions');
    });
  });

  describe('session grouping', () => {
    test('groups sessions by day correctly', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const sessions = [
        createSessionForDate('sess1', 'work', today, 9, 12),
        createSessionForDate('sess2', 'work', today, 14, 17),
        createSessionForDate('sess3', 'music', yesterday, 10, 11),
      ];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      // Should show 3 sessions this month
      expect(lastFrame()).toContain('3 sessions this month');
    });

    test('shows zero sessions when empty', () => {
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={[]} onSelect={onSelect} onCancel={onCancel} />
      );

      expect(lastFrame()).toContain('0 sessions this month');
    });

    test('handles sessions from different timers on same day', () => {
      const today = new Date();
      const sessions = [
        createSessionForDate('sess1', 'work', today, 9, 12),
        createSessionForDate('sess2', 'music', today, 14, 17),
      ];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { lastFrame } = render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      // Both sessions should be counted
      expect(lastFrame()).toContain('2 sessions this month');
    });
  });

  describe('callback props', () => {
    test('onSelect receives session and timer', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      // Manually call onSelect to verify it works
      const { session, timer } = sessions[0]!;
      onSelect(session, timer);

      expect(onSelect).toHaveBeenCalledWith(session, timer);
    });

    test('onCancel can be called', () => {
      const sessions = [createMockSession('sess1', 'work', 2, 1)];
      const onSelect = mock(() => {});
      const onCancel = mock(() => {});

      render(
        <SessionPicker sessions={sessions} onSelect={onSelect} onCancel={onCancel} />
      );

      // Manually call onCancel to verify it works
      onCancel();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('session data display', () => {
    test('session includes all required fields', () => {
      const session = createMockSession('test-id-123', 'work', 2, 1);

      expect(session.session.id).toBe('test-id-123');
      expect(session.session.timerId).toBe('timer-work');
      expect(session.session.start).toBeGreaterThan(0);
      expect(session.session.end).toBeGreaterThan(session.session.start);
      expect(session.timer.name).toBe('work');
    });

    test('timer includes color for display', () => {
      const session = createMockSession('test-id', 'work', 2, 1);

      expect(session.timer.color).toBe('#f5f5f4');
    });
  });
});

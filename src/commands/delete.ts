import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { getSessionById, deleteSession, getAllSessionsByTimer } from '../lib/timer';
import { queries, getDb, sessionFromRow } from '../lib/db';
import { formatTime, formatDuration, getSessionDuration } from '../lib/format';
import { parseDateRange } from '../lib/dateRange';
import { SessionPicker } from '../tui/SessionPicker';
import type { TimerSession, Timer } from '../lib/schemas';

/**
 * Find a session by full ID or short ID (first 6 chars)
 */
function findSession(sessionId: string): TimerSession | null {
  // Try exact match first
  const exact = getSessionById(sessionId);
  if (exact) return exact;

  // Try matching by short ID (prefix match)
  if (sessionId.length >= 4) {
    const db = getDb();
    const results = db
      .query('SELECT * FROM timer_sessions WHERE id LIKE ?')
      .all(`${sessionId}%`) as any[];

    if (results.length === 1) {
      return sessionFromRow(results[0]);
    } else if (results.length > 1) {
      throw new Error(
        `Multiple sessions match "${sessionId}". Please provide more characters.`
      );
    }
  }

  return null;
}

/**
 * Get timer name for a session
 */
function getTimerNameForSession(session: TimerSession): string {
  const timerRow = queries.getTimerById().get(session.timerId);
  return timerRow?.name ?? 'unknown';
}

function doDelete(session: TimerSession, timerName: string): void {
  const duration = getSessionDuration(session);
  const startTime = formatTime(session.start);
  const endTime = session.end ? formatTime(session.end) : '→ now';

  deleteSession(session.id);
  console.log(
    `✓ Deleted session for "${timerName}" (${startTime} - ${endTime}, ${formatDuration(duration)})`
  );
}

export const deleteCommand = new Command('delete')
  .argument('[session-id]', 'session ID (shown in stint log)')
  .description('Delete a session')
  .action(async (sessionId?: string) => {
    try {
      if (sessionId) {
        // Direct mode: session ID provided - delete directly (user knows what they're doing)
        const session = findSession(sessionId);
        if (!session) {
          console.error(`✗ Session "${sessionId}" not found`);
          process.exit(1);
        }
        const timerName = getTimerNameForSession(session);
        doDelete(session, timerName);
      } else {
        // Interactive mode: show picker with sessions from last month
        const range = parseDateRange('month');
        const sessionsByTimer = getAllSessionsByTimer(range.start, range.end);

        if (sessionsByTimer.size === 0) {
          console.log('No sessions found in the last month');
          return;
        }

        // Build flat list of sessions with their timers
        const allSessions: Array<{ session: TimerSession; timer: Timer }> = [];

        sessionsByTimer.forEach((sessions, timer) => {
          sessions.forEach((session) => {
            allSessions.push({ session, timer });
          });
        });

        if (allSessions.length === 0) {
          console.log('No sessions found in the last month');
          return;
        }

        // Show interactive picker using Promise
        const result = await new Promise<{ session: TimerSession; timer: Timer } | null>(
          (resolve) => {
            const { unmount } = render(
              React.createElement(SessionPicker, {
                sessions: allSessions,
                onSelect: (session: TimerSession, timer: Timer) => {
                  unmount();
                  resolve({ session, timer });
                },
                onCancel: () => {
                  unmount();
                  resolve(null);
                },
              })
            );
          }
        );

        if (result) {
          doDelete(result.session, result.timer.name);
        } else {
          console.log('Cancelled');
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

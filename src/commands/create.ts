import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { createSession, getSessionsForTimer } from '../lib/timer';
import { formatDuration, getSessionDuration } from '../lib/format';
import { CalendarView } from '../tui/CalendarView';

/**
 * Parse ISO 8601 datetime string to Unix timestamp (seconds)
 * Accepts formats: YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
 */
function parseDateTime(dateTimeStr: string): number {
  // Replace space with T if present (for flexibility)
  const normalized = dateTimeStr.replace(' ', 'T');

  // Validate format: YYYY-MM-DDTHH:MM
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!isoRegex.test(normalized)) {
    throw new Error(
      `Invalid datetime format: "${dateTimeStr}". Use YYYY-MM-DDTHH:MM (e.g., 2025-12-28T09:00)`
    );
  }

  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: "${dateTimeStr}"`);
  }

  return Math.floor(date.getTime() / 1000);
}

export const createCommand = new Command('create')
  .argument('<timer>', 'timer name')
  .argument('[from]', 'start datetime (ISO 8601: YYYY-MM-DDTHH:MM)')
  .argument('[to]', 'end datetime (ISO 8601: YYYY-MM-DDTHH:MM)')
  .description('Create manual timer sessions')
  .action(async (timerName: string, from?: string, to?: string) => {
    try {
      // Direct mode: both from and to provided
      if (from && to) {
        const startTime = parseDateTime(from);
        const endTime = parseDateTime(to);

        const session = createSession(timerName, startTime, endTime);
        const duration = getSessionDuration(session);

        console.log(
          `✓ Created session for "${timerName}": ${from} - ${to} (${formatDuration(duration)})`
        );
        return;
      }

      // Partial args error
      if (from && !to) {
        console.error('✗ Both FROM and TO arguments are required for direct mode');
        console.error('  Usage: stint create <timer> <from> <to>');
        console.error('  Example: stint create work 2025-12-28T09:00 2025-12-28T17:00');
        process.exit(1);
      }

      // Interactive mode (default when no time args)
      // Fetch existing sessions for this timer
      const existingSessions = getSessionsForTimer(timerName).map((s) => ({
        start: s.start,
        end: s.end ?? Math.floor(Date.now() / 1000),
      }));

      const { waitUntilExit } = render(
        React.createElement(CalendarView, {
          timerName,
          existingSessions,
          onCreateSession: (start: number, end: number) => {
            const session = createSession(timerName, start, end);
            const duration = getSessionDuration(session);
            console.log(`✓ Created session for "${timerName}" (${formatDuration(duration)})`);
          },
          onDone: () => {
            // Nothing to do - sessions already created
          },
        })
      );

      await waitUntilExit();
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

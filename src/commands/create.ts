import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { createSession } from '../lib/timer';
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
  .option('-i, --interactive', 'interactive calendar mode')
  .description('Create manual timer sessions')
  .action(async (timerName: string, from?: string, to?: string, options?: { interactive?: boolean }) => {
    try {
      // Interactive mode
      if (options?.interactive) {
        const { waitUntilExit } = render(
          React.createElement(CalendarView, {
            timerName,
            onSave: (sessions) => {
              if (sessions.length === 0) {
                console.log('No sessions to save.');
                return;
              }

              // Create all sessions
              let created = 0;
              let totalDuration = 0;
              for (const session of sessions) {
                try {
                  createSession(timerName, session.start, session.end);
                  created++;
                  totalDuration += session.end - session.start;
                } catch (error) {
                  console.error(`Failed to create session: ${error}`);
                }
              }

              const hours = Math.floor(totalDuration / 3600);
              const minutes = Math.floor((totalDuration % 3600) / 60);
              console.log(
                `✓ Created ${created} ${created === 1 ? 'session' : 'sessions'} for "${timerName}" (${hours}h${minutes > 0 ? ` ${minutes}m` : ''} total)`
              );
            },
            onCancel: () => {
              console.log('Cancelled');
            },
          })
        );

        await waitUntilExit();
        return;
      }

      // Direct mode: both from and to required
      if (!from || !to) {
        console.error('✗ Direct mode requires both FROM and TO arguments');
        console.error('  Usage: stint create <timer> <from> <to>');
        console.error('  Example: stint create work 2025-12-28T09:00 2025-12-28T17:00');
        console.error('');
        console.error('  Or use interactive mode: stint create <timer> --interactive');
        process.exit(1);
      }

      // Parse datetime strings to Unix timestamps
      const startTime = parseDateTime(from);
      const endTime = parseDateTime(to);

      // Create the session
      const session = createSession(timerName, startTime, endTime);
      const duration = getSessionDuration(session);

      console.log(
        `✓ Created session for "${timerName}": ${from} - ${to} (${formatDuration(duration)})`
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

import { Command } from 'commander';
import { getAllTimers } from '../lib/timer';
import { queries, sessionFromRow } from '../lib/db';
import { getChalkColor } from '../lib/colors';
import { formatDuration, getSessionDuration } from '../lib/format';

export const statusCommand = new Command('status')
  .description('Show status of all timers')
  .action(() => {
    try {
      const timers = getAllTimers();

      if (timers.length === 0) {
        console.log('No timers yet. Use "stint start" to create one.');
        return;
      }

      console.log(''); // Empty line for spacing

      for (const timer of timers) {
        const color = getChalkColor(timer.color);
        const activeSession = queries.getActiveSession().get(timer.id);

        if (activeSession) {
          // Timer is running
          const session = sessionFromRow(activeSession);
          const duration = getSessionDuration(session);
          console.log(`● ${color(timer.name)} — Running for ${formatDuration(duration)}`);
        } else {
          // Timer is stopped
          console.log(`○ ${color(timer.name)} — Stopped`);
        }
      }

      console.log(''); // Empty line for spacing
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

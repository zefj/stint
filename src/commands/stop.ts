import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import { stopTimer, getTimersWithActiveSessions } from '../lib/timer';
import { getChalkColor } from '../lib/colors';
import { formatTime, formatDuration, getSessionDuration } from '../lib/format';

export const stopCommand = new Command('stop')
  .argument('[timer]', 'timer name')
  .description('Stop a timer')
  .action(async (timerName?: string) => {
    try {
      // If timer name provided, stop it directly
      if (timerName) {
        const session = stopTimer(timerName);
        const duration = getSessionDuration(session);
        console.log(
          `✓ Stopped "${timerName}" timer at ${formatTime(session.end!)} (${formatDuration(duration)})`
        );
        return;
      }

      // Interactive mode: no argument provided
      const runningTimers = getTimersWithActiveSessions();

      // No timers running
      if (runningTimers.length === 0) {
        console.log('No timers currently running');
        return;
      }

      // Smart shortcut: if only 1 timer is running, stop it immediately
      if (runningTimers.length === 1) {
        const timer = runningTimers[0];
        const session = stopTimer(timer.name);
        const duration = getSessionDuration(session);
        console.log(
          `✓ Stopped "${timer.name}" timer at ${formatTime(session.end!)} (${formatDuration(duration)})  (only timer running)`
        );
        return;
      }

      // Build choices for interactive selection
      const choices = runningTimers.map((timer) => {
        const color = getChalkColor(timer.color);
        const duration = getSessionDuration(timer.activeSession);

        return {
          name: `● ${color(timer.name)} — ${formatDuration(duration)}`,
          value: timer.name,
        };
      });

      // Show interactive selection
      const selected = await select({
        message: 'Select a timer to stop:',
        choices,
      });

      // Stop selected timer
      const session = stopTimer(selected);
      const duration = getSessionDuration(session);
      console.log(
        `✓ Stopped "${selected}" timer at ${formatTime(session.end!)} (${formatDuration(duration)})`
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

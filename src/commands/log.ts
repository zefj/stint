import { Command } from 'commander';
import { format } from 'date-fns';
import { getAllSessionsByTimer } from '../lib/timer';
import { parseDateRange } from '../lib/dateRange';
import { getChalkColor } from '../lib/colors';
import { formatTime, formatDuration, getSessionDuration } from '../lib/format';
import type { Timer, TimerSession } from '../lib/schemas';

export const logCommand = new Command('log')
  .argument('[range]', 'date range (today, yesterday, week, month, YYYY-MM-DD, YYYY-MM-DD..YYYY-MM-DD)')
  .description('Show time tracking log and history')
  .action((rangeStr?: string) => {
    try {
      // Parse date range (defaults to today)
      const range = parseDateRange(rangeStr);
      const sessionsByTimer = getAllSessionsByTimer(range.start, range.end);

      // Check if any sessions exist
      if (sessionsByTimer.size === 0) {
        console.log(`No sessions found for ${range.label}`);
        return;
      }

      // Group sessions by day
      const sessionsByDay = new Map<string, Map<Timer, TimerSession[]>>();

      sessionsByTimer.forEach((sessions, timer) => {
        sessions.forEach((session) => {
          const dayKey = format(new Date(session.start * 1000), 'yyyy-MM-dd');

          let dayMap = sessionsByDay.get(dayKey);
          if (!dayMap) {
            dayMap = new Map();
            sessionsByDay.set(dayKey, dayMap);
          }

          const timerSessions = dayMap.get(timer) || [];
          dayMap.set(timer, [...timerSessions, session]);
        });
      });

      // Sort days
      const sortedDays = Array.from(sessionsByDay.keys()).sort();

      // Display header
      console.log(`\nSessions for ${range.label}:\n`);

      // Display sessions grouped by day
      let grandTotal = 0;

      for (const dayKey of sortedDays) {
        const dayMap = sessionsByDay.get(dayKey)!;
        const dayDate = new Date(dayKey + 'T00:00:00');

        console.log(format(dayDate, 'EEEE, MMMM d, yyyy'));

        let dayTotal = 0;

        // Sort timers by name
        const sortedTimers = Array.from(dayMap.keys()).sort((a, b) => a.name.localeCompare(b.name));

        for (const timer of sortedTimers) {
          const sessions = dayMap.get(timer)!;
          const color = getChalkColor(timer.color);

          console.log(`  ${color(timer.name)}`);

          // Sort sessions by start time
          sessions.sort((a, b) => a.start - b.start);

          for (const session of sessions) {
            const duration = getSessionDuration(session);
            dayTotal += duration;

            // Show session ID (first 6 chars) for edit/delete
            const shortId = session.id.slice(0, 6);

            // Format end time - show "→ now" for running sessions
            const endDisplay = session.end ? formatTime(session.end) : '→ now';

            console.log(
              `    [${shortId}] ${formatTime(session.start)} - ${endDisplay}  (${formatDuration(duration)})`
            );
          }
        }

        console.log(`  Day total: ${formatDuration(dayTotal)}\n`);
        grandTotal += dayTotal;
      }

      // Display grand total
      console.log(`Total: ${formatDuration(grandTotal)}\n`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

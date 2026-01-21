import { Command } from 'commander';
import chalk from 'chalk';
import { getAllSessionsByTimer } from '../lib/timer';
import { parseDateRange } from '../lib/dateRange';
import { getChalkColor } from '../lib/colors';
import { formatTime, formatDuration, getSessionDuration, formatDateShort } from '../lib/format';
import type { Timer, TimerSession } from '../lib/schemas';

type LogOptions = {
  useColor?: boolean;
};

/**
 * Generate log output lines from sessions grouped by timer
 */
export function generateLogOutput(
  sessionsByTimer: Map<Timer, TimerSession[]>,
  rangeLabel: string,
  options: LogOptions = {}
): string[] {
  const { useColor = true } = options;
  const lines: string[] = [];

  if (sessionsByTimer.size === 0) {
    lines.push(`No sessions found for ${rangeLabel}`);
    return lines;
  }

  // Group sessions by day
  const sessionsByDay = new Map<string, Map<Timer, TimerSession[]>>();

  sessionsByTimer.forEach((sessions, timer) => {
    sessions.forEach((session) => {
      const sessionDate = new Date(session.start * 1000);
      const dayKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;

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

  // Header
  lines.push(`\nSessions for ${rangeLabel}:\n`);

  // Track totals per timer across all days
  const grandTotalByTimer = new Map<string, { timer: Timer; total: number }>();

  const green = useColor ? chalk.green : (s: string) => s;

  for (const dayKey of sortedDays) {
    const dayMap = sessionsByDay.get(dayKey)!;
    const dayDate = new Date(dayKey + 'T00:00:00');

    lines.push(green(formatDateShort(dayDate)));

    // Track day totals per timer
    const dayTotalByTimer = new Map<string, number>();

    // Sort timers by name
    const sortedTimers = Array.from(dayMap.keys()).sort((a, b) => a.name.localeCompare(b.name));

    for (const timer of sortedTimers) {
      const sessions = dayMap.get(timer)!;
      const colorFn = useColor ? getChalkColor(timer.color) : (s: string) => s;

      lines.push(`  ${colorFn(timer.name)}`);

      // Sort sessions by start time
      sessions.sort((a, b) => a.start - b.start);

      let timerDayTotal = 0;
      for (const session of sessions) {
        const duration = getSessionDuration(session);
        timerDayTotal += duration;

        // Format end time - show "→ now" for running sessions
        const endDisplay = session.end ? formatTime(session.end) : '→ now';

        lines.push(`    ${formatTime(session.start)} - ${endDisplay}  (${formatDuration(duration)})`);
      }

      dayTotalByTimer.set(timer.name, timerDayTotal);

      // Add to grand total
      const existing = grandTotalByTimer.get(timer.name);
      if (existing) {
        existing.total += timerDayTotal;
      } else {
        grandTotalByTimer.set(timer.name, { timer, total: timerDayTotal });
      }
    }

    // Day totals per timer
    const dayTotal = Array.from(dayTotalByTimer.values()).reduce((sum, t) => sum + t, 0);
    if (sortedTimers.length > 1) {
      for (const timer of sortedTimers) {
        const colorFn = useColor ? getChalkColor(timer.color) : (s: string) => s;
        lines.push(`  Total ${colorFn(timer.name)}: ${formatDuration(dayTotalByTimer.get(timer.name) || 0)}`);
      }
    }
    lines.push(`  Total: ${formatDuration(dayTotal)}\n`);
  }

  // Grand totals per timer
  const grandTotal = Array.from(grandTotalByTimer.values()).reduce((sum, t) => sum + t.total, 0);
  const sortedGrandTimers = Array.from(grandTotalByTimer.values()).sort((a, b) =>
    a.timer.name.localeCompare(b.timer.name)
  );
  if (sortedGrandTimers.length > 1) {
    for (const { timer, total } of sortedGrandTimers) {
      const colorFn = useColor ? getChalkColor(timer.color) : (s: string) => s;
      lines.push(`Total ${colorFn(timer.name)}: ${formatDuration(total)}`);
    }
  }
  const decimalHours = (grandTotal / 3600).toFixed(2);
  lines.push(`Total: ${formatDuration(grandTotal)} (${decimalHours})\n`);

  return lines;
}

export const logCommand = new Command('log')
  .argument('[range]', 'date range (today, yesterday, week, month, YYYY-MM-DD, YYYY-MM-DD..YYYY-MM-DD)')
  .description('Show time tracking log and history')
  .action((rangeStr?: string) => {
    try {
      const range = parseDateRange(rangeStr);
      const sessionsByTimer = getAllSessionsByTimer(range.start, range.end);
      const lines = generateLogOutput(sessionsByTimer, range.label);

      for (const line of lines) {
        console.log(line);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

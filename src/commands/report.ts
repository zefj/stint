import { Command } from 'commander';
import { getSessionsByTimer } from '../lib/timer';
import { parseDateRange } from '../lib/dateRange';
import { getChalkColor } from '../lib/colors';
import { formatDuration, getSessionDuration } from '../lib/format';
import type { Timer, TimerSession } from '../lib/schemas';

type TimerStats = {
  timer: Timer;
  sessionCount: number;
  totalTime: number;
  avgTime: number;
};

export const reportCommand = new Command('report')
  .argument('[range]', 'date range (today, yesterday, week, month, YYYY-MM-DD, YYYY-MM-DD..YYYY-MM-DD)')
  .description('Generate summary report with statistics')
  .action((rangeStr?: string) => {
    try {
      // Parse date range
      const range = parseDateRange(rangeStr);
      const sessionsByTimer = getSessionsByTimer(range.start, range.end);

      // Check if any sessions exist
      if (sessionsByTimer.size === 0) {
        console.log(`No sessions found for ${range.label}`);
        return;
      }

      // Calculate statistics for each timer
      const stats: TimerStats[] = [];
      let totalSessions = 0;
      let totalTime = 0;

      sessionsByTimer.forEach((sessions, timer) => {
        const sessionCount = sessions.length;
        const timerTotal = sessions.reduce((sum, session) => {
          return sum + getSessionDuration(session);
        }, 0);
        const avgTime = timerTotal / sessionCount;

        stats.push({
          timer,
          sessionCount,
          totalTime: timerTotal,
          avgTime,
        });

        totalSessions += sessionCount;
        totalTime += timerTotal;
      });

      // Sort by total time (descending)
      stats.sort((a, b) => b.totalTime - a.totalTime);

      // Calculate column widths
      const timerColWidth = Math.max(
        15,
        ...stats.map((s) => s.timer.name.length)
      );
      const sessionColWidth = 10;
      const totalColWidth = 12;
      const avgColWidth = 12;

      // Display header
      console.log(`\nTime Report for ${range.label}\n`);

      // Display table header
      const headerTimer = 'Timer'.padEnd(timerColWidth);
      const headerSessions = 'Sessions'.padStart(sessionColWidth);
      const headerTotal = 'Total Time'.padStart(totalColWidth);
      const headerAvg = 'Avg/Session'.padStart(avgColWidth);

      console.log(`${headerTimer}  ${headerSessions}  ${headerTotal}  ${headerAvg}`);

      const separatorLength = timerColWidth + sessionColWidth + totalColWidth + avgColWidth + 6;
      console.log('─'.repeat(separatorLength));

      // Display stats for each timer
      for (const stat of stats) {
        const color = getChalkColor(stat.timer.color);
        const timerName = color(stat.timer.name.padEnd(timerColWidth));
        const sessions = stat.sessionCount.toString().padStart(sessionColWidth);
        const total = formatDuration(stat.totalTime).padStart(totalColWidth);
        const avg = formatDuration(stat.avgTime).padStart(avgColWidth);

        console.log(`${timerName}  ${sessions}  ${total}  ${avg}`);
      }

      // Display totals
      console.log('─'.repeat(separatorLength));

      const totalLabel = 'TOTAL'.padEnd(timerColWidth);
      const totalSessionsStr = totalSessions.toString().padStart(sessionColWidth);
      const totalTimeStr = formatDuration(totalTime).padStart(totalColWidth);
      const totalAvgStr = formatDuration(totalTime / totalSessions).padStart(avgColWidth);

      console.log(`${totalLabel}  ${totalSessionsStr}  ${totalTimeStr}  ${totalAvgStr}`);
      console.log('');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

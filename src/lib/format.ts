import { intervalToDuration } from 'date-fns';
import type { TimerSession } from './schemas';

/**
 * Format duration in seconds to human-readable string (e.g., "2h 34m")
 */
export function formatDuration(seconds: number): string {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });

  const parts: string[] = [];
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (!parts.length && duration.seconds) parts.push(`${duration.seconds}s`);

  return parts.join(' ') || '0s';
}

/**
 * Get duration of a session in seconds (active sessions use current time as end)
 */
export function getSessionDuration(session: TimerSession): number {
  const end = session.end ?? Math.floor(Date.now() / 1000);
  return end - session.start;
}

/**
 * Get total duration of multiple sessions
 */
export function getTotalDuration(sessions: TimerSession[]): number {
  return sessions.reduce((total, session) => {
    return total + getSessionDuration(session);
  }, 0);
}

/**
 * Format Unix timestamp to time string (HH:MM)
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format Unix timestamp to date string (YYYY-MM-DD)
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

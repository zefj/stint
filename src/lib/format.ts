import type { TimerSession } from './schemas';

/**
 * Format duration in seconds to human-readable string (e.g., "2h 34m" or "60h 8m")
 * Always shows total hours (not days) for clarity
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];
  if (totalHours) parts.push(`${totalHours}h`);
  if (remainingMinutes) parts.push(`${remainingMinutes}m`);
  if (!parts.length && remainingSeconds) parts.push(`${remainingSeconds}s`);

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

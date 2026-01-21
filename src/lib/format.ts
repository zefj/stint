import type { TimerSession } from './schemas';

/**
 * Get system locale, falling back to en-GB if American (we don't do MM/DD/YYYY here)
 */
function getSystemLocale(): string {
  const env = process.env;
  const rawLocale = env['LC_TIME'] || env['LC_ALL'] || env['LANG'] || '';

  // Parse locale (e.g., "en_GB.UTF-8" -> "en-GB")
  const match = rawLocale.match(/^([a-z]{2})_([A-Z]{2})/);
  if (match) {
    const locale = `${match[1]}-${match[2]}`;
    // Block American date format - use en-GB instead (DD/MM/YYYY)
    if (locale === 'en-US') {
      return 'en-GB';
    }
    return locale;
  }

  // Default to en-GB for sensible date format
  return 'en-GB';
}

const SYSTEM_LOCALE = getSystemLocale();

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
  return new Date(timestamp * 1000).toLocaleTimeString(SYSTEM_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format Unix timestamp to date string (DD/MM/YYYY or locale-appropriate)
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(SYSTEM_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format Unix timestamp to short date label (e.g., "21/01/2026")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(SYSTEM_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format date to long format with weekday (e.g., "Wednesday, 21 January 2026")
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString(SYSTEM_LOCALE, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

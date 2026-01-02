import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';

export type DateRange = {
  start: number; // Unix timestamp (seconds)
  end: number; // Unix timestamp (seconds)
  label: string; // Human-readable label
};

/**
 * Parse a date range string into start/end timestamps
 * Supports: today, yesterday, week, month, YYYY-MM-DD, YYYY-MM-DD..YYYY-MM-DD
 */
export function parseDateRange(rangeStr?: string): DateRange {
  const now = new Date();
  const range = rangeStr?.toLowerCase() || 'today';

  // Handle named ranges
  if (range === 'today') {
    const start = startOfDay(now);
    const end = endOfDay(now);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Today (${formatDateLabel(start)})`,
    };
  }

  if (range === 'yesterday') {
    const yesterday = subDays(now, 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Yesterday (${formatDateLabel(start)})`,
    };
  }

  if (range === 'week') {
    const weekAgo = subDays(now, 6); // Last 7 days including today
    const start = startOfDay(weekAgo);
    const end = endOfDay(now);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Last 7 days (${formatDateLabel(start)} to ${formatDateLabel(end)})`,
    };
  }

  if (range === 'month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `This month (${formatDateLabel(start)} to ${formatDateLabel(end)})`,
    };
  }

  // Handle date range: YYYY-MM-DD..YYYY-MM-DD
  if (range.includes('..')) {
    const [startStr, endStr] = range.split('..');
    const startDate = parseDate(startStr);
    const endDate = parseDate(endStr);

    if (!startDate || !endDate) {
      throw new Error(`Invalid date range: ${rangeStr}`);
    }

    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    if (end.getTime() < start.getTime()) {
      throw new Error('End date must be after start date');
    }

    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `${formatDateLabel(start)} to ${formatDateLabel(end)}`,
    };
  }

  // Handle single date: YYYY-MM-DD
  const date = parseDate(range);
  if (!date) {
    throw new Error(`Invalid date range: ${rangeStr}. Use: today, yesterday, week, month, YYYY-MM-DD, or YYYY-MM-DD..YYYY-MM-DD`);
  }

  const start = startOfDay(date);
  const end = endOfDay(date);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    label: formatDateLabel(start),
  };
}

/**
 * Parse YYYY-MM-DD date string
 */
function parseDate(dateStr: string): Date | null {
  const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.trim().match(regex);

  if (!match) {
    return null;
  }

  const [_, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Format date for display labels
 */
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

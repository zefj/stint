import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { formatDateShort } from './format';

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
      label: `Today (${formatDateShort(start)})`,
    };
  }

  if (range === 'yesterday') {
    const yesterday = subDays(now, 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Yesterday (${formatDateShort(start)})`,
    };
  }

  if (range === 'week') {
    const weekAgo = subDays(now, 6); // Last 7 days including today
    const start = startOfDay(weekAgo);
    const end = endOfDay(now);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Last 7 days (${formatDateShort(start)} to ${formatDateShort(end)})`,
    };
  }

  if (range === 'month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `This month (${formatDateShort(start)} to ${formatDateShort(end)})`,
    };
  }

  if (range === 'lastmonth') {
    const lastMonth = subMonths(now, 1);
    const start = startOfMonth(lastMonth);
    const end = endOfMonth(lastMonth);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      label: `Last month (${formatDateShort(start)} to ${formatDateShort(end)})`,
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
      label: `${formatDateShort(start)} to ${formatDateShort(end)}`,
    };
  }

  // Handle single date: YYYY-MM-DD
  const date = parseDate(range);
  if (!date) {
    throw new Error(`Invalid date range: ${rangeStr}. Use: today, yesterday, week, month, lastmonth, YYYY-MM-DD, or YYYY-MM-DD..YYYY-MM-DD`);
  }

  const start = startOfDay(date);
  const end = endOfDay(date);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    label: formatDateShort(start),
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

  const [, year, month, day] = match;
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

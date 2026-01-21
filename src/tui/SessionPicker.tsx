import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
} from 'date-fns';
import { formatTime, formatDuration, getSessionDuration } from '../lib/format';
import { getChalkColor } from '../lib/colors';
import type { TimerSession, Timer } from '../lib/schemas';

type SessionWithTimer = {
  session: TimerSession;
  timer: Timer;
};

type Props = {
  sessions: SessionWithTimer[];
  onSelect: (session: TimerSession, timer: Timer) => void;
  onCancel: () => void;
};

export function SessionPicker({ sessions, onSelect, onCancel }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mode, setMode] = useState<'calendar' | 'day' | 'confirm'>('calendar');
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [sessionToConfirm, setSessionToConfirm] = useState<SessionWithTimer | null>(null);

  // Group sessions by day
  const sessionsByDay = new Map<string, SessionWithTimer[]>();
  for (const item of sessions) {
    const date = new Date(item.session.start * 1000);
    const dayKey = format(date, 'yyyy-MM-dd');
    const existing = sessionsByDay.get(dayKey) || [];
    sessionsByDay.set(dayKey, [...existing, item]);
  }

  // Sort sessions within each day by start time (newest first)
  sessionsByDay.forEach((daySessions, key) => {
    daySessions.sort((a, b) => b.session.start - a.session.start);
    sessionsByDay.set(key, daySessions);
  });

  // Generate calendar days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (convert to Monday-based: 0 = Monday, 6 = Sunday)
  const firstDayOfWeek = (getDay(monthStart) + 6) % 7;

  // Get sessions for selected date
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDaySessions = sessionsByDay.get(selectedDateKey) || [];

  useInput((input, key) => {
    if (mode === 'calendar') {
      if (key.leftArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        if (currentIndex > 0) {
          const newDate = daysInMonth[currentIndex - 1];
          if (newDate) setSelectedDate(newDate);
        }
      } else if (key.rightArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        if (currentIndex < daysInMonth.length - 1) {
          const newDate = daysInMonth[currentIndex + 1];
          if (newDate) setSelectedDate(newDate);
        }
      } else if (key.upArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex - 7;
        if (newIndex >= 0) {
          const newDate = daysInMonth[newIndex];
          if (newDate) setSelectedDate(newDate);
        }
      } else if (key.downArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex + 7;
        if (newIndex < daysInMonth.length) {
          const newDate = daysInMonth[newIndex];
          if (newDate) setSelectedDate(newDate);
        }
      } else if (input === 'n') {
        const newMonth = addMonths(currentMonth, 1);
        setCurrentMonth(newMonth);
        setSelectedDate(startOfMonth(newMonth));
      } else if (input === 'p') {
        const newMonth = subMonths(currentMonth, 1);
        setCurrentMonth(newMonth);
        setSelectedDate(startOfMonth(newMonth));
      } else if (key.return) {
        if (selectedDaySessions.length > 0) {
          setSelectedSessionIndex(0);
          setMode('day');
        }
      } else if (key.escape || input === 'q') {
        onCancel();
      }
    } else if (mode === 'day') {
      if (key.upArrow) {
        setSelectedSessionIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedSessionIndex((prev) =>
          Math.min(selectedDaySessions.length - 1, prev + 1)
        );
      } else if (key.return) {
        const selected = selectedDaySessions[selectedSessionIndex];
        if (selected) {
          setSessionToConfirm(selected);
          setMode('confirm');
        }
      } else if (key.escape || input === 'q') {
        setMode('calendar');
      }
    } else if (mode === 'confirm') {
      if (key.return) {
        if (sessionToConfirm) {
          onSelect(sessionToConfirm.session, sessionToConfirm.timer);
        }
      } else if (key.escape || input === 'q') {
        setSessionToConfirm(null);
        setMode('day');
      }
    }
  });

  // Count sessions in current month
  let totalSessions = 0;
  sessionsByDay.forEach((daySessions, dateKey) => {
    const date = new Date(dateKey);
    if (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    ) {
      totalSessions += daySessions.length;
    }
  });

  const renderCalendar = () => {
    const weeks: React.ReactNode[] = [];
    let week: React.ReactNode[] = [];

    // Empty cells before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      week.push(
        <Box key={`empty-${i}`} width={6}>
          <Text> </Text>
        </Box>
      );
    }

    // Days of month
    daysInMonth.forEach((day, index) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const daySessions = sessionsByDay.get(dateKey) || [];
      const hasSessions = daySessions.length > 0;
      const isSelected = isSameDay(day, selectedDate);
      const dayNum = format(day, 'd');

      let displayText = `  ${dayNum.padStart(2, ' ')}`;
      if (hasSessions) displayText += '•';
      else displayText += ' ';

      week.push(
        <Box key={index} width={6}>
          <Text
            color={isSelected ? 'cyan' : hasSessions ? 'green' : undefined}
            inverse={isSelected}
            bold={hasSessions}
          >
            {displayText}
          </Text>
        </Box>
      );

      if ((firstDayOfWeek + index + 1) % 7 === 0 || index === daysInMonth.length - 1) {
        weeks.push(
          <Box key={`week-${weeks.length}`}>{week}</Box>
        );
        week = [];
      }
    });

    return weeks;
  };

  if (mode === 'confirm' && sessionToConfirm) {
    const { session, timer } = sessionToConfirm;
    const color = getChalkColor(timer.color);
    const duration = getSessionDuration(session);
    const startTime = formatTime(session.start);
    const endTime = session.end ? formatTime(session.end) : '→ now';

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">Confirm deletion</Text>
        <Text> </Text>
        <Text>
          Delete session for {color(timer.name)} ({startTime} - {endTime}, {formatDuration(duration)})?
        </Text>
        <Text> </Text>
        <Text dimColor>Enter: confirm   Esc: cancel</Text>
      </Box>
    );
  }

  if (mode === 'day') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Sessions for {format(selectedDate, 'EEEE, d MMMM yyyy')}</Text>
        <Text> </Text>

        {selectedDaySessions.map((item, idx) => {
          const { session, timer } = item;
          const isActive = idx === selectedSessionIndex;
          const color = getChalkColor(timer.color);
          const duration = getSessionDuration(session);
          const startTime = formatTime(session.start);
          const endTime = session.end ? formatTime(session.end) : '→ now';
          const shortId = session.id.slice(0, 6);

          return (
            <Box key={session.id} flexDirection="row">
              <Text color={isActive ? 'cyan' : undefined}>
                {isActive ? '❯ ' : '  '}
              </Text>
              <Text color={isActive ? 'cyan' : undefined}>
                {color(timer.name)} [{shortId}] {startTime} - {endTime} ({formatDuration(duration)})
              </Text>
            </Box>
          );
        })}

        <Text> </Text>
        <Text dimColor>↑↓ Navigate   Enter: Select   Esc: Back to calendar</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold>Select a session to delete</Text>
        <Text>{format(currentMonth, 'MMMM yyyy')}</Text>
      </Box>

      <Box marginBottom={1}>
        <Box width={6}><Text dimColor>Mon</Text></Box>
        <Box width={6}><Text dimColor>Tue</Text></Box>
        <Box width={6}><Text dimColor>Wed</Text></Box>
        <Box width={6}><Text dimColor>Thu</Text></Box>
        <Box width={6}><Text dimColor>Fri</Text></Box>
        <Box width={6}><Text dimColor>Sat</Text></Box>
        <Box width={6}><Text dimColor>Sun</Text></Box>
      </Box>

      <Box flexDirection="column">{renderCalendar()}</Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>←↑↓→ Navigate   n/p: Next/Prev month   Enter: View day   q: Cancel</Text>
        <Text> </Text>
        <Text color="green">• = has sessions</Text>
        <Text>
          {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} this month
        </Text>
      </Box>
    </Box>
  );
}

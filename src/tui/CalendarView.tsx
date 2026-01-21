import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
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
import { DayEntryView } from './DayEntryView';

type Session = {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
};

type Props = {
  timerName: string;
  existingSessions?: Session[];
  onCreateSession: (start: number, end: number) => void;
  onDone: () => void;
};

export function CalendarView({ timerName, existingSessions = [], onCreateSession, onDone }: Props) {
  const { exit } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [createdSessions, setCreatedSessions] = useState<Session[]>([]);
  const [mode, setMode] = useState<'calendar' | 'day'>('calendar');

  // Combine existing and newly created sessions
  const allSessions = [...existingSessions, ...createdSessions];

  // Build set of days with sessions
  const sessionsByDay = new Map<string, Session[]>();
  for (const session of allSessions) {
    const dateKey = format(new Date(session.start * 1000), 'yyyy-MM-dd');
    const existing = sessionsByDay.get(dateKey) || [];
    sessionsByDay.set(dateKey, [...existing, session]);
  }

  // Generate calendar days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
  // Convert to Monday-based (0 = Monday, 6 = Sunday)
  const firstDayOfWeek = (getDay(monthStart) + 6) % 7;

  useInput((input, key) => {
    if (mode === 'calendar') {
      // Navigation in calendar mode
      if (key.leftArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newDate = daysInMonth[currentIndex - 1];
        if (currentIndex > 0 && newDate) {
          setSelectedDate(newDate);
        }
      } else if (key.rightArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newDate = daysInMonth[currentIndex + 1];
        if (currentIndex < daysInMonth.length - 1 && newDate) {
          setSelectedDate(newDate);
        }
      } else if (key.upArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex - 7;
        const newDate = daysInMonth[newIndex];
        if (newIndex >= 0 && newDate) {
          setSelectedDate(newDate);
        }
      } else if (key.downArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex + 7;
        const newDate = daysInMonth[newIndex];
        if (newIndex < daysInMonth.length && newDate) {
          setSelectedDate(newDate);
        }
      } else if (input === 'n') {
        // Next month
        const newMonth = addMonths(currentMonth, 1);
        setCurrentMonth(newMonth);
        setSelectedDate(startOfMonth(newMonth));
      } else if (input === 'p') {
        // Previous month
        const newMonth = subMonths(currentMonth, 1);
        setCurrentMonth(newMonth);
        setSelectedDate(startOfMonth(newMonth));
      } else if (key.return) {
        // Enter day view
        setMode('day');
      } else if (key.escape || input === 'q') {
        // Done - exit
        onDone();
        exit();
      }
    }
  });

  // Calculate existing sessions in current month
  let existingDays = 0;
  let existingHours = 0;
  sessionsByDay.forEach((daySessions, dateKey) => {
    const date = new Date(dateKey);
    if (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    ) {
      existingDays += 1;
      daySessions.forEach((session) => {
        if (session.end) {
          existingHours += (session.end - session.start) / 3600;
        }
      });
    }
  });

  // Render calendar grid
  const renderCalendar = () => {
    const weeks: React.ReactNode[] = [];
    let week: React.ReactNode[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      week.push(
        <Box key={`empty-${i}`} width={6}>
          <Text> </Text>
        </Box>
      );
    }

    // Add days
    daysInMonth.forEach((day, index) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const hasSessions = sessionsByDay.has(dateKey);
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

      // Start new week on Sunday
      if ((firstDayOfWeek + index + 1) % 7 === 0 || index === daysInMonth.length - 1) {
        weeks.push(
          <Box key={`week-${weeks.length}`}>
            {week}
          </Box>
        );
        week = [];
      }
    });

    return weeks;
  };

  if (mode === 'day') {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const daySessions = sessionsByDay.get(dateKey) || [];

    return (
      <DayEntryView
        date={selectedDate}
        existingSessions={daySessions}
        onAddSession={(session) => {
          onCreateSession(session.start, session.end);
          setCreatedSessions((prev) => [...prev, session]);
          setMode('calendar');
        }}
        onBack={() => setMode('calendar')}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold>Create sessions for "{timerName}"</Text>
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

      <Box flexDirection="column">
        {renderCalendar()}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>←↑↓→ Navigate   n/p: Next/Prev month   Enter: Add session   q: Done</Text>
        <Text> </Text>
        <Text color="green">• = has sessions</Text>
        <Text>
          {existingDays} {existingDays === 1 ? 'day' : 'days'} this month, {Math.round(existingHours)}h total
        </Text>
        {createdSessions.length > 0 && (
          <Text color="green">✓ Created {createdSessions.length} {createdSessions.length === 1 ? 'session' : 'sessions'}</Text>
        )}
      </Box>
    </Box>
  );
}

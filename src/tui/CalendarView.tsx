import React, { useState, useEffect } from 'react';
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
  startOfDay,
  endOfDay,
} from 'date-fns';
import { DayEntryView } from './DayEntryView';

type Session = {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
};

type Props = {
  timerName: string;
  onSave: (sessions: Session[]) => void;
  onCancel: () => void;
};

export function CalendarView({ timerName, onSave, onCancel }: Props) {
  const { exit } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState<Map<string, Session[]>>(new Map());
  const [mode, setMode] = useState<'calendar' | 'day'>('calendar');

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
        if (currentIndex > 0) {
          setSelectedDate(daysInMonth[currentIndex - 1]);
        }
      } else if (key.rightArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        if (currentIndex < daysInMonth.length - 1) {
          setSelectedDate(daysInMonth[currentIndex + 1]);
        }
      } else if (key.upArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex - 7;
        if (newIndex >= 0) {
          setSelectedDate(daysInMonth[newIndex]);
        }
      } else if (key.downArrow) {
        const currentIndex = daysInMonth.findIndex((d) => isSameDay(d, selectedDate));
        const newIndex = currentIndex + 7;
        if (newIndex < daysInMonth.length) {
          setSelectedDate(daysInMonth[newIndex]);
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
      } else if (key.escape) {
        // Save and exit
        const allSessions: Session[] = [];
        sessions.forEach((daySessions) => {
          allSessions.push(...daySessions);
        });
        onSave(allSessions);
        exit();
      }
    }
  });

  // Calculate total sessions and hours for the month
  let totalDays = 0;
  let totalHours = 0;
  sessions.forEach((daySessions, dateKey) => {
    const date = new Date(dateKey);
    if (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    ) {
      totalDays += 1;
      daySessions.forEach((session) => {
        totalHours += (session.end - session.start) / 3600;
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
      const hasSessions = sessions.has(dateKey);
      const isSelected = isSameDay(day, selectedDate);
      const dayNum = format(day, 'd');

      let displayText = `  ${dayNum.padStart(2, ' ')}`;
      if (hasSessions) displayText += '•';
      else displayText += ' ';

      week.push(
        <Box key={index} width={6}>
          <Text color={isSelected ? 'cyan' : undefined} inverse={isSelected}>
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
    const daySessions = sessions.get(dateKey) || [];

    return (
      <DayEntryView
        date={selectedDate}
        sessions={daySessions}
        onAddSession={(session) => {
          const newSessions = new Map(sessions);
          const existing = newSessions.get(dateKey) || [];
          newSessions.set(dateKey, [...existing, session]);
          setSessions(newSessions);
          setMode('calendar'); // Return to calendar after adding
        }}
        onClearSessions={() => {
          const newSessions = new Map(sessions);
          newSessions.delete(dateKey);
          setSessions(newSessions);
          setMode('calendar'); // Return to calendar after clearing
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
        <Text dimColor>Navigation:</Text>
        <Text dimColor>  ←↑↓→    Navigate days</Text>
        <Text dimColor>  n / p   Next / Previous month</Text>
        <Text dimColor>  Enter   Add/Edit session for selected day</Text>
        <Text dimColor>  Esc     Save all sessions and quit</Text>
        <Text dimColor></Text>
        <Text>
          Sessions this month: {totalDays} {totalDays === 1 ? 'day' : 'days'},{' '}
          {Math.round(totalHours)}h total
        </Text>
      </Box>
    </Box>
  );
}

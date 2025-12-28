import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { format, setHours, setMinutes, startOfDay } from 'date-fns';

type Session = {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
};

type Props = {
  date: Date;
  sessions: Session[];
  onAddSession: (session: Session) => void;
  onClearSessions: () => void;
  onBack: () => void;
};

export function DayEntryView({ date, sessions, onAddSession, onClearSessions, onBack }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  useInput((char, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      setError('');
      return;
    }

    // Handle character input
    if (char) {
      setInput((prev) => prev + char);
      setError('');
    }
  });

  const handleSubmit = () => {
    if (!input.trim()) {
      return;
    }

    const trimmed = input.trim().toLowerCase();

    // Clear command
    if (trimmed === 'c') {
      onClearSessions();
      setInput('');
      setError('');
      return;
    }

    // Quick shortcuts
    if (trimmed === '8') {
      // 09:00-17:00 (8 hours)
      const start = setMinutes(setHours(startOfDay(date), 9), 0);
      const end = setMinutes(setHours(startOfDay(date), 17), 0);
      onAddSession({
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000),
      });
      setInput('');
      setError('');
      return;
    }

    if (trimmed === '4') {
      // 09:00-13:00 (4 hours)
      const start = setMinutes(setHours(startOfDay(date), 9), 0);
      const end = setMinutes(setHours(startOfDay(date), 13), 0);
      onAddSession({
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000),
      });
      setInput('');
      setError('');
      return;
    }

    // Parse HH:MM-HH:MM format
    const timeRangeRegex = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
    const match = trimmed.match(timeRangeRegex);

    if (!match) {
      setError('Invalid format. Use HH:MM-HH:MM (e.g., 14:00-16:00)');
      return;
    }

    const [_, startHour, startMin, endHour, endMin] = match;
    const startH = parseInt(startHour, 10);
    const startM = parseInt(startMin, 10);
    const endH = parseInt(endHour, 10);
    const endM = parseInt(endMin, 10);

    // Validate hours and minutes
    if (startH < 0 || startH > 23 || endH < 0 || endH > 23) {
      setError('Invalid hours (must be 0-23)');
      return;
    }
    if (startM < 0 || startM > 59 || endM < 0 || endM > 59) {
      setError('Invalid minutes (must be 0-59)');
      return;
    }

    // Create timestamps
    const start = setMinutes(setHours(startOfDay(date), startH), startM);
    const end = setMinutes(setHours(startOfDay(date), endH), endM);

    if (end.getTime() <= start.getTime()) {
      setError('End time must be after start time');
      return;
    }

    onAddSession({
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
    });
    setInput('');
    setError('');
  };

  // Calculate total hours for the day
  const totalSeconds = sessions.reduce((total, session) => {
    return total + (session.end - session.start);
  }, 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{format(date, 'EEEE, MMMM d, yyyy')}</Text>
      <Text></Text>

      {sessions.length > 0 ? (
        <>
          <Text>Current sessions:</Text>
          {sessions.map((session, index) => {
            const startTime = format(new Date(session.start * 1000), 'HH:mm');
            const endTime = format(new Date(session.end * 1000), 'HH:mm');
            const duration = Math.floor((session.end - session.start) / 3600);
            const durationMin = Math.floor(((session.end - session.start) % 3600) / 60);
            return (
              <Text key={index}>
                  {index + 1}. {startTime} - {endTime}  ({duration}h{durationMin > 0 ? ` ${durationMin}m` : ''})
              </Text>
            );
          })}
          <Text>
            Total: {totalHours}h{totalMinutes > 0 ? ` ${totalMinutes}m` : ''}
          </Text>
          <Text></Text>
        </>
      ) : (
        <>
          <Text dimColor>No sessions yet for this day</Text>
          <Text></Text>
        </>
      )}

      <Text>Add session:</Text>
      <Text dimColor>  Type:  HH:MM-HH:MM  (e.g., "14:00-16:00")</Text>
      <Text dimColor>  Quick: 8            (09:00-17:00, 8 hours)</Text>
      <Text dimColor>         4            (09:00-13:00, 4 hours)</Text>
      <Text dimColor>  Clear: c            (delete all sessions for this day)</Text>
      <Text dimColor>  Back:  Esc          (return to calendar)</Text>
      <Text></Text>

      <Text>
        &gt; <Text color="cyan">{input}</Text>
      </Text>

      {error && (
        <Text color="red">✗ {error}</Text>
      )}
    </Box>
  );
}

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { format, setHours, setMinutes, startOfDay } from 'date-fns';

type Session = {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
};

type Props = {
  date: Date;
  existingSessions?: Session[];
  onAddSession: (session: Session) => void;
  onBack: () => void;
};

export function DayEntryView({ date, existingSessions = [], onAddSession, onBack }: Props) {
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

    const startH = parseInt(match[1]!, 10);
    const startM = parseInt(match[2]!, 10);
    const endH = parseInt(match[3]!, 10);
    const endM = parseInt(match[4]!, 10);

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

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{format(date, 'EEEE, MMMM d, yyyy')}</Text>
      <Text> </Text>

      {existingSessions.length > 0 ? (
        <>
          <Text>Existing sessions:</Text>
          {existingSessions.map((session, index) => {
            const startTime = format(new Date(session.start * 1000), 'HH:mm');
            const endTime = session.end ? format(new Date(session.end * 1000), 'HH:mm') : 'now';
            const duration = session.end ? Math.floor((session.end - session.start) / 3600) : 0;
            const durationMin = session.end ? Math.floor(((session.end - session.start) % 3600) / 60) : 0;
            return (
              <Text key={`existing-${index}`} dimColor>
                  • {startTime} - {endTime}  ({duration}h{durationMin > 0 ? ` ${durationMin}m` : ''})
              </Text>
            );
          })}
          <Text> </Text>
        </>
      ) : (
        <>
          <Text dimColor>No sessions for this day</Text>
          <Text> </Text>
        </>
      )}

      <Text>Add session (HH:MM-HH:MM):</Text>
      <Text dimColor>Shortcuts: 8=full day (09-17)  4=half day (09-13)  Esc=back</Text>
      <Text> </Text>

      <Text>
        &gt; <Text color="cyan">{input}</Text>
      </Text>

      {error && (
        <Text color="red">✗ {error}</Text>
      )}
    </Box>
  );
}

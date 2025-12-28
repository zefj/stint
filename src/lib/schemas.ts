import { z } from 'zod';

// Timer schema
export const TimerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  createdAt: z.number(),
});

export type Timer = z.infer<typeof TimerSchema>;

// Timer Session schema
export const TimerSessionSchema = z.object({
  id: z.string(),
  timerId: z.string(),
  start: z.number(),
  end: z.number().nullable(),
  createdAt: z.number(),
});

export type TimerSession = z.infer<typeof TimerSessionSchema>;

// Extended type for UI - timer with active session
export type TimerWithSession = Timer & {
  activeSession?: TimerSession;
  totalSeconds?: number;
};

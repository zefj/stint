# Stint - Local CLI Time Tracker

## Project Overview

**Stint** is a fully local CLI time tracking application that combines:
- CLI patterns and structure inspired by `humaans-cli`
- The time tracking domain model and SQLite database from `timetracker`

No web service, no authentication, no API calls - just a simple, fast, local time tracker.

Built with **Bun** for maximum performance and simplicity.

---

## Technical Stack

### Core Framework
- **Runtime**: Bun (>=1.0)
- **CLI Framework**: Commander.js
- **Language**: TypeScript with ES modules
- **Database**: SQLite via Bun's native `bun:sqlite` (zero dependencies)
- **Validation**: Zod for runtime type safety

### Key Dependencies
```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "date-fns": "^4.1.0",
    "zod": "^3.22.4",
    "nanoid": "^5.0.4",
    "@inquirer/prompts": "^5.0.0",
    "ink": "^5.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "@types/node": "^20.10.0",
    "@types/react": "^18.3.0"
  }
}
```

### Why This Stack?
- **Bun**: ~3-4x faster startup than Node, native SQLite, native TypeScript
- **Commander.js**: Lightweight, simple, perfect for our command structure
- **No ORM**: Direct SQL is simpler for 2 tables, zero overhead, maximum performance
- **Zod**: Runtime validation for database results and user input
- **Ink**: React for CLIs - build rich TUI components (calendar view) with familiar React patterns

### Development Tools
- TypeScript strict mode
- Bun's built-in test runner
- ESLint + Prettier

---

## Database Schema

### SQLite Schema (2 Tables)

**Design principle**: Each timer is a named entity that can be started/stopped. Only ONE active session per timer at a time, but multiple timers can run simultaneously.

```sql
-- Timers: Named trackable activities
CREATE TABLE timers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#f5f5f4',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Timer Sessions: Historical records of timer activity
CREATE TABLE timer_sessions (
  id TEXT PRIMARY KEY,
  timer_id TEXT NOT NULL,
  start INTEGER NOT NULL,           -- Unix timestamp (seconds)
  end INTEGER,                       -- null = currently running
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (timer_id) REFERENCES timers(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_sessions_timer ON timer_sessions(timer_id);
CREATE INDEX idx_sessions_end ON timer_sessions(end);        -- Active sessions: WHERE end IS NULL
CREATE INDEX idx_sessions_start ON timer_sessions(start);    -- Date range queries

-- Constraint: Only one active session per timer (enforced in application logic)
```

### TypeScript Types (with Zod)

```typescript
import { z } from 'zod';

export const TimerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  createdAt: z.number(),
});

export const TimerSessionSchema = z.object({
  id: z.string(),
  timerId: z.string(),
  start: z.number(),
  end: z.number().nullable(),
  createdAt: z.number(),
});

export type Timer = z.infer<typeof TimerSchema>;
export type TimerSession = z.infer<typeof TimerSessionSchema>;

// Extended type for UI
export type TimerWithSession = Timer & {
  activeSession?: TimerSession;
  totalSeconds?: number;
};
```

**Key Design Decisions**:
- **Renamed "Bucket" → "Timer"**: Clearer mental model - a timer IS the thing you start/stop
- **Renamed "TimeEntry" → "TimerSession"**: Better reflects that it's a session of activity
- **One active session per timer**: Enforced by checking before starting a new session
- **Removed automation rules**: Simpler - just prevent multiple sessions per timer
- **Removed "uncategorized"**: Every session belongs to a timer (can have a default "Misc" timer)
- **Cascade delete**: Deleting a timer deletes its history (can add soft-delete later if needed)

---

## CLI Command Structure

### Command Hierarchy

```
stint
├── start [TIMER]            # Start a timer (interactive if no arg)
├── stop [TIMER]             # Stop a timer (interactive if no arg)
├── status                   # Show all running timers
├── list                     # List all timers
├── create <TIMER> <FROM> <TO>  # Manually create session (retroactive entry)
├── log [RANGE]              # Show session history
├── report [RANGE]           # Generate time reports with summaries
├── edit <TIMER>             # Edit timer properties (name, color)
├── delete <TIMER>           # Delete a timer and its history
└── help [COMMAND]           # Show help (built-in)
```

### Command Details

#### `stint start [TIMER]`
**With argument:**
- Starts a timer by name
- **Auto-creates** timer if it doesn't exist (with default gray color)
- If timer is already running, shows error
- Shows confirmation with start time

**Without argument (interactive mode):**
- Shows list of all timers (running timers marked)
- Navigate with arrow keys, confirm with Enter
- Option to create new timer at bottom of list
- **Smart shortcut**: If only 1 timer exists, starts it immediately (skip selection)

**Examples**:
```bash
stint start work              # Start "work" timer (creates if needed)
stint start "Deep Work"       # Start timer with spaces in name
stint start                   # Interactive: shows list of timers
```

**Output** (with argument, first time):
```
✓ Created and started "work" timer at 14:23
```

**Output** (interactive):
```
? Select a timer to start:
  ● work (running - 2h 34m)
  ○ personal
  ○ music
  + Create new timer
```

**Output** (single timer shortcut):
```
✓ Started "work" timer at 14:23  (only timer available)
```

#### `stint stop [TIMER]`
**With argument:**
- Stops a running timer by name
- If timer isn't running, shows error
- Shows duration of stopped session

**Without argument (interactive mode):**
- Shows list of ONLY running timers
- Navigate with arrow keys, confirm with Enter
- **Smart shortcut**: If only 1 timer is running, stops it immediately (skip selection)
- If no timers running, shows message

**Examples**:
```bash
stint stop work               # Stop "work" timer
stint stop "Deep Work"        # Stop timer with spaces
stint stop                    # Interactive: shows list of running timers
```

**Output** (with argument):
```
✓ Stopped "work" timer
  Duration: 2h 34m
```

**Output** (interactive):
```
? Select a timer to stop:
  work (2h 34m)
  music (45m)
```

**Output** (single running timer shortcut):
```
✓ Stopped "work" timer  (only timer running)
  Duration: 2h 34m
```

**Output** (no running timers):
```
No timers are currently running.
Use 'stint start' to start a timer.
```

#### `stint status`
- Lists all currently running timers
- Shows: Timer name, Start time, Elapsed duration
- Color-coded by timer color
- If no timers running, show helpful message

**Output Example**:
```
Running Timers:
  work        2h 34m  (started at 14:23)
  music       45m     (started at 16:12)

Total: 2 timers running
```

#### `stint list`
- Shows all timers (running and stopped)
- Displays: Name, Status (running/stopped), Total time tracked
- Color-coded
- Sorted by last used or alphabetically

**Output Example**:
```
Timers:
  ● work        Running (2h 34m)    Total: 142h 18m
  ○ personal    Stopped             Total: 38h 45m
  ○ music       Running (45m)       Total: 12h 30m
```

#### `stint create <TIMER> <FROM> <TO>`
**Purpose**: Manually create timer sessions for retroactive time entry (PTO, forgot to track, historical data)

**Direct mode (two datetime arguments):**
```bash
stint create work 2025-12-28T09:00 2025-12-28T17:00
```
- Both arguments must be ISO 8601 datetime (YYYY-MM-DDTHH:MM)
- Creates a single session
- Auto-creates timer if it doesn't exist

**Interactive mode (`--interactive`):**
```bash
stint create work --interactive
```
- Full calendar TUI for visual session entry
- Navigate months and days with arrow keys
- Select day → enter session times
- Quick shortcuts: `8` for 8hrs, `4` for 4hrs
- Sessions saved on Escape from calendar

---

### Interactive Mode UX

**Calendar View:**
```
Create sessions for "work"                    December 2025

    Mon   Tue   Wed   Thu   Fri   Sat   Sun
                              1     2     3
     4     5     6     7    [8]    9•   10
    11    12    13    14    15    16    17
    18    19    20    21    22    23    24
    25    26    27    28    29    30    31

[8]  = Currently selected day (highlighted)
  9• = Has session(s) (marked with dot)

Navigation:
  ←↑↓→    Navigate days
  n / p   Next / Previous month
  Enter   Add/Edit session for selected day
  Esc     Save all sessions and quit

Sessions this month: 3 days, 24h total
```

**Day Entry View** (press Enter on a day):
```
Monday, December 8, 2025

Current sessions:
  1. 09:00 - 12:00  (3h)
  2. 13:00 - 17:00  (4h)
  Total: 7h

Add session:
  Type:  HH:MM-HH:MM  (e.g., "14:00-16:00")
  Quick: 8            (09:00-17:00, 8 hours)
         4            (09:00-13:00, 4 hours)
  Clear: c            (delete all sessions for this day)
  Back:  Esc          (return to calendar)

> 8

✓ Added session: 09:00-17:00 (8h)

[Automatically returns to calendar view]
```

**Exit Prompt** (press Esc from calendar):
```
? Save 3 new sessions for "work"? (24h total)
  Yes / No

[If Yes]
✓ Created 3 sessions for "work" (24h total)
```

---

**Examples**:
```bash
# Direct: single session with ISO datetimes
stint create work 2025-12-28T09:00 2025-12-28T17:00

# Interactive: calendar TUI
stint create work --interactive

# Interactive shorthand
stint create work -i
```

#### `stint log [RANGE]`
- Shows completed timer sessions
- Range options: `today`, `yesterday`, `week`, `month`, `YYYY-MM-DD`, `YYYY-MM-DD..YYYY-MM-DD`
- Groups by day, shows durations per timer
- Default: today

**Examples**:
```bash
stint log                     # Today's sessions
stint log yesterday
stint log week                # Last 7 days
stint log 2025-12-01          # Specific day
stint log 2025-12-01..2025-12-15  # Date range
```

**Output Example**:
```
Sessions for Today (2025-12-28):

work
  14:23 - 16:57  (2h 34m)
  09:15 - 12:00  (2h 45m)

music
  16:12 - 16:57  (45m)

Total: 6h 4m
```

#### `stint report [RANGE]`
- Generates summary reports with statistics
- Shows: Total time per timer, sessions count, average session duration
- Formatted table output
- Same range options as `log`

**Output Example**:
```
Time Report (2025-12-01 to 2025-12-15)

Timer           Sessions    Total Time    Avg/Session
work            42          87h 15m       2h 5m
personal        18          12h 30m       42m
music           24          8h 45m        22m
─────────────────────────────────────────────────────
TOTAL           84          108h 30m      1h 18m
```

#### `stint edit <TIMER>`
- Edit timer properties (name, color)
- Can rename a timer
- Can change color

**Examples**:
```bash
stint edit work --name "Work Projects"
stint edit work --color green
```

#### `stint delete <TIMER>`
- Deletes a timer and all its history
- Requires confirmation (unless `--force` flag)
- Cannot delete a running timer (must stop first)

**Examples**:
```bash
stint delete work              # Prompts for confirmation
stint delete work --force      # Skip confirmation
```

#### `stint log [RANGE]`
- Shows completed timer sessions
- Range options: `today`, `yesterday`, `week`, `month`, `YYYY-MM-DD`, `YYYY-MM-DD..YYYY-MM-DD`
- Groups by day, shows durations per timer
- Default: today

**Examples**:
```bash
stint log                     # Today's sessions
stint log yesterday
stint log week                # Last 7 days
stint log 2025-12-01          # Specific day
stint log 2025-12-01..2025-12-15  # Date range
```

**Output Example**:
```
Sessions for Today (2025-12-28):

work
  14:23 - 16:57  (2h 34m)
  09:15 - 12:00  (2h 45m)

music
  16:12 - 16:57  (45m)

Total: 6h 4m
```

#### `stint report [RANGE]`
- Generates summary reports with statistics
- Shows: Total time per timer, sessions count, average session duration
- Formatted table output
- Same range options as `log`

**Output Example**:
```
Time Report (2025-12-01 to 2025-12-15)

Timer           Sessions    Total Time    Avg/Session
work            42          87h 15m       2h 5m
personal        18          12h 30m       42m
music           24          8h 45m        22m
─────────────────────────────────────────────────────
TOTAL           84          108h 30m      1h 18m
```

---

## Architecture & Code Organization

### Directory Structure

```
src/
├── index.ts                          # CLI entry point (Commander program setup)
├── commands/
│   ├── start.ts                      # Start timer (auto-creates if needed)
│   ├── stop.ts                       # Stop timer
│   ├── status.ts                     # Show running timers
│   ├── list.ts                       # List all timers
│   ├── create.ts                     # Manually create sessions (retroactive)
│   ├── log.ts                        # Show session history
│   ├── report.ts                     # Generate reports
│   ├── edit.ts                       # Edit timer (name, color)
│   └── delete.ts                     # Delete timer
├── components/                       # Ink React components (TUI)
│   ├── Calendar.tsx                  # Calendar month view with navigation
│   ├── DayEntry.tsx                  # Day session entry view
│   └── SessionCreator.tsx            # Main TUI orchestrator
├── lib/
│   ├── db.ts                         # Database initialization & queries
│   ├── timer.ts                      # Timer business logic (auto-create, start, stop)
│   ├── session.ts                    # Session creation & manipulation utilities
│   ├── format.ts                     # Duration formatting, table output
│   ├── date-utils.ts                 # Date parsing and range handling
│   ├── colors.ts                     # Color constants and utilities
│   └── schemas.ts                    # Zod schemas & TypeScript types
└── migrations/
    ├── 001_initial_schema.sql        # Initial database schema
    └── migrate.ts                    # Migration runner

test/
└── commands/                         # Command tests (Bun test)
```

### Key Files

#### Entry Point (`src/index.ts`)
```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { statusCommand } from './commands/status';
import { listCommand } from './commands/list';
import { createCommand } from './commands/create';
import { logCommand } from './commands/log';
import { reportCommand } from './commands/report';
import { editCommand } from './commands/edit';
import { deleteCommand } from './commands/delete';

const program = new Command();

program
  .name('stint')
  .description('Local CLI time tracker')
  .version('1.0.0');

// Core timer operations
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(listCommand);

// Manual session creation
program.addCommand(createCommand);

// Reporting
program.addCommand(logCommand);
program.addCommand(reportCommand);

// Timer management
program.addCommand(editCommand);
program.addCommand(deleteCommand);

program.parse();
```

#### Database Setup (`src/lib/db.ts`)
```typescript
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';

// Database location: ~/.stint/stint.db
const DB_DIR = join(homedir(), '.stint');
const DB_PATH = join(DB_DIR, 'stint.db');

// Singleton database instance
let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    // Ensure directory exists
    if (!Bun.file(DB_DIR).exists()) {
      await Bun.write(DB_DIR + '/.keep', '');
    }

    _db = new Database(DB_PATH, { create: true });
    _db.exec('PRAGMA foreign_keys = ON');
  }
  return _db;
}

// Prepared statements (export for use in commands)
export const queries = {
  // Timers
  getAllTimers: getDb().query<Timer, []>(`
    SELECT * FROM timers ORDER BY name
  `),

  getTimerByName: getDb().query<Timer, [string]>(`
    SELECT * FROM timers WHERE name = ?
  `),

  getTimerById: getDb().query<Timer, [string]>(`
    SELECT * FROM timers WHERE id = ?
  `),

  createTimer: getDb().prepare(`
    INSERT INTO timers (id, name, color)
    VALUES (?, ?, ?)
  `),

  updateTimer: getDb().prepare(`
    UPDATE timers SET name = ?, color = ?
    WHERE id = ?
  `),

  deleteTimer: getDb().prepare(`
    DELETE FROM timers WHERE id = ?
  `),

  // Timer Sessions
  startSession: getDb().prepare(`
    INSERT INTO timer_sessions (id, timer_id, start)
    VALUES (?, ?, ?)
  `),

  stopSession: getDb().prepare(`
    UPDATE timer_sessions SET end = ?
    WHERE id = ?
  `),

  getActiveSession: getDb().query<TimerSession, [string]>(`
    SELECT * FROM timer_sessions
    WHERE timer_id = ? AND end IS NULL
    LIMIT 1
  `),

  getAllActiveSessions: getDb().query<TimerSession, []>(`
    SELECT * FROM timer_sessions
    WHERE end IS NULL
    ORDER BY start DESC
  `),

  getSessionsInRange: getDb().query<TimerSession, [number, number]>(`
    SELECT * FROM timer_sessions
    WHERE start >= ? AND start <= ?
    ORDER BY start DESC
  `),

  getSessionsForTimer: getDb().query<TimerSession, [string, number, number]>(`
    SELECT * FROM timer_sessions
    WHERE timer_id = ? AND start >= ? AND start <= ?
    ORDER BY start DESC
  `),
};
```

#### Timer Business Logic (`src/lib/timer.ts`)
```typescript
import { Database } from 'bun:sqlite';
import { nanoid } from 'nanoid';
import { Timer, TimerSession, TimerSchema, TimerSessionSchema } from './schemas';
import { getDb, queries } from './db';

export function getTimerByName(name: string): Timer | null {
  const db = getDb();
  const result = queries.getTimerByName.get(name);
  return result ? TimerSchema.parse(result) : null;
}

export function createTimer(name: string, color: string = '#f5f5f4'): Timer {
  const db = getDb();
  const id = nanoid();

  queries.createTimer.run(id, name, color);

  const result = queries.getTimerById.get(id);
  return TimerSchema.parse(result);
}

export function startTimer(timerName: string): { session: TimerSession; created: boolean } {
  const db = getDb();
  let timer = getTimerByName(timerName);
  let created = false;

  // Auto-create timer if it doesn't exist
  if (!timer) {
    timer = createTimer(timerName);  // Uses default gray color
    created = true;
  }

  // Check if timer already has an active session
  const activeSession = queries.getActiveSession.get(timer.id);
  if (activeSession) {
    throw new Error(`Timer "${timerName}" is already running`);
  }

  // Create new session
  const now = Math.floor(Date.now() / 1000);
  const sessionId = nanoid();

  queries.startSession.run(sessionId, timer.id, now);

  const result = db.query('SELECT * FROM timer_sessions WHERE id = ?').get(sessionId);
  return {
    session: TimerSessionSchema.parse(result),
    created,
  };
}

export function stopTimer(timerName: string): TimerSession {
  const db = getDb();
  const timer = getTimerByName(timerName);

  if (!timer) {
    throw new Error(`Timer "${timerName}" not found`);
  }

  // Find active session
  const activeSession = queries.getActiveSession.get(timer.id);
  if (!activeSession) {
    throw new Error(`Timer "${timerName}" is not running`);
  }

  // Stop the session
  const now = Math.floor(Date.now() / 1000);
  queries.stopSession.run(now, activeSession.id);

  const result = db.query('SELECT * FROM timer_sessions WHERE id = ?').get(activeSession.id);
  return TimerSessionSchema.parse(result);
}

export function getActiveSessions(): TimerSession[] {
  const results = queries.getAllActiveSessions.all();
  return results.map(r => TimerSessionSchema.parse(r));
}

export function getTimersWithActiveSessions(): Array<Timer & { activeSession: TimerSession }> {
  const db = getDb();
  const timers = queries.getAllTimers.all().map(t => TimerSchema.parse(t));

  return timers
    .map(timer => {
      const session = queries.getActiveSession.get(timer.id);
      return session ? { ...timer, activeSession: TimerSessionSchema.parse(session) } : null;
    })
    .filter(Boolean) as Array<Timer & { activeSession: TimerSession }>;
}
```

#### Formatting Utilities (`src/lib/format.ts`)
```typescript
import { intervalToDuration } from 'date-fns';
import { TimerSession } from './schemas';

export function formatDuration(seconds: number): string {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });

  const parts: string[] = [];
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (!parts.length && duration.seconds) parts.push(`${duration.seconds}s`);

  return parts.join(' ') || '0s';
}

export function getSessionDuration(session: TimerSession): number {
  const end = session.end ?? Math.floor(Date.now() / 1000);
  return end - session.start;
}

export function getTotalDuration(sessions: TimerSession[]): number {
  return sessions.reduce((total, session) => {
    return total + getSessionDuration(session);
  }, 0);
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
```

#### Color Utilities (`src/lib/colors.ts`)
```typescript
import chalk from 'chalk';

export const TIMER_COLORS = [
  'gray', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
] as const;

export type TimerColor = typeof TIMER_COLORS[number];

// Map color names to hex values
export const COLOR_HEX: Record<TimerColor, string> = {
  gray: '#9ca3af',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

// Get chalk color function for terminal output
export function getChalkColor(hexColor: string) {
  return chalk.hex(hexColor);
}
```

#### Example: Interactive Start Command (`src/commands/start.ts`)
```typescript
import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import { startTimer, getTimerByName, createTimer } from '../lib/timer';
import { queries } from '../lib/db';
import { getChalkColor } from '../lib/colors';
import { formatTime } from '../lib/format';

export const startCommand = new Command('start')
  .argument('[timer]', 'timer name')
  .description('Start a timer')
  .action(async (timerName?: string) => {
    // If timer name provided, start it directly
    if (timerName) {
      const { session, created } = startTimer(timerName);
      const prefix = created ? 'Created and started' : 'Started';
      console.log(`✓ ${prefix} "${timerName}" timer at ${formatTime(session.start)}`);
      return;
    }

    // Interactive mode: no argument provided
    const allTimers = queries.getAllTimers.all();

    // Smart shortcut: if only 1 timer exists, start it immediately
    if (allTimers.length === 1) {
      const timer = allTimers[0];
      const { session } = startTimer(timer.name);
      console.log(`✓ Started "${timer.name}" timer at ${formatTime(session.start)}  (only timer available)`);
      return;
    }

    // Build choices for interactive selection
    const choices = allTimers.map(timer => {
      const activeSession = queries.getActiveSession.get(timer.id);
      const status = activeSession ? '● running' : '○';
      const color = getChalkColor(timer.color);

      return {
        name: `${status} ${color(timer.name)}`,
        value: timer.name,
        disabled: activeSession ? '(already running)' : false,
      };
    });

    // Add "Create new timer" option
    choices.push({
      name: '+ Create new timer',
      value: '__CREATE_NEW__',
      disabled: false,
    });

    // Show interactive selection
    const selected = await select({
      message: 'Select a timer to start:',
      choices,
    });

    // Handle "Create new timer"
    if (selected === '__CREATE_NEW__') {
      const newTimerName = await input({
        message: 'Timer name:',
        validate: (value) => {
          if (!value.trim()) return 'Timer name cannot be empty';
          if (getTimerByName(value)) return `Timer "${value}" already exists`;
          return true;
        },
      });

      const { session } = startTimer(newTimerName);
      console.log(`✓ Created and started "${newTimerName}" timer at ${formatTime(session.start)}`);
      return;
    }

    // Start selected timer
    const { session } = startTimer(selected);
    console.log(`✓ Started "${selected}" timer at ${formatTime(session.start)}`);
  });
```

---

## Key Features

### 1. Interactive Timer Selection
- **`stint start`** without arguments shows interactive timer list
- **`stint stop`** without arguments shows running timers to stop
- Navigate with arrow keys, confirm with Enter
- **Smart shortcuts**: Auto-select if only 1 timer exists (start) or 1 timer running (stop)
- Fast workflow: type name directly OR use arrow keys to select

### 2. One Active Session Per Timer
- Each timer can only have ONE running session at a time
- Prevents accidentally running multiple sessions of the same timer
- Clear mental model: a timer represents a single trackable activity
- Multiple different timers can run simultaneously (e.g., "work" + "music")

### 3. Named Timers
- Timers are identified by human-readable names
- No need to remember IDs - use names in all commands
- Unique names enforced at database level
- Names can contain spaces (e.g., "Deep Work", "Email Processing")

### 4. Active Session Detection
- `TimerSession.end = null` indicates running session
- Queries filter by `end IS NULL` for efficiency
- Duration calculated as `now() - session.start`
- Fast lookups with proper indexes

### 5. Multi-day Session Support
- Sessions can span multiple days (e.g., overnight work)
- Distribution logic handles midnight boundaries correctly
- Reports clamp sessions to date range boundaries for accurate totals
- Prevents double-counting when sessions cross day boundaries

### 6. Color-Coded Terminal Output
- Each timer has a configurable color (hex value)
- Terminal output uses chalk for color-coded timer names
- Improves visual scanning of status/log output
- 18 predefined color options or custom hex values

### 7. Flexible Date Ranges
- **Natural language**: `today`, `yesterday`, `week`, `month`
- **ISO dates**: `2025-12-28`
- **Ranges**: `2025-12-01..2025-12-15`
- **Relative** (future): `last-week`, `last-month`
- Default to "today" when no range specified

### 8. Manual Session Creation (Retroactive Entry)
- **`stint create`** for adding historical time entries
- **Direct mode**: Create single session with ISO datetime timestamps
- **Interactive calendar TUI**: Visual session entry with Ink (React for CLIs)
  - Navigate months with arrow keys
  - Select days and enter session times
  - Quick shortcuts: `8` (8hrs), `4` (4hrs)
  - See which days have sessions (marked with dot)
  - Sessions saved on exit confirmation
- Perfect for: PTO, forgot to track, filling gaps, corrections

### 9. Persistent History
- All timer sessions are stored in database
- Never lose historical data (unless timer is deleted)
- Generate reports for any date range
- Track total time per timer across all history

---

## Implementation Phases

### Phase 1: Project Setup ✓
- [x] Initialize git repository
- [ ] Initialize Bun project (`bun init`)
- [ ] Configure TypeScript with strict mode
- [ ] Add dependencies (commander, chalk, date-fns, zod)
- [ ] Create initial database schema SQL
- [ ] Create database initialization & migration system
- [ ] Configure ESLint and Prettier
- [ ] Set up package.json with proper bin entry

### Phase 2: Core Infrastructure
- [ ] Create `src/lib/db.ts` - Database singleton & queries
- [ ] Create `src/lib/schemas.ts` - Zod schemas for validation
- [ ] Create migration runner (`src/migrations/migrate.ts`)
- [ ] Apply initial schema migration
- [ ] Create `src/index.ts` - Commander CLI entry point
- [ ] Add shebang and make executable
- [ ] Test database connection and queries

### Phase 3: Core Timer Operations
- [ ] Implement `src/lib/timer.ts` - Timer business logic (start/stop/get)
- [ ] Implement `src/lib/format.ts` - Duration formatting utilities
- [ ] Build `stint start [timer]` command with interactive mode
  - [ ] With argument: start by name (auto-create if needed)
  - [ ] Without argument: show interactive list with @inquirer/prompts
  - [ ] Smart shortcut: auto-start if only 1 timer exists
  - [ ] Include "Create new timer" option in list
- [ ] Build `stint stop [timer]` command with interactive mode
  - [ ] With argument: stop by name
  - [ ] Without argument: show running timers list
  - [ ] Smart shortcut: auto-stop if only 1 timer running
  - [ ] Handle case: no timers running
- [ ] Build `stint status` command
- [ ] Add colored output with chalk
- [ ] Add validation: prevent multiple active sessions per timer
- [ ] Test basic timer workflow (start/stop/status)
- [ ] Test interactive mode (arrow keys, selection, shortcuts)

### Phase 4: Manual Session Creation
- [ ] Implement `src/lib/session.ts` - Session creation utilities
- [ ] Implement ISO 8601 datetime parsing (YYYY-MM-DDTHH:MM)
- [ ] Build `stint create <timer> <from> <to>` command (direct mode)
  - [ ] Parse and validate ISO 8601 timestamps
  - [ ] Auto-create timer if doesn't exist
  - [ ] Validate session doesn't overlap with existing
  - [ ] Store session in database
- [ ] Build interactive calendar TUI (`--interactive` flag)
  - [ ] Create Ink React component: Calendar view
    - [ ] Render month grid with day numbers
    - [ ] Highlight selected day
    - [ ] Mark days with existing sessions (dot indicator)
    - [ ] Show month/year navigation (n/p keys)
    - [ ] Arrow key navigation between days
    - [ ] Display session summary (days count, total hours)
  - [ ] Create Ink React component: Day entry view
    - [ ] Display current sessions for selected day
    - [ ] Input field for time range (HH:MM-HH:MM)
    - [ ] Quick shortcuts: `8`, `4` for preset hours
    - [ ] Clear option: `c` to delete all sessions
    - [ ] Return to calendar on Esc
  - [ ] Implement state management
    - [ ] Track pending sessions (not saved until exit)
    - [ ] Track current month/selected day
    - [ ] Track view mode (calendar vs day entry)
  - [ ] Exit flow: Esc from calendar → confirm save prompt
  - [ ] Bulk insert all pending sessions on confirmation
- [ ] Test manual session creation (direct mode, calendar TUI, overlaps)

### Phase 5: History & Reporting
- [ ] Implement date range parsing (`src/lib/date-utils.ts`)
- [ ] Implement session grouping/distribution logic (`src/lib/session.ts`)
- [ ] Build `stint log [range]` command (show sessions by day)
- [ ] Implement report aggregation logic (total time, avg session, etc.)
- [ ] Build `stint report [range]` command with formatted table output
- [ ] Handle multi-day sessions correctly (midnight boundary)
- [ ] Add tests for date range queries and edge cases

### Phase 6: Timer Management
- [ ] Implement `src/lib/colors.ts` - Color constants and utilities
- [ ] Implement timer validation with Zod
- [ ] Build `stint list` command (show all timers with status)
- [ ] Build `stint edit <timer>` command (rename, change color)
- [ ] Build `stint delete <timer>` command (with confirmation)
- [ ] Test timer operations (list, edit, delete)
- [ ] Test edge cases (duplicate names, deleting active timer, etc.)

### Phase 7: Polish & Testing
- [ ] Add comprehensive error handling (try/catch, validation)
- [ ] Implement confirmation prompts (delete, stop all)
- [ ] Add detailed help text and examples to all commands
- [ ] Write Bun tests for all commands
- [ ] Add edge case tests (overlapping timers, multi-day, etc.)
- [ ] Optimize database queries (verify indexes)
- [ ] Create comprehensive README with examples
- [ ] Add TypeScript build step for distribution

### Phase 7: Distribution
- [ ] Create standalone executable with `bun build --compile`
- [ ] Test binary on macOS, Linux, Windows
- [ ] Add install instructions (Homebrew, manual download)
- [ ] Consider publishing to npm/bun registry

---

## Design Decisions

### Why Bun instead of Node?
- **Faster startup**: ~3-4x faster than Node (critical for CLI UX)
- **Native SQLite**: Built-in `bun:sqlite` - no C++ compilation needed
- **Native TypeScript**: No transpilation step in development
- **Single binary**: Easier distribution with `bun build --compile`
- **Better performance**: Faster I/O, faster runtime
- **Modern tooling**: Built-in test runner, package manager, bundler

### Why Commander.js instead of oclif?
- **Lightweight**: Minimal overhead, faster startup
- **Simpler**: Less boilerplate, more straightforward code
- **Right-sized**: Perfect for our command structure
- **Flexible**: Easy to customize without fighting framework
- **Battle-tested**: 45k+ stars, used by thousands of projects
- oclif is great for complex CLIs with plugins - overkill for stint

### Why No ORM (Direct SQL)?
- **Simplest**: 2 tables don't need ORM abstraction
- **Fastest**: Zero overhead, direct SQLite calls
- **Readable**: SQL is more readable than query builders for simple queries
- **Zero deps**: Bun SQLite is built-in
- **Full control**: Write exactly the SQL you want
- **No magic**: See exactly what queries run
- **Instant startup**: No client generation or initialization

### Why Zod?
- **Runtime validation**: Ensures database results match TypeScript types
- **Type inference**: Generate TypeScript types from schemas
- **User input validation**: Validate CLI arguments and options
- **Error messages**: Clear validation errors for debugging
- **Lightweight**: Small bundle size, minimal overhead
- **Type-safe**: Catch issues at runtime that TypeScript can't

### Why SQLite?
- **Zero configuration**: Single file database
- **Fast**: Perfect for single-user local scenarios
- **Portable**: Database is just a file (easy backup/sync)
- **Offline-first**: Works completely offline by design
- **Proven**: Battle-tested in production apps

### Why Remove User Model?
- **Single-user**: CLI is single-user by design
- **Simpler schema**: Fewer tables, fewer joins
- **Faster queries**: No userId filters needed
- **No auth complexity**: No passwords, sessions, tokens
- **Can add later**: Easy to add multi-user support if needed

### Why Keep Bucket Model?
- **Organization**: Essential for categorizing time entries
- **Automation**: Timer start rules save time
- **Visual**: Color-coding improves terminal UX
- **Reporting**: Bucket summaries are core functionality
- **Low complexity**: Single table, simple relationships

---

## Migration Strategy from Existing Tools

### For humaans users:
1. Export time data from Humaans (if API allows)
2. Transform to Stint schema (map to buckets)
3. Import via Prisma seed script

### For timetracker users:
1. Export SQLite database
2. Strip user-related data
3. Migrate schema (remove User FK constraints)
4. Import into Stint database

---

## Future Enhancements (Post-MVP)

- **Data Export**: CSV, JSON export for time entries
- **Goals & Targets**: Set daily/weekly time goals per bucket
- **Sync**: Optional cloud sync (Dropbox, iCloud, Git)
- **Integrations**: Webhook notifications, Slack integration
- **Calendar View**: ASCII calendar visualization in terminal
- **Reminders**: Notify if no timer running during work hours
- **Tagging**: Add tags to time entries for finer granularity
- **Notes**: Add optional notes/descriptions to time entries
- **Editing**: Edit historical entry start/end times
- **Timer Presets**: Save common bucket + description combos

---

## Success Criteria

A successful `stint` CLI will:
1. ✓ **Instant startup**: Commands execute in <100ms (Bun's fast startup)
2. ✓ **100% offline**: Zero external dependencies or API calls
3. ✓ **Beautiful output**: Clear, colorful terminal interface
4. ✓ **Robust**: Handle edge cases (overlapping timers, multi-day entries)
5. ✓ **Accurate**: Generate precise time reports and summaries
6. ✓ **Fast queries**: All SQLite operations <50ms
7. ✓ **Well-documented**: Comprehensive help text and README
8. ✓ **Tested**: Full test coverage for all workflows
9. ✓ **Small binary**: Compiled executable <10MB
10. ✓ **Simple codebase**: Easy to understand and maintain

---

## File Locations Reference

### From humaans-cli
- CLI Architecture: `/Users/filiprec/Code/humaans-cli/src/`
- Command Examples: `/Users/filiprec/Code/humaans-cli/src/commands/`
- Base Classes: `/Users/filiprec/Code/humaans-cli/src/humaans-command.ts`
- oclif Config: `/Users/filiprec/Code/humaans-cli/package.json` (oclif section)

### From timetracker
- Prisma Schema: `/Users/filiprec/Code/timetracker/prisma/schema.prisma`
- Timer Logic: `/Users/filiprec/Code/timetracker/app/routes/_timer+/timer.server.ts`
- Utilities: `/Users/filiprec/Code/timetracker/app/utils/timers/`
- Type Definitions: `/Users/filiprec/Code/timetracker/app/types/types.d.ts`

---

## Getting Started Commands

```bash
# Initialize Bun project
bun init

# Add dependencies
bun add commander chalk date-fns zod nanoid @inquirer/prompts ink react
bun add -d @types/node @types/react

# Create directory structure
mkdir -p src/{commands,components,lib,migrations}
mkdir -p test/commands

# Create initial files
touch src/index.ts
touch src/lib/{db,schemas,timer,format,bucket,date-utils,distribution}.ts
touch src/migrations/{001_initial_schema.sql,migrate.ts}

# Make CLI executable
chmod +x src/index.ts

# Run migrations
bun run src/migrations/migrate.ts

# Start development
bun run src/index.ts --help

# Or link globally for testing
bun link
stint --help
```

### package.json Configuration

```json
{
  "name": "stint",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "stint": "./src/index.ts"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --compile --outfile stint",
    "test": "bun test"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "date-fns": "^4.1.0",
    "zod": "^3.22.4",
    "nanoid": "^5.0.4",
    "@inquirer/prompts": "^5.0.0",
    "ink": "^5.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.3.0",
    "bun-types": "latest"
  }
}
```

### Initial Migration (src/migrations/001_initial_schema.sql)

```sql
-- Timers: Named trackable activities
CREATE TABLE IF NOT EXISTS timers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#f5f5f4',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Timer Sessions: Historical records of timer activity
CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  timer_id TEXT NOT NULL,
  start INTEGER NOT NULL,
  end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (timer_id) REFERENCES timers(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_timer ON timer_sessions(timer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_end ON timer_sessions(end);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON timer_sessions(start);

-- Note: Only one active session per timer is enforced in application logic
-- (SQLite doesn't support partial indexes or CHECK constraints with subqueries easily)
```

---

## Technology Stack Comparison

### Original Plan vs Final Stack

| Component | Original Plan | Final Stack | Reason for Change |
|-----------|--------------|-------------|-------------------|
| **Runtime** | Node.js >=20.10 | **Bun >=1.0** | 3-4x faster startup, native SQLite/TypeScript |
| **CLI Framework** | oclif v3 | **Commander.js** | Lighter, simpler, faster for our use case |
| **Database Layer** | Prisma ORM | **Bun SQLite (direct)** | Zero deps, instant startup, simpler code |
| **Validation** | Prisma schemas | **Zod** | Runtime validation, type inference |
| **Testing** | Mocha | **Bun test** | Built-in, faster, simpler |
| **Type Checking** | TypeScript strict | **TypeScript strict** | ✓ Same |
| **Styling** | chalk | **chalk** | ✓ Same |
| **Date Utils** | date-fns | **date-fns** | ✓ Same |

### Performance Gains

- **Startup time**: ~250-400ms (Node + oclif + Prisma) → **~50-100ms (Bun + Commander)**
- **Binary size**: ~15-20MB → **~5-8MB**
- **Dependencies**: 8-10 packages → **4 packages** (commander, chalk, date-fns, zod)
- **Complexity**: Medium (ORM, framework) → **Low (direct SQL, simple CLI)**

---

**Ready to build!** This plan provides a clear roadmap from two proven codebases to a focused, high-performance, local-first CLI time tracker built with modern tools.

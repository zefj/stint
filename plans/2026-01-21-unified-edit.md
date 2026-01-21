# Unified Edit Command

## Overview

Replace separate `create` and `delete` commands with a single `edit` command that provides an interactive calendar-based interface for all session management.

## Current State

- `stint create <timer>` - calendar view filtered to one timer, create sessions
- `stint delete [session-id]` - calendar view showing all timers, delete sessions

## Proposed State

- `stint edit` - single interactive command for creating and deleting sessions

## User Flow

### 1. Calendar View
```
stint edit
```

Shows a calendar with all sessions across all timers marked:

```
Create/delete sessions                    January 2026

Mon   Tue   Wed   Thu   Fri   Sat   Sun
           1     2     3     4     5
  6     7     8     9    10    11    12
 13    14    15    16    17    18    19
 20•   21•   22    23    24    25    26
 27    28    29    30    31

←↑↓→ Navigate   n/p: Next/Prev month   Enter: View day   q: Done

• = has sessions
2 days this month, 14h total
```

### 2. Day View

Press Enter on a day to see all sessions:

```
Tuesday, 21 January 2026

  work     09:00 - 12:30  (3h 30m)
  work     14:00 - 17:30  (3h 30m)
❯ music    18:00 - 19:00  (1h)

↑↓ Navigate   d: Delete   c: Create   Esc: Back
```

### 3. Delete Flow

Press `d` on highlighted session:

```
Delete session for "music" (18:00 - 19:00, 1h)?

Enter: Confirm   Esc: Cancel
```

### 4. Create Flow

Press `c` to create a new session:

**Step 1: Timer Selection**
```
Select timer:

❯ work
  music
  + New timer...

↑↓ Navigate   Enter: Select   Esc: Cancel
```

If "New timer..." selected, show text input for timer name.

**Step 2: Time Entry**
```
Add session for "work" on Tuesday, 21 January 2026

Enter time (HH:MM-HH:MM): 13:00-14:00

Shortcuts: 8=full day (09-17)  4=half day (09-13)  Esc=cancel
```

Session is created immediately upon entry.

## Implementation

### New Components

**`src/tui/EditView.tsx`** - Main calendar view (adapt from existing CalendarView)
- Shows all sessions across all timers
- Navigates months/days
- Enter to view day

**`src/tui/DayEditView.tsx`** - Day session list (new)
- Lists all sessions for selected day with timer names
- Highlights current selection
- `d` to delete, `c` to create

**`src/tui/TimerPicker.tsx`** - Timer selection (new)
- Lists existing timers
- Option to create new timer
- Returns selected timer name

### Changes to Existing

**`src/commands/edit.ts`** - Rewrite
- No arguments needed
- Launches EditView

**Remove:**
- `src/commands/create.ts`
- `src/commands/delete.ts`
- `src/tui/CalendarView.tsx` (merge into EditView)
- `src/tui/SessionPicker.tsx` (merge into EditView)

**Update `src/index.ts`:**
- Remove createCommand, deleteCommand
- Keep editCommand

## Key Decisions

1. **No timer argument** - The edit view shows everything, timer is selected when creating

2. **Timer picker for create** - Shows existing timers + "New timer..." option

3. **Immediate operations** - Delete and create happen immediately, no staging/save step

4. **Single day focus** - Day view shows one day at a time, keeps UI simple

## Edge Cases

- **No existing timers**: Timer picker shows only "New timer..." option
- **Empty day**: Day view shows "No sessions" with prompt to create
- **Deleting last session**: Returns to calendar, day no longer marked

## Benefits

1. Single entry point for session management
2. Can see all timers' sessions in one place
3. Easy to fix mistakes (delete wrong, create correct)
4. Discoverable - one command to learn
5. Consistent UX throughout

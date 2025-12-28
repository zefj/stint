import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import { startTimer, getAllTimers, getTimerByName } from '../lib/timer';
import { queries } from '../lib/db';
import { getChalkColor } from '../lib/colors';
import { formatTime } from '../lib/format';

export const startCommand = new Command('start')
  .argument('[timer]', 'timer name')
  .description('Start a timer')
  .action(async (timerName?: string) => {
    try {
      // If timer name provided, start it directly
      if (timerName) {
        const { session, created } = startTimer(timerName);
        const prefix = created ? 'Created and started' : 'Started';
        console.log(`✓ ${prefix} "${timerName}" timer at ${formatTime(session.start)}`);
        return;
      }

      // Interactive mode: no argument provided
      const allTimers = getAllTimers();

      // Smart shortcut: if only 1 timer exists, start it immediately
      if (allTimers.length === 1) {
        const timer = allTimers[0];
        try {
          const { session } = startTimer(timer.name);
          console.log(
            `✓ Started "${timer.name}" timer at ${formatTime(session.start)}  (only timer available)`
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes('already running')) {
            console.error(`✗ Timer "${timer.name}" is already running`);
            process.exit(1);
          }
          throw error;
        }
        return;
      }

      // Build choices for interactive selection
      const choices = allTimers.map((timer) => {
        const activeSession = queries.getActiveSession().get(timer.id);
        const status = activeSession ? '●' : '○';
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
        console.log(
          `✓ Created and started "${newTimerName}" timer at ${formatTime(session.start)}`
        );
        return;
      }

      // Start selected timer
      const { session } = startTimer(selected);
      console.log(`✓ Started "${selected}" timer at ${formatTime(session.start)}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

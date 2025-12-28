#!/usr/bin/env bun

import { Command } from 'commander';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('stint')
  .description('Local CLI time tracker')
  .version('1.0.0');

// Core timer operations
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);

program.parse();

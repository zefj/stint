#!/usr/bin/env bun

import { Command } from 'commander';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { createCommand } from './commands/create';
import { deleteCommand } from './commands/delete';
import { logCommand } from './commands/log';

const program = new Command();

program
  .name('stint')
  .description('Local CLI time tracker')
  .version('1.0.0');

// Core timer operations
program.addCommand(startCommand);
program.addCommand(stopCommand);

// Manual session management
program.addCommand(createCommand);
program.addCommand(deleteCommand);

// History
program.addCommand(logCommand);

program.parse();

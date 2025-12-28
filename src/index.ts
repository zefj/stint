#!/usr/bin/env bun

import { Command } from 'commander';

const program = new Command();

program
  .name('stint')
  .description('Local CLI time tracker')
  .version('1.0.0');

// Commands will be added in Phase 3
// For now, just show help if no command is provided

program.parse();

import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database): void {
  // Create migrations tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Get list of applied migrations
  const applied = db.query('SELECT name FROM _migrations').all() as Array<{ name: string }>;
  const appliedSet = new Set(applied.map((m) => m.name));

  // Get all migration files
  const files = readdirSync(__dirname)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const sql = readFileSync(join(__dirname, file), 'utf-8');

    // Run migration in a transaction
    db.run('BEGIN');
    try {
      db.run(sql);
      db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
      db.run('COMMIT');
      appliedCount++;
      console.log(`✓ Applied: ${file}`);
    } catch (error) {
      db.run('ROLLBACK');
      console.error(`✗ Failed to apply ${file}:`, error);
      throw error;
    }
  }

  if (appliedCount > 0) {
    console.log(`\n✓ Applied ${appliedCount} migration(s)`);
  }
}

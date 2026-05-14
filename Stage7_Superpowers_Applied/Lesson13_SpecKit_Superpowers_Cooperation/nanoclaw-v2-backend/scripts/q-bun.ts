/**
 * scripts/q-bun.ts — Bun-native SQLite CLI replacement for container agents.
 *
 * Usage:
 *   bun /workspace/extra/scripts/q-bun.ts <db-path> "<sql>"
 *
 * Drop-in replacement for q.ts that uses bun:sqlite instead of better-sqlite3,
 * since containers run Bun which lacks the precompiled better-sqlite3 native addon.
 * Output format matches sqlite3 CLI: pipe-separated rows, no header.
 */
import { Database } from 'bun:sqlite';

const [, , dbPath, sql] = process.argv;

if (!dbPath || !sql) {
  process.stderr.write('Usage: bun q-bun.ts <db-path> "<sql>"\n');
  process.exit(1);
}

let db: InstanceType<typeof Database>;
try {
  db = new Database(dbPath);
} catch (e) {
  process.stderr.write(`Failed to open DB at ${dbPath}: ${(e as Error).message}\n`);
  process.exit(1);
}

try {
  const trimmed = sql.trim().toUpperCase();
  const isQuery = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

  if (isQuery) {
    const rows = db.query(sql).all() as Record<string, unknown>[];
    for (const row of rows) {
      process.stdout.write(Object.values(row).join('|') + '\n');
    }
  } else {
    db.run(sql);
  }
} catch (e) {
  process.stderr.write(`SQL error: ${(e as Error).message}\n`);
  process.exit(1);
} finally {
  db.close();
}

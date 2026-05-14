export { registerDailyNewsTask } from './setup.js';
export { fetchAllSources } from './fetcher.js';
export { dedup } from './dedup.js';
export { formatDigest } from './formatter.js';
export { buildTaskPrompt, getNext9amShanghai } from './prompt-builder.js';
export { insertItems, markFailed, markAllFailedForDate, getPendingRepush } from './db.js';

import type Database from 'better-sqlite3';
import { registerDailyNewsTask } from './setup.js';

/**
 * Call once at startup with an active session's inbound DB. Idempotent —
 * skips registration if a pending daily-news task already exists.
 * Returns the new task id, or null if already registered.
 */
export function initDailyNews(inboundDb: Database.Database): string | null {
  const existing = inboundDb
    .prepare(
      "SELECT id FROM messages_in WHERE kind = 'task' AND status IN ('pending', 'paused') AND content LIKE '%daily%'",
    )
    .get();
  if (existing) return null;
  return registerDailyNewsTask(inboundDb);
}

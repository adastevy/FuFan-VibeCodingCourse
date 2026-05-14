import type Database from 'better-sqlite3';
import type { DeliveryRecord } from './types.js';

export function insertItems(db: Database.Database, records: DeliveryRecord[]): void {
  const stmt = db.prepare(
    `INSERT INTO daily_news (date, source, title, summary, url, pushed_at, failed)
     VALUES (@date, @source, @title, @summary, @url, @pushedAt, @failed)`,
  );
  const insertAll = db.transaction((rows: DeliveryRecord[]) => {
    for (const row of rows) stmt.run(row);
  });
  insertAll(records);
}

export function markFailed(db: Database.Database, url: string, date: string): void {
  db.prepare('UPDATE daily_news SET failed = 1 WHERE url = ? AND date = ?').run(url, date);
}

/** Mark all daily_news rows for a given date as failed (used when WeChat delivery fails entirely). */
export function markAllFailedForDate(db: Database.Database, date: string): void {
  db.prepare('UPDATE daily_news SET failed = 1 WHERE date = ? AND failed = 0').run(date);
}

export function getPendingRepush(db: Database.Database): DeliveryRecord[] {
  return (
    db.prepare('SELECT * FROM daily_news WHERE failed = 1').all() as Array<{
      date: string;
      source: string;
      title: string;
      summary: string;
      url: string;
      pushed_at: string | null;
      failed: number;
    }>
  ).map((row) => ({
    date: row.date,
    source: row.source,
    title: row.title,
    summary: row.summary,
    url: row.url,
    pushedAt: row.pushed_at,
    failed: row.failed as 0 | 1,
  }));
}

import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_news (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,
      source     TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      summary    TEXT    NOT NULL,
      url        TEXT    NOT NULL,
      pushed_at  TEXT,
      failed     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_daily_news_date
      ON daily_news (date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_news_url_date
      ON daily_news (url, date);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX  IF EXISTS idx_daily_news_url_date;
    DROP INDEX  IF EXISTS idx_daily_news_date;
    DROP TABLE  IF EXISTS daily_news;
  `);
}

export const migration014: Migration = {
  version: 14,
  name: 'daily-news',
  up,
};

import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_tasks (
      id           TEXT    PRIMARY KEY,
      topic        TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending',
      created_at   TEXT    NOT NULL,
      started_at   TEXT,
      completed_at TEXT,
      error        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_tasks_status
      ON content_tasks (status);
    CREATE INDEX IF NOT EXISTS idx_content_tasks_created
      ON content_tasks (created_at DESC);

    CREATE TABLE IF NOT EXISTS content_articles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      TEXT    NOT NULL REFERENCES content_tasks(id),
      platform     TEXT    NOT NULL,
      title        TEXT,
      content      TEXT    NOT NULL,
      tags         TEXT,
      word_count   INTEGER,
      created_at   TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_articles_task
      ON content_articles (task_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_articles_task_platform
      ON content_articles (task_id, platform);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX  IF EXISTS idx_content_articles_task_platform;
    DROP INDEX  IF EXISTS idx_content_articles_task;
    DROP TABLE  IF EXISTS content_articles;
    DROP INDEX  IF EXISTS idx_content_tasks_created;
    DROP INDEX  IF EXISTS idx_content_tasks_status;
    DROP TABLE  IF EXISTS content_tasks;
  `);
}

export const migration015: Migration = {
  version: 15,
  name: 'content-generation',
  up,
};

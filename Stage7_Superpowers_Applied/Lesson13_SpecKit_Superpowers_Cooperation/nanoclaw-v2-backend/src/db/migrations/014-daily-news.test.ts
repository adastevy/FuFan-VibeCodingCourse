import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import { up, down, migration014 } from './014-daily-news.js';

function freshDb() {
  return new Database(':memory:');
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
    | { name: string }
    | undefined;
  return !!row;
}

function indexExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name) as
    | { name: string }
    | undefined;
  return !!row;
}

function getColumns(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((r) => r.name);
}

describe('migration014 up()', () => {
  it('creates daily_news table', () => {
    const db = freshDb();
    up(db);
    expect(tableExists(db, 'daily_news')).toBe(true);
    db.close();
  });

  it('creates idx_daily_news_date index', () => {
    const db = freshDb();
    up(db);
    expect(indexExists(db, 'idx_daily_news_date')).toBe(true);
    db.close();
  });

  it('creates idx_daily_news_url_date unique index', () => {
    const db = freshDb();
    up(db);
    expect(indexExists(db, 'idx_daily_news_url_date')).toBe(true);
    db.close();
  });

  it('table has all required columns', () => {
    const db = freshDb();
    up(db);
    const cols = getColumns(db, 'daily_news');
    expect(cols).toContain('id');
    expect(cols).toContain('date');
    expect(cols).toContain('source');
    expect(cols).toContain('title');
    expect(cols).toContain('summary');
    expect(cols).toContain('url');
    expect(cols).toContain('pushed_at');
    expect(cols).toContain('failed');
    db.close();
  });

  it('failed column defaults to 0', () => {
    const db = freshDb();
    up(db);
    db.prepare('INSERT INTO daily_news (date, source, title, summary, url) VALUES (?,?,?,?,?)').run(
      '2026-05-11',
      'hackernews',
      'Test',
      'summary',
      'https://example.com',
    );
    const row = db.prepare('SELECT failed FROM daily_news').get() as { failed: number };
    expect(row.failed).toBe(0);
    db.close();
  });

  it('enforces (url, date) unique constraint', () => {
    const db = freshDb();
    up(db);
    db.prepare('INSERT INTO daily_news (date, source, title, summary, url) VALUES (?,?,?,?,?)').run(
      '2026-05-11',
      'hackernews',
      'Test',
      'summary',
      'https://example.com',
    );
    expect(() =>
      db
        .prepare('INSERT INTO daily_news (date, source, title, summary, url) VALUES (?,?,?,?,?)')
        .run('2026-05-11', 'hackernews', 'Test', 'summary', 'https://example.com'),
    ).toThrow();
    db.close();
  });

  it('is idempotent — re-running up() does not throw', () => {
    const db = freshDb();
    up(db);
    expect(() => up(db)).not.toThrow();
    db.close();
  });
});

describe('migration014 down()', () => {
  it('drops daily_news table', () => {
    const db = freshDb();
    up(db);
    down(db);
    expect(tableExists(db, 'daily_news')).toBe(false);
    db.close();
  });

  it('drops indexes', () => {
    const db = freshDb();
    up(db);
    down(db);
    expect(indexExists(db, 'idx_daily_news_date')).toBe(false);
    expect(indexExists(db, 'idx_daily_news_url_date')).toBe(false);
    db.close();
  });

  it('is idempotent — running down() on clean DB does not throw', () => {
    const db = freshDb();
    expect(() => down(db)).not.toThrow();
    db.close();
  });
});

describe('migration014 object', () => {
  it('has correct name', () => {
    expect(migration014.name).toBe('daily-news');
  });

  it('has version 14', () => {
    expect(migration014.version).toBe(14);
  });
});

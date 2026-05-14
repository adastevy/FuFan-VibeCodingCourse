import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import { up } from '../../db/migrations/014-daily-news.js';
import { insertItems, markFailed, getPendingRepush } from './db.js';
import type { DeliveryRecord } from './types.js';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  up(db);
  return db;
}

function makeRecord(overrides: Partial<DeliveryRecord> = {}): DeliveryRecord {
  return {
    date: '2026-05-11',
    source: 'hackernews',
    title: 'Test Title',
    summary: 'Test Summary',
    url: 'https://example.com/story',
    pushedAt: null,
    failed: 0,
    ...overrides,
  };
}

describe('insertItems', () => {
  it('inserts rows into daily_news table', () => {
    const db = freshDb();
    const records = [makeRecord(), makeRecord({ url: 'https://example.com/other', title: 'Other' })];
    insertItems(db, records);
    const count = (db.prepare('SELECT COUNT(*) as c FROM daily_news').get() as { c: number }).c;
    expect(count).toBe(2);
    db.close();
  });

  it('stores all fields correctly', () => {
    const db = freshDb();
    const rec = makeRecord({ pushedAt: '2026-05-11T01:00:00.000Z' });
    insertItems(db, [rec]);
    const row = db.prepare('SELECT * FROM daily_news').get() as {
      date: string;
      source: string;
      title: string;
      summary: string;
      url: string;
      pushed_at: string | null;
      failed: number;
    };
    expect(row.date).toBe(rec.date);
    expect(row.source).toBe(rec.source);
    expect(row.title).toBe(rec.title);
    expect(row.summary).toBe(rec.summary);
    expect(row.url).toBe(rec.url);
    expect(row.pushed_at).toBe(rec.pushedAt);
    expect(row.failed).toBe(0);
    db.close();
  });

  it('does not throw on empty array', () => {
    const db = freshDb();
    expect(() => insertItems(db, [])).not.toThrow();
    db.close();
  });

  it('respects (url, date) unique constraint — throws on duplicate', () => {
    const db = freshDb();
    insertItems(db, [makeRecord()]);
    expect(() => insertItems(db, [makeRecord()])).toThrow();
    db.close();
  });
});

describe('markFailed', () => {
  it('sets failed=1 for the given url+date', () => {
    const db = freshDb();
    insertItems(db, [makeRecord()]);
    markFailed(db, 'https://example.com/story', '2026-05-11');
    const row = db.prepare('SELECT failed FROM daily_news').get() as { failed: number };
    expect(row.failed).toBe(1);
    db.close();
  });

  it('does not affect other rows', () => {
    const db = freshDb();
    insertItems(db, [makeRecord(), makeRecord({ url: 'https://example.com/other' })]);
    markFailed(db, 'https://example.com/story', '2026-05-11');
    const other = db.prepare('SELECT failed FROM daily_news WHERE url = ?').get('https://example.com/other') as {
      failed: number;
    };
    expect(other.failed).toBe(0);
    db.close();
  });
});

describe('getPendingRepush', () => {
  it('returns only rows with failed=1', () => {
    const db = freshDb();
    insertItems(db, [makeRecord({ url: 'https://example.com/ok' }), makeRecord({ url: 'https://example.com/fail' })]);
    markFailed(db, 'https://example.com/fail', '2026-05-11');
    const pending = getPendingRepush(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].url).toBe('https://example.com/fail');
    db.close();
  });

  it('returns empty array when no failed rows', () => {
    const db = freshDb();
    insertItems(db, [makeRecord()]);
    expect(getPendingRepush(db)).toHaveLength(0);
    db.close();
  });
});

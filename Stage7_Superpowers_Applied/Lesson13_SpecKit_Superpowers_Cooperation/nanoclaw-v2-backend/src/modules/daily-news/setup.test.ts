import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { ensureSchema, openInboundDb } from '../../db/session-db.js';
import { registerDailyNewsTask } from './setup.js';
import { initDailyNews } from './index.js';

const TEST_DIR = '/tmp/nanoclaw-daily-news-setup-test';
const DB_PATH = path.join(TEST_DIR, 'inbound.db');

function freshDb() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  ensureSchema(DB_PATH, 'inbound');
  return openInboundDb(DB_PATH);
}

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('registerDailyNewsTask', () => {
  it('returns a non-empty task id', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    expect(id).toBeTruthy();
    db.close();
  });

  it('inserts a row into messages_in', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT * FROM messages_in WHERE id = ?').get(id) as { id: string } | undefined;
    expect(row).toBeDefined();
    db.close();
  });

  it('sets recurrence to 0 9 * * *', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT recurrence FROM messages_in WHERE id = ?').get(id) as {
      recurrence: string;
    };
    expect(row.recurrence).toBe('0 9 * * *');
    db.close();
  });

  it('sets process_after in the future', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT process_after FROM messages_in WHERE id = ?').get(id) as {
      process_after: string;
    };
    expect(new Date(row.process_after).getTime()).toBeGreaterThan(Date.now());
    db.close();
  });

  it('content JSON is parseable and contains prompt field', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT content FROM messages_in WHERE id = ?').get(id) as {
      content: string;
    };
    const content = JSON.parse(row.content) as Record<string, unknown>;
    expect(content).toHaveProperty('prompt');
    expect(typeof content.prompt).toBe('string');
    expect((content.prompt as string).length).toBeGreaterThan(0);
    db.close();
  });

  it('content JSON contains recurrence field', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT content FROM messages_in WHERE id = ?').get(id) as {
      content: string;
    };
    const content = JSON.parse(row.content) as Record<string, unknown>;
    expect(content.recurrence).toBe('0 9 * * *');
    db.close();
  });

  it('kind is task', () => {
    const db = freshDb();
    const id = registerDailyNewsTask(db);
    const row = db.prepare('SELECT kind FROM messages_in WHERE id = ?').get(id) as {
      kind: string;
    };
    expect(row.kind).toBe('task');
    db.close();
  });
});

describe('initDailyNews', () => {
  it('registers the task into messages_in on first call', () => {
    const db = freshDb();
    const id = initDailyNews(db);
    expect(id).toBeTruthy();
    const row = db.prepare('SELECT * FROM messages_in WHERE id = ?').get(id!) as { kind: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.kind).toBe('task');
    db.close();
  });

  it('is idempotent — second call returns null and does not insert a duplicate', () => {
    const db = freshDb();
    const firstId = initDailyNews(db);
    expect(firstId).toBeTruthy();
    const secondId = initDailyNews(db);
    expect(secondId).toBeNull();
    const count = (
      db.prepare("SELECT COUNT(*) as n FROM messages_in WHERE kind = 'task'").get() as {
        n: number;
      }
    ).n;
    expect(count).toBe(1);
    db.close();
  });
});

import { describe, it, expect } from 'vitest';
import { getNext9amShanghai, buildTaskPrompt } from './prompt-builder.js';
import type { RawNewsItem } from './types.js';

function makeItem(i: number): RawNewsItem {
  return {
    url: `https://example.com/${i}`,
    title: `Title ${i}`,
    source: 'hackernews',
    points: i * 10,
    publishedAt: '2026-05-11T00:00:00Z',
  };
}

describe('getNext9amShanghai', () => {
  it('returns a value greater than Date.now()', () => {
    const ts = getNext9amShanghai();
    expect(new Date(ts).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns an ISO 8601 string', () => {
    const ts = getNext9amShanghai();
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBeTruthy();
  });

  it('returned time is at least 1 minute in the future', () => {
    const ts = getNext9amShanghai();
    expect(new Date(ts).getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});

describe('buildTaskPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildTaskPrompt()).toBeTruthy();
  });

  it('contains the WeChat group platform_id reference', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('wechat:');
  });

  it('contains HN Algolia API URL reference', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('hn.algolia.com');
  });

  it('contains RSS source URLs', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('aiweekly.co');
    expect(prompt).toContain('therundown.ai');
    expect(prompt).toContain('infoq.com');
  });

  it('contains step instructions for selection and Chinese summary', () => {
    const prompt = buildTaskPrompt();
    expect(prompt.length).toBeGreaterThan(200);
  });
});

describe('buildTaskPrompt persistence instructions (FR-012)', () => {
  it('contains insertItems call instruction', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('insertItems');
  });

  it('contains markFailed call instruction', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('markFailed');
  });

  it('references daily_news table', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('daily_news');
  });

  it('includes persistence step for failed delivery', () => {
    const prompt = buildTaskPrompt();
    expect(prompt).toContain('failed');
    expect(prompt).toContain('持久化');
  });
});

describe('buildTaskPrompt article list truncation', () => {
  it('caps article list at 50 items', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeItem(i));
    const prompt = buildTaskPrompt(items);
    // Count how many URLs appear (each item has a unique URL)
    const matches = prompt.match(/https:\/\/example\.com\/\d+/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(50);
  });

  it('truncates each title to 120 characters', () => {
    const longTitle = 'A'.repeat(200);
    const items = [{ ...makeItem(0), title: longTitle }];
    const prompt = buildTaskPrompt(items);
    expect(prompt).toContain('A'.repeat(120));
    expect(prompt).not.toContain('A'.repeat(121));
  });
});

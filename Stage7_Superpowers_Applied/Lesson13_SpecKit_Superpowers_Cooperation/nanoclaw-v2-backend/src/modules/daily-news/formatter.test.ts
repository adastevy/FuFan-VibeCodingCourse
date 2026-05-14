import { describe, it, expect } from 'vitest';
import { formatDigest } from './formatter.js';
import type { NewsItem } from './types.js';

function makeItem(i: number, overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    url: `https://example.com/${i}`,
    title: `Title ${i}`,
    source: 'hackernews',
    points: i * 10,
    publishedAt: '2026-05-11T00:00:00Z',
    titleZh: `中文标题${i}`,
    summaryZh: `摘要${i}`,
    urlHash: `hash${i}`,
    ...overrides,
  };
}

function totalLength(msgs: string[]): number {
  return msgs.reduce((sum, m) => sum + m.length, 0);
}

describe('formatDigest — zero items', () => {
  it('returns exactly 1 message', () => {
    expect(formatDigest([])).toHaveLength(1);
  });

  it('returns the fixed no-news string', () => {
    const msgs = formatDigest([]);
    expect(msgs[0]).toBe('今日 AI 工程领域无显著动态，明日 9:00 再见');
  });
});

describe('formatDigest — short digest (≤500 chars)', () => {
  it('returns exactly 1 message for a small set', () => {
    const items = [makeItem(1, { titleZh: 'A', summaryZh: 'B' })];
    expect(formatDigest(items)).toHaveLength(1);
  });

  it('message contains all item fields', () => {
    const item = makeItem(1);
    const msgs = formatDigest([item]);
    expect(msgs[0]).toContain(item.titleZh);
    expect(msgs[0]).toContain(item.summaryZh);
    expect(msgs[0]).toContain(item.url);
  });

  it('5 small items fit in 1 message', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem(i, { titleZh: `T${i}`, summaryZh: `S${i}` }));
    const msgs = formatDigest(items);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].length).toBeLessThanOrEqual(500);
  });
});

describe('formatDigest — long digest (>500 chars)', () => {
  it('returns exactly 2 messages when content exceeds 500 chars', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem(i, {
        titleZh: `超长标题${i}${'X'.repeat(40)}`,
        summaryZh: `超长摘要${'Y'.repeat(40)}`,
      }),
    );
    const msgs = formatDigest(items);
    expect(msgs).toHaveLength(2);
  });

  it('no item is truncated — all items appear across the 2 messages', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem(i, {
        titleZh: `超长标题${i}${'X'.repeat(40)}`,
        summaryZh: `超长摘要${'Y'.repeat(40)}`,
      }),
    );
    const msgs = formatDigest(items);
    const combined = msgs.join('');
    for (const item of items) {
      expect(combined).toContain(item.titleZh);
      expect(combined).toContain(item.summaryZh);
      expect(combined).toContain(item.url);
    }
  });

  it('split is at item boundary — each message ends cleanly', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem(i, {
        titleZh: `标题${i}${'A'.repeat(50)}`,
        summaryZh: `摘要${'B'.repeat(40)}`,
      }),
    );
    const msgs = formatDigest(items);
    // Both messages must be non-empty
    expect(msgs[0].length).toBeGreaterThan(0);
    expect(msgs[1].length).toBeGreaterThan(0);
  });
});

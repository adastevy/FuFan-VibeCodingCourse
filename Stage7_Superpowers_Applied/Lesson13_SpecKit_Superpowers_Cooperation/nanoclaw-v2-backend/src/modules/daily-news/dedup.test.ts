import { describe, it, expect } from 'vitest';
import { urlHash, dedup } from './dedup.js';
import type { RawNewsItem } from './types.js';

function makeItem(url: string, overrides: Partial<RawNewsItem> = {}): RawNewsItem {
  return {
    url,
    title: 'Test Title',
    source: 'hackernews',
    points: 0,
    publishedAt: '2026-05-11T00:00:00Z',
    ...overrides,
  };
}

describe('urlHash', () => {
  it('returns a non-empty string', () => {
    expect(urlHash('https://example.com')).toBeTruthy();
  });

  it('is stable — same URL always produces same hash', () => {
    const url = 'https://news.ycombinator.com/item?id=12345';
    expect(urlHash(url)).toBe(urlHash(url));
  });

  it('produces different hashes for different URLs', () => {
    expect(urlHash('https://a.com')).not.toBe(urlHash('https://b.com'));
  });

  it('returns exactly 8 hex characters', () => {
    expect(urlHash('https://example.com')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('dedup', () => {
  it('returns empty array for empty input', () => {
    expect(dedup([])).toEqual([]);
  });

  it('returns single item unchanged', () => {
    const items = [makeItem('https://example.com')];
    expect(dedup(items)).toHaveLength(1);
  });

  it('removes duplicate URLs — keeps first occurrence', () => {
    const items = [
      makeItem('https://example.com', { title: 'First' }),
      makeItem('https://example.com', { title: 'Second' }),
    ];
    const result = dedup(items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First');
  });

  it('keeps items with different URLs', () => {
    const items = [makeItem('https://a.com'), makeItem('https://b.com'), makeItem('https://c.com')];
    expect(dedup(items)).toHaveLength(3);
  });

  it('handles mixed duplicate and unique URLs correctly', () => {
    const items = [
      makeItem('https://a.com', { title: 'A1' }),
      makeItem('https://b.com', { title: 'B' }),
      makeItem('https://a.com', { title: 'A2' }),
      makeItem('https://c.com', { title: 'C' }),
    ];
    const result = dedup(items);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.title)).toEqual(['A1', 'B', 'C']);
  });

  it('does not mutate the input array', () => {
    const items = [makeItem('https://a.com'), makeItem('https://a.com')];
    const copy = [...items];
    dedup(items);
    expect(items).toEqual(copy);
  });
});

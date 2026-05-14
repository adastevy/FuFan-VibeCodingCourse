import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHackerNews, fetchRssSource } from './fetcher.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const HN_RESPONSE = {
  hits: [
    {
      objectID: '123',
      title: 'LLM advances in 2026',
      url: 'https://example.com/llm',
      points: 150,
      created_at: '2026-05-10T12:00:00.000Z',
    },
    {
      objectID: '124',
      title: 'AI tooling roundup',
      url: 'https://example.com/ai-tools',
      points: 80,
      created_at: '2026-05-10T10:00:00.000Z',
    },
    {
      // item without url (Ask HN etc) — should be skipped
      objectID: '125',
      title: 'Ask HN: thoughts?',
      url: undefined,
      points: 20,
      created_at: '2026-05-10T09:00:00.000Z',
    },
  ],
};

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Weekly</title>
    <item>
      <title>GPT news</title>
      <link>https://aiweekly.co/item/1</link>
      <pubDate>Sat, 10 May 2026 08:00:00 +0000</pubDate>
    </item>
    <item>
      <title>ML update</title>
      <link>https://aiweekly.co/item/2</link>
      <pubDate>Sat, 10 May 2026 07:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchHackerNews', () => {
  it('returns RawNewsItem array on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => HN_RESPONSE,
    });
    const result = await fetchHackerNews();
    expect(result.warnings).toHaveLength(0);
    // Items without url are filtered out
    expect(result.items.length).toBe(2);
  });

  it('items have correct shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => HN_RESPONSE,
    });
    const result = await fetchHackerNews();
    const item = result.items[0];
    expect(item.source).toBe('hackernews');
    expect(item.url).toBe('https://example.com/llm');
    expect(item.title).toBe('LLM advances in 2026');
    expect(item.points).toBe(150);
    expect(item.publishedAt).toBe('2026-05-10T12:00:00.000Z');
  });

  it('returns warning and empty items on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await fetchHackerNews();
    expect(result.items).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('fetchRssSource', () => {
  it('maps RSS items to RawNewsItem shape', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => RSS_XML,
    });
    const result = await fetchRssSource('ai-weekly', 'https://aiweekly.co/issues.rss');
    expect(result.warnings).toHaveLength(0);
    expect(result.items.length).toBe(2);
    const item = result.items[0];
    expect(item.source).toBe('ai-weekly');
    expect(item.url).toBe('https://aiweekly.co/item/1');
    expect(item.title).toBe('GPT news');
    expect(item.points).toBe(0);
    expect(item.publishedAt).toBeTruthy();
  });

  it('returns warning on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchRssSource('ai-weekly', 'https://aiweekly.co/issues.rss');
    expect(result.items).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// T11: retry extension tests
describe('retry — second attempt succeeds', () => {
  it('fetchHackerNews: succeeds on second attempt after first 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => HN_RESPONSE });
    const result = await fetchHackerNews();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('fetchRssSource: succeeds on second attempt after first network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connection refused'));
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => RSS_XML });
    const result = await fetchRssSource('ai-weekly', 'https://aiweekly.co/issues.rss');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('fetchRssSource: warnings contain the source name on exhaustion', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    const result = await fetchRssSource('the-rundown-ai', 'https://api.therundown.ai/rss');
    expect(result.warnings[0]).toContain('the-rundown-ai');
  });

  it('fetchHackerNews: warnings contain source name on exhaustion', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const result = await fetchHackerNews();
    expect(result.warnings[0]).toContain('hackernews');
  });
});

import Parser from 'rss-parser';
import type { RawNewsItem, FetchResult } from './types.js';

const HN_API_BASE = 'https://hn.algolia.com/api/v1/search_by_date';
const MAX_RSS_ITEMS = 20;
const MAX_RETRIES = 3;

interface HnHit {
  objectID: string;
  title: string;
  url?: string;
  points: number;
  created_at: string;
}

export async function fetchHackerNews(): Promise<FetchResult> {
  const yesterday = Math.floor((Date.now() - 86_400_000) / 1000);
  const today = Math.floor(Date.now() / 1000);
  const url = `${HN_API_BASE}?query=AI+LLM+engineering&tags=story&hitsPerPage=30&numericFilters=created_at_i>${yesterday},created_at_i<${today}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { hits: HnHit[] };
      const items: RawNewsItem[] = data.hits
        .filter((h) => !!h.url)
        .map((h) => ({
          url: h.url!,
          title: h.title,
          source: 'hackernews' as const,
          points: h.points ?? 0,
          publishedAt: h.created_at,
        }));
      return { items, warnings: [] };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    items: [],
    warnings: [`hackernews: fetch failed after ${MAX_RETRIES} attempts — ${String(lastErr)}`],
  };
}

export async function fetchRssSource(
  name: 'ai-weekly' | 'the-rundown-ai' | 'infoq-ai',
  url: string,
): Promise<FetchResult> {
  const parser = new Parser();
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const feed = await parser.parseString(xml);
      const items: RawNewsItem[] = (feed.items ?? [])
        .slice(0, MAX_RSS_ITEMS)
        .filter((item) => !!item.link)
        .map((item) => ({
          url: item.link!,
          title: item.title ?? '(no title)',
          source: name,
          points: 0,
          publishedAt: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
        }));
      return { items, warnings: [] };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    items: [],
    warnings: [`${name}: fetch failed after ${MAX_RETRIES} attempts — ${String(lastErr)}`],
  };
}

export async function fetchAllSources(): Promise<FetchResult> {
  const { RSS_SOURCES } = await import('./config.js');
  const results = await Promise.all([fetchHackerNews(), ...RSS_SOURCES.map((s) => fetchRssSource(s.name, s.url))]);
  return results.reduce<FetchResult>(
    (acc, r) => ({
      items: [...acc.items, ...r.items],
      warnings: [...acc.warnings, ...r.warnings],
    }),
    { items: [], warnings: [] },
  );
}

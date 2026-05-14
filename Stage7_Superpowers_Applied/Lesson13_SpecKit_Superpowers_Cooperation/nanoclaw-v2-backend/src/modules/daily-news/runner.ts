/**
 * Manual smoke-runner for dev/test.
 * Usage: pnpm exec tsx src/modules/daily-news/runner.ts
 *
 * Runs fetch → dedup → prompt-build → format pipeline and prints a
 * digest preview to console. Does not require WeChat or a live DB.
 */
import { fetchAllSources } from './fetcher.js';
import { dedup } from './dedup.js';
import { buildTaskPrompt } from './prompt-builder.js';
import { formatDigest } from './formatter.js';
import { RSS_SOURCES, MAX_ITEMS } from './config.js';
import type { NewsItem, RawNewsItem } from './types.js';

async function checkUrlHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== daily-news runner ===\n');

  // URL health check
  console.log('--- URL health check ---');
  const allUrls = [
    { name: 'HN Algolia', url: 'https://hn.algolia.com/api/v1/search_by_date?query=test&tags=story&hitsPerPage=1' },
    ...RSS_SOURCES.map((s) => ({ name: s.name, url: s.url })),
  ];
  for (const { name, url } of allUrls) {
    const ok = await checkUrlHealth(url);
    console.log(`  ${ok ? '✓' : '✗'} ${name}: ${url}`);
  }
  console.log();

  // Fetch
  console.log('--- fetching sources ---');
  const { items: raw, warnings } = await fetchAllSources();
  console.log(`  fetched ${raw.length} raw items`);
  if (warnings.length > 0) {
    console.log('  warnings:');
    for (const w of warnings) console.log(`    WARN: ${w}`);
  }

  // Dedup
  const unique = dedup(raw);
  console.log(`  after dedup: ${unique.length} unique items`);

  // Select top MAX_ITEMS by points
  const selected = [...unique].sort((a, b) => b.points - a.points).slice(0, MAX_ITEMS);
  console.log(`  selected top ${selected.length} items\n`);

  // Build prompt preview
  console.log('--- task prompt preview (first 300 chars) ---');
  const prompt = buildTaskPrompt(selected);
  console.log(prompt.slice(0, 300) + (prompt.length > 300 ? '...' : ''));
  console.log();

  // Format as synthetic NewsItems (no real LLM — use raw title as placeholder)
  const newsItems: NewsItem[] = selected.map((item: RawNewsItem) => ({
    ...item,
    titleZh: item.title.slice(0, 30),
    summaryZh: '(摘要待 LLM 生成)',
    urlHash: item.url.slice(-8),
  }));

  console.log('--- formatted digest preview ---');
  const messages = formatDigest(newsItems);
  console.log(`  ${messages.length} message(s) would be sent to WeChat\n`);
  for (let i = 0; i < messages.length; i++) {
    console.log(`--- message ${i + 1} (${messages[i].length} chars) ---`);
    console.log(messages[i]);
    console.log();
  }

  console.log('=== smoke run complete ===');
}

main().catch((err) => {
  console.error('runner failed:', err);
  process.exit(1);
});

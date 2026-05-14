import { MAX_CHARS } from './config.js';
import type { NewsItem } from './types.js';

const NO_NEWS_MSG = '今日 AI 工程领域无显著动态，明日 9:00 再见';

function formatItem(item: NewsItem): string {
  return `【${item.titleZh}】\n${item.summaryZh}\n${item.url}`;
}

export function formatDigest(items: NewsItem[]): string[] {
  if (items.length === 0) return [NO_NEWS_MSG];

  const formatted = items.map(formatItem);
  const full = formatted.join('\n\n');

  if (full.length <= MAX_CHARS) return [full];

  // Split at item boundary — always keep at least 1 item in each part
  let splitIdx = 1;
  for (let i = 1; i < formatted.length - 1; i++) {
    const candidate = formatted.slice(0, i + 1).join('\n\n');
    if (candidate.length > MAX_CHARS) break;
    splitIdx = i + 1;
  }

  const msg1 = formatted.slice(0, splitIdx).join('\n\n');
  const msg2 = formatted.slice(splitIdx).join('\n\n');
  return [msg1, msg2];
}

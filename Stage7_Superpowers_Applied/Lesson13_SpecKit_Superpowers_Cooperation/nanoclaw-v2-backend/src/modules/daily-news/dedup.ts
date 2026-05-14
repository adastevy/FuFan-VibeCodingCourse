import { createHash } from 'crypto';
import type { RawNewsItem } from './types.js';

export function urlHash(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 8);
}

export function dedup(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const hash = urlHash(item.url);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

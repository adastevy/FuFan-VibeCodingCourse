export const RSS_SOURCES = [
  { name: 'ai-weekly' as const, url: 'https://aiweekly.co/issues.rss' },
  { name: 'the-rundown-ai' as const, url: 'https://api.therundown.ai/rss' },
  { name: 'infoq-ai' as const, url: 'https://feed.infoq.com/news/ai-ml-data-eng' },
] satisfies Array<{ name: 'ai-weekly' | 'the-rundown-ai' | 'infoq-ai'; url: string }>;

export const CRON_EXPR = '0 9 * * *';
export const TIMEZONE = 'Asia/Shanghai';
export const WECHAT_GROUP_PLATFORM_ID = 'wechat:o9cq809ZVevgvCvrFv0wrwQaJYng@im.wechat';
export const WECHAT_CHANNEL_TYPE = 'wechat';
export const MAX_ITEMS = 5;
export const MAX_CHARS = 500;

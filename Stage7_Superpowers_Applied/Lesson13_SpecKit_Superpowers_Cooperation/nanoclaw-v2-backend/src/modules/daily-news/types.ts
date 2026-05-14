export interface RawNewsItem {
  url: string;
  title: string;
  source: 'hackernews' | 'ai-weekly' | 'the-rundown-ai' | 'infoq-ai';
  points: number;
  publishedAt: string;
}

export interface NewsItem extends RawNewsItem {
  titleZh: string;
  summaryZh: string;
  urlHash: string;
}

export interface FetchResult {
  items: RawNewsItem[];
  warnings: string[];
}

export interface DailyDigest {
  date: string;
  items: NewsItem[];
  degraded: boolean;
  messages: string[];
}

export interface DeliveryRecord {
  date: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  pushedAt: string | null;
  failed: 0 | 1;
}

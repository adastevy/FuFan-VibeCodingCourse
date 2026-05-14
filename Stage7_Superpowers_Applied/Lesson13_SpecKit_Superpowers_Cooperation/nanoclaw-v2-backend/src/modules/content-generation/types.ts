export type ContentTaskStatus = 'pending' | 'researching' | 'writing' | 'completed' | 'failed' | 'partial';

export type ContentPlatform = 'xiaohongshu' | 'gongzhonghao' | 'weibo';

export interface ContentTask {
  id: string;
  topic: string;
  status: ContentTaskStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface ContentArticle {
  id: number;
  task_id: string;
  platform: ContentPlatform;
  title: string | null;
  content: string;
  tags: string | null;
  word_count: number | null;
  created_at: string;
}

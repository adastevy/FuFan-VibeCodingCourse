import type Database from 'better-sqlite3';
import type { ContentTask, ContentTaskStatus, ContentArticle } from './types.js';

export function insertTask(
  db: Database.Database,
  task: Omit<ContentTask, 'started_at' | 'completed_at' | 'error'>,
): void {
  db.prepare(
    `INSERT INTO content_tasks (id, topic, status, created_at)
     VALUES (@id, @topic, @status, @created_at)`,
  ).run(task);
}

export function updateTaskStatus(
  db: Database.Database,
  id: string,
  status: ContentTaskStatus,
  extra?: { started_at?: string; completed_at?: string; error?: string },
): void {
  const fields: string[] = ['status = @status'];
  if (extra?.started_at !== undefined) fields.push('started_at = @started_at');
  if (extra?.completed_at !== undefined) fields.push('completed_at = @completed_at');
  if (extra?.error !== undefined) fields.push('error = @error');

  db.prepare(`UPDATE content_tasks SET ${fields.join(', ')} WHERE id = @id`).run({
    id,
    status,
    ...extra,
  });
}

export function getTask(db: Database.Database, id: string): ContentTask | undefined {
  return db.prepare('SELECT * FROM content_tasks WHERE id = ?').get(id) as ContentTask | undefined;
}

export function listTasks(db: Database.Database, limit: number): ContentTask[] {
  return db.prepare('SELECT * FROM content_tasks ORDER BY created_at DESC LIMIT ?').all(limit) as ContentTask[];
}

export function insertArticle(db: Database.Database, article: Omit<ContentArticle, 'id'>): void {
  db.prepare(
    `INSERT INTO content_articles (task_id, platform, title, content, tags, word_count, created_at)
     VALUES (@task_id, @platform, @title, @content, @tags, @word_count, @created_at)
     ON CONFLICT(task_id, platform) DO UPDATE SET
       title      = excluded.title,
       content    = excluded.content,
       tags       = excluded.tags,
       word_count = excluded.word_count`,
  ).run(article);
}

export function listArticlesByTaskId(db: Database.Database, taskId: string): ContentArticle[] {
  return db.prepare('SELECT * FROM content_articles WHERE task_id = ?').all(taskId) as ContentArticle[];
}

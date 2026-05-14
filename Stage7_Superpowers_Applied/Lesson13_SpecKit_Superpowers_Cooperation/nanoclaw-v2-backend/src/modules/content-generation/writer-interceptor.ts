/**
 * Host-side interceptor: persists writer completion messages to content_articles
 * before the message is routed to the coordinator.
 *
 * Two paths:
 *   A (JSON)     – writer sends structured JSON with status='done' + content field
 *   B (markdown) – writer sends plain markdown text; we fall back to inserting
 *                  the raw text as content, resolving task_id from the DB.
 *
 * Failure is non-fatal — the message routes normally regardless.
 */
import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import { insertArticle } from './db.js';
import type { ContentPlatform } from './types.js';

const CONTENT_WRITER_GROUPS = new Set([
  'xiaohongshu-writer',
  'gongzhonghao-writer',
  'weibo-writer',
]);

const PLATFORM_MAP: Record<string, ContentPlatform> = {
  'xiaohongshu-writer': 'xiaohongshu',
  'gongzhonghao-writer': 'gongzhonghao',
  'weibo-writer': 'weibo',
};

export function interceptWriterCompletion(
  sourceGroupId: string,
  targetGroupId: string,
  messageText: string,
): void {
  if (targetGroupId !== 'content-coordinator') return;
  if (!CONTENT_WRITER_GROUPS.has(sourceGroupId)) return;

  const platform = PLATFORM_MAP[sourceGroupId];

  // Unwrap outer {"text":"..."} envelope that NanoClaw wraps send_message calls in.
  let outer: unknown = null;
  try { outer = JSON.parse(messageText); } catch { /* not JSON — treat as bare markdown */ }

  let innerText: string | null = null;
  let payload: unknown = null;

  if (outer !== null && typeof outer === 'object') {
    const outerObj = outer as Record<string, unknown>;
    if (typeof outerObj.text === 'string') {
      innerText = outerObj.text;
      try { payload = JSON.parse(innerText); } catch { /* inner text is markdown, not JSON */ }
    } else {
      // Bare JSON payload without envelope
      payload = outer;
    }
  }

  // ── Path A: structured JSON delivery ──────────────────────────────────────
  if (
    payload !== null &&
    typeof payload === 'object' &&
    (payload as Record<string, unknown>).status === 'done'
  ) {
    const p = payload as Record<string, unknown>;
    if (
      typeof p.taskId === 'string' && p.taskId &&
      typeof p.platform === 'string' && p.platform &&
      typeof p.content === 'string' && p.content
    ) {
      try {
        insertArticle(getDb(), {
          task_id: p.taskId,
          platform: p.platform as ContentPlatform,
          title: typeof p.title === 'string' ? p.title : null,
          content: p.content,
          tags: Array.isArray(p.tags) ? JSON.stringify(p.tags) : null,
          word_count: typeof p.word_count === 'number' ? p.word_count : null,
          created_at: new Date().toISOString(),
        });
        log.info('writer-interceptor: article persisted via JSON path', {
          taskId: p.taskId,
          platform,
          sourceGroupId,
        });
        return;
      } catch (err) {
        log.warn('writer-interceptor: JSON path INSERT failed, trying markdown fallback', {
          err: String(err),
          platform,
        });
      }
    }
  }

  // ── Path B: markdown fallback ─────────────────────────────────────────────
  // Writer sent plain markdown (e.g. "《标题》已完成并交付，等待您的审阅反馈\n\n...article...")
  // Use the unwrapped inner text if available, otherwise the raw messageText.
  const content = (innerText ?? messageText).trim();
  if (content.length < 30) {
    log.warn('writer-interceptor: markdown fallback content too short, skipping', {
      platform,
      len: content.length,
    });
    return;
  }

  // Resolve task_id: most recent task still in an active writing state.
  let taskId: string | undefined;
  try {
    const row = getDb().prepare(
      "SELECT id FROM content_tasks WHERE status IN ('writing','researching') ORDER BY created_at DESC LIMIT 1",
    ).get() as { id: string } | undefined;
    taskId = row?.id;
  } catch { /* ignore DB errors */ }

  if (!taskId) {
    log.warn('writer-interceptor: markdown fallback: no active task_id, skipping', { platform });
    return;
  }

  // Extract title from the first non-empty line (strip markdown decorators).
  const firstLine = content.split('\n').find(l => l.trim().length > 0)?.trim() ?? null;
  const title =
    firstLine && firstLine.length < 100
      ? firstLine.replace(/^[#*\s]+/, '').replace(/[*#\s]+$/, '') || null
      : null;

  // Extract up to 5 hashtags.
  const tagsMatch = content.match(/#[^\s#]+/g) ?? [];
  const tags = tagsMatch.length > 0 ? JSON.stringify(tagsMatch.slice(0, 5)) : null;

  try {
    insertArticle(getDb(), {
      task_id: taskId,
      platform,
      title,
      content,
      tags,
      word_count: content.length,
      created_at: new Date().toISOString(),
    });
    log.info('writer-interceptor: article persisted via markdown fallback', {
      platform,
      taskId,
      content_length: content.length,
      title,
      sourceGroupId,
    });
  } catch (err) {
    log.warn('writer-interceptor: markdown fallback INSERT failed (message still routed)', {
      err: String(err),
      platform,
      taskId,
    });
  }
}

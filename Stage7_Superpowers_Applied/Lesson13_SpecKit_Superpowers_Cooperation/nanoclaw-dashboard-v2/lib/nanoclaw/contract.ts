import path from "path";
import fs from "fs";

/**
 * 所有"对 NanoClaw 的假设"集中在这里：
 * 命令 / cwd / 超时 / stdout 解析 / 输入校验 / 环境隔离。
 * NanoClaw 升级时只改这一处。
 *
 * TODO(Important #11): 把这里和 lib/mock/schema.ts 一起合并到 lib/contract/，
 *   schema.ts 是真正跨 mock 与 api 共享的 contract，本文件是 transport 层。
 */

const HOME = process.env.HOME || "";
const ALLOWED_ROOT_PREFIX = path.join(HOME, "projects");

const RAW_NANOCLAW_ROOT =
  process.env.NANOCLAW_ROOT ||
  path.join(HOME, "projects", "nanoclaw-fork", "nanoclaw-v2");

/**
 * Critical #2 修复：NANOCLAW_ROOT 必须在 ~/projects/ 下。
 * 防止环境变量被劫持后指向任意目录的恶意 npm script。
 */
let _resolvedRoot: string | null = null;
function resolveNanoClawRoot(): string {
  if (_resolvedRoot) return _resolvedRoot;
  let real: string;
  try {
    real = fs.realpathSync(RAW_NANOCLAW_ROOT);
  } catch (e) {
    throw new Error(
      `NANOCLAW_ROOT does not exist or is not accessible: ${RAW_NANOCLAW_ROOT}`,
    );
  }
  const withSep = real.endsWith(path.sep) ? real : real + path.sep;
  const prefixWithSep = ALLOWED_ROOT_PREFIX + path.sep;
  if (!withSep.startsWith(prefixWithSep)) {
    throw new Error(
      `NANOCLAW_ROOT must be under ${ALLOWED_ROOT_PREFIX}/, got ${real}`,
    );
  }
  if (!fs.existsSync(path.join(real, "package.json"))) {
    throw new Error(`NANOCLAW_ROOT missing package.json: ${real}`);
  }
  _resolvedRoot = real;
  return real;
}
export { resolveNanoClawRoot };

export const CHAT_CMD = "pnpm";
export const CHAT_ARGS = (msg: string): string[] => ["run", "chat", msg];
export const CHAT_TIMEOUT_MS = 120_000;

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Critical #1 修复：拒绝可能成为 pnpm/tsx CLI flag 的输入（argument injection）。
 * `shell:false` 只防 shell 解释，不防 flag 走私（`--config /etc/passwd` 类）。
 */
export type MessageValidation =
  | { ok: true; value: string }
  | { ok: false; error: string; status: 400 | 413 };

export function validateChatMessage(input: unknown): MessageValidation {
  if (typeof input !== "string")
    return { ok: false, error: "Missing or empty message", status: 400 };
  const trimmed = input.trim();
  if (!trimmed)
    return { ok: false, error: "Missing or empty message", status: 400 };
  if (trimmed.length > MAX_MESSAGE_LENGTH)
    return {
      ok: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)`,
      status: 413,
    };
  if (trimmed.startsWith("-")) {
    return {
      ok: false,
      error: "Message must not start with '-' (reserved for CLI flags)",
      status: 400,
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Critical #3 修复：env 白名单，避免把 process.env 里的密钥
 * （OPENAI_API_KEY 等）原封不动透传给子进程。
 */
export function buildChildEnv(root: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    SHELL: process.env.SHELL ?? "/bin/sh",
    LANG: process.env.LANG ?? "en_US.UTF-8",
    NODE_ENV: process.env.NODE_ENV,
    NANOCLAW_ROOT: root,
  };
}

/** 滤掉 pnpm/tsx 启动器输出，只保留 agent 真正的回复 */
export function stripPnpmWrapper(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !/^>\s+nanoclaw@/.test(line) &&
        !/^>\s+tsx\s+/.test(line) &&
        !/^\s*$/.test(line),
    )
    .join("\n")
    .trim();
}

/* ─── 兼容已有 import：保留旧名 ───────────────────────────── */
export const NANOCLAW_ROOT = RAW_NANOCLAW_ROOT;

/* ─── daily-news DB helpers ────────────────────────────────── */
import Database from "better-sqlite3";

export const ANDY_AGENT_GROUP_ID = "ag-1778127817315-jlhkmo";

export interface DailyNewsItem {
  id: number;  // INTEGER PRIMARY KEY AUTOINCREMENT in NanoClaw daily_news table
  date: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  pushed_at: string | null;
}

export function readRecentDailyNews(limit: number = 10): DailyNewsItem[] {
  let root: string;
  try {
    root = resolveNanoClawRoot();
  } catch {
    return [];
  }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        `SELECT id, date, source, title, summary, url, pushed_at
         FROM daily_news ORDER BY date DESC, pushed_at DESC LIMIT ?`,
      )
      .all(limit) as DailyNewsItem[];
  } finally {
    db.close();
  }
}

export interface DailyNewsTask {
  id: string;
  next_run_at: string;
  recurrence: string;
  tries: number;
  status: string;
}

/* ─── content-generation types ─────────────────────────────── */

export type ContentTaskStatus =
  | "pending"
  | "researching"
  | "writing"
  | "completed"
  | "failed"
  | "partial";

export type ContentPlatform = "xiaohongshu" | "gongzhonghao" | "weibo";

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
  tags: string | null; // JSON array string e.g. '["#AI","#tech"]'
  word_count: number | null;
  created_at: string;
}

export function writeContentTask(task: {
  id: string;
  topic: string;
  status: string;
  created_at: string;
}): void {
  const root = resolveNanoClawRoot();
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) throw new Error(`v2.db not found: ${dbPath}`);
  const db = new Database(dbPath);
  try {
    db.prepare(
      `INSERT INTO content_tasks (id, topic, status, created_at) VALUES (?, ?, ?, ?)`,
    ).run(task.id, task.topic, task.status, task.created_at);
  } finally {
    db.close();
  }
}

export function readActiveContentTask(): ContentTask | undefined {
  let root: string;
  try { root = resolveNanoClawRoot(); } catch { return undefined; }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return undefined;
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        `SELECT * FROM content_tasks WHERE status IN ('pending','researching','writing') LIMIT 1`,
      )
      .get() as ContentTask | undefined;
  } finally {
    db.close();
  }
}

export function readContentTask(id: string): ContentTask | undefined {
  let root: string;
  try { root = resolveNanoClawRoot(); } catch { return undefined; }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return undefined;
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(`SELECT * FROM content_tasks WHERE id = ?`)
      .get(id) as ContentTask | undefined;
  } finally {
    db.close();
  }
}

export function readContentArticles(taskId: string): ContentArticle[] {
  let root: string;
  try { root = resolveNanoClawRoot(); } catch { return []; }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(`SELECT * FROM content_articles WHERE task_id = ? ORDER BY platform`)
      .all(taskId) as ContentArticle[];
  } finally {
    db.close();
  }
}

export function listContentTasks(limit: number = 10): ContentTask[] {
  let root: string;
  try { root = resolveNanoClawRoot(); } catch { return []; }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(`SELECT * FROM content_tasks ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as ContentTask[];
  } finally {
    db.close();
  }
}

/* ─── content-showcase helpers ─────────────────────────────── */

export interface ContentArticleWithTopic extends ContentArticle {
  topic: string;
}

export interface ContentArticlesStats {
  total_tasks: number;
  total_articles: number;
  by_platform: Record<string, number>;
  total_words: number;
}

const EMPTY_STATS: ContentArticlesStats = {
  total_tasks: 0,
  total_articles: 0,
  by_platform: {},
  total_words: 0,
};

export function readAllContentArticles(limit: number = 100): {
  articles: ContentArticleWithTopic[];
  stats: ContentArticlesStats;
} {
  let root: string;
  try { root = resolveNanoClawRoot(); } catch { return { articles: [], stats: EMPTY_STATS }; }
  const dbPath = path.join(root, "data", "v2.db");
  if (!fs.existsSync(dbPath)) return { articles: [], stats: EMPTY_STATS };
  const db = new Database(dbPath, { readonly: true });
  try {
    const articles = db
      .prepare(
        `SELECT a.id, a.task_id, a.platform, a.title, a.content, a.tags,
                a.word_count, a.created_at, t.topic
         FROM content_articles a
         JOIN content_tasks t ON a.task_id = t.id
         WHERE t.status IN ('completed','partial')
         ORDER BY a.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as ContentArticleWithTopic[];

    const agg = db
      .prepare(
        `SELECT COUNT(DISTINCT a.task_id) AS total_tasks,
                COUNT(*) AS total_articles,
                COALESCE(SUM(a.word_count), 0) AS total_words
         FROM content_articles a
         JOIN content_tasks t ON a.task_id = t.id
         WHERE t.status IN ('completed','partial')`,
      )
      .get() as { total_tasks: number; total_articles: number; total_words: number } | undefined;

    const platformRows = db
      .prepare(
        `SELECT a.platform, COUNT(*) AS cnt
         FROM content_articles a
         JOIN content_tasks t ON a.task_id = t.id
         WHERE t.status IN ('completed','partial')
         GROUP BY a.platform`,
      )
      .all() as { platform: string; cnt: number }[];

    const by_platform: Record<string, number> = {};
    for (const row of platformRows) by_platform[row.platform] = row.cnt;

    return {
      articles,
      stats: {
        total_tasks: agg?.total_tasks ?? 0,
        total_articles: agg?.total_articles ?? 0,
        by_platform,
        total_words: agg?.total_words ?? 0,
      },
    };
  } finally {
    db.close();
  }
}

export function readDailyNewsTask(): DailyNewsTask | null {
  let root: string;
  try {
    root = resolveNanoClawRoot();
  } catch {
    return null;
  }
  const sessionsRoot = path.join(root, "data/v2-sessions", ANDY_AGENT_GROUP_ID);
  if (!fs.existsSync(sessionsRoot)) return null;
  const sessions = fs.readdirSync(sessionsRoot).sort().reverse();
  for (const sess of sessions) {
    const inboundDb = path.join(sessionsRoot, sess, "inbound.db");
    if (!fs.existsSync(inboundDb)) continue;
    const db = new Database(inboundDb, { readonly: true });
    try {
      // NanoClaw recurring task 机制：原 task 完成后·host-sweep 生成新 row（id 重发）·series_id 指向原始 task。
      // 我们要找的是"下次会执行的 daily-news task"——所以按 series_id LIKE 过滤 + status='pending' + 有 recurrence。
      const row = db
        .prepare(
          `SELECT id, process_after AS next_run_at, recurrence, tries, status
           FROM messages_in
           WHERE kind='task' AND series_id LIKE 'task-daily-news%'
             AND status='pending' AND recurrence IS NOT NULL
           ORDER BY process_after ASC LIMIT 1`,
        )
        .get() as DailyNewsTask | undefined;
      if (row) return row;
    } finally {
      db.close();
    }
  }
  return null;
}

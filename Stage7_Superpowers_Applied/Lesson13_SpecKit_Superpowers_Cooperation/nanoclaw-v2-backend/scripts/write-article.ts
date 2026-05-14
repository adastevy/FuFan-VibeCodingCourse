import Database from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH ?? '/workspace/data/v2.db';

function parseArgs(): {
  taskId: string;
  platform: string;
  title: string;
  content: string;
  tags: string;
  wordCount: number | null;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    for (const arg of args) {
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
      const idx = args.indexOf(flag);
      if (idx !== -1 && args[idx + 1] !== undefined) return args[idx + 1];
    }
    return undefined;
  };

  const taskId = get('--task-id');
  const platform = get('--platform');
  const content = get('--content');

  if (!taskId) {
    process.stderr.write('Missing required argument: --task-id\n');
    process.exit(1);
  }
  if (!platform) {
    process.stderr.write('Missing required argument: --platform\n');
    process.exit(1);
  }
  if (!content) {
    process.stderr.write('Missing required argument: --content\n');
    process.exit(1);
  }

  const title = get('--title') ?? '';
  const rawTags = get('--tags') ?? '[]';
  let parsedTags: unknown;
  try {
    parsedTags = JSON.parse(rawTags);
    if (!Array.isArray(parsedTags)) throw new Error('tags must be a JSON array');
  } catch (e) {
    process.stderr.write(`Invalid --tags JSON: ${(e as Error).message}\n`);
    process.exit(1);
  }

  const rawWordCount = get('--word-count');
  const wordCount = rawWordCount != null ? parseInt(rawWordCount, 10) : null;

  return {
    taskId,
    platform,
    title,
    content,
    tags: JSON.stringify(parsedTags),
    wordCount: wordCount != null && !isNaN(wordCount) ? wordCount : null,
  };
}

function main(): void {
  const { taskId, platform, title, content, tags, wordCount } = parseArgs();

  let db: Database.Database;
  try {
    db = new Database(DB_PATH);
  } catch (e) {
    process.stderr.write(`Failed to open DB at ${DB_PATH}: ${(e as Error).message}\n`);
    process.exit(1);
  }

  try {
    db.prepare(
      `INSERT OR REPLACE INTO content_articles
         (task_id, platform, title, content, tags, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(taskId, platform, title || null, content, tags, wordCount);
  } catch (e) {
    process.stderr.write(`DB insert failed: ${(e as Error).message}\n`);
    db.close();
    process.exit(1);
  }

  db.close();
  process.exit(0);
}

main();

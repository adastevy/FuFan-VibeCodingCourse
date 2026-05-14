/**
 * scripts/write-article-bun.ts — Bun-native article writer for container agents.
 *
 * Drop-in replacement for write-article.ts using bun:sqlite instead of better-sqlite3.
 *
 * Usage:
 *   DB_PATH=/workspace/extra/data/v2.db bun /workspace/extra/scripts/write-article-bun.ts \
 *     --task-id=<id> --platform=<platform> --title=<title> \
 *     --content=<content> --tags='[...]' --word-count=<n>
 */
import { Database } from 'bun:sqlite';

const DB_PATH = process.env.DB_PATH ?? '/workspace/extra/data/v2.db';

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
    }
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1] !== undefined) return args[idx + 1];
    return undefined;
  };

  const taskId = get('--task-id');
  const platform = get('--platform');
  const content = get('--content');

  if (!taskId) { process.stderr.write('Missing required argument: --task-id\n'); process.exit(1); }
  if (!platform) { process.stderr.write('Missing required argument: --platform\n'); process.exit(1); }
  if (!content) { process.stderr.write('Missing required argument: --content\n'); process.exit(1); }

  const title = get('--title') ?? '';
  const tags = get('--tags') ?? '[]';
  const wordCountStr = get('--word-count');
  const wordCount = wordCountStr ? parseInt(wordCountStr, 10) : null;

  return { taskId: taskId!, platform: platform!, title, content: content!, tags, wordCount };
}

const { taskId, platform, title, content, tags, wordCount } = parseArgs();

let db: InstanceType<typeof Database>;
try {
  db = new Database(DB_PATH);
} catch (e) {
  process.stderr.write(`Failed to open DB at ${DB_PATH}: ${(e as Error).message}\n`);
  process.exit(1);
}

try {
  db.run(
    `INSERT OR REPLACE INTO content_articles
       (task_id, platform, title, content, tags, word_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [taskId, platform, title, content, tags, wordCount],
  );
  process.stdout.write(`Article written: task=${taskId} platform=${platform} words=${wordCount ?? 'unknown'}\n`);
} catch (e) {
  process.stderr.write(`DB write error: ${(e as Error).message}\n`);
  process.exit(1);
} finally {
  db.close();
}

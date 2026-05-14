/**
 * inject-task CLI
 *
 * Writes a task message into content-coordinator's inbound.db and immediately
 * wakes the container — bypassing the 60-second host-sweep cycle (FR-004).
 *
 * Usage:
 *   pnpm run inject-task -- --task-id=<id> --topic=<topic> [--coordinator-name=content-coordinator] [--dry-run]
 *
 * Exit 0 = message written (and wake attempted). Exit 1 = hard failure.
 */
import path from 'path';

import { initDb } from '../db/connection.js';
import { DATA_DIR } from '../config.js';
import { resolveSession, writeSessionMessage } from '../session-manager.js';

// ── arg parsing ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  taskId: string;
  topic: string;
  coordinatorName: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const map: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === '--dry-run') {
      map['dry-run'] = true;
    } else if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        map[arg.slice(2)] = true;
      } else {
        map[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    }
  }

  const taskId = map['task-id'] as string | undefined;
  const topic = map['topic'] as string | undefined;
  const coordinatorName = (map['coordinator-name'] as string | undefined) ?? 'content-coordinator';
  const dryRun = !!map['dry-run'];

  if (!taskId) die('--task-id is required');
  if (!topic) die('--topic is required');

  return { taskId: taskId!, topic: topic!, coordinatorName, dryRun };
}

function die(msg: string): never {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // inject-task runs standalone; must init central DB before resolveSession.
  initDb(path.join(DATA_DIR, 'v2.db'));

  const { taskId, topic, coordinatorName, dryRun } = parseArgs(process.argv.slice(2));

  // Find or create the coordinator session.
  // resolveSession('agent-shared') finds the single active session for the
  // agent group, or creates a new session + initialises inbound.db schema.
  let session: import('../types.js').Session;
  try {
    const { session: s } = resolveSession(coordinatorName, null, null, 'agent-shared');
    session = s;
  } catch (err) {
    die(`Failed to resolve session for '${coordinatorName}': ${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(`Using session ${session.id} for ${coordinatorName}\n`);

  // Write the task message into coordinator's inbound.db.
  const msgId = `inject-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const content = JSON.stringify({ taskId, topic });

  try {
    writeSessionMessage(coordinatorName, session.id, {
      id: msgId,
      kind: 'chat',
      timestamp: now,
      platformId: null,
      channelType: null,
      threadId: null,
      content: JSON.stringify({ text: content }),
      processAfter: now,
      recurrence: null,
      trigger: 1,
    });
  } catch (err) {
    die(`Failed to write message to inbound.db: ${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(`Wrote task message ${msgId} (taskId=${taskId})\n`);

  if (dryRun) {
    process.stdout.write('[dry-run] Skipping wakeContainer — exiting\n');
    process.exit(0);
  }

  // Wake the coordinator container directly, bypassing host-sweep.
  // Dynamic import so any module-level initialisation failures in
  // container-runner (e.g. OneCLI SDK with empty env) are catchable.
  try {
    const { wakeContainer } = await import('../container-runner.js');
    const woken = await wakeContainer(session);
    if (woken) {
      process.stdout.write(`Container woken for session ${session.id}\n`);
    } else {
      // wakeContainer returns false on transient failure (e.g. Docker
      // daemon unavailable).  The message is in inbound.db so the
      // host-sweep will retry within 60 s.
      process.stderr.write(
        `Warning: wakeContainer returned false — container will start via next host-sweep (≤60 s)\n`,
      );
    }
  } catch (err) {
    // Module init or call failed (e.g. OneCLI missing creds in child env).
    // Message is already written; fall back to sweep.
    process.stderr.write(`Warning: wakeContainer error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.stderr.write('Container will start via next host-sweep (≤60 s)\n');
  }

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(String(err instanceof Error ? (err.stack ?? err.message) : err) + '\n');
  process.exit(1);
});

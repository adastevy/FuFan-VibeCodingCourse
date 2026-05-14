import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import {
  resolveNanoClawRoot,
  buildChildEnv,
  writeContentTask,
  readActiveContentTask,
  readContentTask,
} from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIGGER_TIMEOUT_MS = 30_000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = (body as { topic?: unknown })?.topic;
  if (typeof topic !== "string" || topic.trim().length === 0 || topic.trim().length > 500) {
    return NextResponse.json(
      { error: "topic must be a non-empty string (1-500 chars)" },
      { status: 400 },
    );
  }
  const cleanTopic = topic.trim();

  const running = readActiveContentTask();
  if (running) {
    return NextResponse.json(
      { error: "已有任务在跑·等完成再触发" },
      { status: 409 },
    );
  }

  let cwd: string;
  try {
    cwd = resolveNanoClawRoot();
  } catch (e) {
    const reason = e instanceof Error ? e.message : "NANOCLAW_ROOT not configured";
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  const taskId = `ctask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    writeContentTask({
      id: taskId,
      topic: cleanTopic,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Failed to write task";
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  return new Promise<NextResponse>((resolve) => {
    let responded = false;
    const respond = (r: NextResponse) => {
      if (!responded) {
        responded = true;
        resolve(r);
      }
    };

    const proc = spawn(
      "pnpm",
      [
        "run",
        "inject-task",
        "--",
        "--coordinator-name=content-coordinator",
        `--task-id=${taskId}`,
        `--topic=${cleanTopic}`,
      ],
      {
        cwd,
        shell: false,
        env: buildChildEnv(cwd),
      },
    );

    proc.on("error", async (err) => {
      try {
        const db = await import("better-sqlite3");
        const path = await import("path");
        const dbPath = path.join(cwd, "data", "v2.db");
        const Database = db.default;
        const conn = new Database(dbPath);
        try {
          conn
            .prepare(`UPDATE content_tasks SET status='failed', error=? WHERE id=?`)
            .run(err.message, taskId);
        } finally {
          conn.close();
        }
      } catch {
        // best-effort update
      }
      respond(
        NextResponse.json(
          { error: "Failed to spawn inject-task: " + err.message },
          { status: 500 },
        ),
      );
    });

    const timer = setTimeout(() => {
      proc.kill();
      respond(NextResponse.json({ taskId }));
    }, TRIGGER_TIMEOUT_MS);

    proc.on("close", () => {
      clearTimeout(timer);
      respond(NextResponse.json({ taskId }));
    });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import {
  resolveNanoClawRoot,
  CHAT_CMD,
  CHAT_ARGS,
  CHAT_TIMEOUT_MS,
  stripPnpmWrapper,
  validateChatMessage,
  buildChildEnv,
} from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";

/**
 * Critical #4 修复：CSRF / DNS-rebinding 防护。
 * 浏览器 fetch 跨站时一定带 Origin；同源时 Origin = 自己。
 * 允许同源 + 缺失（curl/server-side），拒绝其他 origin。
 */
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:4000",
  "http://localhost:4000",
]);

function isOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-side / curl / same-origin-direct
  return ALLOWED_ORIGINS.has(origin);
}

// TODO(Important #9): 加并发 / 速率限制 — 当前同源恶意 JS 可并发 spawn 100 个 pnpm
//   进程造成 fork bomb。建议模块级 in-flight 计数 ≥ 1 时返回 429。

// TODO(Important #6): Next.js 14.2.18 含 CVE-2025-29927（中间件绕过），应升至 14.2.33+。

export async function POST(req: NextRequest) {
  if (!isOriginAllowed(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateChatMessage((body as { message?: unknown })?.message);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const message = validation.value;

  let cwd: string;
  try {
    cwd = resolveNanoClawRoot();
  } catch (e) {
    const reason = e instanceof Error ? e.message : "NANOCLAW_ROOT not configured";
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(CHAT_CMD, CHAT_ARGS(message), {
      cwd,
      shell: false,
      env: buildChildEnv(cwd),
    });

    let stdout = "";
    let stderr = "";
    let responded = false;

    const respond = (r: NextResponse) => {
      if (!responded) {
        responded = true;
        resolve(r);
      }
    };

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", () => {
      // TODO(Important #7): stderr 当回复返回会泄漏内部错误栈和路径。
      //   应该：成功 → reply；失败 → 通用文案，stderr 仅写 server log。
      const reply =
        stripPnpmWrapper(stdout || stderr || "") || "(Andy 没有返回内容)";
      respond(NextResponse.json({ reply }));
    });

    proc.on("error", (err) => {
      respond(
        NextResponse.json(
          { error: "Failed to spawn chat process: " + err.message },
          { status: 500 },
        ),
      );
    });

    const timer = setTimeout(() => {
      proc.kill();
      respond(
        NextResponse.json(
          { error: "Chat process timed out after 120 seconds" },
          { status: 504 },
        ),
      );
    }, CHAT_TIMEOUT_MS);
    proc.on("close", () => clearTimeout(timer));
  });
}

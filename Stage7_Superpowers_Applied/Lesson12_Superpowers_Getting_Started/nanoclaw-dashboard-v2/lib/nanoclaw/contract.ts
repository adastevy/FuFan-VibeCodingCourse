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

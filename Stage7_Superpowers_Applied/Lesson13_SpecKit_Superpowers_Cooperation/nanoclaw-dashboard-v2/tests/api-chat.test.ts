import { describe, it, expect } from "vitest";
import {
  stripPnpmWrapper,
  validateChatMessage,
  MAX_MESSAGE_LENGTH,
} from "@/lib/nanoclaw/contract";
import { POST } from "@/app/api/chat/route";

/* ── 纯函数：stripPnpmWrapper ── */
describe("stripPnpmWrapper", () => {
  it("过滤 pnpm 启动器标头", () => {
    const input = `> nanoclaw@2.0.33 chat /path\n> tsx scripts/chat.ts hi\n\nhello\n`;
    expect(stripPnpmWrapper(input)).toBe("hello");
  });
  it("过滤多个空行", () => {
    expect(stripPnpmWrapper("\n\nfoo\n\n")).toBe("foo");
  });
  it("无污染时原样返回", () => {
    expect(stripPnpmWrapper("Hi\nThere")).toBe("Hi\nThere");
  });
  it("全是噪音时返回空串", () => {
    const input = `> nanoclaw@2.0.33 chat\n> tsx scripts/chat.ts\n\n`;
    expect(stripPnpmWrapper(input)).toBe("");
  });
});

/* ── 纯函数：validateChatMessage（不触发 spawn 的精细单测） ── */
describe("validateChatMessage", () => {
  it("空字符串 → 400", () => {
    const r = validateChatMessage("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
  it("非字符串 → 400", () => {
    const r = validateChatMessage(123);
    expect(r.ok).toBe(false);
  });
  it("以 '-' 开头 → 400", () => {
    const r = validateChatMessage("-rf /");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
  it("正好 4000 字符 → ok", () => {
    const r = validateChatMessage("a".repeat(MAX_MESSAGE_LENGTH));
    expect(r.ok).toBe(true);
  });
  it("4001 字符 → 413", () => {
    const r = validateChatMessage("a".repeat(MAX_MESSAGE_LENGTH + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });
  it("中文正常 → ok，trim 生效", () => {
    const r = validateChatMessage("  你好  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("你好");
  });
});

/* ── /api/chat 输入校验 ── */
function makeReq(body: unknown, options?: { invalidJson?: boolean }) {
  return new Request("http://x/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: options?.invalidJson ? "not-json" : JSON.stringify(body),
  });
}

describe("POST /api/chat · 输入校验", () => {
  it("非 JSON body → 400", async () => {
    const res = await POST(makeReq(null, { invalidJson: true }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("缺 message 字段 → 400", async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing or empty/);
  });

  it("message 是空串 → 400", async () => {
    const res = await POST(makeReq({ message: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("message 全空白 → 400", async () => {
    const res = await POST(makeReq({ message: "   \n\t  " }) as never);
    expect(res.status).toBe(400);
  });

  it("message 是数字（非字符串）→ 400", async () => {
    const res = await POST(makeReq({ message: 123 }) as never);
    expect(res.status).toBe(400);
  });

  /* ── Critical #1：argument injection 防御 ── */
  it("message 以 '-' 开头 → 400（防 CLI flag 走私）", async () => {
    const res = await POST(makeReq({ message: "-rf /etc/passwd" }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/CLI flags|must not start with/i);
  });
  it("message 以 '--' 开头 → 400", async () => {
    const res = await POST(makeReq({ message: "--config /tmp/evil" }) as never);
    expect(res.status).toBe(400);
  });

  /* ── Critical #1：长度上限（route 级 + 纯函数级） ── */
  it("message > 4000 字符 → 413", async () => {
    const res = await POST(
      makeReq({ message: "x".repeat(4001) }) as never,
    );
    expect(res.status).toBe(413);
  });

  /* ── Critical #4：Origin 检查 ── */
  it("Origin = evil.com → 403", async () => {
    const req = new Request("http://x/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
      body: JSON.stringify({ message: "ok" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });
  it("Origin = http://127.0.0.1:4000 → 通过", async () => {
    const req = new Request("http://x/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4000",
      },
      body: JSON.stringify({ message: "" }),
    });
    const res = await POST(req as never);
    // body empty 会到 400，关键是不到 403
    expect(res.status).toBe(400);
  });
});

import { describe, it, expect } from "vitest";
import {
  reducer,
  initialState,
  type State,
  type Action,
} from "@/lib/chat-state";

const T = 1_700_000_000_000;

const dispatch = (state: State, ...actions: Action[]): State =>
  actions.reduce((s, a) => reducer(s, a), state);

/* ════════════════════════════════════════════════════════════
 * § 1 · 初始状态
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 1 初始", () => {
  it("初始 panel = 'closed'", () => {
    expect(initialState.panel).toBe("closed");
  });
  it("初始 messages 为空", () => {
    expect(initialState.messages).toEqual([]);
  });
  it("初始无 pending / 无 error / 无 failedContent", () => {
    expect(initialState.pendingId).toBeNull();
    expect(initialState.errorReason).toBeNull();
    expect(initialState.failedContent).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════
 * § 2 · OPEN / CLOSE
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 2 OPEN / CLOSE", () => {
  it("closed --OPEN--> open", () => {
    const s = reducer(initialState, { type: "OPEN" });
    expect(s.panel).toBe("open");
  });
  it("OPEN 在 open 时 idempotent（仍 open）", () => {
    const s = dispatch(initialState, { type: "OPEN" }, { type: "OPEN" });
    expect(s.panel).toBe("open");
  });
  it("OPEN 在 received 时不改变 panel", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "hi", timestamp: T },
      { type: "REPLY_OK", id: "r1", content: "hello", timestamp: T + 1 },
    );
    expect(s.panel).toBe("received");
    const s2 = reducer(s, { type: "OPEN" });
    expect(s2.panel).toBe("received");
  });

  it("open --CLOSE--> closed", () => {
    const s = dispatch(initialState, { type: "OPEN" }, { type: "CLOSE" });
    expect(s.panel).toBe("closed");
  });
  it("CLOSE 保留历史 messages", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "hi", timestamp: T },
      { type: "REPLY_OK", id: "r1", content: "hello", timestamp: T + 1 },
      { type: "CLOSE" },
    );
    expect(s.panel).toBe("closed");
    expect(s.messages.length).toBe(2);
  });
  it("CLOSE 在 sending 时取消 pending", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "hi", timestamp: T },
      { type: "CLOSE" },
    );
    expect(s.panel).toBe("closed");
    expect(s.pendingId).toBeNull();
  });
  it("CLOSE 在 error 时清掉 errorReason 和 failedContent", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "hi", timestamp: T },
      { type: "REPLY_FAIL", id: "r1", reason: "boom" },
      { type: "CLOSE" },
    );
    expect(s.panel).toBe("closed");
    expect(s.errorReason).toBeNull();
    expect(s.failedContent).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════
 * § 3 · SEND（从 open 起）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 3 SEND", () => {
  const opened = reducer(initialState, { type: "OPEN" });

  it("open --SEND--> sending", () => {
    const s = reducer(opened, { type: "SEND", id: "r1", content: "ping", timestamp: T });
    expect(s.panel).toBe("sending");
  });
  it("SEND 后 pendingId 等于请求 id", () => {
    const s = reducer(opened, { type: "SEND", id: "r1", content: "ping", timestamp: T });
    expect(s.pendingId).toBe("r1");
  });
  it("SEND 立即把 user 消息追加到 messages（UX：用户先看到自己说的话）", () => {
    const s = reducer(opened, { type: "SEND", id: "r1", content: "ping", timestamp: T });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]!.role).toBe("user");
    expect(s.messages[0]!.content).toBe("ping");
    expect(s.messages[0]!.timestamp).toBe(T);
  });
  it("SEND 在 closed 时被拒（必须先 OPEN）", () => {
    const s = reducer(initialState, { type: "SEND", id: "r1", content: "ping", timestamp: T });
    expect(s.panel).toBe("closed");
    expect(s.messages).toEqual([]);
    expect(s.pendingId).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════
 * § 4 · REPLY_OK · sending → received
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 4 REPLY_OK", () => {
  const setup = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
  );

  it("sending --REPLY_OK--> received", () => {
    const s = reducer(setup(), { type: "REPLY_OK", id: "r1", content: "pong", timestamp: T + 100 });
    expect(s.panel).toBe("received");
  });
  it("appends assistant message", () => {
    const s = reducer(setup(), { type: "REPLY_OK", id: "r1", content: "pong", timestamp: T + 100 });
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1]!.role).toBe("assistant");
    expect(s.messages[1]!.content).toBe("pong");
  });
  it("clears pendingId / errorReason / failedContent", () => {
    const s = reducer(setup(), { type: "REPLY_OK", id: "r1", content: "pong", timestamp: T + 100 });
    expect(s.pendingId).toBeNull();
    expect(s.errorReason).toBeNull();
    expect(s.failedContent).toBeNull();
  });
  it("ID 不匹配时被忽略（防 stale 回包）", () => {
    const before = setup();
    const s = reducer(before, { type: "REPLY_OK", id: "rX", content: "pong", timestamp: T + 100 });
    expect(s).toEqual(before);
  });
  it("非 sending 状态收到 REPLY_OK 被忽略", () => {
    const s = reducer(initialState, { type: "REPLY_OK", id: "r1", content: "pong", timestamp: T });
    expect(s).toEqual(initialState);
  });
});

/* ════════════════════════════════════════════════════════════
 * § 5 · REPLY_FAIL · sending → error
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 5 REPLY_FAIL", () => {
  const setup = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
  );

  it("sending --REPLY_FAIL--> error", () => {
    const s = reducer(setup(), { type: "REPLY_FAIL", id: "r1", reason: "net" });
    expect(s.panel).toBe("error");
  });
  it("errorReason 写入", () => {
    const s = reducer(setup(), { type: "REPLY_FAIL", id: "r1", reason: "net" });
    expect(s.errorReason).toBe("net");
  });
  it("failedContent 保存原内容（用于 RETRY）", () => {
    const s = reducer(setup(), { type: "REPLY_FAIL", id: "r1", reason: "net" });
    expect(s.failedContent).toBe("ping");
  });
  it("user 消息保留在 messages（不被擦掉）", () => {
    const s = reducer(setup(), { type: "REPLY_FAIL", id: "r1", reason: "net" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]!.role).toBe("user");
  });
  it("ID 不匹配时被忽略", () => {
    const before = setup();
    const s = reducer(before, { type: "REPLY_FAIL", id: "rX", reason: "stale" });
    expect(s).toEqual(before);
  });
});

/* ════════════════════════════════════════════════════════════
 * § 6 · 并发 SEND（一次只能有一个在飞）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 6 并发 SEND（拒绝排队）", () => {
  it("sending 中再 SEND 被拒，pendingId 不变", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "ping1", timestamp: T },
      { type: "SEND", id: "r2", content: "ping2", timestamp: T + 1 },
    );
    expect(s.pendingId).toBe("r1");
  });
  it("sending 中再 SEND 被拒，messages 不增加", () => {
    const s = dispatch(
      initialState,
      { type: "OPEN" },
      { type: "SEND", id: "r1", content: "ping1", timestamp: T },
      { type: "SEND", id: "r2", content: "ping2", timestamp: T + 1 },
    );
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]!.content).toBe("ping1");
  });
});

/* ════════════════════════════════════════════════════════════
 * § 7 · 已收到回复后再发（received → sending）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 7 多轮对话（received → sending）", () => {
  const afterReply = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
    { type: "REPLY_OK", id: "r1", content: "pong", timestamp: T + 100 },
  );

  it("received --SEND--> sending", () => {
    const s = reducer(afterReply(), { type: "SEND", id: "r2", content: "again", timestamp: T + 200 });
    expect(s.panel).toBe("sending");
    expect(s.pendingId).toBe("r2");
  });
  it("messages 累加（保留之前的两条 + 新增 user）", () => {
    const s = reducer(afterReply(), { type: "SEND", id: "r2", content: "again", timestamp: T + 200 });
    expect(s.messages).toHaveLength(3);
    expect(s.messages[2]!.content).toBe("again");
  });
});

/* ════════════════════════════════════════════════════════════
 * § 8 · RETRY · error → sending（重发同样内容）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 8 RETRY", () => {
  const errored = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
    { type: "REPLY_FAIL", id: "r1", reason: "net" },
  );

  it("error --RETRY--> sending", () => {
    const s = reducer(errored(), { type: "RETRY", newId: "r1-retry", timestamp: T + 100 });
    expect(s.panel).toBe("sending");
  });
  it("RETRY 后 pendingId 是 newId", () => {
    const s = reducer(errored(), { type: "RETRY", newId: "r1-retry", timestamp: T + 100 });
    expect(s.pendingId).toBe("r1-retry");
  });
  it("RETRY 不重复 append user 消息（只有原来那一条）", () => {
    const s = reducer(errored(), { type: "RETRY", newId: "r1-retry", timestamp: T + 100 });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]!.content).toBe("ping");
  });
  it("RETRY 清掉 errorReason 和 failedContent", () => {
    const s = reducer(errored(), { type: "RETRY", newId: "r1-retry", timestamp: T + 100 });
    expect(s.errorReason).toBeNull();
    expect(s.failedContent).toBeNull();
  });
  it("RETRY 后 REPLY_OK 用 newId 能正常关闭循环", () => {
    const s = dispatch(
      errored(),
      { type: "RETRY", newId: "r1-retry", timestamp: T + 100 },
      { type: "REPLY_OK", id: "r1-retry", content: "pong", timestamp: T + 200 },
    );
    expect(s.panel).toBe("received");
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1]!.role).toBe("assistant");
  });
  it("非 error 状态 RETRY 被忽略", () => {
    const opened = reducer(initialState, { type: "OPEN" });
    const s = reducer(opened, { type: "RETRY", newId: "x", timestamp: T });
    expect(s).toEqual(opened);
  });
});

/* ════════════════════════════════════════════════════════════
 * § 9 · DISMISS_ERROR · error → open
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 9 DISMISS_ERROR", () => {
  const errored = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
    { type: "REPLY_FAIL", id: "r1", reason: "net" },
  );

  it("error --DISMISS_ERROR--> open", () => {
    const s = reducer(errored(), { type: "DISMISS_ERROR" });
    expect(s.panel).toBe("open");
  });
  it("清掉 errorReason / failedContent", () => {
    const s = reducer(errored(), { type: "DISMISS_ERROR" });
    expect(s.errorReason).toBeNull();
    expect(s.failedContent).toBeNull();
  });
  it("messages 保留（含失败的 user 消息）", () => {
    const s = reducer(errored(), { type: "DISMISS_ERROR" });
    expect(s.messages).toHaveLength(1);
  });
  it("非 error 状态 DISMISS_ERROR 被忽略", () => {
    const opened = reducer(initialState, { type: "OPEN" });
    const s = reducer(opened, { type: "DISMISS_ERROR" });
    expect(s).toEqual(opened);
  });
});

/* ════════════════════════════════════════════════════════════
 * § 10 · 错误后输入新内容（error --SEND--> sending）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 10 error 状态下新 SEND", () => {
  const errored = () => dispatch(
    initialState,
    { type: "OPEN" },
    { type: "SEND", id: "r1", content: "ping", timestamp: T },
    { type: "REPLY_FAIL", id: "r1", reason: "net" },
  );

  it("error --SEND(新内容)--> sending", () => {
    const s = reducer(errored(), { type: "SEND", id: "r2", content: "fresh", timestamp: T + 200 });
    expect(s.panel).toBe("sending");
    expect(s.pendingId).toBe("r2");
  });
  it("appends 新的 user 消息（保留旧的失败那条）", () => {
    const s = reducer(errored(), { type: "SEND", id: "r2", content: "fresh", timestamp: T + 200 });
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1]!.content).toBe("fresh");
  });
  it("新 SEND 清掉 errorReason 和 failedContent", () => {
    const s = reducer(errored(), { type: "SEND", id: "r2", content: "fresh", timestamp: T + 200 });
    expect(s.errorReason).toBeNull();
    expect(s.failedContent).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════
 * § 11 · 状态合法性矩阵（防止非法跃迁）
 * ════════════════════════════════════════════════════════════ */
describe("chat-state · § 11 非法跃迁全部 no-op", () => {
  it("closed 下 SEND / REPLY_OK / REPLY_FAIL / RETRY / DISMISS 全部不动", () => {
    const acts: Action[] = [
      { type: "SEND", id: "x", content: "y", timestamp: T },
      { type: "REPLY_OK", id: "x", content: "y", timestamp: T },
      { type: "REPLY_FAIL", id: "x", reason: "y" },
      { type: "RETRY", newId: "x", timestamp: T },
      { type: "DISMISS_ERROR" },
    ];
    for (const a of acts) {
      expect(reducer(initialState, a)).toEqual(initialState);
    }
  });
});

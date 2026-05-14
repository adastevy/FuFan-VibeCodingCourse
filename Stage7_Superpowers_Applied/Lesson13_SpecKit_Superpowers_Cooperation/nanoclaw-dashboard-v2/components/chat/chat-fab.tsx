"use client";

import { useReducer, useRef, useEffect, useState } from "react";
import { reducer, initialState } from "@/lib/chat-state";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ChatMessage,
  ChatGreeting,
  TypingIndicator,
} from "./chat-message";

const greetingMsg = {
  id: "sys-greeting",
  content: BRAND.greeting,
};

function nextId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function ChatFab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.panel]);

  /** 真正发出请求 + 处理回复 / 错误 */
  async function fireRequest(reqId: string, content: string) {
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && typeof data.reply === "string") {
        dispatch({
          type: "REPLY_OK",
          id: reqId,
          content: data.reply,
          timestamp: Date.now(),
        });
      } else {
        const reason =
          data.error ||
          (resp.status === 504
            ? "聊天超时（120s）"
            : `请求失败（HTTP ${resp.status}）`);
        dispatch({ type: "REPLY_FAIL", id: reqId, reason });
      }
    } catch (e) {
      // 网络错误 / 服务器不可达
      const reason =
        e instanceof Error
          ? `连接失败：${e.message}（后端 /api/chat 不可达）`
          : "连接失败";
      dispatch({ type: "REPLY_FAIL", id: reqId, reason });
    }
  }

  function send() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (state.panel === "sending") return; // 双保险（按钮也会 disabled）
    const id = nextId();
    dispatch({ type: "SEND", id, content: trimmed, timestamp: Date.now() });
    setDraft("");
    void fireRequest(id, trimmed);
  }

  function retry() {
    if (state.panel !== "error" || !state.failedContent) return;
    const newId = nextId();
    const content = state.failedContent;
    dispatch({ type: "RETRY", newId, timestamp: Date.now() });
    void fireRequest(newId, content);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
  // TODO(Important #13): 浮层 ESC 关闭。需要在浮层根节点 useEffect 监听 window.keydown=Escape。
  // TODO(Important #12): 错误 banner 4 元素（icon + reason + failedContent + 重试 + ✕）拥挤，
  //   且按钮 11px 字号点击区太小。下次迭代：去掉 failedContent（用户刚发的自己知道），
  //   重试/忽略 改成图标按钮 + 增大 hit-area。

  const open = state.panel !== "closed";
  const sending = state.panel === "sending";
  const errored = state.panel === "error";
  const canSend = !sending && draft.trim().length > 0;

  return (
    <>
      {/* ───── 浮层 ───── */}
      {open && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[560px] bg-card border border-border rounded-card shadow-2xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{BRAND.logo}</span>
              <span className="font-semibold text-[14px]">
                和 {BRAND.agentDefault} 对话
              </span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full ml-1",
                  errored
                    ? "bg-red"
                    : sending
                      ? "bg-yellow animate-pulse"
                      : "bg-green shadow-green-glow",
                )}
              />
              <span className="text-[10px] text-text-weak ml-1 uppercase tracking-wider">
                {labelByPanel(state.panel)}
              </span>
            </div>
            <button
              onClick={() => dispatch({ type: "CLOSE" })}
              className="text-text-weak hover:text-text text-base leading-none"
              aria-label="关闭"
            >
              ✕
            </button>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 bg-card"
          >
            <ChatGreeting content={greetingMsg.content} />
            {state.messages.map((m) => (
              <ChatMessage key={m.id} msg={m} />
            ))}
            {sending && <TypingIndicator />}
          </div>

          {/* Error banner */}
          {errored && (
            <div className="mx-3 mb-2 px-3 py-2 rounded-btn bg-red-dim border border-red/30 flex items-start gap-2">
              <div className="text-red text-sm shrink-0">⚠</div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-red font-medium truncate">
                  {state.errorReason}
                </div>
                {state.failedContent && (
                  <div className="text-[11px] text-text-weak truncate mt-0.5">
                    「{state.failedContent}」
                  </div>
                )}
              </div>
              <button
                onClick={retry}
                className="text-[11px] text-accent hover:underline shrink-0 font-medium"
              >
                重试
              </button>
              <button
                onClick={() => dispatch({ type: "DISMISS_ERROR" })}
                className="text-[11px] text-text-weak hover:text-text shrink-0"
                aria-label="忽略"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3 flex items-end gap-2 shrink-0">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              placeholder={
                sending
                  ? "Andy 正在回复…"
                  : `发消息给 ${BRAND.agentDefault}…（Enter 发送 · Shift+Enter 换行）`
              }
              rows={1}
              className={cn(
                "flex-1 bg-bg border border-border rounded-btn px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-none placeholder:text-text-weak max-h-32",
                sending && "opacity-60 cursor-not-allowed",
              )}
            />
            <button
              onClick={send}
              disabled={!canSend}
              className={cn(
                "w-9 h-9 rounded-btn text-base flex items-center justify-center shrink-0 transition-colors",
                canSend
                  ? "bg-accent text-bg hover:opacity-90"
                  : "bg-white/5 text-text-weak cursor-not-allowed",
              )}
              aria-label="发送"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ───── 浮动按钮 ───── */}
      <button
        onClick={() =>
          dispatch({ type: open ? "CLOSE" : "OPEN" })
        }
        title={`和 ${BRAND.agentDefault} 对话`}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent text-bg text-2xl flex items-center justify-center shadow-accent-glow z-40 transition-transform",
          open ? "scale-95 opacity-90" : "hover:scale-110 active:scale-95",
        )}
      >
        💬
      </button>
    </>
  );
}

function labelByPanel(panel: string): string {
  switch (panel) {
    case "open":
      return "在线";
    case "sending":
      return "发送中";
    case "received":
      return "已回复";
    case "error":
      return "错误";
    default:
      return "";
  }
}

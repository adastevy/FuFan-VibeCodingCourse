"use client";

import { useState } from "react";

interface Props {
  onTaskCreated: (taskId: string) => void;
}

export function ContentGenerationTrigger({ onTaskCreated }: Props) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = topic.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/content-generation/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.taskId) {
        setTopic("");
        onTaskCreated(data.taskId);
      } else if (res.status === 409) {
        const existing = data.existingTaskId ? `（任务 ID：${data.existingTaskId}）` : "";
        setError(`已有任务进行中，请等待完成后再触发${existing}`);
      } else if (res.status === 400) {
        setError(data.error || "话题内容不合法，请检查后重试");
      } else {
        setError(data.error || `请求失败（HTTP ${res.status}）`);
      }
    } catch (e) {
      setError(e instanceof Error ? `连接失败：${e.message}` : "连接失败");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  const canSubmit = topic.trim().length > 0 && !loading;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
            maxLength={500}
            placeholder="输入话题，如：AI 工程化、大模型应用开发…"
            className="w-full bg-bg border border-border rounded-btn px-4 py-2.5 text-[14px] outline-none focus:border-accent placeholder:text-text-weak disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-weak">
            {topic.length}/500
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={
            "px-5 py-2.5 rounded-btn text-[13px] font-medium shrink-0 transition-colors " +
            (canSubmit
              ? "bg-accent text-bg hover:opacity-90"
              : "bg-white/5 text-text-weak cursor-not-allowed")
          }
        >
          {loading ? "触发中…" : "开始生成"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-btn bg-red-dim border border-red/30 text-[12px] text-red">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-text-weak hover:text-text"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

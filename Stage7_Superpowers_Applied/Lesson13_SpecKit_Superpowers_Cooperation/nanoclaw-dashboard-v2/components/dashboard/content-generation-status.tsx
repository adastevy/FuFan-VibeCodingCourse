"use client";

import { useEffect, useState } from "react";
import type { ContentTask, ContentArticle } from "@/lib/nanoclaw/contract";

const STATUS_LABEL: Record<string, string> = {
  pending: "等待处理…",
  researching: "正在调研话题…",
  writing: "正在生成三平台文章（并发）…",
  completed: "✓ 生成完成",
  partial: "⚠ 部分平台生成成功",
  failed: "✗ 生成失败",
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "partial"]);

const STEP_ORDER = ["pending", "researching", "writing", "completed"];

interface Props {
  taskId: string | null;
  onStatusChange: (status: string, articles: ContentArticle[]) => void;
}

export function ContentGenerationStatus({ taskId, onStatusChange }: Props) {
  const [task, setTask] = useState<ContentTask | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setFetchError(null);
      return;
    }

    let active = true;

    async function poll() {
      try {
        const res = await fetch(
          `/api/content-generation/status?taskId=${encodeURIComponent(taskId!)}`,
        );
        if (!active) return;
        if (!res.ok) {
          setFetchError(`轮询失败（HTTP ${res.status}）`);
          return;
        }
        const data = await res.json();
        if (!active) return;
        const t: ContentTask = data.task;
        const arts: ContentArticle[] = data.articles || [];
        setTask(t);
        setFetchError(null);
        onStatusChange(t.status, arts);
        if (TERMINAL_STATUSES.has(t.status)) {
          active = false;
          clearInterval(intervalId);
        }
      } catch (e) {
        if (!active) return;
        setFetchError(e instanceof Error ? e.message : "轮询失败");
      }
    }

    // FR-016: immediate first poll, then every 5s
    poll();
    const intervalId = setInterval(poll, 5_000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!taskId) return null;

  const currentStatus = task?.status ?? "pending";
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);
  const statusLabel = STATUS_LABEL[currentStatus] ?? currentStatus;

  return (
    <div className="bg-card border border-border rounded-card p-5 space-y-4">
      {/* Status headline */}
      <div className="flex items-center gap-3">
        {!isTerminal && (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
        )}
        <span
          className={
            "text-[14px] font-medium " +
            (currentStatus === "completed"
              ? "text-green"
              : currentStatus === "failed"
                ? "text-red"
                : currentStatus === "partial"
                  ? "text-yellow"
                  : "text-text")
          }
        >
          {statusLabel}
        </span>
        {task?.error && (
          <span className="text-[12px] text-text-weak ml-2">— {task.error}</span>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_ORDER.map((step, i) => {
          const stepIndex = STEP_ORDER.indexOf(step);
          const currentIndex =
            STEP_ORDER.indexOf(currentStatus) !== -1
              ? STEP_ORDER.indexOf(currentStatus)
              : currentStatus === "failed" || currentStatus === "partial"
                ? STEP_ORDER.length - 1
                : 0;

          // For failed tasks: steps before the last are green-done, the last step is red-X
          const isFailedFinalStep = currentStatus === "failed" && stepIndex === currentIndex;
          const isDone =
            !isFailedFinalStep &&
            (stepIndex < currentIndex || (isTerminal && stepIndex <= currentIndex));
          const isActive = stepIndex === currentIndex && !isTerminal;
          const stepLabels: Record<string, string> = {
            pending: "排队",
            researching: "调研",
            writing: "生成",
            completed: "完成",
          };

          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={
                  "w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-medium transition-colors " +
                  (isFailedFinalStep
                    ? "bg-red text-bg"
                    : isDone
                      ? "bg-green text-bg"
                      : isActive
                        ? "bg-accent text-bg"
                        : "bg-white/10 text-text-weak")
                }
              >
                {isFailedFinalStep ? "✗" : isDone && !isActive ? "✓" : i + 1}
              </div>
              <span className="text-[12px] text-text-weak">{stepLabels[step]}</span>
              {i < STEP_ORDER.length - 1 && (
                <div
                  className={
                    "h-px w-8 " + (isDone ? "bg-green/50" : "bg-border")
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Topic */}
      {task?.topic && (
        <div className="text-[12px] text-text-weak">
          话题：<span className="text-text-sub">{task.topic}</span>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="text-[12px] text-red">⚠ {fetchError}</div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ContentTask } from "@/lib/nanoclaw/contract";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "完成", cls: "text-green" },
  partial: { label: "部分", cls: "text-yellow" },
  failed: { label: "失败", cls: "text-red" },
  pending: { label: "等待", cls: "text-text-weak" },
  researching: { label: "调研中", cls: "text-accent" },
  writing: { label: "生成中", cls: "text-accent" },
};

interface Props {
  currentTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function ContentHistory({ currentTaskId, onSelectTask }: Props) {
  const [tasks, setTasks] = useState<ContentTask[]>([]);

  useEffect(() => {
    async function fetchList() {
      try {
        const res = await fetch("/api/content-generation/list?limit=10");
        if (!res.ok) return;
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch {
        // silently ignore
      }
    }

    fetchList();
    const id = setInterval(fetchList, 5_000);
    return () => clearInterval(id);
  }, []);

  if (tasks.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-card p-4 mb-5">
      <div className="text-[12px] font-medium text-text-weak mb-3 uppercase tracking-wide">
        历史任务
      </div>
      <div className="space-y-1">
        {tasks.map((t) => {
          const badge = STATUS_BADGE[t.status] ?? { label: t.status, cls: "text-text-weak" };
          const isSelected = t.id === currentTaskId;
          const dateStr = t.created_at.slice(0, 16).replace("T", " ");
          return (
            <button
              key={t.id}
              onClick={() => onSelectTask(t.id)}
              className={
                "w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-[12px] transition-colors " +
                (isSelected
                  ? "bg-accent/15 border border-accent/30"
                  : "hover:bg-white/5 border border-transparent")
              }
            >
              <span className="font-mono text-text-sub truncate flex-1">{t.id}</span>
              <span className={badge.cls + " shrink-0 w-12 text-right"}>{badge.label}</span>
              <span className="text-text-muted shrink-0 tabular-nums">{dateStr}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

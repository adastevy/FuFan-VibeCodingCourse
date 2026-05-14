"use client";

import { useEffect, useState } from "react";
import { PanelCard } from "./panel-card";

interface DailyNewsItem {
  id: number;
  date: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  pushed_at: string | null;
}

interface DailyNewsTask {
  id: string;
  next_run_at: string;
  recurrence: string;
  tries: number;
  status: string;
}

export function DailyNewsPanel() {
  const [items, setItems] = useState<DailyNewsItem[]>([]);
  const [task, setTask] = useState<DailyNewsTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [listRes, statusRes] = await Promise.all([
          fetch("/api/daily-news/list").then((r) => r.json()),
          fetch("/api/daily-news/status").then((r) => r.json()),
        ]);
        if (listRes.error) throw new Error(listRes.error);
        setItems(listRes.items || []);
        setTask(statusRes.task || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <PanelCard title="📰 知识日报 Agent" count="Stage 1·每天 9:00 自动推 WeChat">
      {task && (
        <div className="text-xs text-zinc-400 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            下次执行:{" "}
            {new Date(task.next_run_at).toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
            })}
          </span>
          <span>·</span>
          <span>
            cron: <code className="text-zinc-300">{task.recurrence}</code>
          </span>
        </div>
      )}

      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      {error && <div className="text-sm text-rose-400">⚠ {error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-sm text-zinc-500">
          暂无日报记录·等 09:00 第一次触发
        </div>
      )}

      <ul className="space-y-2 max-h-72 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="text-sm border-b border-zinc-800 pb-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-100 hover:text-emerald-400 transition"
            >
              {item.title}
            </a>
            <div className="text-xs text-zinc-500 mt-1">{item.summary}</div>
            <div className="text-xs text-zinc-600 mt-1">
              {item.source} · {item.date}
              {item.pushed_at && (
                <>
                  {" "}
                  · 已推{" "}
                  {new Date(item.pushed_at).toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

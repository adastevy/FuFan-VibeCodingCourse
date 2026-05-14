"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ContentGenerationTrigger } from "@/components/dashboard/content-generation-trigger";
import { ContentGenerationStatus } from "@/components/dashboard/content-generation-status";
import { ContentArticlesGrid } from "@/components/dashboard/content-articles-grid";
import { ContentHistory } from "@/components/dashboard/content-history";
import { ContentShowcase } from "@/components/dashboard/content-showcase";
import type { ContentArticle } from "@/lib/nanoclaw/contract";

const LS_KEY = "content-current-task-id";

export default function ContentGenerationPage() {
  const [taskId, setTaskIdState] = useState<string | null>(null);
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);

  // Persist taskId to localStorage and reset display state
  function setTaskId(id: string) {
    setTaskIdState(id);
    setTaskStatus(null);
    setArticles([]);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      // ignore SSR / private-mode errors
    }
  }

  // On mount: restore from localStorage, or pick latest from list API
  useEffect(() => {
    async function init() {
      try {
        const stored = localStorage.getItem(LS_KEY);
        if (stored) {
          setTaskIdState(stored);
          return;
        }
      } catch {
        // ignore
      }
      try {
        const res = await fetch("/api/content-generation/list?limit=1");
        if (!res.ok) return;
        const data = await res.json();
        const first: { id: string } | undefined = data.tasks?.[0];
        if (first) {
          setTaskIdState(first.id);
          try {
            localStorage.setItem(LS_KEY, first.id);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
    init();
  }, []);

  function handleTaskCreated(id: string) {
    setTaskId(id);
  }

  function handleStatusChange(status: string, arts: ContentArticle[]) {
    setTaskStatus(status);
    setArticles(arts);
  }

  const showGrid =
    taskStatus !== null &&
    (articles.length > 0 ||
      taskStatus === "completed" ||
      taskStatus === "partial" ||
      taskStatus === "failed");

  return (
    <>
      <PageHeader
        title="多平台内容生成"
        subtitle="输入话题，AI 自动完成调研 + 小红书 / 公众号 / 微博三平台写作"
        actions={
          <Link
            href="/content-generation/showcase"
            className="text-[12px] px-3 py-1.5 rounded-btn bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium whitespace-nowrap"
          >
            查看作品集 →
          </Link>
        }
      />

      {/* Trigger area */}
      <div className="bg-card border border-border rounded-card p-5 mb-5">
        <div className="text-[13px] text-text-weak mb-3">
          输入话题（最多 500 字），点击「开始生成」，约 3 分钟内产出 3 篇风格迥异的文章
        </div>
        <ContentGenerationTrigger onTaskCreated={handleTaskCreated} />
      </div>

      {/* History tasks */}
      <ContentHistory currentTaskId={taskId} onSelectTask={setTaskId} />

      {/* Status area */}
      {taskId && (
        <div className="mb-5">
          <ContentGenerationStatus
            taskId={taskId}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      {/* Articles grid */}
      {showGrid && (
        <ContentArticlesGrid articles={articles} taskStatus={taskStatus} />
      )}

      {/* Showcase — all historical articles */}
      <div className="mt-10 mb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[16px] font-bold text-text">作品集</div>
            <div className="text-[12px] text-text-weak mt-0.5">
              全部已完成文章 · 点击卡片查看完整内容
            </div>
          </div>
          <Link
            href="/content-generation/showcase"
            className="text-[11px] text-text-weak hover:text-accent transition-colors"
          >
            全屏查看 →
          </Link>
        </div>
        <ContentShowcase />
      </div>
    </>
  );
}

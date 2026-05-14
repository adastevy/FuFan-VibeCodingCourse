"use client";

import { useState } from "react";
import type { ContentArticle } from "@/lib/nanoclaw/contract";

const PLATFORMS = [
  { id: "xiaohongshu", label: "小红书", emoji: "📕" },
  { id: "gongzhonghao", label: "公众号", emoji: "📰" },
  { id: "weibo", label: "微博", emoji: "🐦" },
] as const;

const CONTENT_PREVIEW_LIMIT = 500;

interface Props {
  articles: ContentArticle[];
  taskStatus: string | null;
}

function ArticleCard({
  article,
  platform,
}: {
  article: ContentArticle;
  platform: { id: string; label: string; emoji: string };
}) {
  const [expanded, setExpanded] = useState(false);

  const content = article.content ?? "";
  const isLong = content.length > CONTENT_PREVIEW_LIMIT;
  const displayContent = expanded || !isLong ? content : content.slice(0, CONTENT_PREVIEW_LIMIT) + "…";

  let tags: string[] = [];
  try {
    tags = article.tags ? JSON.parse(article.tags) : [];
  } catch {
    tags = [];
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{platform.emoji}</span>
        <span className="text-[13px] font-semibold">{platform.label}</span>
        {article.word_count != null && (
          <span className="text-[11px] text-text-weak ml-auto">
            {article.word_count} 字
          </span>
        )}
      </div>

      {/* Title */}
      {article.title && (
        <div className="text-[13px] font-medium text-text leading-snug">
          {article.title}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-badge bg-accent-dim text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="text-[12px] text-text-sub leading-relaxed whitespace-pre-wrap break-words">
        {displayContent}
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[12px] text-accent hover:underline"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </div>
  );
}

function EmptyColumn({
  platform,
  isFailed,
}: {
  platform: { id: string; label: string; emoji: string };
  isFailed: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{platform.emoji}</span>
        <span className="text-[13px] font-semibold">{platform.label}</span>
      </div>
      <div
        className={
          "flex flex-col items-center justify-center h-32 rounded-btn border border-dashed text-[12px] " +
          (isFailed
            ? "border-red/40 text-red bg-red-dim"
            : "border-border text-text-weak")
        }
      >
        {isFailed ? "该平台生成失败" : "等待生成…"}
      </div>
    </div>
  );
}

export function ContentArticlesGrid({ articles, taskStatus }: Props) {
  const byPlatform = new Map(articles.map((a) => [a.platform, a]));

  return (
    <div className="grid grid-cols-3 gap-5">
      {PLATFORMS.map((platform) => {
        const article = byPlatform.get(platform.id);
        const isFailed = taskStatus === "partial" && !article;

        return (
          <div
            key={platform.id}
            className="bg-card border border-border rounded-card p-4 flex flex-col min-h-[200px]"
          >
            {article ? (
              <ArticleCard article={article} platform={platform} />
            ) : (
              <EmptyColumn platform={platform} isFailed={isFailed} />
            )}
          </div>
        );
      })}
    </div>
  );
}

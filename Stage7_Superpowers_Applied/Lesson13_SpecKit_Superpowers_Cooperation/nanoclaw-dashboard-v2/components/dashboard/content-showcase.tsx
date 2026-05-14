"use client";

import { useState, useEffect, useCallback } from "react";

interface ArticleWithTopic {
  id: number;
  task_id: string;
  platform: string;
  title: string | null;
  content: string;
  tags: string | null;
  word_count: number | null;
  created_at: string;
  topic: string;
}

interface ShowcaseStats {
  total_tasks: number;
  total_articles: number;
  by_platform: Record<string, number>;
  total_words: number;
}

const PLATFORMS = [
  {
    id: "xhs",
    label: "小红书",
    emoji: "📕",
    color: "text-red",
    border: "border-red/30",
    headerBg: "bg-red/5",
    badgeBg: "bg-red/10",
  },
  {
    id: "gzh",
    label: "公众号",
    emoji: "📰",
    color: "text-green",
    border: "border-green/30",
    headerBg: "bg-green/5",
    badgeBg: "bg-green/10",
  },
  {
    id: "weibo",
    label: "微博",
    emoji: "🐦",
    color: "text-blue",
    border: "border-blue/30",
    headerBg: "bg-blue/5",
    badgeBg: "bg-blue/10",
  },
] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function parseTags(raw: string | null): string[] {
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function ArticleModal({
  article,
  onClose,
}: {
  article: ArticleWithTopic;
  onClose: () => void;
}) {
  const platform = PLATFORMS.find((p) => p.id === article.platform);
  const tags = parseTags(article.tags);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(article.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{platform?.emoji}</span>
            <span className={`font-bold text-[15px] ${platform?.color}`}>
              {platform?.label}
            </span>
            {article.word_count != null && (
              <span className="text-[11px] px-2 py-0.5 rounded-badge bg-accent/10 text-accent font-medium">
                {article.word_count} 字
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-weak hover:text-text text-[18px] w-7 h-7 flex items-center justify-center rounded hover:bg-border transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="text-[11px] text-text-weak bg-border/40 px-3 py-1.5 rounded-btn inline-block">
            原话题：{article.topic}
          </div>
          {article.title && (
            <div className="text-[16px] font-semibold text-text leading-snug">
              {article.title}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
          <div className="text-[13px] text-text-sub leading-[1.8] whitespace-pre-wrap">
            {article.content}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex items-center gap-3">
          <button
            onClick={copy}
            className="text-[12px] px-3 py-1.5 rounded-btn bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
          >
            {copied ? "已复制 ✓" : "复制全文"}
          </button>
          <span className="text-[11px] text-text-weak">{timeAgo(article.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  platform,
  onClick,
}: {
  article: ArticleWithTopic;
  platform: (typeof PLATFORMS)[number];
  onClick: () => void;
}) {
  const PREVIEW = 150;
  const preview =
    article.content.length > PREVIEW
      ? article.content.slice(0, PREVIEW) + "…"
      : article.content;
  const tags = parseTags(article.tags);

  return (
    <div
      onClick={onClick}
      className={`bg-card border ${platform.border} rounded-card p-4 cursor-pointer hover:bg-card-hover transition-all space-y-2.5 group`}
    >
      {/* Title */}
      {article.title ? (
        <div className="text-[13px] font-semibold text-text leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {article.title}
        </div>
      ) : (
        <div className="text-[12px] text-text-weak line-clamp-2 italic">
          （无标题）
        </div>
      )}

      {/* Content preview */}
      <div className="text-[12px] text-text-sub leading-relaxed line-clamp-3">
        {preview}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-accent-dim text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <div
          className="text-[10px] text-text-weak truncate max-w-[60%]"
          title={article.topic}
        >
          {article.topic}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {article.word_count != null && (
            <span className="text-[10px] text-text-weak">
              {article.word_count}字
            </span>
          )}
          <span className="text-[10px] text-text-weak">
            {timeAgo(article.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ContentShowcase() {
  const [articles, setArticles] = useState<ArticleWithTopic[]>([]);
  const [stats, setStats] = useState<ShowcaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ArticleWithTopic | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/content-generation/articles?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setArticles(data.articles ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-weak text-[13px]">
        加载作品集…
      </div>
    );
  }

  if (!stats || articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-2">
        <div className="text-text-weak text-[13px]">暂无已完成的文章</div>
        <div className="text-text-weak text-[11px]">
          生成几篇文章后再来查看
        </div>
      </div>
    );
  }

  // Group articles by platform
  const byPlatform = new Map<string, ArticleWithTopic[]>();
  for (const p of PLATFORMS) byPlatform.set(p.id, []);
  for (const a of articles) {
    const list = byPlatform.get(a.platform);
    if (list) list.push(a);
  }

  const wanWords = (stats.total_words / 10_000).toFixed(1);

  return (
    <>
      {modal && (
        <ArticleModal article={modal} onClose={() => setModal(null)} />
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "完成任务", value: String(stats.total_tasks), sub: "个话题" },
          { label: "生成文章", value: String(stats.total_articles), sub: "篇" },
          { label: "生成字数", value: `${wanWords} 万`, sub: "字" },
          {
            label: "平台分布",
            value: [
              stats.by_platform["xhs"] ?? 0,
              stats.by_platform["gzh"] ?? 0,
              stats.by_platform["weibo"] ?? 0,
            ].join(" / "),
            sub: "📕 / 📰 / 🐦",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-card border border-border rounded-card px-4 py-3"
          >
            <div className="text-[11px] text-text-weak mb-1">{item.label}</div>
            <div className="text-[24px] font-bold text-accent leading-tight">
              {item.value}
            </div>
            <div className="text-[11px] text-text-weak mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-5">
        {PLATFORMS.map((platform) => {
          const list = byPlatform.get(platform.id) ?? [];
          return (
            <div key={platform.id} className="space-y-3">
              {/* Column header */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-btn ${platform.headerBg} border ${platform.border}`}
              >
                <span className="text-xl">{platform.emoji}</span>
                <span className={`text-[14px] font-bold ${platform.color}`}>
                  {platform.label}
                </span>
                <span
                  className={`text-[11px] ml-auto px-2 py-0.5 rounded-badge ${platform.badgeBg} ${platform.color} font-medium`}
                >
                  {list.length} 篇
                </span>
              </div>

              {/* Articles */}
              {list.length === 0 ? (
                <div className="flex items-center justify-center h-24 rounded-card border border-dashed border-border text-[12px] text-text-weak">
                  暂无文章
                </div>
              ) : (
                list.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    platform={platform}
                    onClick={() => setModal(article)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

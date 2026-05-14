import { WECHAT_GROUP_PLATFORM_ID, MAX_ITEMS } from './config.js';
import type { RawNewsItem } from './types.js';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, China has no DST

export function getNext9amShanghai(): string {
  const now = Date.now();
  const shanghaiNow = new Date(now + SHANGHAI_OFFSET_MS);
  const todayStr = shanghaiNow.toISOString().slice(0, 10); // YYYY-MM-DD in Shanghai

  // 9am Asia/Shanghai = 01:00 UTC
  const today9amUtc = new Date(`${todayStr}T01:00:00.000Z`).getTime();

  // Use today's 9am if it's more than 60s away, otherwise advance to tomorrow
  const target = today9amUtc > now + 60_000 ? today9amUtc : today9amUtc + 24 * 60 * 60 * 1000;
  return new Date(target).toISOString();
}

export function buildTaskPrompt(articles?: RawNewsItem[]): string {
  const capped = (articles ?? []).slice(0, 50).map((a) => ({
    ...a,
    title: a.title.slice(0, 120),
  }));

  const articleSection =
    capped.length > 0
      ? `\n\n### 参考文章列表\n${capped.map((a, i) => `${i + 1}. [${a.title}](${a.url}) — ${a.points} points`).join('\n')}`
      : '';

  return `## 每日 AI 工程新闻任务

执行以下步骤，完成今日 AI 新闻摘要并推送到微信群：

### Step 1 — 抓取 HackerNews（昨日故事）
请求 HN Algolia API，取昨日发布的 AI/工程类故事（最多 30 条）：
  GET https://hn.algolia.com/api/v1/search_by_date?query=AI+LLM+engineering&tags=story&hitsPerPage=30

### Step 2 — 抓取 RSS 源（各取最新 20 条）
  - AI Weekly:       https://aiweekly.co/issues.rss
  - The Rundown AI:  https://api.therundown.ai/rss
  - InfoQ AI:        https://feed.infoq.com/news/ai-ml-data-eng

任一源抓取失败：重试 1 次，仍失败则跳过并记录警告，继续处理其余源。

### Step 3 — 去重
对所有条目按 URL 精确匹配去重（保留第一次出现）。

### Step 4 — 选出 ${MAX_ITEMS} 条
综合评分：HN points 权重 50%、AI/ML/LLM/工程工具相关度（你的判断）50%。
若去重后不足 ${MAX_ITEMS} 条，取全部。若 0 条，输出固定消息（见 Step 6）。

### Step 5 — 生成中文摘要
每条格式：
  【标题】（中文，适当意译）
  【摘要】1-2 句，≤ 50 字
  【来源】原始 URL

### Step 6 — 发送到微信群
目标群 platform_id: ${WECHAT_GROUP_PLATFORM_ID}
若摘要总长 > 500 字符，拆分为 2 条连续消息，不截断任何条目。
若 0 条可用内容：发送"今日 AI 工程领域无显著动态，明日 9:00 再见"。

若 LLM 摘要生成失败：重试一次；仍失败则降级为纯标题列表发送，不留空。

### Step 7 — 持久化记录到 daily_news 表
对每条最终确认推送的新闻摘要，调用 db.insertItems() 将记录写入 daily_news 表：
  - date:      今日上海日期（YYYY-MM-DD，与任务触发时间一致）
  - source:    来源名称（'hackernews' / 'ai-weekly' / 'the-rundown-ai' / 'infoq-ai'）
  - title:     中文标题
  - summary:   中文摘要
  - url:       原始 URL
  - pushed_at: 推送成功时的 ISO 时间戳
  - failed:    0（推送成功）

若微信推送最终失败（重试耗尽），对本次所有条目调用 db.markFailed()，将 failed 置 1，以便后续重推。${articleSection}`;
}

#!/usr/bin/env tsx
/**
 * 一次性脚本：注册 daily-news-9am · 立刻 trigger 一次（不等明早 9 点）
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const ANDY_INBOUND_PATH = path.join(
  process.cwd(),
  'data/v2-sessions/ag-1778127817315-jlhkmo/sess-1778127850240-jhp974/inbound.db',
);

import { registerDailyNewsTask } from '../src/modules/daily-news/setup.js';

const inboundDb = new Database(ANDY_INBOUND_PATH);

console.log('[1] registering daily-news-9am task ...');
const taskId = registerDailyNewsTask(inboundDb);
console.log(`   ✅ task registered: ${taskId}`);

console.log('\n[2] inserting trigger task (process_after = now-1s, will be picked up by next sweep)...');
const triggerId = `task-daily-news-trigger-${Date.now()}`;
const processAfter = new Date(Date.now() - 1000).toISOString();
const triggerContent = JSON.stringify({
  action: 'trigger_task',
  reason: 'Stage 1 manual trigger · 九天老师直播验证',
  prompt: `请立刻执行知识日报任务·步骤：

1. 抓取 HackerNews Algolia API 昨日 stories
   URL: https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${Math.floor((Date.now() - 86400_000) / 1000)}&hitsPerPage=20

2. 抓取 3 个 RSS 源各最新 5 条（按需要用 WebFetch 或 fetch tool）
   - https://aiweekly.co/issues.rss
   - https://api.therundown.ai/rss
   - https://feed.infoq.com/news/ai-ml-data-eng

3. 综合 HN + RSS·选出 5 条最值得关注的 AI/工程相关新闻

4. 用简体中文为每条生成结构化摘要：
   ## 序号·标题
   1-2 句话摘要（≤ 50 字）
   🔗 链接

5. 把 5 条整合·总长控制在 500 字内

6. 调 send_to_wechat 工具·把消息推送给 platformId=wechat:o9cq809ZVevgvCvrFv0wrwQaJYng@im.wechat
   channelType=wechat`,
});

inboundDb
  .prepare(
    `INSERT INTO messages_in (id, kind, timestamp, process_after, trigger, platform_id, channel_type, content)
     VALUES (@id, 'task', datetime('now'), @processAfter, 1, @platformId, @channelType, @content)`,
  )
  .run({
    id: triggerId,
    processAfter,
    platformId: 'wechat:o9cq809ZVevgvCvrFv0wrwQaJYng@im.wechat',
    channelType: 'wechat',
    content: triggerContent,
  });

console.log(`   ✅ trigger task inserted: ${triggerId}`);
console.log(`   ⏱  process_after = ${processAfter}（host-sweep 60s 后必定捕获）`);

console.log('\n[3] 现在等 host sweep 把它捡起来·watch logs/nanoclaw.log');
console.log('   tail -f logs/nanoclaw.log | grep -iE "trigger|daily-news|wechat|delivered"');

inboundDb.close();

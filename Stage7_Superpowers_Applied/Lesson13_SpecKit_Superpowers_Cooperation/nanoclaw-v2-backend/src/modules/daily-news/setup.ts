import type Database from 'better-sqlite3';
import { insertTask } from '../scheduling/db.js';
import { buildTaskPrompt, getNext9amShanghai } from './prompt-builder.js';
import { WECHAT_GROUP_PLATFORM_ID, WECHAT_CHANNEL_TYPE, CRON_EXPR } from './config.js';

export function registerDailyNewsTask(inboundDb: Database.Database): string {
  const id = `task-daily-news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const processAfter = getNext9amShanghai();

  insertTask(inboundDb, {
    id,
    processAfter,
    recurrence: CRON_EXPR,
    platformId: WECHAT_GROUP_PLATFORM_ID,
    channelType: WECHAT_CHANNEL_TYPE,
    threadId: null,
    content: JSON.stringify({
      action: 'schedule_task',
      taskId: id,
      prompt: buildTaskPrompt(),
      script: null,
      processAfter,
      recurrence: CRON_EXPR,
      platformId: WECHAT_GROUP_PLATFORM_ID,
      channelType: WECHAT_CHANNEL_TYPE,
      threadId: null,
    }),
  });
  return id;
}

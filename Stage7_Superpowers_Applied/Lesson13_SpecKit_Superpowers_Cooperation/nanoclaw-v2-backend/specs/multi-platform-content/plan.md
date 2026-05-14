# Plan: multi-platform-content

**Step**: spec-kit Step 4
**Created**: 2026-05-13
**Based on**: spec.md (18 FR) + clarify.md (8 CL) + brainstorming.md (8章) + integration-plan.md (4 sub-agent分工)

---

## 1 · 模块总图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        nanoclaw-dashboard-v2                             │
│                                                                          │
│  app/(dashboard)/content-generation/page.tsx                            │
│     ├── ContentGenerationTrigger  (components/dashboard/)               │
│     │      POST /api/content-generation/trigger                         │
│     ├── ContentGenerationStatus  (components/dashboard/)                │
│     │      GET  /api/content-generation/status?taskId=xxx  [5s poll]    │
│     └── ContentArticlesGrid     (components/dashboard/)                 │
│            3列展示 (xiaohongshu / gongzhonghao / weibo)                  │
│                                                                          │
│  app/api/content-generation/                                             │
│     ├── trigger/route.ts   → validates topic, writes content_tasks,     │
│     │                        spawn inject-task (pnpm run inject-task)   │
│     ├── status/route.ts    → reads content_tasks + content_articles     │
│     └── list/route.ts      → lists content_tasks DESC                   │
│                                                                          │
│  lib/nanoclaw/contract.ts  (修改: +readContentTask +readContentArticles  │
│                                   +writeContentTask)                     │
│  lib/mock/nav.ts           (修改: 新增侧边栏项)                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ spawn pnpm run inject-task
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          nanoclaw-v2 (host)                              │
│                                                                          │
│  src/scripts/inject-task.ts    ← CLI: --task-id --topic                 │
│     ├── 查 sessions 表找 coordinator session                              │
│     ├── 写 coordinator inbound.db messages_in (kind=task, trigger=1)    │
│     └── wakeContainer(coordinator_session)  [直接wake, 绕过sweep]        │
│                                                                          │
│  src/modules/content-generation/                                         │
│     ├── types.ts      ContentTask / ContentArticle interfaces            │
│     ├── db.ts         insertTask / updateStatus / insertArticle /        │
│     │                 getTask / listArticles (better-sqlite3)            │
│     └── index.ts      export barrel                                      │
│                                                                          │
│  src/db/migrations/015-content-generation.ts                            │
│     content_tasks + content_articles DDL (up/down)                      │
│  src/db/migrations/index.ts   (修改: 注册 migration015)                  │
│                                                                          │
│  scripts/setup-content-agents.ts                                        │
│     → 向 v2.db 插入 5 个 agent_groups + 8条 agent_destinations           │
│                                                                          │
│  scripts/write-article.ts                                               │
│     CLI: --task-id --platform --title --content --tags --word-count     │
│     → INSERT OR REPLACE INTO content_articles (better-sqlite3)          │
│                                                                          │
│  data/v2.db                                                              │
│     ├── content_tasks  (status机: pending→researching→writing→completed) │
│     ├── content_articles  UNIQUE(task_id, platform)                     │
│     └── agent_destinations (8条ACL行, setup脚本写入)                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ wakeContainer → Docker spawn
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    NanoClaw Agent Containers (Docker)                    │
│                                                                          │
│  content-coordinator (groups/content-coordinator/)                      │
│     CLAUDE.md: 接收task→更新状态→调度Researcher→等回传→并发触发3Writer    │
│     → send_message × 1 (→researcher)                                    │
│     → send_message × 3 (→xhs/gzh/weibo, 真并发wake)                    │
│     → Bash: update content_tasks.status via scripts/q.ts               │
│     → session_state: writers_completed / writers_failed 计数器          │
│                                                                          │
│  content-researcher (groups/content-researcher/)                        │
│     CLAUDE.md: 调研话题(WebSearch MCP/curl HN API)→结构化JSON→回传       │
│     → send_message × 1 (→coordinator, content=research_result JSON)    │
│                                                                          │
│  xiaohongshu-writer (groups/xiaohongshu-writer/)                        │
│  gongzhonghao-writer (groups/gongzhonghao-writer/)  ← 3个容器并发运行   │
│  weibo-writer (groups/weibo-writer/)                                    │
│     CLAUDE.md各自: 接收research→生成文章→Bash write-article.ts→回传done  │
│                                                                          │
│  container共用: /workspace/scripts/write-article.ts (host挂载)          │
│               : pnpm exec tsx (host node_modules挂载)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2 · 数据流详图

基于 brainstorming.md §3.1 数据流全图，精确到代码引用：

```
Step 0: 用户触发
  浏览器 POST /api/content-generation/trigger { topic }
  → trigger/route.ts:
    (a) 校验 topic 非空 ≤500 字符
    (b) SELECT id FROM content_tasks WHERE status IN ('pending','researching','writing')
        → 有结果: return 409 { error, existingTaskId }
    (c) 无冲突: INSERT INTO content_tasks (id=ctask-<ts>-<rand>, status='pending')
        → 使用 contract.ts writeContentTask()
    (d) spawn("pnpm", ["run","inject-task","--","--task-id=..","--topic=.."],
             { cwd: NANOCLAW_ROOT })  ← 与 chat/route.ts L63 完全一致模式
    (e) return 200 { taskId }

Step 1: inject-task → coordinator wake
  src/scripts/inject-task.ts:
    (a) 从 v2.db SELECT sessions WHERE agent_group_id='content-coordinator'
    (b) 打开 data/v2-sessions/{ag_id}/{sess_id}/inbound.db
    (c) INSERT INTO messages_in
          (id, seq=host偶数, kind='task', trigger=1,
           content=JSON{taskId, topic}, status='pending')
    (d) import { wakeContainer } from '../container-runner'
        await wakeContainer(coordinator_session)
        ← 与 router.ts deliverToAgent 模式一致
    (e) process.exit(0)

Step 2: Coordinator 唤醒
  content-coordinator container:
    (a) 读 messages_in 的 task 消息，解析 {taskId, topic}
    (b) Bash: pnpm exec tsx scripts/q.ts data/v2.db
             "UPDATE content_tasks SET status='researching',started_at=datetime('now')
              WHERE id='<taskId>'"
    (c) send_message(channel_type='agent', to='researcher', content={taskId,topic})
        → delivery.ts → routeAgentMessage() → researcher inbound.db
        → wakeContainer(researcher_session)  ← async Promise，不等

Step 3: Researcher 调研
  content-researcher container:
    (a) 读 messages_in，解析 {taskId, topic}
    (b) WebSearch MCP 或 Bash curl HN Algolia API
        搜索 topic 相关内容，汇总 key_facts + sources
    (c) 格式化为 research_result JSON（见 clarify.md CL-05）
    (d) send_message(channel_type='agent', to='parent',
                    content={taskId, research_result: JSON.stringify(result)})
        → coordinator inbound.db + wakeContainer(coordinator)

Step 4: Coordinator 收到 research，触发 3 Writers（真并发）
  content-coordinator container（第二次 wake）:
    (a) Bash: UPDATE content_tasks SET status='writing' WHERE id='<taskId>'
    (b) session_state: SET writers_completed='0', writers_failed='0'
    (c) 连续 3 次 send_message（channel_type='agent'）:
        send_message(to='xhs-writer',  content={taskId,topic,research_result})
        send_message(to='gzh-writer',  content={taskId,topic,research_result})
        send_message(to='weibo-writer',content={taskId,topic,research_result})
        → delivery.ts 对每次 send_message 调用 routeAgentMessage():
          routeAgentMessage→ xhs inbound.db + wakeContainer(xhs_session)   [Promise A]
          routeAgentMessage→ gzh inbound.db + wakeContainer(gzh_session)   [Promise B]
          routeAgentMessage→ weibo inbound.db + wakeContainer(weibo_session)[Promise C]
          container-runner.ts L93: wakePromises.set(sessionId, promise)
          ← A/B/C 互不等待，3个Docker容器几乎同时spawn
          ← 真并发来源: activeContainers key=sessionId 无全局锁

Step 5: 3 Writers 并发生成（各自独立 Docker 容器）
  xiaohongshu-writer / gongzhonghao-writer / weibo-writer 各自:
    (a) 读 messages_in，解析 {taskId, topic, research_result}
    (b) 按平台规格生成文章（CLAUDE.md 风格约束）
    (c) Bash: pnpm exec tsx /workspace/scripts/write-article.ts
              --task-id="ctask-xxx" --platform="xiaohongshu"
              --title="..." --content="..." --tags='["#AI"]' --word-count=750
        → write-article.ts: INSERT OR REPLACE INTO content_articles
          ← better-sqlite3 参数化SQL，无注入风险
    (d) send_message(channel_type='agent', to='parent',
                    content={taskId, platform, status:'done'|'error', error?:'...'})

Step 6: Coordinator 汇总完成信号
  content-coordinator container（第 3/4/5 次 wake）:
    (a) 读 messages_in，解析 {taskId, platform, status, error?}
    (b) 读 session_state writers_completed + writers_failed
    (c) 按 status 更新计数：
        done  → writers_completed += 1
        error → writers_failed += 1; failed_platforms.push(platform)
    (d) 写回 session_state（outbound.db 持久，容器重启后可恢复）
    (e) 若 writers_completed + writers_failed < 3: session 等待下次 wake（不退出）
    (f) 若 = 3:
        (3,0) → UPDATE content_tasks SET status='completed', completed_at=now()
        (1-2,1-2) → status='partial', error='failed: [platforms]', completed_at=now()
        (0,3) → status='failed', error='all writers failed', completed_at=now()

Step 7: Dashboard 轮询
  浏览器 GET /api/content-generation/status?taskId=ctask-xxx
  → status/route.ts:
    SELECT * FROM content_tasks WHERE id=?        → task
    SELECT * FROM content_articles WHERE task_id=? → articles (0-3行)
    return 200 { task, articles }
  → 前端:
    status='completed'|'failed'|'partial' → clearInterval
    articles 按 platform 分列渲染
```

---

## 3 · 文件清单（精确到路径）

### 3.1 nanoclaw-v2 新增文件

| 文件 | 类型 | Sub-Agent | 说明 |
|------|------|-----------|------|
| `src/db/migrations/015-content-generation.ts` | 新建 | Sub-1 | content_tasks + content_articles DDL |
| `src/modules/content-generation/types.ts` | 新建 | Sub-1 | ContentTask / ContentArticle interface |
| `src/modules/content-generation/db.ts` | 新建 | Sub-1 | DB CRUD helpers (better-sqlite3) |
| `src/modules/content-generation/index.ts` | 新建 | Sub-1 | export barrel |
| `scripts/write-article.ts` | 新建 | Sub-1 | CLI: INSERT OR REPLACE content_articles |
| `src/scripts/inject-task.ts` | 新建 | Sub-3 | CLI: 写 coordinator inbound.db + wakeContainer |
| `groups/content-coordinator/CLAUDE.md` | 新建 | Sub-2 | Coordinator 指令 |
| `groups/content-researcher/CLAUDE.md` | 新建 | Sub-2 | Researcher 指令 |
| `groups/xiaohongshu-writer/CLAUDE.md` | 新建 | Sub-2 | 小红书风格指令 |
| `groups/gongzhonghao-writer/CLAUDE.md` | 新建 | Sub-2 | 公众号风格指令 |
| `groups/weibo-writer/CLAUDE.md` | 新建 | Sub-2 | 微博风格指令 |
| `scripts/setup-content-agents.ts` | 新建 | Sub-2 | 注册5 agent_groups + 8条 agent_destinations |

### 3.2 nanoclaw-v2 修改文件

| 文件 | 类型 | Sub-Agent | 修改内容 |
|------|------|-----------|---------|
| `src/db/migrations/index.ts` | 修改 | Sub-1 | import + 注册 migration015 |
| `package.json` | 修改 | Sub-3 | 新增 `"inject-task": "tsx src/scripts/inject-task.ts"` script |

### 3.3 nanoclaw-dashboard-v2 新增文件

| 文件 | 类型 | Sub-Agent | 说明 |
|------|------|-----------|------|
| `app/api/content-generation/trigger/route.ts` | 新建 | Sub-3 | POST 触发，写DB + spawn inject-task |
| `app/api/content-generation/status/route.ts` | 新建 | Sub-3 | GET 轮询状态 + 文章 |
| `app/api/content-generation/list/route.ts` | 新建 | Sub-3 | GET 历史任务列表 |
| `app/(dashboard)/content-generation/page.tsx` | 新建 | Sub-4 | 主页面，组合所有组件 |
| `components/dashboard/content-generation-trigger.tsx` | 新建 | Sub-4 | 输入框 + 触发按钮 |
| `components/dashboard/content-generation-status.tsx` | 新建 | Sub-4 | 5s轮询状态展示 |
| `components/dashboard/content-articles-grid.tsx` | 新建 | Sub-4 | 3列文章展示网格 |

### 3.4 nanoclaw-dashboard-v2 修改文件

| 文件 | 类型 | Sub-Agent | 修改内容 |
|------|------|-----------|---------|
| `lib/nanoclaw/contract.ts` | 修改 | Sub-3 | +readContentTask +readContentArticles +writeContentTask +listContentTasks |
| `lib/mock/nav.ts` | 修改 | Sub-4 | 新增"多平台内容生成"侧边栏导航项 |

---

## 4 · 关键技术决策表

基于 brainstorming.md §2 的 7 个决策，每个含真代码引用：

### 决策 1 · 5 个独立 agent_group，不是 1 个全包 Agent

**为什么**：单 Agent 在同一 session 连续生成 3 种风格文章会发生 context 污染（brainstorming §2.1）。风格漂移的根因是 context window 里有前一篇文章的语气，影响后续生成。

**真代码引用**：`src/modules/daily-news/prompt-builder.ts` 的 7 步 Prompt 模式是单 Agent 全包——这对风格统一的日报可行，但多平台内容风格各异（小红书 emoji 活泼 vs 公众号深度长文），必须隔离 context。

**具体体现**：5 个独立 CLAUDE.md 文件（`groups/content-coordinator/CLAUDE.md` 等），每个 CLAUDE.md 只有该角色的风格约束，不混合。

---

### 决策 2 · Coordinator 串行 → 3 Writer 真并发

**为什么**：3 Writer 任务独立（输入相同 research，输出不同 DB 行），可并发；但 Writer 必须等 Researcher 完成才能开始（data dependency）。

**真代码引用**：`container-runner.ts` L51 `activeContainers = new Map<string, ...>()` key=sessionId——不同 session 的 wakeContainer 互不阻塞。`container-runner.ts` L93 `wakePromises.set(session.id, promise)` 注册异步 Promise，不等待。

**具体体现**：Coordinator 连续 3 次 `send_message(channel_type='agent')` → `delivery.ts` → `routeAgentMessage()` 对 3 个不同 session 各自独立 spawn Docker，3 容器几乎同时启动。

---

### 决策 3 · Dashboard spawn inject-task 子进程，不直接 import nanoclaw-v2 模块

**为什么**：dashboard 和 nanoclaw-v2 是独立项目（独立 package.json/node_modules），直接 import 引入跨项目编译依赖（brainstorming §2.3）。`wakeContainer()` 是 nanoclaw-v2 内部函数，不是公开 API。

**真代码引用**：`app/api/chat/route.ts` L63 `spawn("pnpm", ["run", "chat", message], { cwd: NANOCLAW_ROOT, shell: false })` — inject-task 完全复用此模式，仅更换命令名和参数。

**具体体现**：`src/scripts/inject-task.ts` 新建 CLI，`package.json` 新增 `"inject-task": "tsx src/scripts/inject-task.ts"` script；dashboard trigger route 调用 `spawn("pnpm", ["run","inject-task","--",...])`。

---

### 决策 4 · inject-task 直接 wakeContainer，绕过 host-sweep 60s 等待

**为什么**：`host-sweep.ts` L137–L139 `for...await sweepSession(session)` 串行遍历，每 60s 一轮；任务最多等 60s 才有反应（brainstorming §4.2, integration-plan 风险 2）。

**真代码引用**：`src/router.ts` L478 `deliverToAgent` 在写完 inbound.db 后立即调用 `wakeContainer(session)` — inject-task.ts 复用此模式：写完 messages_in 后直接 `import { wakeContainer } from '../container-runner'` 并调用。

**具体体现**：inject-task.ts 最后两行：写 messages_in → `await wakeContainer(session)`；确保用户点按钮后 ≤5s coordinator container 启动。

---

### 决策 5 · content_articles UNIQUE(task_id, platform) 约束 + INSERT OR REPLACE

**为什么**：3 Writer 各写不同 platform，正常情况无冲突；但 Writer 重试场景可能重复写同 platform，UNIQUE 约束保护数据一致性（brainstorming §6 risk 5）。

**真代码引用**：`src/db/migrations/014-daily-news.ts` 的 `UNIQUE INDEX idx_daily_news_url_date ON daily_news (url, date)` — 同模式应用到 content_articles。

**具体体现**：`015-content-generation.ts` 中 `CREATE UNIQUE INDEX idx_content_articles_task_platform ON content_articles (task_id, platform)`；`write-article.ts` 使用 `INSERT OR REPLACE` 语义。

---

### 决策 6 · Coordinator 用 session_state 维护 Writer 完成计数器

**为什么**：3 个 Writer 各自独立容器，完成后 send_message 给 Coordinator；Coordinator 需要跨多次 wake 累计计数（每次 wake 只处理一个 Writer 回传）（clarify.md CL-04）。

**真代码引用**：`container/agent-runner/src/db/` 中 `session_state` 表（outbound.db）：`key TEXT PK, value TEXT, updated_at TEXT` — Coordinator 读写 `writers_completed` + `writers_failed` 两个 key。outbound.db 在 `container-runner.ts` 中不被清除（只清 processing_ack），重启可恢复。

**具体体现**：Coordinator CLAUDE.md 指令：每次 wake 先读 session_state，判断 writers_completed + writers_failed 是否 < 3，是则继续等待，否则写最终 content_tasks 状态。

---

### 决策 7 · Writer 通过 pnpm exec tsx write-article.ts 写 DB，不用 sqlite3 CLI

**为什么**：content 字段含中文、emoji、换行符，直接拼 sqlite3 CLI 命令存在 shell 转义和 SQL 注入风险（clarify.md CL-06）。

**真代码引用**：`container/agent-runner/src/mcp-tools/` 无直接 INSERT v2.db 的工具；Writer 只能通过 Bash tool 执行外部命令。host node_modules 已挂载到容器 `/workspace`，`pnpm exec tsx` 可用。

**具体体现**：`scripts/write-article.ts` 使用 `better-sqlite3`（host 侧 package），参数化 SQL：`db.prepare('INSERT OR REPLACE INTO content_articles VALUES (?,?,?,?,?,?,?,?)').run(values)`；Writer CLAUDE.md 明确命令格式和参数转义规则。

---

## 5 · Sub-Agent 依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│   T1: Sub-1 + Sub-2 同时启动（文件域零重叠，真并行）     │
│                                                          │
│   Sub-1 (DB + types + write-article.ts)                 │
│     src/db/migrations/015-content-generation.ts         │
│     src/modules/content-generation/{types,db,index}.ts  │
│     scripts/write-article.ts                            │
│     src/db/migrations/index.ts                          │
│                        ↓ 产出: types.ts, db.ts          │
│                                                          │
│   Sub-2 (Agent CLAUDE.md + setup脚本)                   │
│     groups/content-{coordinator,researcher}/CLAUDE.md   │
│     groups/{xiaohongshu,gongzhonghao,weibo}-writer/     │
│     scripts/setup-content-agents.ts                     │
│     ← 与Sub-1零重叠，无需等待                            │
└──────────────────┬──────────────────────────────────────┘
                   ↓ Sub-1完成后（types.ts可用）
┌──────────────────────────────────────────────────────────┐
│   T2: Sub-3 启动（依赖Sub-1的types + db helpers）        │
│                                                          │
│   Sub-3 (API Routes + inject-task CLI)                  │
│     src/scripts/inject-task.ts                          │
│     package.json (+inject-task script)                  │
│     lib/nanoclaw/contract.ts (+content-gen helpers)     │
│     app/api/content-generation/trigger/route.ts         │
│     app/api/content-generation/status/route.ts          │
│     app/api/content-generation/list/route.ts            │
│     ← 依赖Sub-1的ContentTask/ContentArticle types       │
└──────────────────┬──────────────────────────────────────┘
                   ↓ Sub-3完成后（API路径确定）
┌──────────────────────────────────────────────────────────┐
│   T3: Sub-4 启动（依赖Sub-3的API路径）                   │
│                                                          │
│   Sub-4 (Dashboard 前端组件)                             │
│     lib/mock/nav.ts (+侧边栏项)                          │
│     components/dashboard/content-generation-trigger.tsx  │
│     components/dashboard/content-generation-status.tsx   │
│     components/dashboard/content-articles-grid.tsx       │
│     app/(dashboard)/content-generation/page.tsx         │
│     ← 依赖Sub-3确定的API路径(/api/content-generation/*) │
└─────────────────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│   T4: 人工联调（端到端测试）                             │
│     pnpm exec tsx scripts/setup-content-agents.ts       │
│     pnpm run inject-task -- --task-id=test --topic=AI   │
│     curl POST localhost:4000/api/content-generation/trigger │
│     等待3min → 验证 content_tasks + content_articles     │
└─────────────────────────────────────────────────────────┘
```

---

## 6 · 关键 Schema 定义（实现参考）

```sql
-- src/db/migrations/015-content-generation.ts up()
CREATE TABLE IF NOT EXISTS content_tasks (
  id           TEXT    PRIMARY KEY,
  topic        TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',
  created_at   TEXT    NOT NULL,
  started_at   TEXT,
  completed_at TEXT,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_tasks_status
  ON content_tasks (status);
CREATE INDEX IF NOT EXISTS idx_content_tasks_created
  ON content_tasks (created_at DESC);

CREATE TABLE IF NOT EXISTS content_articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT    NOT NULL REFERENCES content_tasks(id),
  platform     TEXT    NOT NULL,
  title        TEXT,
  content      TEXT    NOT NULL,
  tags         TEXT,
  word_count   INTEGER,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_articles_task
  ON content_articles (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_articles_task_platform
  ON content_articles (task_id, platform);
```

```sql
-- src/db/migrations/015-content-generation.ts down()
DROP INDEX IF EXISTS idx_content_articles_task_platform;
DROP INDEX IF EXISTS idx_content_articles_task;
DROP TABLE IF EXISTS content_articles;
DROP INDEX IF EXISTS idx_content_tasks_created;
DROP INDEX IF EXISTS idx_content_tasks_status;
DROP TABLE IF EXISTS content_tasks;
```

---

## 7 · agent_destinations ACL 矩阵（setup 脚本必须写完整）

| # | agent_group_id | local_name | target_type | target_id |
|---|----------------|------------|-------------|-----------|
| 1 | content-coordinator | researcher | agent | content-researcher |
| 2 | content-coordinator | xhs-writer | agent | xiaohongshu-writer |
| 3 | content-coordinator | gzh-writer | agent | gongzhonghao-writer |
| 4 | content-coordinator | weibo-writer | agent | weibo-writer |
| 5 | content-researcher | parent | agent | content-coordinator |
| 6 | xiaohongshu-writer | parent | agent | content-coordinator |
| 7 | gongzhonghao-writer | parent | agent | content-coordinator |
| 8 | weibo-writer | parent | agent | content-coordinator |

验证：`pnpm exec tsx scripts/q.ts data/v2.db "SELECT * FROM agent_destinations WHERE agent_group_id LIKE 'content%'"` 输出 8 行。

---

## 8 · inject-task CLI 接口规范

```bash
# 调用方式（dashboard spawn）
pnpm run inject-task -- --task-id=<ctask-xxx> --topic=<topic>

# 参数
--task-id   必填，已存在于 content_tasks 表的 id（trigger/route.ts 先写 DB 再 spawn）
--topic     必填，原始话题字符串（注意 shell 转义）

# 退出码
0  = 成功（inbound.db 已写，wakeContainer 已调用）
1  = 失败（错误原因输出到 stderr）

# 错误场景
- content-coordinator session 不存在 → exit 1, stderr: "coordinator session not found"
- inbound.db 写入失败 → exit 1, stderr: DB error message
- wakeContainer 抛出异常 → exit 1, stderr: wake error（但 inbound.db 已写，task 会在下次sweep被wake）

# 超时：无（inject-task 完成即返回，实际 wake 是异步的）
```

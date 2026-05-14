# Multi-Platform Content Generation · Brainstorming

> Stage 3 spec-kit Step 1 · 真凭据驱动
> 基于 Step 0 调研：`/tmp/stage3-code-survey.md`（后端真实实现）+ `/tmp/stage3-integration-plan.md`（dashboard 结构 + 并发能力）
> 旧版（基于 Claude Code Task subagents 临时编排·与 NanoClaw 无关）完全推翻重写

---

## 1 · 功能愿景

### 谁用、为什么用、解决什么真问题

**用户**：内容创作者/运营者，日常需要将同一话题发布到小红书、公众号、微博三个平台，每个平台文风截然不同（小红书 emoji 活泼、公众号深度长文、微博精炼口语）。

**真问题**：
- 手写 3 篇风格各异的文章耗时 1-2 小时
- 写完一篇换风格时容易"漂移"——公众号写完再写小红书，仍残留深度分析语气
- 话题调研（需要哪些数据支撑、最新数字是什么）是三篇文章共用但只需做一次的工作

**解决方式**：用户在 dashboard 输入话题，点一个按钮，系统自动完成调研 + 三平台生成，3 分钟内得到 3 篇可直接发布的文章。人工工作从"写作"退化为"审核"。

### MVP 范围 vs 扩展可能

| 维度 | MVP（本期） | 扩展（后期） |
|------|------------|-------------|
| 平台 | 小红书 + 公众号 + 微博 | 抖音文案、LinkedIn |
| 触发 | Dashboard 手动输入话题 | 定时触发（每天 9:00）、Webhook |
| 发布 | 文章写入 DB + 前端展示，人工复制发布 | 接 WeChat/Weibo adapter 真实投递 |
| 调研 | 联网搜索 + 摘要 | 私有知识库、竞品监控 |
| 历史 | 当前任务状态 | 任务历史列表、文章回溯 |

---

## 2 · 核心架构选择（含决策依据）

### 2.1 为什么是 5 个独立 agent_group，不是 1 个全包 Agent

**错误对比：daily-news 的单 Agent 7 步 Prompt 模式**

`src/modules/daily-news/prompt-builder.ts` 用一个 7 步指令让单 Agent 自己完成拉取→去重→摘要→格式化→发送→持久化。这对 daily-news 可行，因为任务是线性的、风格统一的（只有微信一种输出）。

**多平台内容生成不适合单 Agent 的真原因：**
1. **风格漂移**：单 Agent 在同一 session 内连续生成 3 篇不同风格文章，后面的文章会受前面文章的风格污染（context 污染），小红书写完再写公众号，语气容易不纯
2. **无真并发**：单 Agent 只有一个 container，三篇文章只能串行生成，耗时 2-3x
3. **context 臃肿**：调研数据 + 三篇文章全在一个 Agent session，context window 压力大，hallucination 风险上升
4. **独立 agent_group = 独立 CLAUDE.md**：每个 Writer 的 CLAUDE.md 可以精确调教该平台风格，而不是在同一 prompt 里切换人格

**决策依据**：`/tmp/stage3-integration-plan.md` 任务 2 §2.3 — 独立 agent_group + 独立 session 是 `wakeContainer` 真并发的必要条件；`agent-shared` session_mode 会让多个 Writer 排队用同一 container。

**5 个 agent_group：**
- `content-coordinator`：调度入口，串联 Researcher 和 Writers，维护任务状态
- `content-researcher`：专职调研，输出结构化 research 结果
- `xiaohongshu-writer`：专注小红书风格
- `gongzhonghao-writer`：专注公众号深度文风
- `weibo-writer`：专注微博精炼口语

### 2.2 为什么是 Coordinator + Researcher 串行 → 3 Writer 并发，不是别的拓扑

**串行部分（Coordinator → Researcher）的决策依据：**
- 3 个 Writer 都依赖同一份 research 结果，必须等 Researcher 完成才能开始
- 如果 3 个 Writer 各自调研，会产生 3 套不一致的数据，文章间数字互相矛盾
- Researcher 是 IO 密集型（网络请求），单独拆出来可以在 Coordinator 等待期间不占用其他资源

**并发部分（3 Writer 同时跑）的决策依据：**
- 3 个 Writer 任务完全独立——输入都是同一份 research，输出写不同的 DB 行（`UNIQUE(task_id, platform)` 保证无冲突）
- `container-runner.ts` L93 `wakePromises` per-session 机制：Coordinator 连续 3 次 `send_message`（channel_type='agent'），`delivery.ts` → `routeAgentMessage()` → 对 3 个不同 session 各自独立 spawn Docker 容器，互不阻塞
- 真实并发节点来自代码：`container-runner.ts` L51 `activeContainers` 的 key 是 `sessionId`，不是全局锁

**其他拓扑为什么不选：**
- "Researcher 也并发"：3 Writer 还未分工时调研，调研什么？话题输入后只有一个调研任务
- "Coordinator 直接做调研"：Coordinator 还要管状态机（pending→researching→writing→completed），职责混淆
- "全串行"：放弃了真并发的性能优势，3 篇文章生成时间 3x

### 2.3 为什么 dashboard 触发用 `spawn pnpm run inject-task` 子进程，不是别的方式

**真凭据**：`/tmp/stage3-integration-plan.md` §1.3 — dashboard 无 HTTP 客户端，NanoClaw 没有 REST API。现有唯一触发机制是 `app/api/chat/route.ts` L63 spawn `pnpm run chat`。

**直接 import nanoclaw-v2 内部模块**的问题：
- dashboard 和 nanoclaw-v2 是两个独立项目（不同 package.json、不同 node_modules）
- import 内部模块意味着 dashboard 需要 build nanoclaw-v2 的 TypeScript，引入跨项目编译依赖
- `wakeContainer()` 是 nanoclaw-v2 内部函数，不是公开 API

**直接写 inbound.db 绕过 inject-task** 的问题：
- dashboard 的 contract.ts 目前只读 SQLite，写 host-owned `inbound.db` 需要理解 nanoclaw-v2 的 seq parity 规则（host 用偶数 seq）
- 写完 DB 不 wake container，任务要等最多 60s 的 host-sweep 才会被发现

**最终决策：仿照 `pnpm run chat` 模式**，新增 `pnpm run inject-task` CLI 脚本（`src/scripts/inject-task.ts`），dashboard spawn 它传递 `taskId + topic`，脚本完成写 `inbound.db` + 直接 `wakeContainer()`，绕过 60s sweep 等待。

---

## 3 · 数据流 + DB 概念设计

### 3.1 数据流全图

```
用户在 Dashboard 输入话题 "AI 工程化"
  ↓ POST /api/content-generation/trigger
  ↓ 写 content_tasks (status='pending')
  ↓ spawn inject-task → 写 coordinator inbound.db + wakeContainer(coordinator)

content-coordinator 容器唤醒：
  ↓ 更新 content_tasks.status = 'researching'
  ↓ send_message(channel_type='agent', → content-researcher, content={taskId, topic})
  → routeAgentMessage → researcher inbound.db + wakeContainer(researcher)

content-researcher 容器唤醒：
  ↓ 调研（网络搜索、摘要）
  ↓ send_message(→ coordinator, content={taskId, research_result})
  → coordinator inbound.db + wakeContainer(coordinator)

content-coordinator 收到 research：
  ↓ 更新 content_tasks.status = 'writing'
  ↓ 连续 3 次 send_message（→ xhs-writer / gzh-writer / weibo-writer）
  → 3 次 routeAgentMessage → 3 个 inbound.db + 3 次 wakeContainer（几乎同时）

3 个 Writer 容器并发运行：
  ↓ 各自生成文章
  ↓ 各自通过 Bash tool 写 content_articles（task_id × platform）
  ↓ 各自 send_message(→ coordinator) 报告完成

content-coordinator 汇总（收到 3 个完成信号）：
  ↓ 更新 content_tasks.status = 'completed' + completed_at

Dashboard 5s 轮询 GET /api/content-generation/status：
  ↓ 读 content_tasks + content_articles
  → 展示进度文字 + 完成后 3 列文章
```

### 3.2 DB Schema 概念设计

**迁移文件**：`src/db/migrations/015-content-generation.ts`（对齐 `014-daily-news.ts` 的 `up()` 函数结构）

```sql
-- 任务状态机表
CREATE TABLE IF NOT EXISTS content_tasks (
  id           TEXT    PRIMARY KEY,      -- 'ctask-<timestamp>-<random>'
  topic        TEXT    NOT NULL,         -- 用户输入话题
  status       TEXT    NOT NULL DEFAULT 'pending',
               -- 状态机：'pending' → 'researching' → 'writing' → 'completed' | 'failed'
  created_at   TEXT    NOT NULL,         -- ISO 8601 UTC
  started_at   TEXT,                     -- coordinator 首次唤醒时
  completed_at TEXT,                     -- 所有 Writer 完成时
  error        TEXT                      -- 失败原因
);
CREATE INDEX IF NOT EXISTS idx_content_tasks_status   ON content_tasks (status);
CREATE INDEX IF NOT EXISTS idx_content_tasks_created  ON content_tasks (created_at DESC);

-- 各平台文章表
CREATE TABLE IF NOT EXISTS content_articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT    NOT NULL REFERENCES content_tasks(id),
  platform     TEXT    NOT NULL,         -- 'xiaohongshu' | 'gongzhonghao' | 'weibo'
  title        TEXT,                     -- 公众号/小红书有标题；微博无
  content      TEXT    NOT NULL,
  tags         TEXT,                     -- JSON array ["#AI工程化", "#技术"]
  word_count   INTEGER,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_articles_task
  ON content_articles (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_articles_task_platform
  ON content_articles (task_id, platform);
```

### 3.3 谁写谁读（关键边界）

| 表 | 写者 | 读者 | 写入时机 |
|----|------|------|---------|
| `content_tasks` INSERT | Dashboard API Route | Dashboard 前端 | 用户点触发按钮 |
| `content_tasks` UPDATE status | content-coordinator（Bash tool → sqlite） | Dashboard 轮询 | 每次状态转换 |
| `content_articles` | 各 Writer（Bash tool → sqlite） | Dashboard 轮询 | 文章生成完成 |

**关键决策**：Coordinator 是 content_tasks 的唯一状态机维护者；三个 Writer 只负责写自己的 content_articles 行，不触碰 content_tasks。

---

## 4 · 并发设计 · 真凭据论证

### 4.1 真并发节点

**代码证据**（`/tmp/stage3-integration-plan.md` §2.2）：

```typescript
// container-runner.ts L51
activeContainers = new Map<string, { process; containerName }>()
// key = sessionId，不是全局锁

// container-runner.ts L83–L104
wakeContainer(session) {
  if (activeContainers.has(session.id)) return;  // 同 session 去重
  const promise = spawnContainer(session).then(...);
  wakePromises.set(session.id, promise);          // 不同 session 完全独立
}
```

Coordinator 连续调用 3 次 `send_message`（channel_type='agent'）：
1. `delivery.ts` → `routeAgentMessage(→ xhs-writer)` → `wakeContainer(xhs_session)` → spawn Docker A
2. `delivery.ts` → `routeAgentMessage(→ gzh-writer)` → `wakeContainer(gzh_session)` → spawn Docker B
3. `delivery.ts` → `routeAgentMessage(→ weibo-writer)` → `wakeContainer(weibo_session)` → spawn Docker C

Docker A/B/C 的 `spawnContainer` 是 async Promise，注册进各自的 `wakePromises` entry，互不等待。**3 个 Docker 容器几乎同时启动，真并发。**

### 4.2 host-sweep 不是触发路径（关键陷阱）

**陷阱**（`/tmp/stage3-integration-plan.md` §2.1）：

```typescript
// host-sweep.ts L137–L139
for (const session of sessions) {
  await sweepSession(session);   // 串行 await，不是 Promise.all
}
```

sweep 每 60 秒跑一次，且串行遍历所有 session。若依赖 sweep 触发 coordinator，用户点按钮后最多等 60s 才有反应——这不可接受。

**解决方案**：`inject-task.ts` 脚本写完 `inbound.db` 后直接调用 `wakeContainer(coordinator_session)`，与 `router.ts` L478 `deliverToAgent` 的模式一致。Coordinator 唤醒后的 3 次 `send_message` 也通过 `routeAgentMessage` 直接 wake 各 Writer，全程绕过 sweep。

### 4.3 并发度边界

- **NanoClaw 代码层**：无全局锁，3 个 Writer 并发无障碍
- **宿主机层**：Docker 容器并发受 CPU/内存限制；开发机通常可跑 3-5 个 Claude Code 容器
- **Claude API 层**：并发 API 调用受账户 rate limit；3 个并发请求通常在限制内

---

## 5 · 开发分工（4 sub-agent 并发）

### 依赖图

```
Sub-1 (DB migration + content-generation module)        ── T1，无依赖，立即开始
Sub-2 (5 个 agent CLAUDE.md + setup-content-agents.ts) ── T1，与 Sub-1 真并行（文件域零重叠）
                                         ↓
Sub-3 (dashboard API Routes + inject-task CLI)          ── T2，等 Sub-1 完成（需要 types）
                                         ↓
Sub-4 (dashboard 前端组件 + 侧边栏)                     ── T3，等 Sub-3 完成（需要 API 路径）
```

### Sub-1 · DB migration + content-generation module（T1，无依赖）

**文件域（nanoclaw-v2）：**
- `src/db/migrations/015-content-generation.ts`（新建，DDL）
- `src/db/migrations/index.ts`（修改，注册 migration015）
- `src/modules/content-generation/types.ts`（新建，ContentTask/ContentArticle 接口）
- `src/modules/content-generation/db.ts`（新建，insertTask/updateStatus/insertArticle/getTask/listArticles）
- `src/modules/content-generation/index.ts`（新建，导出）

**交付标准**：`pnpm run build` 通过，migration 可被 index.ts 加载，DB helper 有完整类型。

### Sub-2 · 5 个 agent CLAUDE.md + setup 脚本（T1，与 Sub-1 并行）

**文件域（nanoclaw-v2）：**
- `groups/content-coordinator/CLAUDE.md`（新建，指令：接收任务→调度 Researcher→并发触发 Writer→汇总状态）
- `groups/content-researcher/CLAUDE.md`（新建，指令：调研话题→结构化输出→回传 coordinator）
- `groups/xiaohongshu-writer/CLAUDE.md`（新建，指令：小红书文风，800字内，emoji，hashtag）
- `groups/gongzhonghao-writer/CLAUDE.md`（新建，指令：公众号文风，1500-2500字，小标题）
- `groups/weibo-writer/CLAUDE.md`（新建，指令：微博文风，≤280字符，话题标签）
- `scripts/setup-content-agents.ts`（新建，向 v2.db 插入 5 个 agent_groups + 完整 agent_destinations ACL）

**交付标准**：`pnpm exec tsx scripts/setup-content-agents.ts` 运行后，`agent_destinations` 表有 8 条双向 ACL 行，coordinator 能向所有其他 4 个 agent 发消息，researcher/writer 能回传 coordinator。

### Sub-3 · Dashboard API Routes + inject-task CLI（T2，等 Sub-1 完成）

**文件域（nanoclaw-v2）：**
- `src/scripts/inject-task.ts`（新建，CLI：接收 taskId + topic → 写 coordinator inbound.db + wakeContainer）
- `package.json`（修改，新增 `"inject-task": "tsx src/scripts/inject-task.ts"`）

**文件域（nanoclaw-dashboard-v2）：**
- `app/api/content-generation/trigger/route.ts`（新建，POST → 写 content_tasks + spawn inject-task）
- `app/api/content-generation/status/route.ts`（新建，GET → 读 content_tasks + content_articles）
- `app/api/content-generation/list/route.ts`（新建，GET → 列出历史任务）
- `lib/nanoclaw/contract.ts`（修改，新增 readContentTask / readContentArticles / writeContentTask helper）

**交付标准**：`curl -X POST .../trigger -d '{"topic":"test"}'` 返回 `{taskId}`，v2.db 有 pending 行，`pnpm run inject-task` 命令行测试不报错。

### Sub-4 · Dashboard 前端组件 + 侧边栏（T3，等 Sub-3 完成）

**文件域（nanoclaw-dashboard-v2）：**
- `app/(dashboard)/content-generation/page.tsx`（新建，组合触发器 + 状态 + 文章展示）
- `components/dashboard/content-generation-trigger.tsx`（新建，话题输入框 + 触发按钮）
- `components/dashboard/content-generation-status.tsx`（新建，5s 轮询 + 状态进度展示，参考 `daily-news-panel.tsx` L47 setInterval 模式）
- `components/dashboard/content-articles-grid.tsx`（新建，3 列 platform 展示）
- `lib/mock/nav.ts`（修改，新增"多平台内容生成"侧边栏项）

**交付标准**：页面在 `localhost:4000/content-generation` 可访问，输入话题点按钮有反应，状态区有 5s 轮询迹象，完成后 3 列文章展示区显示内容。

### 时序说明

```
T1  Sub-1 + Sub-2 同时启动（文件域零重叠，真并行）
T2  Sub-3 启动（依赖 Sub-1 的 types.ts + DB helpers）
    Sub-2 setup 脚本部分在此对齐（轻依赖 types.ts）
T3  Sub-4 启动（依赖 Sub-3 的 API 路径确定）
T4  人工联调 + 端到端测试
```

---

## 6 · 真风险点（5 个）

### 风险 1 · Dashboard 写 inbound.db 的边界问题

**现状**：`lib/nanoclaw/contract.ts` 目前只有 readonly SQLite 操作；写 host-owned `inbound.db` 需要理解 nanoclaw-v2 的 seq parity 规则（host 用偶数 seq）。

**解决方案**：新增 `pnpm run inject-task` CLI 脚本，dashboard 通过 `spawn("pnpm", ["run", "inject-task", ...], { cwd: NANOCLAW_ROOT })` 调用——与 `app/api/chat/route.ts` L63 `spawn("pnpm", ["run", "chat", message])` 完全一致的模式。inject-task 脚本在 nanoclaw-v2 内部运行，可以直接用 better-sqlite3 写 inbound.db 并调用 wakeContainer。

**验证方式**：`pnpm run inject-task ctask-001 "AI工程化"` 命令行测试，coordinator container 日志出现。

### 风险 2 · host-sweep 60s 串行导致 wake 延迟

**现状**：`host-sweep.ts` L137–L139 的 `for...await` 串行遍历，每 60 秒一轮，任务进入 inbound.db 后最多等 60s 才触发。

**解决方案**：inject-task 脚本在写完 `messages_in` 后立即调用 `wakeContainer(coordinator_session)`，与 `router.ts` `deliverToAgent` 的模式一致（不走 sweep 路径）。Coordinator 触发后的下游 wake 由 `routeAgentMessage` 驱动，同样不经 sweep。

**验证方式**：inject-task 执行后 2s 内 coordinator container 日志出现，而不是 60s 后。

### 风险 3 · Writer agent 写 content_articles 的方式

**现状**：agent 容器内的 MCP 工具清单（`container/agent-runner/src/mcp-tools/`）没有直接 INSERT v2.db 的工具；send_message/schedule_task 等工具都面向消息系统。

**解决方案**：Writer agent 通过 Bash tool 执行 `pnpm exec tsx /workspace/scripts/write-article.ts --task-id="ctask-xxx" --platform="xiaohongshu" --content="..."` 或直接用 `sqlite3` CLI（需在 container.json 中通过 `install_packages` 确保 sqlite3 在 PATH）。Sub-2 的 CLAUDE.md 需明确指定写入命令格式。

**验证方式**：容器内 `which sqlite3` 或 `pnpm exec tsx --version` 不报错。

### 风险 4 · agent_destinations ACL 初始化缺失（高风险·静默失败）

**现状**：`agent-route.ts` L112–L117 在路由前做 ACL 检查——`hasDestination(sourceGroupId, 'agent', targetGroupId)` 必须返回 true，否则 throw 拒绝。

**后果**：若 setup 脚本没有插入完整双向 ACL 行，Coordinator 发给 Researcher 的消息会被静默拒绝（无 delivery，无错误到用户侧），任务卡在 `researching` 状态永不推进——极难 debug。

**解决方案**：`setup-content-agents.ts` 必须插入以下全部 8 条 agent_destinations 行：
- coordinator → researcher（local_name: 'researcher'）
- researcher → coordinator（local_name: 'parent'）
- coordinator → xiaohongshu-writer（local_name: 'xhs-writer'）
- coordinator → gongzhonghao-writer（local_name: 'gzh-writer'）
- coordinator → weibo-writer（local_name: 'weibo-writer'）
- xiaohongshu-writer → coordinator（local_name: 'parent'）
- gongzhonghao-writer → coordinator（local_name: 'parent'）
- weibo-writer → coordinator（local_name: 'parent'）

**验证方式**：`pnpm exec tsx scripts/q.ts data/v2.db "SELECT * FROM agent_destinations WHERE agent_group_id LIKE 'content%'"` 输出 8 行。

### 风险 5 · content_articles UNIQUE 冲突（已被 schema 兜底，无需额外处理）

**分析**：`UNIQUE(task_id, platform)` 约束在 3 个 Writer 各写不同 platform 时不会触发冲突（xiaohongshu ≠ gongzhonghao ≠ weibo）。若用户重复触发同一 task_id（理论上不可能，每次触发生成新 taskId），UNIQUE 也会保护数据一致性。

**结论**：此风险已被 schema 设计完全覆盖，无需额外代码处理。

---

## 7 · 成功标准（MVP 可验证标志）

### 功能性标准

1. **端到端可运行**：在 dashboard-v2 输入话题"AI 工程化"点按钮，3 分钟内 `content_tasks.status` 变为 `completed`，`content_articles` 有 3 行

2. **小红书文章质量**：
   - 字数：800 字以内
   - 格式：含 emoji（≥3 个）
   - 格式：含 hashtag（≥3 个 `#xxx` 标签）

3. **公众号文章质量**：
   - 字数：1500–2500 字
   - 格式：含小标题（≥2 个 `## xxx` 或 `**xxx**` 格式）
   - 风格：深度分析语调，无滥用 emoji

4. **微博文章质量**：
   - 字数：≤280 字符（含话题标签）
   - 格式：含 `#话题#` 格式（≥1 个）
   - 风格：口语化，精炼

5. **状态机完整性**：content_tasks 表状态真实走完 `pending → researching → writing → completed`，可通过 `pnpm exec tsx scripts/q.ts data/v2.db "SELECT id,status,created_at,completed_at FROM content_tasks"` 验证

6. **Dashboard 可见性**：
   - 生成过程中：状态面板显示当前阶段文字（"正在调研..."、"正在生成文章..."）
   - 生成完成后：3 列文章展示区显示内容，不需刷新页面

### 非功能性标准

7. **响应时间**：用户点按钮后 ≤5s dashboard 显示"正在处理"（由 5s 轮询保证），不卡在 loading 状态
8. **真并发验证**：3 个 Writer 容器启动时间差 ≤5s（容器日志时间戳可验证）
9. **无数据污染**：多次触发后 content_articles 不出现重复 platform 行（UNIQUE 约束兜底）

---

## 8 · 下一步（spec-kit Step 2 specify 输入）

spec-kit Step 2 需要把以下内容固化为 `specs/multi-platform-content/spec.md`：

### 需要固化的设计决策

1. **5 个 agent_group 的精确 folder 名和 DB id**：setup 脚本和 CLAUDE.md 路径都依赖这些值，需要在 spec 中定义

2. **agent_destinations 完整 ACL 矩阵**：8 条规则（见风险 4）逐一列出，防止 Sub-2 遗漏任何一条

3. **各 Writer CLAUDE.md 的强约束清单**：
   - 小红书：字数范围、emoji 数量下限、hashtag 格式、禁止深度分析语调
   - 公众号：字数范围、小标题格式、禁止滥用 emoji、需有引导语
   - 微博：字符上限（280）、话题标签格式、禁止超过 3 句话

4. **content_tasks 状态机转换规则**：谁在何时写哪个状态（coordinator 全权负责，writers 不碰 content_tasks）

5. **inject-task CLI 接口规范**：参数格式（`--task-id=xxx --topic=xxx`）、exit code 规范、错误处理

6. **5s 轮询终止条件**：`completed` 或 `failed` 时 clearInterval，避免 dashboard 无限轮询

7. **Writer 写 content_articles 的具体命令**：确定用 sqlite3 CLI 还是 tsx 脚本，消除 Sub-2 CLAUDE.md 中的模糊性

### 需要在 Step 2 澄清的遗留问题

- Researcher 的调研工具是什么？（WebSearch MCP？固定 API 调用？）调研结果用什么格式回传 Coordinator？（影响 Writer 收到的 prompt 质量）
- Coordinator 如何知道"3 个 Writer 全部完成"？（计数器 + session_state？还是等 3 次 send_message 回传？）
- 任务失败时的 UX：dashboard 是否展示 error 字段内容？Coordinator 是否有重试逻辑？

---

*spec-kit Step 1 brainstorming 完成 · 真凭据驱动 · 旧版（Claude Code Task subagents 临时编排路线）完全推翻重写*

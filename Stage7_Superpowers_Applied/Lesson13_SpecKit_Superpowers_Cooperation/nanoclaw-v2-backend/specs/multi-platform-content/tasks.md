# Tasks: multi-platform-content

**Step**: spec-kit Step 5
**Created**: 2026-05-13
**Based on**: plan.md (文件清单 §3, 依赖图 §5) + spec.md (18 FR) + clarify.md (8 CL)
**Total tasks**: 27
**Sub-agent distribution**: Sub-1: 6 | Sub-2: 7 | Sub-3: 7 | Sub-4: 7

---

## 执行顺序

```
T1 (并行): Sub-1 + Sub-2   ← 文件域零重叠
T2 (串行): Sub-3           ← 等 Sub-1 完成
T3 (串行): Sub-4           ← 等 Sub-3 完成
T4:        人工联调
```

---

## Sub-1 · DB migration + types + write-article.ts

**无依赖，立即开始。文件域：nanoclaw-v2 的 src/db/ + src/modules/content-generation/ + scripts/**

---

### T-S1-01 · 写 DB migration DDL

**描述**: 新建 `src/db/migrations/015-content-generation.ts`，包含 `up()` 和 `down()` 函数。`up()` 创建 `content_tasks` + `content_articles` 两张表及 4 个 index（含 UNIQUE index）；`down()` 按逆序 DROP 所有 index 和表。格式对齐 `src/db/migrations/014-daily-news.ts`。

**文件域**:
- `src/db/migrations/015-content-generation.ts` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep -l "content_tasks\|content_articles" src/db/migrations/015-content-generation.ts
grep "UNIQUE INDEX.*task_platform" src/db/migrations/015-content-generation.ts
grep "export function up\|export function down" src/db/migrations/015-content-generation.ts | wc -l  # 输出 2
```

**估时**: 30min

---

### T-S1-02 · 注册 migration015 到 index

**描述**: 修改 `src/db/migrations/index.ts`，import migration015 并将其加入迁移数组，保持与已有 migration 014 等的注册格式一致。

**文件域**:
- `src/db/migrations/index.ts` (修改)

**输入依赖**: T-S1-01

**完成判据**:
```bash
grep "015-content-generation\|migration015" src/db/migrations/index.ts
```

**估时**: 15min

---

### T-S1-03 · 写 content-generation types

**描述**: 新建 `src/modules/content-generation/types.ts`，定义 `ContentTask`（含 id/topic/status/created_at/started_at/completed_at/error 字段）和 `ContentArticle`（含 id/task_id/platform/title/content/tags/word_count/created_at 字段）两个 TypeScript interface。`status` 字段用字面量联合类型 `'pending'|'researching'|'writing'|'completed'|'failed'|'partial'`。

**文件域**:
- `src/modules/content-generation/types.ts` (新建)

**输入依赖**: 无（可与 T-S1-01 并行）

**完成判据**:
```bash
grep "ContentTask\|ContentArticle" src/modules/content-generation/types.ts | wc -l  # ≥2
grep "pending.*researching.*writing.*completed.*failed.*partial" src/modules/content-generation/types.ts
```

**估时**: 15min

---

### T-S1-04 · 写 DB helper 函数

**描述**: 新建 `src/modules/content-generation/db.ts`，使用 `better-sqlite3` 实现以下 5 个函数（同步 API，与 `src/modules/daily-news/db.ts` 风格对齐）：
- `insertTask(db, task: Omit<ContentTask, 'started_at'|'completed_at'|'error'>): void`
- `updateTaskStatus(db, id: string, status: ContentTask['status'], extra?: {started_at?:string, completed_at?:string, error?:string}): void`
- `insertArticle(db, article: Omit<ContentArticle, 'id'>): void`
- `getTask(db, id: string): ContentTask | undefined`
- `listTasks(db, limit: number): ContentTask[]`

所有 SQL 使用参数化查询，不拼字符串。

**文件域**:
- `src/modules/content-generation/db.ts` (新建)

**输入依赖**: T-S1-03

**完成判据**:
```bash
grep "insertTask\|updateTaskStatus\|insertArticle\|getTask\|listTasks" src/modules/content-generation/db.ts | wc -l  # ≥5
grep "INSERT OR REPLACE\|INSERT INTO content_articles" src/modules/content-generation/db.ts
```

**估时**: 30min

---

### T-S1-05 · 写 export barrel + write-article.ts CLI

**描述**:
(a) 新建 `src/modules/content-generation/index.ts`，re-export types + db helpers。
(b) 新建 `scripts/write-article.ts`，解析 CLI 参数 `--task-id --platform --title --content --tags --word-count`，使用 `better-sqlite3` 执行 `INSERT OR REPLACE INTO content_articles`，成功 exit(0)，失败 exit(1) + stderr 写原因。tags 参数为 JSON 字符串，需 JSON.parse 验证。

**文件域**:
- `src/modules/content-generation/index.ts` (新建)
- `scripts/write-article.ts` (新建)

**输入依赖**: T-S1-03, T-S1-04

**完成判据**:
```bash
grep "INSERT OR REPLACE INTO content_articles" scripts/write-article.ts
# 手动测试（需先 T-S1-01 migration 跑过）:
# node -e "require('./src/modules/content-generation/index')" 2>&1 | head -3  # 无报错
```

**估时**: 30min

---

### T-S1-06 · TypeScript 编译验证

**描述**: 在 nanoclaw-v2 项目根目录运行 `pnpm run build`，确认所有新增文件编译通过，无 TS 错误。若有 import 路径问题或类型错误，当场修复。

**文件域**: 无新增文件，修复编译错误

**输入依赖**: T-S1-01, T-S1-02, T-S1-03, T-S1-04, T-S1-05

**完成判据**:
```bash
pnpm run build 2>&1 | tail -5  # 末行不含 "error TS"
```

**估时**: 15min

---

## Sub-2 · 5 个 Agent CLAUDE.md + setup 脚本

**无依赖，与 Sub-1 并行。文件域：nanoclaw-v2 的 groups/ + scripts/**

---

### T-S2-01 · 写 content-coordinator CLAUDE.md

**描述**: 新建 `groups/content-coordinator/CLAUDE.md`，明确 Coordinator 的完整状态机指令：
1. 收到 task 消息：更新 content_tasks.status='researching'（Bash + scripts/q.ts），send_message → researcher
2. 收到 research 回传：更新 status='writing'，session_state writers_completed='0' writers_failed='0'，连续 3 次 send_message 给 xhs/gzh/weibo writer
3. 收到 Writer done/error：读 session_state 更新计数，若总计=3 则写最终状态（completed/partial/failed）
4. 每次 wake 先读 session_state 决定当前阶段（防容器重启后状态丢失）

指令中明确 Bash 命令格式：
```bash
pnpm exec tsx scripts/q.ts data/v2.db "UPDATE content_tasks SET status='researching' WHERE id='<taskId>'"
```

**文件域**:
- `groups/content-coordinator/CLAUDE.md` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep "writers_completed\|session_state\|status='researching'\|status='writing'" groups/content-coordinator/CLAUDE.md | wc -l  # ≥4
```

**估时**: 30min

---

### T-S2-02 · 写 content-researcher CLAUDE.md

**描述**: 新建 `groups/content-researcher/CLAUDE.md`，明确 Researcher 指令：
1. 接收 {taskId, topic}，联网调研（优先 WebSearch MCP，降级 Bash curl HN Algolia API + RSS）
2. 整理 key_facts（≥5 条，含数字/来源）和 sources（≥3 条带 URL）
3. 输出为规定 JSON 格式（clarify.md CL-05 格式）
4. 通过 send_message(to='parent', content={taskId, research_result: JSON.stringify(result)}) 回传

指令中写明 research_result JSON schema（key_facts / sources / researched_at 字段）和禁止幻觉的约束（无法查到的内容标注 "data unavailable"，不得编造数字）。

**文件域**:
- `groups/content-researcher/CLAUDE.md` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep "key_facts\|sources\|send_message.*parent\|data unavailable" groups/content-researcher/CLAUDE.md | wc -l  # ≥4
```

**估时**: 30min

---

### T-S2-03 · 写 xiaohongshu-writer CLAUDE.md

**描述**: 新建 `groups/xiaohongshu-writer/CLAUDE.md`，明确小红书风格写作指令：
- 接收 {taskId, topic, research_result}，解析 JSON
- 文章规格：字数 500–800 字，emoji ≥3 个，hashtag ≥3 个（`#xxx` 格式），禁止深度分析书面语
- 写入命令（明确格式，含转义注意事项）：
  ```bash
  pnpm exec tsx /workspace/scripts/write-article.ts --task-id="..." --platform="xiaohongshu" --title="..." --content="..." --tags='["#xxx","#yyy"]' --word-count=<n>
  ```
- 写入成功后 send_message(to='parent', content={taskId, platform:'xiaohongshu', status:'done'})
- 写入失败后 send_message(to='parent', content={taskId, platform:'xiaohongshu', status:'error', error:'<stderr>'})

**文件域**:
- `groups/xiaohongshu-writer/CLAUDE.md` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep "xiaohongshu\|write-article.ts\|status:'done'\|500.*800" groups/xiaohongshu-writer/CLAUDE.md | wc -l  # ≥3
```

**估时**: 20min

---

### T-S2-04 · 写 gongzhonghao-writer CLAUDE.md

**描述**: 新建 `groups/gongzhonghao-writer/CLAUDE.md`，明确公众号风格写作指令：
- 文章规格：字数 1500–2500 字，小标题 ≥2 个（`## xxx` 格式），禁止滥用 emoji（≤每500字1个），需有引导语开篇
- 写入命令格式与 T-S2-03 相同，platform='gongzhonghao'
- 完成/失败信号回传格式与 T-S2-03 相同

**文件域**:
- `groups/gongzhonghao-writer/CLAUDE.md` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep "gongzhonghao\|1500.*2500\|##.*小标题\|引导语" groups/gongzhonghao-writer/CLAUDE.md | wc -l  # ≥2
```

**估时**: 20min

---

### T-S2-05 · 写 weibo-writer CLAUDE.md

**描述**: 新建 `groups/weibo-writer/CLAUDE.md`，明确微博风格写作指令：
- 文章规格：字数 ≤280 字符，`#话题#` 格式标签 ≥1 个，禁止超过 5 句话，口语化精炼
- 写入命令格式与 T-S2-03 相同，platform='weibo'，title 参数留空（微博无标题）
- 完成/失败信号回传格式与 T-S2-03 相同

**文件域**:
- `groups/weibo-writer/CLAUDE.md` (新建)

**输入依赖**: 无

**完成判据**:
```bash
grep "weibo\|280.*字符\|#话题#\|口语" groups/weibo-writer/CLAUDE.md | wc -l  # ≥2
```

**估时**: 15min

---

### T-S2-06 · 写 setup-content-agents.ts 脚本

**描述**: 新建 `scripts/setup-content-agents.ts`，幂等地向 `data/v2.db` 插入：
1. 5 个 agent_groups 行（id: content-coordinator/content-researcher/xiaohongshu-writer/gongzhonghao-writer/weibo-writer，folder 同名，agent_provider='claude'）
2. 8 条 agent_destinations 行（完整 ACL 矩阵，见 plan.md §7），使用 `INSERT OR IGNORE`

使用 `better-sqlite3` 同步 API，脚本末尾 console.log 输出 agent_groups 和 agent_destinations 数量验证。

**文件域**:
- `scripts/setup-content-agents.ts` (新建)

**输入依赖**: T-S1-03（引用 agent_group_id 常量，可直接硬编码字符串，轻依赖）

**完成判据**:
```bash
# 运行脚本（需 data/v2.db 已存在且 migration 已跑过）
pnpm exec tsx scripts/setup-content-agents.ts 2>&1 | grep "agent_groups\|agent_destinations"
# 验证 ACL 完整性
pnpm exec tsx scripts/q.ts data/v2.db "SELECT COUNT(*) FROM agent_destinations WHERE agent_group_id LIKE 'content%'"
# 期望输出: 8
```

**估时**: 45min

---

### T-S2-07 · 验证 agent_destinations 8 行

**描述**: 运行 setup-content-agents.ts，用 scripts/q.ts 验证 v2.db 中 agent_destinations 表有完整 8 条 ACL 行（plan.md §7 矩阵全部存在）。若缺行，修复 setup 脚本并重跑。

**文件域**: 无新增文件（修复 scripts/setup-content-agents.ts 若有问题）

**输入依赖**: T-S2-06

**完成判据**:
```bash
pnpm exec tsx scripts/q.ts data/v2.db "SELECT agent_group_id,local_name,target_id FROM agent_destinations WHERE agent_group_id LIKE 'content%' ORDER BY agent_group_id,local_name"
# 输出 8 行，覆盖 plan.md §7 的全部组合
```

**估时**: 15min

---

## Sub-3 · Dashboard API Routes + inject-task CLI

**依赖 Sub-1 完成（T-S1-06 通过后启动）。文件域跨 nanoclaw-v2 + nanoclaw-dashboard-v2。**

---

### T-S3-01 · 写 inject-task.ts CLI

**描述**: 新建 `src/scripts/inject-task.ts`，实现：
1. 解析 `--task-id` 和 `--topic` 参数（用 `process.argv`）
2. 打开 `data/v2.db`，查 sessions 表找 agent_group_id='content-coordinator' 的 session
3. 若无 session，exit(1) + stderr "coordinator session not found"
4. 打开对应的 `data/v2-sessions/{ag_id}/{sess_id}/inbound.db`
5. 写 messages_in（id=uuid, seq=下一个偶数, kind='task', trigger=1, status='pending', content=JSON{taskId,topic}）
6. import wakeContainer 并调用（或通过 spawn docker 命令模拟，依当前 container-runner 导出方式）
7. 成功 exit(0)，失败 exit(1) + stderr

seq 偶数规则：查 messages_in MAX(seq) + 2（若无行则 seq=2）。参考 `src/session-manager.ts` 的 seq 管理模式。

**文件域**:
- `src/scripts/inject-task.ts` (新建)

**输入依赖**: T-S1-06（Sub-1 编译通过，证明 container-runner 可 import）

**完成判据**:
```bash
grep "\-\-task-id\|wakeContainer\|messages_in\|exit(0)" src/scripts/inject-task.ts | wc -l  # ≥4
# 命令行冒烟（不实际 wake，验证参数解析）:
pnpm exec tsx src/scripts/inject-task.ts --task-id=test-001 --topic=test 2>&1 | head -5
```

**估时**: 1h

---

### T-S3-02 · 修改 package.json 新增 inject-task script

**描述**: 修改 nanoclaw-v2 的 `package.json`，在 `scripts` 字段中新增：
```json
"inject-task": "tsx src/scripts/inject-task.ts"
```
保持与现有 script 格式对齐（参考 `"chat": "tsx src/scripts/chat.ts"` 等已有条目）。

**文件域**:
- `package.json` (修改，nanoclaw-v2)

**输入依赖**: T-S3-01

**完成判据**:
```bash
grep '"inject-task"' package.json
pnpm run inject-task -- --task-id=x --topic=y 2>&1 | head -3  # 能执行（即使报错也证明script存在）
```

**估时**: 15min

---

### T-S3-03 · 扩展 contract.ts 的 content-generation helpers

**描述**: 修改 nanoclaw-dashboard-v2 的 `lib/nanoclaw/contract.ts`，新增 4 个函数：
- `writeContentTask(task: { id, topic, status, created_at }): void`：INSERT INTO content_tasks（读写模式打开 DB）
- `readContentTask(id: string): ContentTask | undefined`：SELECT，readonly 模式
- `readContentArticles(taskId: string): ContentArticle[]`：SELECT WHERE task_id，readonly 模式
- `listContentTasks(limit: number): ContentTask[]`：SELECT ORDER BY created_at DESC，readonly 模式

DB 路径复用 contract.ts 已有的 `NANOCLAW_ROOT/data/v2.db` 路径解析，readonly/readwrite 模式参考 L133–L153 现有模式。ContentTask/ContentArticle 类型在 contract.ts 内部定义（不 import nanoclaw-v2 内部模块）。

**文件域**:
- `lib/nanoclaw/contract.ts` (修改，nanoclaw-dashboard-v2)

**输入依赖**: T-S1-03（参考 ContentTask/ContentArticle 字段定义，但 contract.ts 内重新声明类型）

**完成判据**:
```bash
grep "writeContentTask\|readContentTask\|readContentArticles\|listContentTasks" lib/nanoclaw/contract.ts | wc -l  # ≥4
```

**估时**: 30min

---

### T-S3-04 · 写 trigger API route

**描述**: 新建 `app/api/content-generation/trigger/route.ts`（Next.js App Router）：
1. 解析 POST body，校验 topic 非空 ≤500 字符（返回 400）
2. 查 content_tasks WHERE status IN ('pending','researching','writing')，若有返回 409
3. 生成 taskId = `ctask-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
4. 调用 contract.ts `writeContentTask()` 写 DB
5. `spawn("pnpm", ["run","inject-task","--","--task-id=<id>","--topic=<topic>"], { cwd: NANOCLAW_ROOT, shell: false })`，等待 close 事件判断 exit code
6. exit 0 → return 200 `{ taskId }`；非 0 → return 500（但 task 已写入 DB，提示用户）

参考 `app/api/chat/route.ts` 的 spawn 模式。

**文件域**:
- `app/api/content-generation/trigger/route.ts` (新建，nanoclaw-dashboard-v2)

**输入依赖**: T-S3-02, T-S3-03

**完成判据**:
```bash
grep "spawn\|writeContentTask\|409\|inject-task" app/api/content-generation/trigger/route.ts | wc -l  # ≥4
```

**估时**: 30min

---

### T-S3-05 · 写 status API route

**描述**: 新建 `app/api/content-generation/status/route.ts`：
1. 读 `taskId` query param，校验非空（返回 400）
2. 调用 `readContentTask(taskId)` 读 content_tasks，若无结果返回 404
3. 调用 `readContentArticles(taskId)` 读 content_articles（0-3行）
4. 返回 200 `{ task: ContentTask, articles: ContentArticle[] }`

**文件域**:
- `app/api/content-generation/status/route.ts` (新建，nanoclaw-dashboard-v2)

**输入依赖**: T-S3-03

**完成判据**:
```bash
grep "readContentTask\|readContentArticles\|articles" app/api/content-generation/status/route.ts | wc -l  # ≥3
```

**估时**: 20min

---

### T-S3-06 · 写 list API route

**描述**: 新建 `app/api/content-generation/list/route.ts`：
1. 读 `limit` query param，默认 10，最大 50
2. 调用 `listContentTasks(limit)` 读 content_tasks ORDER BY created_at DESC
3. 返回 200 `{ tasks: ContentTask[], count: number }`

**文件域**:
- `app/api/content-generation/list/route.ts` (新建，nanoclaw-dashboard-v2)

**输入依赖**: T-S3-03

**完成判据**:
```bash
grep "listContentTasks\|count\|limit" app/api/content-generation/list/route.ts | wc -l  # ≥3
```

**估时**: 15min

---

### T-S3-07 · curl 端对端冒烟测试

**描述**: 启动 nanoclaw-dashboard-v2 dev server（`pnpm dev`），用 curl 验证 3 个 API route：
1. `curl -X POST localhost:4000/api/content-generation/trigger -H "Content-Type: application/json" -d '{"topic":"AI工程化测试"}'` → 期望 200 `{taskId}`
2. `curl "localhost:4000/api/content-generation/status?taskId=<上步返回的id>"` → 期望 200 `{task:{status:'pending'|'researching',...}}`
3. `curl "localhost:4000/api/content-generation/list"` → 期望 200 `{tasks:[...]}`
4. 并发冲突测试：在 status!='completed' 时再次 POST trigger → 期望 409

修复任何 API 报错。

**文件域**: 修复 T-S3-03~T-S3-06 中发现的问题

**输入依赖**: T-S3-04, T-S3-05, T-S3-06

**完成判据**:
```bash
curl -s -X POST localhost:4000/api/content-generation/trigger \
  -H "Content-Type: application/json" -d '{"topic":"test"}' | grep "taskId"
# 输出含 taskId 字段
```

**估时**: 30min

---

## Sub-4 · Dashboard 前端组件

**依赖 Sub-3 完成（T-S3-07 冒烟通过后启动）。文件域：nanoclaw-dashboard-v2。**

---

### T-S4-01 · 修改 nav.ts 新增侧边栏项

**描述**: 修改 `lib/mock/nav.ts`（或实际的侧边栏数据源，依现有代码结构），在合适的导航组中新增：
```ts
{ id: 'content-generation', label: '多平台内容生成', href: '/content-generation' }
```
查阅 `components/shell/sidebar.tsx` 确认 nav item 数据结构字段（id/label/href/icon 等），严格对齐现有格式。

**文件域**:
- `lib/mock/nav.ts` (修改，nanoclaw-dashboard-v2)

**输入依赖**: T-S3-07（确认路由路径 `/content-generation` 可用）

**完成判据**:
```bash
grep "content-generation\|多平台内容生成" lib/mock/nav.ts
```

**估时**: 15min

---

### T-S4-02 · 写 ContentGenerationTrigger 组件

**描述**: 新建 `components/dashboard/content-generation-trigger.tsx`，实现：
- 话题输入框（`<input>`，placeholder="输入话题，如：AI工程化"，maxLength=500）
- 「开始生成」按钮（点击后 POST `/api/content-generation/trigger`，loading 状态禁用重复点击）
- 成功：调用 prop `onTaskCreated(taskId: string)` 回调，清空输入框
- 409：显示 "已有任务进行中，请等待完成后再触发" + existingTaskId
- 其他错误：显示错误文字

参考 `components/chat/chat-fab.tsx` 的 fetch + loading state 模式（Tailwind CSS，无第三方组件库）。

**文件域**:
- `components/dashboard/content-generation-trigger.tsx` (新建)

**输入依赖**: T-S4-01

**完成判据**:
```bash
grep "onTaskCreated\|/api/content-generation/trigger\|409\|loading" components/dashboard/content-generation-trigger.tsx | wc -l  # ≥4
```

**估时**: 30min

---

### T-S4-03 · 写 ContentGenerationStatus 组件

**描述**: 新建 `components/dashboard/content-generation-status.tsx`，实现 5s 轮询进度展示：
- 接收 prop `taskId: string | null`
- useEffect 监听 taskId 变化，taskId 存在时立即发起首次请求，随后 `setInterval(poll, 5_000)`
- 状态文字映射：pending→"等待处理…" / researching→"正在调研话题…" / writing→"正在生成三平台文章（并发）…" / completed→"✓ 生成完成" / partial→"⚠ 部分平台生成成功" / failed→"✗ 生成失败"
- status IN ('completed','failed','partial') 时 clearInterval
- 暴露 `articles` 状态给父组件（通过 prop `onArticlesLoaded(articles: ContentArticle[])` 或将 articles state 提升到 page.tsx）

参考 `components/dashboard/daily-news-panel.tsx` L30–L48 的 setInterval 轮询模式。

**文件域**:
- `components/dashboard/content-generation-status.tsx` (新建)

**输入依赖**: T-S4-01

**完成判据**:
```bash
grep "setInterval.*5.*000\|clearInterval\|completed.*failed.*partial\|正在调研" components/dashboard/content-generation-status.tsx | wc -l  # ≥3
```

**估时**: 30min

---

### T-S4-04 · 写 ContentArticlesGrid 组件

**描述**: 新建 `components/dashboard/content-articles-grid.tsx`，实现 3 列文章展示：
- 接收 prop `articles: ContentArticle[]`（0-3 个元素）
- 固定 3 列（小红书 / 公众号 / 微博），`articles` 按 platform 字段分配
- 有文章的列：展示 title（若有）+ content + tags（badge 样式）+ word_count
- 无文章的列：若 taskStatus='partial' 显示"该平台生成失败"红色占位；否则显示"等待生成…"灰色占位
- content 超过 500 字符时 truncate，提供"展开全文"按钮
- 纯 Tailwind CSS，grid-cols-3 布局

**文件域**:
- `components/dashboard/content-articles-grid.tsx` (新建)

**输入依赖**: T-S4-01

**完成判据**:
```bash
grep "xiaohongshu\|gongzhonghao\|weibo\|grid-cols-3\|platform" components/dashboard/content-articles-grid.tsx | wc -l  # ≥4
```

**估时**: 30min

---

### T-S4-05 · 写 content-generation page.tsx

**描述**: 新建 `app/(dashboard)/content-generation/page.tsx`，组合所有组件：
- 页面标题："多平台内容生成"
- 状态管理：`taskId: string | null`（useState），`articles: ContentArticle[]`，`taskStatus: string`
- 布局：Trigger 组件（顶部）→ Status 组件（中部，taskId 存在时显示）→ ArticlesGrid（底部，articles.length > 0 或 taskStatus 非 null 时显示）
- 触发新 task 时 reset articles + taskStatus

**文件域**:
- `app/(dashboard)/content-generation/page.tsx` (新建)

**输入依赖**: T-S4-02, T-S4-03, T-S4-04

**完成判据**:
```bash
grep "ContentGenerationTrigger\|ContentGenerationStatus\|ContentArticlesGrid" app/\(dashboard\)/content-generation/page.tsx | wc -l  # ≥3
```

**估时**: 30min

---

### T-S4-06 · 首页新增 Stage 3 入口卡片（可选）

**描述**: 修改 `app/(dashboard)/page.tsx`，在首页（控制台主页）新增一个「多平台内容生成」入口卡片（参考已有面板布局），点击跳转到 `/content-generation`。若首页已很拥挤，改为只在侧边栏导航（T-S4-01 已做）即可，跳过本 task。

**文件域**:
- `app/(dashboard)/page.tsx` (可选修改)

**输入依赖**: T-S4-05

**完成判据**: 视觉验证，`localhost:4000` 首页有入口卡片或本 task 跳过均可。

**估时**: 15min

---

### T-S4-07 · 页面可访问性验证

**描述**: 确保 `localhost:4000/content-generation` 可访问，执行以下验证：
1. 页面正常渲染，无控制台报错
2. 侧边栏"多平台内容生成"导航项存在且可点击
3. 输入话题、点击触发按钮：Network 面板出现 POST trigger 请求，status 区域出现"等待处理…"
4. 每 5s 出现 GET status 轮询请求
5. 若联调环境可用（Sub-1/Sub-2 已完成），等待 task 完成，验证 3 列文章展示

修复任何运行时错误。

**文件域**: 修复 T-S4-02~T-S4-05 中发现的问题

**输入依赖**: T-S4-05, T-S4-06

**完成判据**:
- `curl -s localhost:4000/content-generation` 返回 HTML（不是 404/500）
- 页面 JavaScript 控制台无 uncaught error（手动验证）

**估时**: 20min

---

## 任务汇总

| Sub-Agent | Tasks | 估时 | 依赖 |
|-----------|-------|------|------|
| Sub-1 | T-S1-01 ~ T-S1-06 (6个) | ~2h | 无 |
| Sub-2 | T-S2-01 ~ T-S2-07 (7个) | ~2.5h | 无（与Sub-1并行）|
| Sub-3 | T-S3-01 ~ T-S3-07 (7个) | ~3h | Sub-1完成 |
| Sub-4 | T-S4-01 ~ T-S4-07 (7个) | ~3h | Sub-3完成 |
| **合计** | **27个** | **~10.5h** | 串并行执行可压缩到~6.5h |

---

## 关键验收命令（联调时使用）

```bash
# 1. ACL 完整性（应输出 8）
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT COUNT(*) FROM agent_destinations WHERE agent_group_id LIKE 'content%'"

# 2. 任务状态全链路查看
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT id,topic,status,created_at,completed_at FROM content_tasks ORDER BY created_at DESC LIMIT 5"

# 3. 文章写入验证
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT task_id,platform,word_count,created_at FROM content_articles ORDER BY created_at DESC"

# 4. 并发容器时间差验证（运行期间）
docker ps --format '{{.Names}}\t{{.Status}}' | grep nanoclaw

# 5. 端到端触发（手动联调）
curl -s -X POST localhost:4000/api/content-generation/trigger \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI工程化实践"}' | jq .
```

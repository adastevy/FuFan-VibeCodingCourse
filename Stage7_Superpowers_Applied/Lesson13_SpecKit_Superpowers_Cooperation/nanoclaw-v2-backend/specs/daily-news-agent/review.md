# Code Review · daily-news-agent

## Summary

**3 blockers · 5 majors · 3 minors**

---

## 1. Spec 一致性

| FR | 描述 | 状态 |
|----|------|------|
| FR-001 | 09:00 Asia/Shanghai 定时触发 | ❌ BLOCKER — `registerDailyNewsTask()` 从未在启动路径中被调用（见下） |
| FR-002 | 抓取昨日 HN 故事，以 Asia/Shanghai 为准 | ❌ MAJOR — `fetcher.ts:17` 用的是 UTC 相对窗口，非上海墙钟日期 |
| FR-003 | 抓取 3 个预配置 RSS 源 | ✅ config.ts 硬编码正确 |
| FR-004 | URL 精确去重 + 选 5 条 | ✅ dedup.ts 实现正确；选取逻辑在 prompt 里 |
| FR-005 | 每条生成中文标题/摘要/URL | ✅ buildTaskPrompt() Step 5 有明确指示 |
| FR-006 | 推送到微信群 | ❌ MAJOR — `WECHAT_GROUP_PLATFORM_ID` 仍是占位符 `'wechat:REPLACE_WITH_GROUP_ID'` |
| FR-007 | 源失败后跳过并 WARN | ✅ fetcher.ts 实现了 3 次重试+warning 返回；prompt 里也有指示 |
| FR-008 | LLM 失败降级为纯标题列表 | ✅ prompt 里有明确降级指示 |
| FR-009 | WeChat 重试 3 次+指数退避 | ❌ BLOCKER — `wechat.ts deliver()` 无重试，失败直接返回 undefined |
| FR-010 | 0 条故事时推固定消息 | ✅ formatter.ts 和 prompt 都有实现 |
| FR-011 | 超 500 字拆为 2 条 | ⚠️ MAJOR — formatter.ts 有逻辑缺陷（单条 > 500 时产生空消息） |
| FR-012 | 每条记录一行 daily_news | ❌ BLOCKER — `buildTaskPrompt()` 无持久化指令，`insertItems()` 运行时从未被调用 |

---

## 2. TDD 真实性

### 抽查 1：`fetcher.test.ts`

测试覆盖了 `fetchHackerNews` 和 `fetchRssSource` 的 happy path、HTTP 错误、网络错误、重试成功、重试耗尽。mock 策略是 `vi.stubGlobal('fetch', mockFetch)` — 全局 fetch 级别，不是整层 HTTP，合理。**但 `fetchAllSources`（把 4 个源并发合并的公开入口）零测试**。这是主要测试盲点。

### 抽查 2：`formatter.test.ts`

零条、短摘要（单条、5 条）、长摘要（5 条超 500）都有测试，包含"所有条目都出现在拆分后的消息中"这个核心断言。**但缺少关键边界：单条本身 > 500 字时的行为**（见 MAJOR-4）。

### 抽查 3：`db.test.ts`

使用 `:memory:` SQLite + 真实 `up()` migration，测试了 insert、字段映射、空数组、唯一约束、markFailed、getPendingRepush。**真实 DB，无过度 mock，质量高**。唯一问题是这些函数在运行时从无调用方（见 BLOCKER-3）。

**TDD 整体结论**：测试质量尚可，mock 边界合理，但有两处关键空白：`fetchAllSources` 无测试，formatter 单条超限 edge case 无测试。

---

## 3. NanoClaw 集成正确性

### 3.1 schedule_task 集成

- `setup.ts` 正确使用 `insertTask()` 向 `messages_in` 写入 `kind='task'` 行 ✅
- `content` JSON 结构包含 `action`, `prompt`, `recurrence`, `platformId`, `channelType` ✅
- `getNext9amShanghai()` 用固定 UTC+8 偏移（中国无 DST），计算正确 ✅
- **但 `registerDailyNewsTask()` 在 `src/modules/index.ts` 的导入是纯 re-export barrel，没有任何初始化副作用** — 任务永远不会被注册（BLOCKER-1）

### 3.2 WeChat 集成

- `src/channels/index.ts` 已追加 `import './wechat.js'` — 自注册正确 ✅
- `factory()` 正确检查 `WECHAT_ENABLED=true` 环境变量 ✅
- `deliver()` 通过 `client.sendText()` 发送文本 ✅
- **`deliver()` 没有重试逻辑**，失败直接 catch+return undefined，不满足 FR-009（BLOCKER-2）

### 3.3 SQLite migration

- `014-daily-news.ts` 正确注册进 `src/db/migrations/index.ts`，会在 central DB (`data/v2.db`) 上执行 ✅
- 但 spec 写的是"Extend the **session** SQLite DB"；migration 在 central DB 上，而 `insertItems()` 的调用方应是主机侧交付后的钩子 — 这个钩子不存在（MAJOR-5）

---

## 4. 错误处理

| 场景 | 实现 | 状态 |
|------|------|------|
| 单个 RSS 源抓取失败 | fetcher.ts 3 次重试 + warning 返回 | ✅ |
| 所有源失败 | fetchAllSources 合并 warnings，0 条走固定消息路径 | ✅（通过 prompt 指示） |
| LLM 摘要失败 | prompt Step 5/6 有重试一次+降级指示 | ✅ |
| WeChat 推送失败，3 次重试+退避 | wechat.ts deliver() 无重试，无退避 | ❌ BLOCKER-2 |
| WeChat 全部失败后持久化 failed 记录 | markFailed() 存在但从未被调用 | ❌ BLOCKER-3 |
| 0 条故事 | formatter 返回固定中文字符串 | ✅ |

---

## 5. 反模式扫描

### console.log

`runner.ts` 有 17 处 `console.log`。文件头注释明确标为"Manual smoke-runner for dev/test"，且未被任何 barrel 导入，属于有意保留。**不阻塞**。

### it.skip / describe.skip

全库零处。✅

### 注释掉的代码

零处。✅

### vi.mock 整层 HTTP

未出现。`vi.stubGlobal('fetch', ...)` 只 mock 全局 fetch，粒度合理。✅

### TODO / FIXME

`config.ts:9` 中 `WECHAT_GROUP_PLATFORM_ID = 'wechat:REPLACE_WITH_GROUP_ID'` 是运行时占位符，虽非注释形式但语义等同 TODO（见 MAJOR-2）。

---

## 6. 详细问题列表

### BLOCKERs

- **[blocker] [src/modules/index.ts:20 + src/modules/daily-news/index.ts]** `registerDailyNewsTask()` 从未在启动路径中被调用。`src/modules/index.ts` 导入 `./daily-news/index.js`，但该文件是纯 re-export barrel，无副作用。`src/index.ts` 没有对 `registerDailyNewsTask` 的任何调用。整个 daily-news feature 在运行时完全不工作——没有定时任务，没有推送。  
  修复建议：在 `src/modules/daily-news/index.ts` 或 `setup.ts` 中添加一个 `initDailyNews(inboundDb)` 函数，并在 `src/index.ts` 的启动序列里（session 初始化之后）调用一次；或者在 `src/modules/index.ts` 里通过 side-effect import 触发注册（需要从 DI 获取 inboundDb）。调用方式需与 NanoClaw 的 session 生命周期对齐。

- **[blocker] [src/channels/wechat.ts:200-215]** `deliver()` 方法无重试逻辑。FR-009 要求 3 次重试、退避 1 s / 3 s / 10 s，全部失败后持久化 failed 记录。当前实现捕获错误后直接 return undefined，既无重试，也无 `markFailed()` 调用。  
  修复建议：在 `deliver()` 内用 `for` 循环实现 3 次重试，每次用 `await sleep(backoffs[attempt])` 等待对应时间；全部失败后调用 `markFailed(db, platformId, date)` 并 `log.warn()`。需要从 setup 注入 central DB 引用。

- **[blocker] [src/modules/daily-news/prompt-builder.ts:30-63 + src/modules/daily-news/db.ts]** `buildTaskPrompt()` 无任何持久化指令。6 个 Step 里没有"写入 daily_news"这一步，`insertItems()` / `markFailed()` 在整个运行时路径中从未被调用。FR-012（每条记录一行 daily_news）和 SC-006、SC-007 无法满足。  
  修复建议：在 prompt 的 Step 6 后新增 Step 7，指示 agent 通过 `schedule_task` action 或 host-side hook 持久化本次推送的每条记录；或者在 `delivery.ts` 的交付成功回调中调用 `insertItems()`（需要扩展 delivery 层）。两种方案都需要将 daily_news DB 操作接入实际的交付流。

### Majors

- **[major] [src/modules/daily-news/fetcher.ts:17-19]** HN "昨日"窗口用 UTC 相对时间 `Date.now() - 86_400_000`，不是 Asia/Shanghai 墙钟日期。FR-002 要求"以任务触发时的上海日期为准"。09:00 上海（01:00 UTC）时，本代码抓的是从 01:00 UTC 前一天到 01:00 UTC 当天的故事，而不是 00:00—23:59 上海时间（16:00 UTC 前一天到 15:59 UTC 当天）。  
  修复建议：与 `getNext9amShanghai()` 同样用固定 UTC+8 偏移计算上海"昨日"的 00:00 和 23:59 对应的 UTC Unix 时间戳，替换当前窗口计算。

- **[major] [src/modules/daily-news/config.ts:9]** `WECHAT_GROUP_PLATFORM_ID = 'wechat:REPLACE_WITH_GROUP_ID'` 是占位符，会作为实际 WeChat 目标写入每个定时任务的 prompt。任何触发的推送都会发向不存在的群组，导致静默失败。  
  修复建议：补充安装文档（或 `/add-wechat` skill 的 wire 步骤）说明如何替换此值；或在 `registerDailyNewsTask()` 里加运行时断言，启动时检测占位符并 throw，防止任务以错误 ID 注册。

- **[major] [src/modules/daily-news/fetcher.test.ts]** `fetchAllSources()` 是模块主要公开入口（并发调用全部 4 个源、合并结果），但没有任何测试。部分失败、全部失败、warnings 合并的正确性均未被覆盖。  
  修复建议：补充 `fetchAllSources` 的测试，至少覆盖：全成功返回合并 items、1 个源失败时其他源结果仍返回、全部失败时 items 为空且 warnings 含全部源名。

- **[major] [src/modules/daily-news/formatter.ts:19-25]** 当 `items.length === 1` 且该条目 > 500 字时，split 循环条件 `i < formatted.length - 1` 即 `i < 0` 不满足，`splitIdx` 保持 1，结果是 `[item_text, '']`——会向微信发一条空消息。  
  修复建议：在 split 前检测 `formatted.length <= 1` 直接返回 `[full]`；同时补充测试：单条 > 500 字时返回长度为 1 的数组。

- **[major] [src/db/migrations/014-daily-news.ts + src/modules/daily-news/db.ts]** `daily_news` 表通过 central DB migration 创建（`data/v2.db`），但 spec 指定"Extend the session SQLite DB"。`insertItems()` 接受任意 `Database.Database` 参数，但在整个运行时路径（`delivery.ts`、`host-sweep.ts`）中从未被调用，`markFailed()` 和 `getPendingRepush()` 同理。SC-006（5 分钟内有 daily_news 记录）和 SC-007（delivery 失败后有 failed 记录）不可达。  
  修复建议：明确 `daily_news` 的归属 DB（central 或 session），并在 `delivery.ts` 交付成功/失败的回调中接入 `insertItems()` / `markFailed()`。

### Minors

- **[minor] [src/modules/daily-news/fetcher.ts:21-39]** 重试之间无任何延迟（纯 busy-retry）。spec FR-007 未指定源抓取的退避间隔，但瞬时连续重试对于网络抖动/rate-limit 场景效果有限。  
  修复建议：可在每次重试前加 `await sleep(1000 * attempt)` 的线性退避（不阻塞）。

- **[minor] [src/modules/daily-news/prompt-builder.test.ts:55-58]** `buildTaskPrompt()` 的 "contains step instructions" 测试只检查 `prompt.length > 200`，无法验证关键指令（5 条选取逻辑、≤50 字限制、微信目标等）是否存在。  
  修复建议：补充断言检测 "Step 4"/"Step 6"/"50 字"/"wechat:" 等关键字存在。

- **[minor] [src/modules/daily-news/setup.test.ts]** `setup.test.ts` 未测试"第一次启动不立即触发"的防护逻辑（FR-001 CL-09）。`getNext9amShanghai()` 的 60s 保护存在且单独测试了，但 setup 层没有测试 `process_after > now` 的组合断言。  
  修复建议：已有 `process_after > Date.now()` 测试（第 51 行），可补充一个断言确认 `process_after` 至少比当前时间晚 60 秒（防止"刚好在 09:00 启动"的边界）。

---

## 7. Verdict

**3 blockers 必须全部修复才能放行 Step 9 finish branch：**

1. `registerDailyNewsTask()` 未接入启动序列 → feature 完全不工作
2. `wechat.ts deliver()` 无重试+退避+失败持久化 → FR-009 全不满足
3. `buildTaskPrompt()` 无持久化指令 + `db.ts` 函数从无调用方 → FR-012 全不满足

---

## Fix Round 1（2026-05-11）

Blocker 1 · ✅ 修复 · 新增 `initDailyNews(inboundDb)` 至 `src/modules/daily-news/index.ts`（幂等，重复启动不会二次注册）；`src/index.ts` 在 `runMigrations` 后遍历所有 active sessions 并调用；新增 `initDailyNews` 测试 2 条（首次注册、幂等二次调用）

Blocker 2 · ✅ 修复 · `src/channels/wechat.ts` 提取 `deliverText(client, to, text, platformId, onFinalFailure)` 函数，内含 3 次重试 + 1 s/3 s/10 s 退避；`onFinalFailure` 回调在 `deliver()` 中调用 `markAllFailedForDate(getDb(), today)`；`src/modules/daily-news/db.ts` 新增 `markAllFailedForDate`；新增 `src/channels/wechat.test.ts` 4 条测试覆盖首次成功、第 3 次成功、全败后 `onFinalFailure`、2 败不触发 `onFinalFailure`

Blocker 3 · ✅ 修复 · `src/modules/daily-news/prompt-builder.ts` `buildTaskPrompt()` 新增 Step 7：明确指示 agent 调用 `db.insertItems()` 持久化每条记录、推送失败后调用 `db.markFailed()`；`prompt-builder.test.ts` 新增 4 条断言（insertItems、markFailed、daily_news、持久化关键词）

Verdict 更新：0 blocker · vitest 90 passed · build OK · 放行 Step 9 finish branch

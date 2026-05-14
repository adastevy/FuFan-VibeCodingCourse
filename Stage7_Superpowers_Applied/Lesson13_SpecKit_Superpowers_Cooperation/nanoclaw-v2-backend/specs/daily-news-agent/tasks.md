# Tasks: daily-news-agent

**Input**: `specs/daily-news-agent/plan.md` + `specs/daily-news-agent/spec.md`  
**Branch**: `daily-news-agent` | **Date**: 2026-05-11  
**TDD**: 所有实现类任务先写 vitest test，测试跑红后再写实现

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行（不同文件，无互相依赖）
- **[US1/US2/US3]**: 对应 spec.md 的用户故事
- **TDD**: 先写测试（跑红）→ 再写实现（跑绿）

---

## Phase 1: Setup（基础设施安装）

**Purpose**: 安装 WeChat 渠道、添加 rss-parser 依赖  
**⚠️ 无依赖，T01/T02 可并行启动**

- [ ] T01 安装 `/add-wechat` 渠道（6 步）：`git fetch origin channels` → `git show origin/channels:src/channels/wechat.ts > src/channels/wechat.ts` → 追加 `import './wechat.js';` 到 `src/channels/index.ts` → `pnpm install wechat-ilink-client@0.1.0` → `pnpm run build` → `.env` 追加 `WECHAT_ENABLED=true` 并 `launchctl kickstart -k gui/$(id -u)/com.nanoclaw`
  - **输入**: channels branch 上的 `src/channels/wechat.ts`
  - **输出**: `src/channels/wechat.ts` 存在，host build 成功，WeChat QR 登录页可访问
  - **TDD**: 否（操作类任务）

- [ ] T02 [P] 安装 rss-parser 依赖：`pnpm install rss-parser@3.13.0`，确认 `pnpm-lock.yaml` 更新且无 `minimumReleaseAgeExclude` bypass
  - **输入**: 当前 `package.json`
  - **输出**: `rss-parser@3.13.0` 出现在 `package.json` dependencies，lockfile 更新
  - **TDD**: 否（依赖安装）

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 类型定义、配置常量、数据库 DDL — 所有用户故事均依赖此阶段  
**⚠️ T03 与 T01/T02 无依赖可并行；T04 依赖 T03**

- [ ] T03 [P] 创建 `src/modules/daily-news/types.ts`（`RawNewsItem`/`NewsItem`/`FetchResult`/`DailyDigest`/`DeliveryRecord` 接口）和 `src/modules/daily-news/config.ts`（`RSS_SOURCES`、`CRON_EXPR='0 9 * * *'`、`TIMEZONE='Asia/Shanghai'`、`WECHAT_GROUP_PLATFORM_ID` 占位、`MAX_ITEMS=5`、`MAX_CHARS=500`）
  - **输入**: plan.md §Data Model、§NanoClaw Integration Points
  - **输出**: 两个无副作用文件；`pnpm exec tsc --noEmit` 通过
  - **TDD**: 否（类型/常量，无逻辑）

- [ ] T04 [TDD] 写 Migration 014 测试 → 实现 `src/db/migrations/014-daily-news.ts` daily_news 表 DDL，注册到 `src/db/migrations/index.ts`
  - **输入**: T03 的 `types.ts`（`DeliveryRecord` 字段参考）；plan.md §3 DDL 代码块
  - **输出**: `up()` 创建 `daily_news` 表 + `idx_daily_news_date` + `idx_daily_news_url_date`；`down()` 完全回滚；幂等重跑 `up()` 无报错；`pnpm test` 绿
  - **TDD**: **是**（先写测试用内存 DB 验证 up/down/idempotent，测试跑红后再实现）
  - **依赖**: T03

---

## Phase 3: User Story 1 — 自动每日摘要推送 (P1) 🎯 MVP

**Goal**: 09:00 Asia/Shanghai 自动拉取新闻、生成中文摘要、推送到微信群  
**Independent Test**: 手动触发 scheduled task，60 秒内收到含 5 条中文摘要的微信消息

- [ ] T05 [P] [US1] [TDD] 写 `src/modules/daily-news/dedup.test.ts` → 实现 `src/modules/daily-news/dedup.ts`
  - **输入**: T03 `RawNewsItem` 类型
  - **输出**: `urlHash(url)` 结果稳定可重现；相同 URL 去重保留第一条；不同 URL 不误合并；空数组返回空数组；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现纯函数）
  - **依赖**: T03；与 T06/T07/T08/T12 可并行

- [ ] T06 [P] [US1] [TDD] 写 `src/modules/daily-news/prompt-builder.test.ts` → 实现 `src/modules/daily-news/prompt-builder.ts`
  - **输入**: T03 `config.ts` 中 `TIMEZONE`/`MAX_ITEMS`；plan.md §schedule_task 代码块
  - **输出**: `getNext9amShanghai()` 始终返回未来时间戳且 ≥ 下一个 09:00；`buildTaskPrompt()` 包含所有必填字段；文章列表截断至 50 条；单条标题截断至 120 字符；边界：setup 恰好在 09:00:00 时推进到次日；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现）
  - **依赖**: T03；与 T05/T07/T08/T12 可并行

- [ ] T07 [TDD] [US1] 写 `src/modules/daily-news/db.test.ts`（CRUD 部分）→ 实现 `src/modules/daily-news/db.ts`
  - **输入**: T04 migration 014（需要 `daily_news` 表存在）；T03 `DeliveryRecord` 类型
  - **输出**: `insertItems()` 写入正确行；`markFailed()` 将 `failed` 翻转为 1；`getPendingRepush()` 只返回 `failed=1` 的行；`(url, date)` unique constraint 阻止重复插入；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现）
  - **依赖**: T04（需要表 DDL 存在）

- [ ] T08 [P] [US1] [TDD] 写 `src/modules/daily-news/fetcher.test.ts`（成功路径）→ 实现 `src/modules/daily-news/fetcher.ts` 基础抓取逻辑
  - **输入**: T03 `RawNewsItem`/`FetchResult` 类型；`rss-parser@3.13.0`（T02）；plan.md HN Algolia URL
  - **输出**: `fetchHackerNews()` 返回符合 `RawNewsItem` 结构的数组；`fetchRssSource()` 正确映射 rss-parser 输出；使用 `vitest` mock 模拟 HTTP（不打真实网络）；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现）
  - **依赖**: T02、T03；与 T05/T06/T07/T12 可并行

- [ ] T09 [US1] [TDD] 写 `src/modules/daily-news/setup.test.ts` → 实现 `src/modules/daily-news/setup.ts`（`registerDailyNewsTask` + `schedule_task` MCP 注册）
  - **输入**: T06 `buildTaskPrompt()`/`getNext9amShanghai()`；T07 `db.ts` insertTask 调用；plan.md §schedule_task 代码块（`recurrence='0 9 * * *'`，`timezone='Asia/Shanghai'`）
  - **输出**: `registerDailyNewsTask()` 以正确 `recurrence='0 9 * * *'` 调用 `insertTask()`；`processAfter > Date.now()`；content JSON 可解析且含 `prompt` 字段；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现）
  - **依赖**: T06、T07

- [ ] T10 [US1] 实现 `src/modules/daily-news/index.ts`（模块入口：export `registerDailyNewsTask`，注册 delivery hook）
  - **输入**: T08 fetcher、T05 dedup、T06 prompt-builder、T07 db、T09 setup；T12 formatter（如先完成则 wire）
  - **输出**: `import './daily-news/index.js'` 加到 `src/modules/index.ts`（或等价位置）后 `pnpm build` 通过；模块导出正确
  - **TDD**: 否（集成 wire，由 integration test 覆盖）
  - **依赖**: T09（setup 完成）、T08（fetcher 完成）

---

## Phase 4: User Story 2 — 单源失败部分投递 (P2)

**Goal**: 某 RSS 源不可达时跳过该源，仍从其他源投递；全源失败时推送固定提示  
**Independent Test**: mock 其中一个 RSS 源返回 500，验证其他源的条目仍正常投递且 WARN 日志出现

- [ ] T11 [US2] [TDD] 在 `src/modules/daily-news/fetcher.test.ts` 追加重试测试 → 在 `fetcher.ts` 中实现每源 3 次重试 + WARN 级别日志跳过 + 全源失败时 `FetchResult.items=[]` + `warnings` 回传
  - **输入**: T08 已有的 `fetcher.ts`；plan.md §Failure Branch；spec.md CL-01
  - **输出**: 单源失败耗尽 3 次后 `warnings` 包含该源名；第 2 次重试成功时返回正常 items；全源失败时 items 为空（触发固定消息路径）；`pnpm test` 绿
  - **TDD**: **是**（先追加测试跑红，再扩展实现）
  - **依赖**: T08

---

## Phase 5: User Story 3 — 长摘要自动拆分 (P3)

**Goal**: 消息总长 >500 字符时拆为 2 条，不截断任何条目  
**Independent Test**: 构造 >500 字符的 5 条摘要，验证收到恰好 2 条微信消息且所有条目完整

- [ ] T12 [P] [US3] [TDD] 写 `src/modules/daily-news/formatter.test.ts` → 实现 `src/modules/daily-news/formatter.ts`
  - **输入**: T03 `NewsItem`/`DailyDigest` 类型；spec.md FR-010/FR-011；plan.md §formatter
  - **输出**: ≤500 字符 → 恰好 1 条消息；>500 字符 → 恰好 2 条消息（在条目边界分割）；0 条目 → 固定字符串 `"今日 AI 工程领域无显著动态，明日 9:00 再见"`；5 条目所有字段存在；无条目被截断；`pnpm test` 绿
  - **TDD**: **是**（先测试跑红，再实现纯函数）
  - **依赖**: T03；与 T05/T06/T08 可并行（不依赖 T04 ~ T09）

---

## Phase 6: Polish & 运维就绪

**Purpose**: 模块 wire 进 host、开发调试工具、OneCLI 权限确认

- [ ] T13 [P] 实现 `src/modules/daily-news/runner.ts`（手动触发 smoke-runner：一次性执行 fetch → dedup → prompt-build → format 管道，输出到 console，URL 健康检查）
  - **输入**: T08 fetcher、T05 dedup、T06 prompt-builder、T12 formatter
  - **输出**: `pnpm exec tsx src/modules/daily-news/runner.ts` 可运行，打印摘要预览，不需要 WeChat 实际连接
  - **TDD**: 否（开发工具）
  - **依赖**: T05、T06、T08、T12；与 T14 可并行

- [ ] T14 [P] 确认 OneCLI secret mode + 填写 `WECHAT_GROUP_PLATFORM_ID`：QR 扫码登录后从日志提取 `platformId`，更新 `src/modules/daily-news/config.ts`；执行 `onecli agents set-secret-mode --id <agent-id> --mode all` 确保 WeChat 凭证注入
  - **输入**: T01 完成的 WeChat 安装；`logs/nanoclaw.log` 中 `WeChat inbound platformId=...` 行
  - **输出**: `config.ts` 中 `WECHAT_GROUP_PLATFORM_ID` 填入真实值；`onecli agents secrets --id <agent-id>` 显示 WeChat secret 已分配
  - **TDD**: 否（运维操作）
  - **依赖**: T01；与 T13 可并行

- [ ] T15 [US1] 端到端验证：执行 `registerDailyNewsTask(inboundDb)`，确认 `inbound.db` 写入 `processAfter` 为下一个 09:00 Asia/Shanghai 的 task row，然后手动提前触发并验证微信群收到格式正确的中文摘要消息
  - **输入**: T10 index.ts、T14 config.ts（真实 WECHAT_GROUP_PLATFORM_ID）、T11 fetcher 重试、T12 formatter
  - **输出**: `daily_news` 表存在 5 行 `pushed_at` 非 NULL 的记录；微信群收到 1 或 2 条包含中文标题/摘要/URL 的消息；`pnpm test` 全绿
  - **TDD**: 否（集成验证）
  - **依赖**: T10、T11、T12、T14

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (T01, T02, T03) — 无依赖，全部可并行启动
    ↓
Phase 2 (T04) — 依赖 T03
    ↓
Phase 3 (T05, T06, T07, T08) — 依赖 T03/T04（T07 依赖 T04，其余依赖 T03）
    ↓
Phase 3 (T09) — 依赖 T06 + T07
    ↓
Phase 3 (T10) — 依赖 T09 + T08
    ↓
Phase 4 (T11) — 依赖 T08
Phase 5 (T12) — 依赖 T03（可与 T05/T08 并行，越早越好）
    ↓
Phase 6 (T13, T14) — 依赖 T05/T06/T08/T12（T13）；T01（T14）；两者可并行
    ↓
Phase 6 (T15) — 依赖 T10 + T11 + T12 + T14
```

### Task-Level Dependencies

| Task | 依赖 | 说明 |
|------|------|------|
| T01 | — | 独立 |
| T02 | — | 独立 |
| T03 | — | 独立 |
| T04 | T03 | 需要 DeliveryRecord 字段参考 |
| T05 | T03 | 需要 RawNewsItem 类型 |
| T06 | T03 | 需要 config.ts TIMEZONE |
| T07 | T04 | 需要 daily_news 表 DDL |
| T08 | T02, T03 | 需要 rss-parser + types |
| T09 | T06, T07 | 需要 buildTaskPrompt + insertTask |
| T10 | T09, T08 | 集成 wire |
| T11 | T08 | 扩展 fetcher.ts |
| T12 | T03 | 纯函数，仅需 types |
| T13 | T05, T06, T08, T12 | smoke-runner |
| T14 | T01 | WeChat QR 登录后操作 |
| T15 | T10, T11, T12, T14 | 端到端验证 |

---

## Parallel Groups

### Group A（Phase 1，无任何依赖）
```
同时启动:
├── T01  /add-wechat 安装
├── T02  rss-parser 安装
└── T03  types.ts + config.ts
```

### Group B（T03 完成后）
```
T04  migration 014 DDL
（单任务，为 Group C 解锁 T07）
```

### Group C（T03 + T04 完成后，可全部并行）
```
同时启动:
├── T05  dedup.test → dedup.ts
├── T06  prompt-builder.test → prompt-builder.ts
├── T07  db.test → db.ts          ← 需要 T04
├── T08  fetcher.test → fetcher.ts ← 需要 T02
└── T12  formatter.test → formatter.ts
```

### Group D（T06 + T07 完成后）
```
T09  setup.test → setup.ts（registerDailyNewsTask + schedule_task MCP）
```

### Group E（T08 完成后，与 Group D 并行）
```
T11  fetcher 重试扩展（US2 逻辑）
```

### Group F（T09 + T08 完成后）
```
T10  index.ts 模块入口 wire
```

### Group G（T10 完成 + T12 完成后，T13/T14 可并行）
```
同时启动:
├── T13  runner.ts smoke-runner
└── T14  OneCLI secret mode + config.ts WECHAT_GROUP_PLATFORM_ID
```

### Group H（T10 + T11 + T12 + T14 全部完成后）
```
T15  端到端集成验证
```

---

## Parallel Execution Examples

### MVP 最快路径（单人串行）
```
T01/T02/T03 (并行) → T04 → T05/T06/T08/T12 (并行) → T07 → T09 → T10 → T11 → T14 → T15
```

### 双人协作
```
人员 A: T01 → T14（WeChat 安装 + 登录）
人员 B: T02 → T03 → T04 → T07 → T09 → T10
（并行）T05/T06/T08/T12 → T11 → T13 → T15
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: T01 + T02 + T03（并行）
2. Phase 2: T04（migration DDL）
3. Phase 3: T05 + T06 + T08 + T12（并行）→ T07 → T09 → T10
4. **STOP & VALIDATE**: `registerDailyNewsTask` 写入正确的 task row，`pnpm test` 全绿
5. T14（填入真实 WECHAT_GROUP_PLATFORM_ID）→ T15 端到端验证

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T01-T04)
2. US1 核心实现 → 手动验证每日摘要投递 (T05-T10)
3. US2 重试 / 降级 → 验证部分失败容错 (T11)
4. US3 消息拆分 → 验证 >500 字符场景 (T12，可提前到 Group C 并行)
5. Polish + 端到端 (T13-T15)

---

## TDD 顺序（strict — 测试先于实现）

```
1. types.ts + config.ts    (T03 — 无测试，纯类型/常量)
2. migration 014           (T04 — 先写 DB schema 测试)
3. dedup.test → dedup.ts   (T05 — 先测试)
4. formatter.test → formatter.ts  (T12 — 先测试，可与 T05 并行)
5. prompt-builder.test → prompt-builder.ts  (T06 — 先测试)
6. db.test → db.ts         (T07 — 先测试，依赖 T04)
7. fetcher.test → fetcher.ts  (T08 — 先测试 success 路径)
8. setup.test → setup.ts   (T09 — 先测试，依赖 T06/T07)
9. fetcher 重试扩展 test → fetcher.ts 扩展  (T11 — 先追加测试)
10. index.ts               (T10 — 集成 wire，无独立测试)
```

---

## Notes

- `[P]` = 不同文件，无互相依赖，可跨 subagent 并行
- WeChat QR 登录（T01 最后一步）是人工操作，需要用户介入
- T14 中 `WECHAT_GROUP_PLATFORM_ID` 必须在第一次 WeChat 消息入组后从日志读取
- `rss-parser@3.13.0` 是成熟版本（2023），无需 `minimumReleaseAgeExclude` bypass
- container/agent-runner 无新代码——所有逻辑在 host `src/modules/daily-news/`
- `bun:sqlite` 参数风格与 `better-sqlite3` 不同（`$name` 前缀不自动剥离），但本模块只在 host 侧运行，使用 `better-sqlite3`，无此问题

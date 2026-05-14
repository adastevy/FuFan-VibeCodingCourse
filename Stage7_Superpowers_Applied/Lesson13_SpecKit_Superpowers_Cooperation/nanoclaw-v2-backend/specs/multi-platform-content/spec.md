# Feature Specification: multi-platform-content

**Feature Directory**: `specs/multi-platform-content`
**Created**: 2026-05-13
**Status**: Draft
**Depends On**: brainstorming.md (Step 1), `/tmp/stage3-code-survey.md`, `/tmp/stage3-integration-plan.md`

---

## Clarification Log (Auto-resolved)

Ambiguities identified during speckit-clarify and resolved without deadlock. Full rationale in `clarify.md`.

| # | Question | Resolution |
|---|----------|-----------|
| CL-01 | 同一时刻能跑几个 task？ | 最多 1 个 task 并发执行；前端触发时检查 pending/researching/writing 状态任务是否已存在，若是则返回 409。 |
| CL-02 | Researcher 超时怎么处理？ | 60s 超时；超时后 Coordinator 写 content_tasks.error + status='failed'。 |
| CL-03 | Writer 部分失败怎么处理？ | 其余 Writer 照常完成；失败 platform 不写 content_articles 行；Coordinator 收到的完成计数 < 3 时写 status='partial' + error 说明哪些 platform 失败。 |
| CL-04 | Coordinator 如何知道 3 个 Writer 全完成？ | Coordinator 在 session_state 维护计数器（writers_completed），每收到一个 Writer 回传消息计数+1，到 3 时更新 status='completed'。 |
| CL-05 | Researcher 调研工具是什么？ | 使用容器内置 Bash tool + WebSearch MCP（若已配置）；结构化输出为 JSON 字符串回传 Coordinator。 |
| CL-06 | Writer 如何写 content_articles？ | 通过 Bash tool 执行 `pnpm exec tsx /workspace/scripts/write-article.ts`；Sub-2 CLAUDE.md 明确命令格式。 |
| CL-07 | Dashboard 路由权限？ | MVP 无鉴权，local-only 部署；next.js API route 不加 auth middleware。 |
| CL-08 | 轮询终止条件？ | status 为 'completed'、'failed'、'partial' 时 clearInterval，不再轮询。 |

---

## Project Meta

| Field | Value |
|-------|-------|
| Project name | multi-platform-content |
| Parent project | NanoClaw v2 + nanoclaw-dashboard-v2 |
| NanoClaw backend path | `src/modules/content-generation/` |
| Migration file | `src/db/migrations/015-content-generation.ts` |
| Agent groups | `content-coordinator`, `content-researcher`, `xiaohongshu-writer`, `gongzhonghao-writer`, `weibo-writer` |
| Dashboard entry | `localhost:4000/content-generation` |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 一键触发多平台内容生成 (Priority: P1)

用户在 dashboard 的「多平台内容生成」页面输入话题（如"AI 工程化"），点击「开始生成」按钮，系统自动完成调研 + 三平台写作，3 分钟内不刷新页面即可看到 3 篇文章。

**Why this priority**: 这是功能的完整价值交付路径，缺少则一切皆无。

**Independent Test**: POST `/api/content-generation/trigger`，body `{ topic: "AI工程化" }`，等待 3 分钟，`content_tasks.status` 必须变为 `completed`，`content_articles` 必须有 3 行（xiaohongshu / gongzhonghao / weibo）。

**Acceptance Scenarios**:

1. **Given** 没有正在进行的 task，**when** 用户提交话题并点击触发按钮，**then** API 返回 `{ taskId }` 且 `content_tasks` 出现 status='pending' 的新行，within 2s。
2. **Given** task 已触发，**when** content-coordinator 容器被 wake，**then** `content_tasks.status` 从 'pending' 变为 'researching'，within 5s（inject-task 直接 wake，不走 60s sweep）。
3. **Given** Researcher 完成调研，**when** Coordinator 收到 research 回传，**then** `content_tasks.status` 变为 'writing'，且 3 个 Writer 容器在 5s 内先后 spawn。
4. **Given** 3 个 Writer 全部完成，**when** Coordinator 收到 3 个完成信号，**then** `content_tasks.status` 变为 'completed'，`content_articles` 有 3 行。

---

### User Story 2 — 实时查看生成进度 (Priority: P2)

用户触发生成后，页面状态面板每 5 秒刷新一次，显示当前阶段文字（"调研中…" / "写作中…" / "已完成"），不需要手动刷新页面。

**Why this priority**: 没有进度反馈，用户不知道系统是否在工作，体验等同于黑盒。

**Independent Test**: 触发生成后，打开 Network 面板，确认每 5s 有 GET `/api/content-generation/status?taskId=xxx` 请求；status 变为 'completed' 后轮询停止。

**Acceptance Scenarios**:

1. **Given** taskId 已获取，**when** 状态组件挂载，**then** 立即发起第一次轮询请求（不等 5s）。
2. **Given** `content_tasks.status` 为 'writing'，**when** 轮询返回，**then** 页面显示"正在生成文章（3 个平台并发）…"。
3. **Given** status 为 'completed' 或 'failed'，**when** 轮询返回，**then** clearInterval 停止轮询，Network 面板不再出现新的 status 请求。

---

### User Story 3 — 查看并使用 3 篇生成文章 (Priority: P2)

生成完成后，页面自动展示 3 列文章——小红书、公众号、微博各一列，用户可以直接复制内容发布。

**Why this priority**: 文章展示是功能的直接产出，是用户获得价值的最后一步。

**Acceptance Scenarios**:

1. **Given** status='completed'，**when** 3 列文章展示区渲染，**then** 小红书列含 emoji（≥3 个）和 hashtag（≥3 个 `#xxx`），公众号列含小标题（≥2 个），微博列字数 ≤280 字符。
2. **Given** 文章展示完成，**when** 用户触发新话题，**then** 旧文章清空，新 taskId 生成，进度面板重置。

---

### User Story 4 — 调研失败的降级处理 (Priority: P3)

Researcher 超时（60s 内未回传）或调研异常，Coordinator 标记 task 为 'failed'，用户在 dashboard 看到错误提示，可以重新触发。

**Acceptance Scenarios**:

1. **Given** Researcher 未在 60s 内回传，**when** Coordinator 超时检测触发，**then** `content_tasks.status='failed'`，`error` 字段写入超时原因，dashboard 显示错误提示。
2. **Given** task 为 'failed'，**when** 用户再次点击触发按钮提交相同话题，**then** 系统生成新 taskId，重新走完整流程。

---

### User Story 5 — Writer 部分失败的容错处理 (Priority: P3)

3 个 Writer 中某个失败（容器崩溃 / Bash 写入报错），其余 Writer 照常完成并入库，task 标记为 'partial'，dashboard 明确指出哪些平台成功。

**Acceptance Scenarios**:

1. **Given** xiaohongshu-writer 失败，**when** gongzhonghao + weibo 完成，**then** `content_tasks.status='partial'`，`error='xiaohongshu writer failed'`，content_articles 有 2 行（非 3 行）。
2. **Given** status='partial'，**when** dashboard 轮询返回，**then** 成功的 2 列文章正常展示，失败列显示"生成失败"占位符。

---

## Edge Cases

- **EC-01 并发任务冲突**：用户在 task 进行中再次点击触发按钮，POST trigger API 检测到 pending/researching/writing 状态任务存在，返回 HTTP 409 `{ error: "task already in progress", existingTaskId: "ctask-xxx" }`，不创建新 task。
- **EC-02 Researcher 超时**：Coordinator 发出 send_message → researcher 后，在 session_state 记录 researcher_sent_at；Coordinator 的下一次唤醒（由 Researcher 回传触发）若 60s 内未发生，由 host-sweep（下一个 60s tick）发现 stale session 后写 failed 状态——或 Coordinator CLAUDE.md 指令要求在超时时间内检测并自行标记。见 clarify.md CL-02 的拍板决策。
- **EC-03 全部 Writer 失败**：3 个 Writer 全部失败，Coordinator 收不到任何完成信号；60s 超时后标记 status='failed'，error='all writers failed'。
- **EC-04 inject-task 子进程崩溃**：inject-task.ts 退出码非 0，trigger API route 捕获 child process error，返回 HTTP 500，content_tasks 行已插入（status='pending'）但 coordinator 不会被 wake；此时 task 会在下一个 60s sweep 中被 wake（降级为 sweep 触发，延迟 ≤60s）。
- **EC-05 content_articles UNIQUE 冲突**：同一 task_id 同一 platform 重复写入（Writer 重试场景），UNIQUE(task_id, platform) 约束触发 UNIQUE constraint failed；write-article.ts 脚本使用 `INSERT OR REPLACE` 语义，用最新内容覆盖。
- **EC-06 DB 写入失败（磁盘满）**：write-article.ts 脚本退出码非 0，Writer 在 CLAUDE.md 指令下识别写入失败，通过 send_message 回传 coordinator 失败信号（含 platform + error），进入 EC-01 Writer 部分失败处理。
- **EC-07 topic 为空或过长**：trigger API route 校验 topic 非空、字数 ≤500；不符合返回 HTTP 400 `{ error: "topic must be 1-500 characters" }`，不写 DB。
- **EC-08 agent_destinations ACL 缺失**：setup-content-agents.ts 未运行或 ACL 行缺失，agent-route.ts 的 `hasDestination` 返回 false，`routeAgentMessage` throw 错误，任务卡在 'researching' 状态不推进；排查方式：`pnpm exec tsx scripts/q.ts data/v2.db "SELECT * FROM agent_destinations WHERE agent_group_id LIKE 'content%'"`，预期 8 行。
- **EC-09 dashboard 与 nanoclaw-v2 路径错配**：`NANOCLAW_ROOT` 环境变量未设置或路径不存在，contract.ts 的 validateNanoclawRoot() 检查失败，API route 返回 HTTP 500 with 明确错误信息，不会静默返回空数据。
- **EC-10 service 未运行时触发**：inject-task.ts 写入 inbound.db 成功，但 nanoclaw 服务未在运行，wakeContainer 调用静默成功（spawn docker 但 docker daemon 不可用），容器启动失败；task 保持 'pending'，下次服务恢复后 host-sweep 会 wake 该 session 继续执行。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 HTTP API `POST /api/content-generation/trigger`，接受 body `{ topic: string }`，校验 topic 非空且 ≤500 字符，否则返回 HTTP 400。(CL-07)
- **FR-002**: 触发时，系统 MUST 检测是否已有 status IN ('pending','researching','writing') 的 task 存在；若是，返回 HTTP 409 `{ error, existingTaskId }`，不创建新 task。(CL-01, EC-01)
- **FR-003**: 通过 FR-001 校验后，系统 MUST 在 `content_tasks` 表插入新行（status='pending'，id='ctask-\<timestamp\>-\<random\>'），并通过 spawn `pnpm run inject-task -- --task-id=<id> --topic=<topic>` 子进程触发 coordinator，返回 HTTP 200 `{ taskId }`。
- **FR-004**: `inject-task.ts` CLI MUST 完成：(1) 找到 content-coordinator 的 session，(2) 在其 inbound.db 的 `messages_in` 表写入 kind='task', trigger=1, content=JSON{taskId, topic}，(3) 直接调用 `wakeContainer(coordinator_session)`，绕过 60s host-sweep；CLI 退出码 0 表示成功，非 0 表示失败。(brainstorming §2.3, risk 2)
- **FR-005**: content-coordinator agent MUST 在收到 task 消息后，将 `content_tasks.status` 更新为 'researching'，并通过 `send_message(channel_type='agent', platform_id=researcher_ag_id)` 将 `{taskId, topic}` 转发给 content-researcher。
- **FR-006**: content-researcher agent MUST 在收到 `{taskId, topic}` 后完成联网调研，输出 JSON 格式的 research_result（含 key_facts 数组、sources 数组），通过 `send_message(channel_type='agent', platform_id=coordinator_ag_id)` 回传给 coordinator；调研必须在 60s 内完成，超时由 coordinator 侧超时检测处理。(CL-05)
- **FR-007**: content-coordinator agent MUST 在收到 research_result 后，将 `content_tasks.status` 更新为 'writing'，并连续调用 3 次 `send_message(channel_type='agent')`，分别发给 xiaohongshu-writer、gongzhonghao-writer、weibo-writer，每条消息携带 `{taskId, topic, research_result}`。(brainstorming §4.1 真并发节点)
- **FR-008**: 每个 Writer agent MUST 在收到消息后按平台规格生成文章（见 FR-013~FR-015），通过 Bash tool 调用 `pnpm exec tsx /workspace/scripts/write-article.ts` 写入 `content_articles` 表，写入成功后通过 `send_message(→ coordinator)` 发送完成信号 `{taskId, platform, status:'done'}`；写入失败发送 `{taskId, platform, status:'error', error:'<reason>'}`。(CL-06)
- **FR-009**: `write-article.ts` 脚本 MUST 接受参数 `--task-id`, `--platform`, `--title`, `--content`, `--tags`（JSON 数组），向 `content_articles` 表执行 `INSERT OR REPLACE`，成功退出码 0，失败退出码 1 并 stderr 写原因。(EC-05)
- **FR-010**: content-coordinator agent MUST 在 session_state 维护 writers_completed 计数器（初始 0）；每收到一个 Writer 的 done 信号计数+1，收到 error 信号记录失败平台；当 writers_completed + writers_failed = 3 时，更新 content_tasks：(a) 3 done → status='completed'；(b) 1-2 done → status='partial', error='<失败 platform 列表>'；(c) 0 done → status='failed'，error='all writers failed'。(CL-04)
- **FR-011**: Dashboard MUST 提供 `GET /api/content-generation/status?taskId=<id>`，返回 `{ task: ContentTask, articles: ContentArticle[] }`，直读 `v2.db`（better-sqlite3 readonly 模式，参考 contract.ts L133–L153）。
- **FR-012**: Dashboard MUST 提供 `GET /api/content-generation/list?limit=10`，返回 `{ tasks: ContentTask[], count: number }`，按 created_at DESC 排序。
- **FR-013**: 小红书文章 MUST 满足：字数 500–800 字，含 emoji ≥3 个，含 hashtag ≥3 个（`#xxx` 格式），禁止出现深度分析语调（如"综上所述"、"值得注意的是"等书面体词汇）。
- **FR-014**: 公众号文章 MUST 满足：字数 1500–2500 字，含小标题 ≥2 个（`## xxx` 或 `**xxx**` 格式），禁止滥用 emoji（每 500 字最多 1 个），需有引导语开篇。
- **FR-015**: 微博文章 MUST 满足：字数 ≤280 字符（含话题标签），含 `#话题#` 格式标签 ≥1 个，禁止超过 5 句话，口语化、精炼。
- **FR-016**: Dashboard 前端状态组件 MUST 在 taskId 存在后立即发起第一次轮询，随后每 5s 轮询 status API；当 status IN ('completed','failed','partial') 时 clearInterval，停止轮询。(CL-08, integration-plan §3.2)
- **FR-017**: Dashboard 前端 MUST 在 status='completed' 或 'partial' 时展示 3 列文章网格（小红书 / 公众号 / 微博）；'partial' 时失败列显示"该平台生成失败"占位符。
- **FR-018**: `content_tasks` + `content_articles` 表 MUST 由 migration 文件 `src/db/migrations/015-content-generation.ts` 创建，格式对齐 `014-daily-news.ts` 的 `up()` / `down()` 函数结构；migration 在 nanoclaw 服务启动时幂等执行。

---

### Key Entities

- **ContentTask**: 一次内容生成任务记录。字段：id, topic, status, created_at, started_at, completed_at, error。
- **ContentArticle**: 某 task 的某平台文章。字段：id, task_id, platform, title, content, tags（JSON 数组）, word_count, created_at。UNIQUE(task_id, platform)。
- **ContentCoordinator**: 调度 Agent，负责 content_tasks 全生命周期状态机。唯一有权写 content_tasks 的 agent。
- **ContentResearcher**: 调研 Agent，输入话题，输出结构化 JSON research_result，通过 a2a 回传。
- **PlatformWriter**: 3 个写作 Agent（xiaohongshu / gongzhonghao / weibo），各自独立 agent_group + 独立 session，真并发。

---

## Non-Functional Requirements

- **延迟**：用户点击触发到 dashboard 显示"正在处理" ≤5s（由 inject-task 直接 wake + 5s 首次轮询保证）。(brainstorming §7 非功能性标准)
- **吞吐**：MVP 串行任务，同一时刻最多 1 个 task 执行；不支持并发任务队列（见 FR-002 409 保护）。
- **端到端时间**：正常情况下 topic → 3 篇文章 ≤3 分钟（Researcher 1min + 3 Writer 并发 1.5min + 开销 30s）。
- **真并发验证**：3 个 Writer 容器启动时间差 ≤5s（Docker 日志时间戳可验证）。
- **可靠性**：单 Writer 失败不影响其余 Writer，task 降级为 'partial' 而非整体 'failed'（见 FR-010, CL-03）。
- **数据一致性**：`content_articles` UNIQUE(task_id, platform) 约束在 schema 层保证，write-article.ts 使用 INSERT OR REPLACE 处理重试（见 FR-009, EC-05）。
- **可观测性**：task 状态可通过 `pnpm exec tsx scripts/q.ts data/v2.db "SELECT id,status,created_at,completed_at FROM content_tasks"` 查询；article 写入可通过 `SELECT task_id,platform,word_count FROM content_articles` 验证。

---

## NanoClaw Integration Constraints

| Concern | Constraint |
|---------|-----------|
| **触发机制** | dashboard 不直接导入 nanoclaw-v2 内部模块；使用 spawn `pnpm run inject-task` 子进程（与 `app/api/chat/route.ts` L63 `spawn("pnpm", ["run", "chat", ...])` 完全一致的模式）。 |
| **A2A 路由** | 所有 Agent 间通信通过 `send_message(channel_type='agent')` → `delivery.ts` → `routeAgentMessage()` → inbound.db + wakeContainer；不使用 HTTP 调用或文件共享。 |
| **并发 wake** | 3 个 Writer 各有独立 agent_group + 独立 session，`container-runner.ts` L51 `activeContainers` key=sessionId 保证无全局锁，真并发（brainstorming §4.1）。 |
| **DB 写入** | Writer agent 通过 Bash tool 调用 `write-article.ts` 脚本写 content_articles；Coordinator 通过 Bash tool 直接 sqlite 更新 content_tasks.status（使用 `pnpm exec tsx scripts/q.ts`）。 |
| **ACL 初始化** | setup-content-agents.ts 必须预先运行，向 agent_destinations 插入 8 条双向 ACL 行（brainstorming §6 risk 4 详列）；缺失导致 a2a 消息被 agent-route.ts L112–L117 静默拒绝。 |
| **session_mode** | 5 个 agent_group 各自独立，不使用 'agent-shared' session_mode；否则 3 个 Writer 会共用一个容器变为串行。 |
| **Bun vs Node** | container 内 write-article.ts 若作为容器内脚本需用 Bun 语法（bun:sqlite）；若作为 host 侧脚本（通过 /workspace 挂载在容器内调用）则可用 better-sqlite3 Node；本 spec 选后者——脚本放在 nanoclaw-v2 `scripts/` 目录，挂载进容器后用 `pnpm exec tsx` 执行（host node_modules 已挂载到 /workspace）。 |

---

## Out of Scope (MVP)

以下内容明确不在本期实现范围内，实现中不得擅自添加：

1. **真实平台投递**：文章写入 DB 展示，不接 WeChat/Weibo/小红书 adapter 真实投递。
2. **富文本编辑**：生成结果为纯文本，不提供 markdown 在线编辑器。
3. **定时触发**：MVP 仅支持手动按钮触发，不支持定时调度（schedule_task MCP）。
4. **任务历史浏览**：list API 存在但无历史页面 UI；dashboard 仅展示当前/最近一次任务。
5. **Researcher 重试逻辑**：Researcher 失败 → Coordinator 写 'failed'，不实现自动重试。
6. **并发任务队列**：同一时刻只允许 1 个 task 执行，不实现排队机制。
7. **文章回溯与搜索**：content_articles 表存在但 dashboard 不提供历史文章搜索界面。
8. **用户鉴权**：MVP 为 local-only 部署，API route 不加鉴权中间件。(CL-07)
9. **抖音 / LinkedIn / 其他平台**：MVP 只做小红书 + 公众号 + 微博三平台。
10. **文章质量评估 / Gate 验证**：不实现 Verifier agent 或字数/emoji 自动检查（留人工审核）。

---

## Success Criteria *(mandatory)*

- **SC-001**: `pnpm exec tsx scripts/q.ts data/v2.db "SELECT id,status FROM content_tasks"` 输出至少 1 行 status='completed'，且对应 content_articles 有 3 行（platform 各不同）。
- **SC-002**: 小红书文章：grep emoji 字符计数 ≥3，grep `#` 计数 ≥3，word_count 在 500–800 范围内。
- **SC-003**: 公众号文章：word_count 在 1500–2500 范围内，grep `## ` 或 `\*\*` 计数 ≥2。
- **SC-004**: 微博文章：content 字符数 ≤280，grep `#` 计数 ≥1。
- **SC-005**: inject-task 执行后 ≤5s，coordinator container 日志出现（不是 60s 后的 sweep 触发）。
- **SC-006**: 3 个 Writer 容器 Docker 日志时间戳差值 ≤5s（真并发验证）。
- **SC-007**: 触发后 ≤5s，dashboard 状态面板显示"调研中…"（首次轮询命中 researching 状态）。
- **SC-008**: status 变为 'completed' 后，轮询 clearInterval，Network 面板不再出现新的 status 请求。
- **SC-009**: `pnpm exec tsx scripts/q.ts data/v2.db "SELECT * FROM agent_destinations WHERE agent_group_id LIKE 'content%'"` 输出 8 行（ACL 完整性验证）。
- **SC-010**: 在 task 进行中点击触发按钮，API 返回 HTTP 409，DB 无新增 content_tasks 行。

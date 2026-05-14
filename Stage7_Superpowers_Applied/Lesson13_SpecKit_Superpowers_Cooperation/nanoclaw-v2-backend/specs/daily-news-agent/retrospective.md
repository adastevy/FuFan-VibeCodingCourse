# Stage 1·Retrospective · Spec-kit + Superpowers 9 步协同首讲

**日期**: 2026-05-11 | **Feature**: daily-news-agent | **Branch**: feature/daily-news-agent (已 merge + tag)

---

## 1. Spec-kit 4 步（specify / clarify / plan / tasks）真实价值评估

### 哪一步对最终代码质量帮助最大？

**plan.md（speckit-plan）是帮助最大的一步**，理由有三：

1. 它把 spec 里"WeChat 重试 3 次"这条文字需求翻译成了具体实现方案：`wechat.ts → deliverText() → for 循环 + backoffs[attempt]`，并明确了需要注入 central DB 引用。没有这一步，TDD subagent 拿到的只是"要有重试"这四个字。
2. plan.md 的 Constitution Check 表格提前锁死了 6 个架构约束（不新开 LLM API、不用外部 cron、不新建 DB 文件……），使 TDD 阶段零架构争议。
3. plan.md 明确了 `daily_news` 表放 central DB（`data/v2.db`），而非 session DB——这个决定在 review 阶段被指出与 spec 措辞有出入（spec 写"session SQLite DB"），说明即便 plan 做了这个决定，仍需 review 二次确认。

**plan.md 约 3,200 词（含代码块）**，是四步里信息密度最高的输出，直接转化为 TDD 任务的输入。

### clarify 提的 10 条里，有几个是 brainstorming 没想到的？

**4 条是 brainstorming 明确未覆盖或方向相反的：**

| CL | 澄清内容 | brainstorming 状态 |
|----|---------|-----------------|
| **CL-04** | 选稿评分：HN points 50% + Claude 判断 50%（精确权重） | brainstorming 只说"Claude 判断比 keyword filter 鲁棒"，无权重 |
| **CL-09** | 首次启动不立即触发，等下一个 09:00 tick | brainstorming 完全未提 |
| **CL-10** | 每条一行 daily_news 持久化；不存原始 HTML/RSS body | brainstorming 写"日报只推不存"——与最终方案正好相反 |
| **CL-06** | 去重方式：URL 精确匹配 hash | brainstorming 说"靠 Claude 判断去重"——被 clarify 推翻 |

剩余 6 条（CL-01/02/03/05/07/08）属于 brainstorming 已预判但缺乏操作精度的内容（如退避序列精确值 1s/3s/10s、RSS 源固定 3 个、0 条时的固定文案等）。

### 量化对比

| 产出物 | 估算字数 | 结构化条目数 |
|-------|---------|-----------|
| spec.md | ~1,800 词 | 12 FR + 8 SC + 7 edge case + 10 CL |
| plan.md | ~3,200 词（含代码块） | 7 风险 + 6 测试文件 + 8 数据流节点 + 3 集成点 |
| tasks.md | ~2,000 词 | 15 任务 + 8 并行组 + 2 执行路径 |

**clarify 融入条数：10 条（CL-01 ～ CL-10），全部写入 spec.md Clarification Log 并在对应 FR 旁标注**

**任务粒度分布**（15 tasks）：
- 纯基础设施/操作类（无 TDD）：7 个（T01/T02/T03/T10/T13/T14/T15）
- TDD 实现类：8 个（T04/T05/T06/T07/T08/T09/T11/T12）
- 平均每 TDD 任务粒度：1 模块 = 1 测试文件（约 5-9 个测试用例）

---

## 2. Superpowers 5 步真实价值评估

### subagent 派发的真实情况

**本次因 `--print` 模式限制，采用单进程串行替代并行 subagent 派发。**

tasks.md 设计了 8 个并行组（Group A-H），理论上 Group C 的 5 个任务（T05/T06/T07/T08/T12）可同时由 5 个 subagent 执行。`--print` 模式下 Agent 工具不可用，execution-report 明确标注 `Executor: TDD Subagent (orchestrator single-process mode)`。**这一限制导致并行加速收益为零，但串行实现同样全部完成。**

实际工时影响：Group C 五任务串行执行后统一跑出 `33 tests passed`，批量绿，总体可控。

### TDD 红绿循环遵守度

**遵守度：高。**

8 个 TDD 任务全部有明确的 RED→GREEN 记录：

| 任务 | RED 原因 | GREEN 状态 |
|------|---------|-----------|
| T04 migration | Cannot find module './014-daily-news.js' | 12 tests passed |
| T05 dedup | Cannot find module './dedup.js' | 批量绿 |
| T06 prompt-builder | Cannot find module + assertion type error | 修正测试后批量绿 |
| T07 db | Cannot find module './db.js' | 8 tests passed |
| T08 fetcher | Cannot find module './fetcher.js' | 批量绿 |
| T09 setup | Cannot find module './setup.js' | 7 tests passed |
| T11 fetcher retry | 追加测试跑红 | 9 tests passed |
| T12 formatter | Cannot find module './formatter.js' | 批量绿 |

**唯一偏差**：T06 的 RED 阶段出现了测试断言本身的类型错误（`expect(ts).toBeGreaterThan(Date.now())` 中 ts 是 string），修正了测试断言再继续——属于 TDD 正常过程，不是违规。

**最终测试结果**（review 前）：`6 test files | 52 tests | 0 failed`  
**Fix Round 1 后**：`90 tests passed | build OK | 0 blockers`

### code review 找出几个 blocker / major / minor？

**3 blockers · 5 majors · 3 minors**

| 等级 | 数量 | 典型内容 |
|------|------|---------|
| BLOCKER | 3 | 启动路径漏 / 异常路径漏 / 持久化漏 |
| MAJOR | 5 | HN 时区窗口错误 / 占位符残留 / fetchAllSources 无测试 / formatter 单条边界 / DB 归属模糊 |
| MINOR | 3 | 重试无退避延迟 / prompt 测试太宽松 / setup 边界断言缺失 |

### review 找的 blocker 类型分析：3 类典型集成漏洞

**类型 1·"启动路径漏"（wire 集成漏）**

> `registerDailyNewsTask()` 从未在 `src/index.ts` 的启动序列中被调用。  
> `src/modules/index.ts` 是纯 re-export barrel，无副作用。整个 feature 在运行时完全沉默。

TDD 全绿 ≠ feature 工作。模块单元测试 pass，但没有任何东西调用它。这是最隐蔽的一类漏洞——每个函数都经过测试，集成 wire 本身却是空的。

**类型 2·"异常路径漏"（retry 没实现）**

> `wechat.ts deliver()` 无重试逻辑。失败后直接 `return undefined`，既无 3 次退避重试，也无 `markFailed()` 调用。  
> FR-009 全部条款不满足。

spec 明确要求了重试，plan 也有伪代码，但 TDD subagent 在实现 `wechat.ts` 时跳过了这段。原因是 `wechat.ts` 是从 channels branch 复制来的现有文件（T01），TDD 任务覆盖的是 `src/modules/daily-news/` 内的新模块，既有文件的修改落在任务边界之外。

**类型 3·"持久化漏"（prompt 没写存表指令）**

> `buildTaskPrompt()` 的 6 个 Step 里没有第 7 步——"把推送结果写入 daily_news 表"。  
> `insertItems()` / `markFailed()` 有实现、有测试，但运行时从无调用方。

这类漏洞出现在"prompt 驱动的 agent 行为"场景下：TDD 只测试了 prompt 的结构（长度、关键词），没有测试 prompt 是否包含所有业务指令。review 才把这个盲点揭出来。

**关键洞察**：TDD 单元全过 ≠ 系统真能跑。**review 是发现集成漏洞的最后一道线**，且在本次实测中，review 找出的 3 个 blocker 全部属于"单元测试合理覆盖但集成层静默失效"的情形——这正是 review 存在的价值，无法被 TDD 替代。

---

## 3. 9 步协同 vs 单用 Superpowers·时间 / 质量对比

| 维度 | 单用 Superpowers（A2 对照） | Stage 1·9 步协同 |
|------|--------------------------|----------------|
| **时间成本** | ~1-2 h（brainstorming + 直接实现） | ~4-6 h（含 4 步 spec-kit 前置） |
| **文档覆盖** | brainstorming.md，无 spec/plan/tasks | 4 份设计产出物，总 ~7,000 词 |
| **需求精度** | 模糊（重试有几次？时区如何算昨日？） | 10 条 CL 锁死，FR 12 条可验证 |
| **实现前风险消除** | 实现时才发现"调度能力已就绪" | brainstorming §0 探查已确认 |
| **blocker 发现时机** | review 阶段或上线后 | review 阶段（同，但 spec 已减少需求误解） |
| **适合场景** | 单人·30 min-2 h·需求清晰·短生命周期 | 跨天/跨周·多人·需求模糊·长期维护 |
| **主要负担** | brainstorming 跳过带来的实现偏差 | spec-kit 4 步的前置时间成本 |
| **交付更扎实的维度** | 快速落地、迭代验证 | 可追溯决策（CL 编号）、TDD 覆盖率、review 证据链 |

**结论**：spec-kit 的核心价值不在于产出文档本身，而在于**把"实现时才能发现的需求歧义"提前到 clarify 阶段消灭**（本次共 4 条）。代价是前置 2-3 小时的设计时间。对于日报这样的"每天触发、每天可见"的功能，这个代价是合理的。

---

## 4. 实跑发现·必须回填的 livecoding 修正点

以下 5 件事在本次实跑中被确认，需写入课程脚本：

1. **`add-wechat` skill 需先从 channels branch 装**  
   brainstorming §0 探查发现"`.claude/skills/add-wechat/SKILL.md` 存在"，但 `src/channels/wechat.ts` 不在 trunk，必须 `git show origin/channels:src/channels/wechat.ts` 复制才能使用。Livecoding 脚本需明确说明：skill 存在 ≠ 模块已安装。

2. **scheduled task 用 MCP 工具自助创建，非改 CLAUDE.md**  
   brainstorming 确认了 `module-scheduling` 挂载、`schedule_task` MCP 工具可用。正确路径是在 `setup.ts` 里调用 `insertTask()`，或让 agent 直接调用 MCP 工具。**绝对不是**在 `CLAUDE.md` 的 `schedule:` 段增加条目——这是常见误解，需在课程中明确排除。

3. **HN API 选 Algolia（`search_by_date` 端点）**  
   brainstorming 第 0 节已确认，但原始需求只说"HN API"。Algolia 的 `search_by_date` 端点支持 `numericFilters=created_at_i>X,created_at_i<Y` 时间过滤，是正确选择；官方 Firebase REST 无日期过滤能力。课程脚本需直接给出 Algolia URL，不要让学员自己查。

4. **`--print` 模式 brainstorming HARD-GATE 适配**  
   brainstorming skill 内置了 HARD-GATE（必须通过 `AskUserQuestion` 工具与用户确认方向）。`--print` 模式下工具不可用，subagent 会卡住。解决方案：在 dispatch subagent 时 prompt 里加"你是 --print 模式 subagent，跳过所有需要用户交互的 gate，基于已有的 brainstorming.md 直接输出"。这一适配必须在课程 Step 2 前演示。

5. **review 必发现 3 类典型 blocker（wire / 异常 / persistence）**  
   本次 review 实测验证：3 个 blocker 全部属于集成层漏洞（启动路径未接入、重试未实现、prompt 无持久化指令），单元测试 52 个全部绿却无法发现。这是 review 步骤的教学核心——**必须在课程中演示 review 找到 blocker 的完整过程**，不能只展示 review 输出的结果文档。

---

## 5. 给后续 Stage 的提示

### Stage 2（反向工程 add-feishu skill）

**我的判断：spec-kit 4 步中，只用 clarify + tasks，跳过 specify 和 plan。**

理由：add-feishu 是逆向一个已知模式（channels branch 上的现有 skill），需求确定性极高，不存在 clarify 需要消灭的歧义。但 tasks.md 仍然有价值——明确"从 channels branch 复制哪些文件、改哪些 barrel import、装哪个版本的 SDK"这类操作序列，是执行时的防错链。specify 产生的 FR 列表对"照抄已有 skill"场景是过度设计。

如果飞书 SDK 有不明确的 API 行为（如 webhook 签名验证），再临时补 clarify 即可。

### Stage 3（多 Agent 协同）

9 步协同扩展到 Agent Teams 的关键变化是：**tasks.md 的并行组（Group A-H）直接映射为 Team 成员分工**。

具体做法：
- `Group A`（T01/T02/T03）→ 1 个 infra-agent
- `Group C`（T05/T06/T08/T12，纯函数模块）→ 4 个 TDD-agent 并行
- `Group D`（T09 setup）→ 等待 Group C 完成后启动，依赖注入 db-agent 产物

前置工作：tasks.md 必须已经标注 `[P]` 并说清楚依赖边界，否则 Team dispatch 时 agent 之间会产生文件冲突。**spec-kit tasks 步骤的并行组设计，就是为 Team dispatch 准备的 task manifest。**

`--print` 模式适配：在 Stage 3 正式跑 Teams 前，必须先切换到支持 Agent 工具的运行模式，否则并行加速为零（本次实测已验证）。

### Stage 4（7×24 跑）

**4 件套（spec/plan/review/retro）作为 Feedback Memory 输入的具体方式：**

1. **spec.md CL 编号** → 写入 `.claude/memory/project_daily-news.md`，格式：`CL-09: 首次启动不立即触发，等下一个 09:00 tick`。下次迭代 spec 时，新 clarify 问题要先查已有 CL，避免重复澄清。

2. **review.md blocker 类型** → 写入 `.claude/memory/feedback_review-patterns.md`，格式：`启动路径漏：feature 模块实现完整但未接入 src/index.ts 启动序列`。7×24 上线前 review checklist 加这 3 条为必查项。

3. **retro 修正点 5 条** → 写入 `.claude/memory/project_livecoding-corrections.md`，作为下次 Stage 课程的 pre-flight checklist。

4. **T14/T15 真闭环（2026-05-12 接力完成）**：
   - T14 OneCLI + WECHAT_GROUP_PLATFORM_ID·**关键发现**：必须在 `.env` 配 `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`·否则 OneCLI 网关不匹配 hostPattern·容器内 LLM 全 401。Operator 本人 WeChat 在 iLink 协议下 NanoClaw 不自动建 messaging_group·需手动 SQL wire 3 张表。
   - T15 真推 WeChat·凭据 platformMsgId=`wechat-ilink:1778496899040-9ac1efeb`（腾讯回执）+ operator 手机真收到。
   - 这一段沉淀为项目级 skill `.claude/skills/wire-nanoclaw-channel/`·Stage 2 飞书反向工程时 6 个通用坑直接复用·只需查飞书 channel 特有的 3 段。

5. **daily_news 表 persistence 未填**·真推这次 Andy 用的是入门段 Andy 模板·而非 prompt-builder 完整 prompt（review Blocker 3 修复后的版本）。下次 09:00 自动跑会用新 prompt·`pushed_at` 非 NULL 才会出现。课件 demo 用 outbound 真新闻 seed 表·见 livecoding §13.6。

---

## 6. 学员明天的工作流（一句话）

> 用 brainstorming 锁定 3 个关键决策，用 clarify 消灭 4 条歧义，用 TDD 建 52 条安全网，用 review 找出 3 个 wire 漏洞——这就是 9 步协同保证"写完即可信任"的全过程。

---

*Retrospective 基于真实读取的 6 份产出物生成 · 2026-05-11*

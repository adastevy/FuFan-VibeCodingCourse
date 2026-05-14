# Spec · wire-nanoclaw-channel skill

**Created**: 2026-05-12  
**Status**: Draft  
**来源凭据**:
- Stage 1: `specs/daily-news-agent/retrospective.md` §4–§5
- Step 3: `specs/wire-nanoclaw-channel-skill/baseline-failures.md`

---

## 我们要解决什么问题

Step 3 Telegram 实跑（baseline-failures.md）揭示了一个工程结构问题：NanoClaw 内置的 `add-telegram/SKILL.md` 覆盖了 Telegram 特有安装步骤，但 fresh sub-agent 仍然踩了 3 个新坑——chat peer dependency 版本分裂、错误凭据触发 withRetry 30s 假挂、pre-flight 部分安装状态混淆。这 3 个坑都不是 Telegram 特有的；任何使用 @chat-adapter/* 系列包的 channel 都可能复现前两个，任何 idempotent 安装流程都可能复现第三个。

这说明 **SKILL 必须分层**：

| 层 | 谁来写 | 覆盖什么 |
|---|--------|--------|
| channel-specific | 各 `add-*` skill | 装这个 channel 的具体步骤 + 该 channel 特有坑 |
| **channel-agnostic** | **wire-nanoclaw-channel（本 skill）** | **任何 channel 都会遇到的通用 6 段链路 + 通用失败模式** |

本 spec 的目标：定义 wire-nanoclaw-channel skill 的 channel-agnostic 覆盖边界。把 6（Stage 1）+ 3（Step 3）= 9 个坑分堆，明确 In Scope 与 Out of Scope，防止 skill 膨胀成 channel-specific 细节大杂烩。

---

## 9 坑分堆（每条附理由）

### Stage 1 六坑（来源：retrospective §4 item 1 + §5 T14/T15）

| # | 坑描述 | 堆 | 分堆理由 |
|---|--------|---|---------|
| S1 | **pre-flight 状态语义**：skill 文件存在 ≠ `src/channels/<channel>.ts` 已安装 | **A** | 所有 add-* channel 安装流程都需要逐项 pre-flight check；是 NanoClaw channels branch 架构的通用特性，不属于某 channel |
| S2 | **ANTHROPIC_BASE_URL 未配 → 容器 LLM 全 401**：OneCLI 网关 hostPattern 不匹配，placeholder key 送出 | **B** | 属于 OneCLI / LLM 网关基础设施配置，是 NanoClaw 启动前提（pre-setup 层），不是 channel wiring 步骤本身；每次接 channel 都要，但应由 setup/onecli 文档维护，不是 channel wiring skill 的职责 |
| S3 | **messaging_group 手动 SQL wire**：operator 本人 DM 不触发自动建组，需 INSERT 3 张表 | **A** | NanoClaw host routing 引擎行为，与 channel 协议无关；任何 channel 的 operator 自测场景都会遇到 |
| S4 | **iLink context_token 失效机制**：WeChat Bot 只能推给"最近发过消息的用户"，重启后内存 token 失效 | **B** | iLink 是腾讯 Bot 协议特有；其他 channel（Telegram chat_id / Feishu tenant token）的 push credential 机制完全不同，iLink 的诊断步骤无法复用 |
| S5 | **平台层回执（platformMsgId）= 真推证据**：outbound.db 有行只是"待发"，手机真收才算 | **A** | 所有 channel delivery 的验证模式相同（log + platformMsgId + 手机确认三件套）；是 NanoClaw delivery 管道通用语义 |
| S6 | **push credential bootstrap 概念**：用户必须主动发一条消息激活 bot 的推送凭据 | **A** | "先收后推"是 channel-agnostic 的反骚扰机制原则；Telegram 需 /start，Discord 需加入 server，iLink 需发一条消息——名字不同，模式相同 |

### Step 3 三坑（来源：baseline-failures.md 卡 #1 / #2 / #3）

| # | 坑描述 | 堆 | 分堆理由 |
|---|--------|---|---------|
| T1 | **SDK peer dep 版本分裂**：`@chat-adapter/telegram@4.27.0` 依赖 `chat@4.27.0`，但 package.json 锁在 `^4.24.0` → pnpm 装两个版本 → TS2322 | **A** | @chat-adapter/* 系列所有包都依赖 `chat` 核心包；升级任何 channel adapter 时都可能触发相同的版本分裂模式 |
| T2 | **withRetry timeout 误判**：无效/占位 bot token → adapter 对所有错误 retry → 30s+ 假"挂住" → 用户误以为服务崩溃 | **A** | "错误凭据 → withRetry 长时间假挂 → 误判为网络/服务问题"这个诊断模式适用任何有 withRetry 的 channel adapter；Telegram 30s 的具体时长是 channel-specific，但通用诊断思路（看 retry attempt log，排查凭据，不要重启）是 channel-agnostic |
| T3 | **pre-flight 部分安装状态混淆**：`setup/pair-telegram.ts` 已存在，其他文件不存在；新手不知道是继续做还是跳过 | **A** | 任何 idempotent 安装流程都可能留下部分完成状态；"skip if present" 语义需明文说明，与 channel 无关 |

**分堆汇总：A堆 7 条（In Scope）· B堆 2 条（Out of Scope）**

---

## 范围与边界（关键·防膨胀）

### In Scope · channel-agnostic 6 段链路 + 通用失败模式

本 skill 覆盖以下 7 条 channel-agnostic 内容：

1. **pre-flight 状态语义**（S1 + T3）：安装前逐项检查哪些文件真实存在；"skip if present" vs "继续做"的判断规则；部分完成状态的处理方式  
   `(来源: Stage 1 retrospective §4 item 1 / Step 3 baseline 卡 #3)`

2. **SDK peer dep 版本对齐**（T1）：@chat-adapter/<channel> 升版时底层 `chat` 包必须同步 pin 到精确版本；build 报 TS2322 时的排查链路（检查 pnpm list，找两个 chat 版本共存）  
   `(来源: Step 3 baseline 卡 #1)`

3. **withRetry timeout 误判诊断**（T2）：adapter 启动时出现 retry attempt log → 先排查凭据/配置，不要重启；与 channel-registry.ts 的 NetworkError-only retry 是两套机制  
   `(来源: Step 3 baseline 卡 #2)`

4. **messaging_group 手动 SQL wire**（S3）：operator 本人 DM 不触发自动建组；3 张表（messaging_groups / messaging_group_agents / agent_destinations）的通用 INSERT 模板  
   `(来源: Stage 1 retrospective §5 T14 / SKILL.md F7)`

5. **push credential bootstrap**（S6）：重启后必须用户主动发一条消息刷新推送凭据；"先收后推"原则对所有 channel 成立；channel-specific 的凭据名称（context_token / chat_id / tenant_token）由各 add-* skill 说明  
   `(来源: Stage 1 retrospective §5 T14 / SKILL.md F8 抽象层)`

6. **平台层回执验证**（S5）：outbound.db 有行 ≠ 推送成功；真推三件套（log `Message delivered` + `platformMsgId` 字段 + 手机真收）  
   `(来源: Stage 1 retrospective §5 T15 / SKILL.md F9)`

7. **凭据前置依赖**（S1 + T2）：adapter factory 在无 credentials 时返回 null，不会出现 "Channel adapter started" log；credentials 必须在 adapter-ready 验证之前就绪  
   `(来源: Stage 1 retrospective §4 item 1 / Step 3 baseline 卡 #2)`

### Out of Scope · channel-specific（明示由各 add-* skill 维护）

| 内容 | 归属 skill | 来源 |
|------|-----------|------|
| ANTHROPIC_BASE_URL / OneCLI hostPattern 配置 | `setup/` 或 `init-onecli` 文档 | Stage 1 retrospective §5 T14 / SKILL.md F6 |
| WeChat iLink context_token 协议细节（字段名、存储、失效时间） | `add-wechat` SKILL.md | Stage 1 retrospective §5 T14/T15 |
| Telegram withRetry 全错误重试的具体 30s 时长 | `add-telegram` SKILL.md | Step 3 baseline 卡 #2 附加症状 |
| 各 channel credentials 获取流程（BotFather /newbot、OAuth2、企业 Bot 审批） | 各 `add-*` SKILL.md | — |
| Channel-specific token 格式校验（Telegram `<数字>:<字符串>`、iLink app_id/secret） | 各 `add-*` SKILL.md | — |
| 非 channel wiring 的工作流问题（spec-kit HARD-GATE、subagent 进程数）| `superpowers:*` skills | SKILL.md F1–F4 |

---

## 功能要求（FR）

### FR-1 · SKILL.md 三戒律自动可验证

description 字段和 skill 整体必须满足以下三戒律，每条均可 bash 机械验证：

| 戒律 | 要求 | 验证命令 |
|------|------|---------|
| Use-when 句式 | description 必须以 `Use when` 开头 | `grep -c "^description: Use when" SKILL.md` = 1 |
| 第三人称 | description 不含 `you`/`your`（大小写无关） | `grep -iP "^description:.*\byou\b" SKILL.md` 输出空 |
| 字符限制 | description ≤ 500 字符 | description 行 `wc -c` ≤ 500 |
| 词数限制 | skill 整体 ≤ 500 词 | `wc -w SKILL.md` ≤ 500（不含 frontmatter）|

**验收**：4 条 bash 检查全部 pass（return 0 / 空输出）。

### FR-2 · Recognition Scenarios 覆盖 7 条通用症状

skill 正文必须包含"症状 → 诊断 → 修复段" mapping，覆盖 A堆全部 7 条失败模式：

| RC | 症状（引自真实 log 或操作结果） | 对应 A堆坑 | 修复动作 |
|----|-------------------------------|-----------|---------|
| RC-01 | `src/channels/<channel>.ts` 不存在，但 `.claude/skills/add-<channel>/SKILL.md` 在 | A1 pre-flight 状态语义 | `git show origin/channels:src/channels/<channel>.ts > ...` |
| RC-02 | `pnpm run build` 报 TS2322，pnpm list 同时有 `chat@4.26.0` 和 `chat@4.27.0` | A2/T1 SDK peer dep | pin `chat` 到与 adapter 一致的精确版本，重新 `pnpm install` |
| RC-03 | adapter 启动 log 出现 `attempt 1 (1s delay), attempt 2 (2s delay)...`，服务"挂住" | A3/T2 withRetry 误判 | 看 retry 原因：若是 ResourceNotFoundError 说明凭据无效；检查 credentials，不要重启 |
| RC-04 | log 有 inbound，但 `messaging_groups` 表 0 行，wire-dm.ts 报 "No unwired groups" | A4 messaging_group 手动 wire | 手动 INSERT 3 张表（messaging_groups / mga / agent_destinations），参见段 4 情况 B |
| RC-05 | 重启后 outbound 有消息但报 `deliver failed · "No context_token for user"` 或等价 | A5 push credential 失效 | 让用户主动从该 channel 给 bot 发一条消息，刷新 push 凭据 |
| RC-06 | outbound.db 有 channel 消息行，但手机没收到 | A6 平台层回执误判 | `grep "Message delivered.*platformMsgId" logs/nanoclaw.log` 确认是否有真推 log |
| RC-07 | 按 add-* SKILL.md 步骤完成，log 没出现 "Channel adapter started · channel=<x>" | A7 凭据前置依赖 | 确认 `.env` 有真实 credentials（非 placeholder）；无 credentials 时 adapter factory 静默返回 null |

### FR-3 · CSO 关键词覆盖

description 字段必须包含以下关键词，确保 Claude Code skill 搜索可命中：

| 必须包含 | 验证方式 |
|---------|---------|
| `channel` 或 `messaging channel` | `grep -i "channel" <description_line>` |
| `wire` 或 `routing` 或 `messaging_group` | `grep -iE "wire\|routing\|messaging_group" <description_line>` |
| `adapter` | `grep -i "adapter" <description_line>` |
| `token` 或 `auth` 或 `credentials` | `grep -iE "token\|auth\|credentials" <description_line>` |
| `pitfall` 或 `failure` 或 `troubleshoot` | `grep -iE "pitfall\|failure\|troubleshoot" <description_line>` |

### FR-4 · Common Mistakes 段（预防 loophole）

skill 必须包含 `## Common Mistakes`（或等价标题），至少 4 条 loophole counter：

| CM | 错误做法（loophole） | 正确做法 |
|----|---------------------|---------|
| CM-01 | `.claude/skills/add-<channel>/SKILL.md` 存在就认为 adapter 模块已装 | 必须检查 `src/channels/<channel>.ts` 是否真实存在；skill ≠ 模块 |
| CM-02 | `pnpm install <adapter>` 成功就认为依赖对齐 | 必须 `pnpm list chat` 确认只有一个 chat 版本；版本分裂会让 TypeScript 静默失败 |
| CM-03 | outbound.db 有消息行就认为推送成功 | 真推证据是 `Message delivered ... platformMsgId=...`；outbound.db 只是待发队列 |
| CM-04 | retry log 出现就认为是网络问题，重启服务 | 先看 retry 错误类型；若是 ResourceNotFoundError / InvalidCredentials → 凭据问题，重启无效 |
| CM-05 | operator 本人给 bot 发消息期望自动建 messaging_group | operator DM 被 NanoClaw 识别为"bot 自聊"→ 不自动建组；必须手动 SQL INSERT 3 张表 |

*Step 11 REFACTOR 阶段基于 GREEN 实跑再补 loophole。*

### FR-5 · 配套 sanity-check.sh 扩展

现有 `sanity-check.sh` 覆盖 6 段链路。Step 10 GREEN 阶段需验证脚本已新增以下 3 项检查：

| 新增检查项 | 对应 A堆 | 检测方式 | 期望结果 |
|-----------|---------|---------|---------|
| SDK peer dep 版本一致性 | T1/A2 | `pnpm list chat --depth=0` | 只有 1 个 chat 版本 |
| credentials 存在性（非 placeholder） | T2/A7 | `grep -iP "^${CHANNEL}_.*TOKEN\s*=\s*(?!placeholder)" .env` | 有真实 credentials |
| pre-flight 文件完整性 | S1/T3/A1 | `src/channels/<channel>.ts` 存在 + `src/channels/index.ts` 含对应 import | 两项均 ✅ |

---

## 非功能要求（NFR）

### NFR-1 · 复用性

- skill 正文不得 hardcode 任何 channel 名（wechat / telegram / feishu / discord 等）作为固定步骤指令
- 所有命令模板使用 `<channel>` 或 `${CHANNEL}` 占位符
- sanity-check.sh 必须接受 channel 参数，对任何 channel 均可运行

**验收**：`grep -iE "^[^#].*\b(wechat|telegram|feishu|discord)\b" SKILL.md` 只允许在对比表和注释中出现，不得在步骤指令正文中出现。

### NFR-2 · 测试可验证

每条 FR 必须有机械化验证方式，不留"看起来对就行"的灰色标准：

| FR | 验证命令 |
|----|---------|
| FR-1 三戒律 | 4 条 bash/grep 全 pass |
| FR-2 scenarios ≥ 7 | 枚举清单，RC-01 到 RC-07 每条有对应 skill 段落 |
| FR-3 CSO 关键词 | 5 类 grep 全命中 |
| FR-4 Common Mistakes ≥ 4 | `grep -c "^| CM-" SKILL.md` ≥ 4 |
| FR-5 sanity-check.sh | `bash sanity-check.sh telegram` 6 段 + 3 新检查项全跑，无 ERR 退出 |

---

## 测试方案

RED 已完成（Step 3 baseline-failures.md：3 个新坑的真实记录）。

**GREEN（Step 10）**：skill 更新后，派 fresh sub-agent 重跑同一 Telegram 装机场景（不提前告知坑），量化对比：
- 卡 #1（chat peer dep）→ FR-2 RC-02 + FR-5 新增检查是否防住
- 卡 #2（withRetry 假挂住）→ FR-2 RC-03 是否提供正确诊断路径
- 卡 #3（pre-flight 部分安装）→ FR-2 RC-01/RC-07 + FR-4 CM-01 是否消除混淆

成功标准：fresh sub-agent 不再卡 3 个已知坑中的任何一个。

**REFACTOR（Step 11）**：
- 发现 sub-agent 绕过 skill 建议的 loophole → 写入 FR-4 CM-6, CM-7...
- 检查 skill 词数是否超 NFR-1 限制，裁剪冗余

---

## 验收标准（Step 12 finish branch 前必须全过）

- [ ] 三戒律 bash check 全 pass（Use-when 句式 + 第三人称 + ≤500 字符 + skill ≤500 词）
- [ ] Recognition scenarios ≥ 7 条（RC-01 到 RC-07 全部有对应 skill 段落）
- [ ] CSO 关键词 5 类 grep 全命中
- [ ] Common Mistakes ≥ 4 条（CM-01 到 CM-04 最少）
- [ ] sanity-check.sh 6 段 + 3 新检查项全跑，无 ERR 退出
- [ ] skill 正文无 hardcode channel 名
- [ ] Out of Scope 边界明示（ANTHROPIC_BASE_URL / iLink / Telegram withRetry 细节各归属 add-* skill）
- [ ] GREEN 实跑：baseline 3 个新坑全部被 skill 覆盖，各标注"被 FR-2 哪条防住"

---

## 关联产物

| 文件 | 用途 |
|------|------|
| `specs/lessons-learned/brainstorming.md` | Step 2 探查：writing-skills 元方法 + NanoClaw hook 兼容性 |
| `specs/wire-nanoclaw-channel-skill/baseline-failures.md` | Step 3 RED：Telegram 实跑真踩 3 个新坑（原始凭据） |
| `.claude/skills/wire-nanoclaw-channel/SKILL.md` | 当前 skill 实现（GREEN 阶段修改目标） |
| `.claude/skills/wire-nanoclaw-channel/sanity-check.sh` | 当前自检脚本（FR-5 扩展目标） |
| `specs/daily-news-agent/retrospective.md` §4–§5 | Stage 1 六坑原始凭据 |

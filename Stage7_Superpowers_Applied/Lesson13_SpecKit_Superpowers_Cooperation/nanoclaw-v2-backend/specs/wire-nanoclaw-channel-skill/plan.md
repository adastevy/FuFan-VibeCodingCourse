# Plan · wire-nanoclaw-channel skill 重构

## 实现策略

选**路径 B：增量重构**。现有 SKILL.md 的 6 段链路框架（段 1-6）和 F7/F8/F9 三个失败模式是经过 Stage 1 真跑验证的正确内容，从零重写会丢失这部分沉淀。增量重构的工作是：删掉不属于 channel-agnostic 的 F1-F6，用 <channel> 占位符替换 hardcode，在 RC 节补 RC-01/02/03/07 三件套，新增 Common Mistakes 和 Out of Scope 节，最后用 sanity-check.sh 扩展收尾。

---

## T01 产出·现有段落基线清单（已读 SKILL.md + sanity-check.sh）

### SKILL.md 段落列表（共 14 段）

| # | 段落标题 | 行数区间 | 类型 |
|---|---------|---------|------|
| 1 | frontmatter description | 1–3 | 需改写 |
| 2 | 整体链路 6 段闭环（框架图） | 18–34 | 保留·去 hardcode |
| 3 | 段1 Pre-flight Checklist | 38–81 | 保留核心·删 OneCLI secret 子节·删 stale container 节 |
| 4 | 段2 装 channel adapter（6 步） | 85–125 | 保留·去 hardcode |
| 5 | 段3 Channel 认证 | 128–155 | 保留·去 wechat/feishu 特有表格 |
| 6 | 段4 Wire Routing（情况 A/B/C） | 158–222 | 保留核心 SQL 模板·去 iLink/WeChat 上下文 |
| 7 | 段5 Context Token / Push 凭据 | 225–249 | 保留抽象层·删 iLink 协议细节 |
| 8 | 段6 真推验证 | 252–280 | 保留（F9 对应 RC-06） |
| 9 | F1 brainstorming HARD-GATE deadlock | 286–290 | **删除**（superpowers 问题） |
| 10 | F2 sub-agent 凭语义猜路径 | 292–296 | **删除**（superpowers 问题） |
| 11 | F3 15 subagent 进程开销 | 298–302 | **删除**（superpowers 问题） |
| 12 | F4 review 找出 3 类 blocker | 303–309 | **删除**（superpowers 问题） |
| 13 | F5 worktree merge 后忘 pnpm install | 311–316 | **删除**（finishing-a-development-branch 问题） |
| 14 | F6 OneCLI 网关 + ANTHROPIC_BASE_URL | 318–340 | **删除**（Out of Scope·归 setup/init-onecli） |
| 15 | F7 operator 本人不自动建 messaging_group | 342–348 | 保留→ RC-04 |
| 16 | F8 iLink context_token 失效 | 350–358 | 保留抽象层→ RC-05·删 iLink 细节 |
| 17 | F9 outbound DB ≠ 真推 | 360–366 | 保留→ RC-06 |
| 18 | 一键自检脚本（SKILL.md 内 inline 版） | 370–409 | **删除**（已有 sanity-check.sh，不重复） |
| 19 | 关联资料 | 412–419 | **删除**（Stage 1 特有引用·不 channel-agnostic） |

### sanity-check.sh 现有 6 段基线

| 段 | 检查内容 | 行号区间 |
|---|---------|---------|
| 段1 | .env 关键字段（CHANNEL_ENABLED / ONECLI_URL / ONECLI_API_KEY / ANTHROPIC_BASE_URL）+ OneCLI HTTP 200 | 19–28 |
| 段2 | `Channel adapter started.*type="<CHANNEL>"` log 存在 | 31–36 |
| 段3 | `<CHANNEL>.*(adapter ready\|login complete\|resumed)` log 存在 | 39–45 |
| 段4 | `messaging_groups JOIN messaging_group_agents WHERE channel_type=<CHANNEL>` COUNT > 0 | 48–55 |
| 段5 | `<CHANNEL> inbound` 最近 log（context_token 是否新鲜） | 58–67 |
| 段6 | `Message delivered.*platformMsgId` 存在 + 无 `deliver failed` | 70–86 |

---

## SKILL.md 改造清单

### 删除（不属于 channel-agnostic）

| 段落 | 删除理由 | 归属 |
|------|---------|------|
| F1 brainstorming HARD-GATE deadlock | sub-agent 工作流问题，不是 channel wiring | `superpowers:brainstorming` |
| F2 sub-agent 凭语义猜路径 | sub-agent 调度问题 | `superpowers:*` |
| F3 15 subagent 进程开销 | sub-agent 进程管理 | `superpowers:dispatching-parallel-agents` |
| F4 review 找出 3 类 blocker | review 方法论 | `superpowers:requesting-code-review` |
| F5 worktree merge 后忘 pnpm install | 分支管理问题 | `superpowers:finishing-a-development-branch` |
| F6 ANTHROPIC_BASE_URL / OneCLI hostPattern | LLM 网关基础设施（spec Out of Scope S2/B堆）| `setup` / `init-onecli` |
| 段1.2 OneCLI secret 配置子节 | 同 F6 原因 | `setup` / `init-onecli` |
| 段1.4 stale container check | 非 channel wiring，属基础运维 | `debug` skill |
| 段3 wechat/feishu 特有认证表格 | channel-specific 细节 | `add-wechat` / `add-feishu` |
| F8 iLink context_token 协议细节（字段名/存储/失效时间）| iLink 协议特有（spec Out of Scope S4/B堆）| `add-wechat` |
| 一键自检脚本（SKILL.md inline 版）| sanity-check.sh 是权威来源，不重复 | 保留在 sanity-check.sh |
| 关联资料段 | Stage 1 特有引用，不适合 channel-agnostic skill | — |

**删除计数：F1-F6 共 6 个 failure mode 段落 + 3 个子节 + inline 脚本 + 关联资料 = 约 200 行**

### 保留（channel-agnostic 已覆盖）

| 当前段落 | 对应 spec | 保留后新 ID | 是否需 polish |
|---------|----------|-----------|-------------|
| 整体链路 6 段闭环框架图 | FR-2 骨架 | 框架图保留 | 是·去 hardcode channel 名 |
| 段2 装 channel adapter 6 步 | FR-2 RC-01/RC-07 | 保留核心流程 | 是·去 hardcode·改为 `<channel>` |
| 段4 Wire Routing 情况 A/B/C + SQL 模板 | FR-2 RC-04 / spec S3/A4 | RC-04 | 是·去 WeChat/iLink 上下文·保留 SQL 模板 |
| 段5 "先收后推"原则 (抽象层) | FR-2 RC-05 / spec S6/A5 | RC-05 | 是·删 iLink 细节·只留通用原则 |
| 段6 真推三件套核对 | FR-2 RC-06 / spec S5/A6 | RC-06 | 是·`<channel>` 占位 |
| F7 operator 不自动建 messaging_group | FR-2 RC-04 | RC-04 | 合并进段4 改造版 |
| F9 outbound DB ≠ 真推 | FR-2 RC-06 / spec S5/A6 | RC-06 | 合并进段6 改造版 |

**保留计数：3 个核心 RC（RC-04 / RC-05 / RC-06）+ 框架图 + 6 步安装流程骨架**

### 新增（spec 要求但当前缺）

| 新段落 | 对应 spec | 来源 |
|--------|----------|------|
| RC-01 pre-flight 文件完整性 | FR-2 RC-01 / spec S1+T3/A1 | baseline 卡 #3 |
| RC-02 SDK peer dep 版本分裂 | FR-2 RC-02 / spec T1/A2 | baseline 卡 #1 |
| RC-03 withRetry 假挂住误判 | FR-2 RC-03 / spec T2/A3 | baseline 卡 #2 |
| RC-07 credentials 前置依赖 | FR-2 RC-07 / spec S1+T2/A7 | baseline 卡 #2 |
| Common Mistakes 节（CM-01 至 CM-05） | FR-4 | spec FR-4 |
| Out of Scope 节（明示边界） | spec Out of Scope 表 | clarifications Q2 |

**新增计数：4 个新 RC + Common Mistakes 节 + Out of Scope 节**

### 修改（结构调整）

- **description 重写**：改为 `Use when` 句式，去掉 `you/your`，覆盖 CSO 关键词（channel, wire, adapter, token/credentials, failure/pitfall），≤500 字符，不提 Stage 1 / daily-news-agent
- **全文 `<channel>` 占位化**：所有 hardcode channel 名（wechat / feishu / discord / telegram）替换为 `<channel>` 或 `${CHANNEL}`，仅 Out of Scope 表格和注释行豁免（per Q2 方案 B）
- **CM-03 / CM-04 改为 reference 形式**：CM-03 → "见 RC-06 三件套验证"；CM-04 → "见 RC-03 retry 诊断"（per Q5 方案 B）
- **每个 RC 段补三件套**：症状关键词 + 至少 1 条诊断命令 + 至少 1 条修复命令（per Q1 方案 B）

---

## sanity-check.sh 扩展清单

### 现有 6 段基线（保持不变，只做 hardcode 修复）

现有脚本第 20 行已有大小写转换逻辑（`tr a-z A-Z`），但格式为老式写法。重构时统一到脚本头部。

### 大小写转换实现（加到脚本第 10 行）

```bash
CHANNEL_LOW=$(echo "$1" | tr '[:upper:]' '[:lower:]')
CHANNEL_UP=$(echo "$1" | tr '[:lower:]' '[:upper:]')
```

后续所有段落用 `$CHANNEL_LOW` 做 log grep（log 里用小写），用 `$CHANNEL_UP` 做 `.env` grep（env var 用大写）。

### 新增 3 段（加在 6 段之后）

| 检查项 | 对应 spec | 命令 | 期望结果 |
|-------|---------|------|---------|
| SDK peer dep 版本一致性 | T1/A2/FR-5 | `pnpm list chat --depth=0 2>/dev/null \| grep -c " chat "` | 输出为 1（只有 1 个版本） |
| credentials 存在性（非 placeholder） | T2/A7/FR-5 | `grep -iP "^${CHANNEL_UP}[_A-Z]*(?:TOKEN\|KEY\|SECRET)\\s*=\\s*(?!placeholder\|your_)" .env` | 有匹配行（非 placeholder） |
| pre-flight 文件完整性（模块存在 + import 注册） | S1/T3/A1/FR-5 | `[ -f "src/channels/${CHANNEL_LOW}.ts" ]` 且 `grep -q "import.*${CHANNEL_LOW}" src/channels/index.ts` | 两项均 ✅ |

---

## 词数预算（500 词硬约束）

| 段落 | 预估词数 |
|------|---------|
| frontmatter description（不计入正文词数）| — |
| Use when 段（2-3 行） | ~25 |
| 整体链路 6 段框架图（精简版） | ~35 |
| RC-01（三件套·紧凑 3 行）| ~22 |
| RC-02（三件套·紧凑 3 行）| ~22 |
| RC-03（三件套·紧凑 3 行）| ~22 |
| RC-04（三件套 + SQL 模板注释）| ~30 |
| RC-05（三件套·通用先收后推原则）| ~22 |
| RC-06（三件套·三件套验证）| ~22 |
| RC-07（三件套·credentials 前置）| ~22 |
| Common Mistakes（CM-01 到 CM-05·CM-03/04 只 reference）| ~55 |
| Out of Scope（4 条·reference 形式）| ~40 |
| sanity-check.sh 调用示例（1 行命令 + 1 行说明）| ~20 |
| **合计** | **~337**（留 163 buffer） |

---

## 任务拆分（给 Step 7 /speckit.tasks 用）

| Task ID | 内容 | 依赖 |
|---------|------|------|
| T01 | ✅ 读取当前 SKILL.md + sanity-check.sh，确认"现有 6 段基线"清单（本文档已完成）| — |
| T02 | 重写 frontmatter description：Use when 句式·去 you/your·CSO 关键词全覆盖·≤500 字符 | T01 |
| T03 | 重写 Use when 段 + 6 段框架图（去 hardcode，`<channel>` 占位，去 Stage 1 引用）| T01 |
| T04 | 新增 RC-01 / RC-02 / RC-03 / RC-07 三件套（症状关键词 + 诊断命令 + 修复命令）| T01 |
| T05 | 改写 RC-04（F7 → 通用 SQL 模板·去 WeChat 上下文）· RC-05（F8 → 通用先收后推·删 iLink 细节）· RC-06（F9 → 三件套验证）| T01 T04 |
| T06 | 新增 Common Mistakes 节（CM-01 至 CM-05，CM-03/04 仅 reference RC-06/RC-03）| T04 T05 |
| T07 | 新增 Out of Scope 节（明示 ANTHROPIC_BASE_URL / iLink / Telegram withRetry 细节 / F1-F4 各归属 skill）| T01 |
| T08 | 合并上述改动·输出最终 SKILL.md·删除 F1-F6 + inline 脚本 + 关联资料 | T02 T03 T04 T05 T06 T07 |
| T09 | 扩展 sanity-check.sh：加脚本头部大小写转换 + 新增 3 段检查（peer dep / credentials / pre-flight 文件）| T01 |
| T10 | 自检：三戒律 bash check（Use-when / 第三人称 / ≤500 字符 / ≤500 词）+ hardcode grep（functional code path）+ sanity-check.sh dry-run 语法检查 | T08 T09 |
| T11 | 回写 spec.md FR-5 "现有 6 段基线"子表（Q7/A 方案 A）| T01 |

---

## 风险与对策

| 风险 | 触发条件 | 对策 |
|------|---------|------|
| RC 三件套展开后 500 词超限 | 7 条 RC × 诊断 + 修复各一行 = ~45 行 | 用 inline 紧凑格式（症状/诊断/修复各 1 行）；SQL 模板保留但不加注释行 |
| 三戒律 grep 验证失败（description 含 you/your）| description 重写时口语化 | T10 中用 `grep -iP "^description:.*\\byou\\b" SKILL.md` 预检，失败立刻修改 |
| hardcode grep 误报（Out of Scope 表格含 channel 名）| 验收命令 `grep -nE "^[^#].*\b(wechat|telegram)\b"` | Out of Scope 节用 HTML 注释 `<!--wechat-->` 标注豁免行；或将表格行以 `> ` 引用块格式写（不触发 ^[^#] 规则） |
| sanity-check.sh credentials 检查误判 | `.env` 里有 `TELEGRAM_BOT_TOKEN=placeholder` | grep pattern 用 `(?!placeholder\|your_\|REPLACE_ME)` negative lookahead；T10 用 shellcheck 验证 |
| GREEN sub-agent 仍卡 T1（RC-02 提示不够锐利）| SKILL.md 诊断命令用了 `pnpm list` 但未指定 `--depth=0` | RC-02 诊断命令明确写 `pnpm list chat --depth=0`；sanity-check.sh 新增段输出 chat 版本数量 |

---

## 验收（与 spec 验收标准对应）

- [ ] 三戒律 bash check 全 pass（Use-when 句式 + 第三人称 + ≤500 字符 + skill ≤500 词）
- [ ] Recognition scenarios ≥ 7 条（RC-01 到 RC-07 的症状关键词每条均可在 SKILL.md 里 grep 命中，且命中处包含修复指引）
- [ ] CSO 关键词 5 类 grep 全命中（channel / wire · routing · messaging_group / adapter / token · auth · credentials / pitfall · failure · troubleshoot）
- [ ] Common Mistakes ≥ 4 条（CM-01 到 CM-04 最少；CM-03/CM-04 以 reference 形式计入）
- [ ] sanity-check.sh 6 段 + 3 新检查项全跑，无 ERR 退出
- [ ] skill 正文无 hardcode channel 名（`grep -nE "^[^#].*\b(wechat|telegram|discord|feishu)\b" SKILL.md` 无输出）
- [ ] Out of Scope 边界明示（ANTHROPIC_BASE_URL / iLink / Telegram withRetry 细节各归属 add-* skill）
- [ ] GREEN 实跑：baseline 3 个新坑全部被 skill 覆盖，各标注"被 FR-2 哪条防住"

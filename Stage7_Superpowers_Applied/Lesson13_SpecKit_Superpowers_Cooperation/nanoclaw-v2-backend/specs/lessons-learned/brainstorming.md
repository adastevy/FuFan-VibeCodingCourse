# Stage 2 Lessons-Learned 三件套 · Brainstorming

## 0. 探查结论（事实依据）

### 0.1 writing-skills 元方法核心摘要

**来源**：`~/.claude/plugins/cache/superpowers-dev/superpowers/5.1.0/skills/writing-skills/SKILL.md`

#### description 三戒律（CSO 节）

1. **"Use when..." 起头**：description 必须以 "Use when..." 开头，聚焦触发条件
2. **第三人称**：description 以第三人称写（因为它会被注入系统 prompt）
3. **绝不总结 workflow**："NEVER summarize the skill's process or workflow" — 原文示例警告：当 description 包含工作流摘要时，Claude 会抄近路（follow description instead of reading full skill content），skill body 就成了死代码

#### 4 分类（实际只有 3 种 skill 类型 + 1 种测试分类）

| 类型 | 定义 | 测试方法 |
|------|------|---------|
| **Technique** | 有具体步骤的方法（condition-based-waiting） | Application + Variation scenarios |
| **Pattern** | 思考问题的方式（flatten-with-flags） | **Recognition scenarios** + Application + Counter-examples |
| **Reference** | API 文档/命令参考 | Retrieval + Application scenarios |
| Discipline（测试分类）| 规则/纪律执行 | Pressure scenarios（非 skill 类型，是测试策略） |

> ⚠️ 任务说"4 种分类"·原文只有 3 种 skill 类型。"Discipline" 是测试策略（Discipline-Enforcing Skills），不是 skill 的第 4 种类型。

#### Pattern 类 recognition scenarios 判定标准

原文（Testing All Skill Types → Pattern Skills 节）：
> **Test with:** Recognition scenarios: Do they recognize when pattern applies? Application scenarios: Can they use the mental model? Counter-examples: Do they know when NOT to apply?
> **Success criteria:** Agent correctly identifies when/how to apply pattern

Recognition scenario 是：给出一个情境 → 测试 agent 能否认出"这里该用这个 pattern"。

#### Iron Law 原文

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

> This applies to NEW skills AND EDITS to existing skills.
> Write skill before testing? Delete it. Start over.

---

### 0.2 NanoClaw hook 机制兼容性（关键发现）

**探查路径**：`src/container-runner.ts`、`src/router.ts`、`.claude/settings.json`

#### 现有 .claude/settings.json

```json
{"sandbox": {"enabled": false}}
```

**无任何 hook 注册**。`.claude/hooks/` 目录不存在。

#### NanoClaw 容器内 Agent 是否支持 Claude Code hooks？

**结论：容器内 Agent 的正常运行路径不触发 Claude Code hooks。**

理由链：
1. `container-runner.ts` ~301 行注释明确：entrypoint 是 `exec bun ...`，主进程是 **Bun agent-runner**
2. agent-runner 通过 Anthropic SDK 直接调 Claude API，**不经过** Claude Code CLI
3. Claude Code hooks（Stop/SessionStart/PreToolUse/PostToolUse）是 Claude Code CLI 的功能，SDK 调用不会触发它们
4. 虽然容器内 claude-code CLI 已安装（CLAUDE.md 提到作为可调用工具），但它不是 agent-runner 的主路径

**例外**：如果 agent-runner 显式调用 `claude` CLI 子进程（如某些 agent 用 claude-code 执行子任务），那些子进程 *内部* 的 Claude Code hooks 会触发。但 daily-news Agent 的标准操作不包含这个路径。

#### 可行的 hook 挂载点

| 挂载点 | 可行性 | 说明 |
|--------|--------|------|
| 宿主 Claude Code 开发者 session 的 Stop/SessionStart | **✅ 完全可行** | 开发者在 Claude Code 里工作时触发 |
| 容器内 `/home/node/.claude/settings.json` | **⚠️ 有条件** | 仅当容器内显式调用 claude CLI 时触发 |
| NanoClaw host-sweep / container-runner 生命周期 | **✅ 可行（需改代码）** | container start/stop 事件·但需修改 host 代码 |

**MVP 选择**：hooks 安装在**宿主 Claude Code 开发者 session**（`.claude/settings.json`），用于开发工作流的 lessons capture。这是零成本且立即可用的路径。

---

### 0.3 Stage 1 已有 skills / hooks（避免冲突）

#### 已有 skills 目录（完整）

```
.claude/skills/
├── wire-nanoclaw-channel/        ← Stage 1 产物·含 sanity-check.sh
├── add-discord/ add-slack/ add-telegram/ ... (channel 系列)
├── add-github/ add-linear/ add-resend/ ...
├── speckit-*/                    ← spec 工作流系列
├── claw/ debug/ customize/ setup/ manage-channels/
├── update-nanoclaw/ update-skills/
├── x-integration/                ← 含多个 agent.ts/host.ts 脚本
└── ... (共 ~50 个 skills)
```

#### 已有 hooks

**无**。`.claude/hooks/` 不存在，`settings.json` 只有 `sandbox.enabled=false`。

#### 已有 container skills

```
container/skills/
├── agent-browser/
├── frontend-engineer/
├── self-customize/
├── slack-formatting/
├── vercel-cli/
└── welcome/
```

#### 命名冲突风险

- 新 skill 命名 `lessons-learned` → **无冲突**
- 新 hook 脚本 `lessons-capture-stop.sh`、`lessons-inject-sessionstart.sh` → **无冲突**
- memory 文件 `.claude/memory/lessons-daily-news.md` → `.claude/memory/` 不存在，需新建

---

## 1. SKILL.md description 选定

**选 A**（九天偏好）：

```yaml
description: Use when a session ends with failures or when discovering reusable insights
```

**理由**：

- **覆盖范围**：涵盖 Scenario A（HN 503 错误·blocked）、Scenario B（重复 timeout·隐性 pattern）、Scenario C（用户明示·主动触发）全部三个 RED baseline 触发条件
- **选 B 的问题**："Use when Claude makes a mistake that could have been prevented by prior knowledge" 语义过严。Scenario C（用户明示"记住下次别 Y"）不一定满足"prior knowledge could have prevented"的逻辑前提
- **三戒律合规检查**：
  - ✅ "Use when..." 开头
  - ✅ 第三人称（无"I"/"we"）
  - ✅ 未总结 workflow（只描述触发条件，没有"然后写 memory table"等流程）

---

## 2. 3 个 Recognition Scenarios 详细设计

### Scenario A：HN API 503 错误（Blocked 触发）

**情境描述**：
Agent 在抓取 Hacker News 头条时收到 HTTP 503 Service Unavailable，重试两次后放弃，直接向用户汇报"抓取失败"。

**期望"未装 skill 时"的失败行为**：
- Agent 只报告错误，不记录任何 lesson
- 下次同样情境仍然盲目直接请求，不 health check
- 没有任何"这是个可复用 lesson"的意识

**期望"装上 skill 后"的合规行为**：
- Agent 识别出"外部 API 阻塞性失败"= recognition scenario A 的触发点
- 主动 trigger lessons-capture：写入 memory table `{ trigger: blocked, lesson: "HN API 503 → 先 health check" }`
- 下次 SessionStart 时，该 lesson 被注入 context，Agent 在开始抓取前先 health check

**Recognition 关键词**：`HTTP 5xx`、`API unavailable`、`blocked`、重试失败

---

### Scenario B：重复犯错（隐性 pattern 触发）

**情境描述**：
本周第二次遭遇 RSS feed timeout（上次是昨天），Agent 没有关联这两次事件。

**期望"未装 skill 时"的失败行为**：
- Agent 处理每次 timeout 都是"独立事件"
- 无法识别"这是 repeated failure pattern"
- 不主动 surface lesson

**期望"装上 skill 后"的合规行为**：
- Agent 识别出 memory table 中已存在相同 trigger 类型的条目（RSS timeout）
- 识别为 Scenario B：重复 pattern = insight 值更高
- 更新 memory table 的 `used_count`，强化 lesson（"RSS feed timeout → 改用备用源"）

**Recognition 关键词**：second time、repeated、again、same error as before

---

### Scenario C：用户明示（主动触发）

**情境描述**：
用户在对话中说："记住，下次别直接用第一个搜索结果，要比较 top 3"。

**期望"未装 skill 时"的失败行为**：
- Agent 回复"好的"，但不写任何持久化记录
- 下次 session 这条指令消失，Agent 重蹈覆辙

**期望"装上 skill 后"的合规行为**：
- Agent 识别出用户明示 = Scenario C 触发点（关键词："记住"、"下次"、"别"、"always"、"never again"）
- 立即 trigger lessons-capture，写入 `{ trigger: user-explicit, lesson: "比较 top 3 搜索结果再使用" }`
- 向用户确认：「已记录，下次 session 会注入这条指示」

**Recognition 关键词**：记住、下次、don't、remember、always、never again、用户明示

---

## 3. 跨 Session 状态保持设计

### Memory 文件路径

```
.claude/memory/lessons-daily-news.md
```

（`.claude/memory/` 目录需新建）

### Memory 文件格式

```markdown
# Daily News Agent · Lessons Learned

| date | trigger | lesson_text | used_count | last_used |
|------|---------|-------------|-----------|-----------|
| 2026-05-12 | blocked | HN API 503 → 先 health check 再抓取 | 0 | — |
| 2026-05-11 | repeated | RSS feed timeout → 改用备用源 feedburner | 1 | 2026-05-12 |
| 2026-05-10 | user-explicit | 比较 top 3 搜索结果再选用 | 2 | 2026-05-12 |
```

**格式选型理由**：
- Markdown table：人工 review 友好（`git diff` 可读）
- pipe-separated：`awk -F'|'` 可直接处理，bash 脚本零依赖
- 无 JSON/YAML 嵌套：避免复杂解析

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | `YYYY-MM-DD` | lesson 首次写入日期 |
| `trigger` | enum | `blocked` / `repeated` / `user-explicit` |
| `lesson_text` | string | 一句话·动词开头·可操作 |
| `used_count` | int | 被 SessionStart 注入次数（活跃度指标） |
| `last_used` | `YYYY-MM-DD` \| `—` | 最后一次被注入的日期 |

### 7 天 active 定义

**`last_used` 在 7 天内**（而非 `date` 创建时间）。

**理由**：
- 保留"活跃使用中的 lesson"（上周写入·但昨天刚用过的 → 保留）
- 自然淡出"只写未用的 lesson"（写入超 7 天且从未被使用 → 不注入）
- 未用过的新 lesson（`last_used = —`）：按创建日期计算，`date` 在 7 天内则视为 active

### SessionStart 注入逻辑（lessons-inject-sessionstart.sh）

```bash
#!/usr/bin/env bash
# 读取 .claude/memory/lessons-daily-news.md
# 过滤 last_used 在 7 天内（或 — 且 date 在 7 天内）的行
# 输出注入 context 的文本块
CUTOFF=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
# awk 过滤 + 格式化为 context prefix
```

### Stop 捕获逻辑（lessons-capture-stop.sh）

```bash
#!/usr/bin/env bash
# 读取 Claude Code Stop hook 的 CLAUDE_TRANSCRIPT 环境变量或 stdin
# 扫描触发词（503/timeout/repeated/用户明示关键词）
# 提取 lesson_text
# Append 到 .claude/memory/lessons-daily-news.md
```

---

## 4. MVP 边界

### 做什么

- ✅ 单 daily-news Agent 自己的 lessons（不跨 Agent）
- ✅ Blocked 错误触发（HTTP 5xx、connection refused、抓取失败）
- ✅ 用户明示触发（"记住"/"下次"/"don't" 等关键词）
- ✅ Markdown table 持久化到 `.claude/memory/lessons-daily-news.md`
- ✅ SessionStart 注入最近 7 天（`last_used` 计算）active lessons
- ✅ Stop hook 写入 `.claude/settings.json`（宿主 Claude Code 开发者 session）
- ✅ Step 13 staged 演示（非真跑一周）

### 不做什么

- ❌ lesson 自动去重（重复 lesson 手动 review）
- ❌ lesson 之间合并/聚合
- ❌ 多 Agent 共享 lessons（每个 Agent 独立 memory 文件）
- ❌ 1 周真跑录像（改为 staged 演示·用户已决定）
- ❌ 容器内 Agent 的 Claude Code hooks（主进程是 Bun SDK，不支持）
- ❌ Repeated pattern 自动识别（Scenario B 需手动触发或未来迭代）

---

## 5. brainstorming → spec 切入点检验

与 Stage 1 daily-news 同模式：**从 3 个 recognition scenarios 出发写 spec**，Scenario A（blocked 触发）为 P0 主线，Scenario C（用户明示）为 P1，Scenario B（repeated）列为 Future。

---

*探查日期：2026-05-12*
*探查来源：writing-skills SKILL.md（Jesse Vincent 原版）、.claude/settings.json、src/container-runner.ts、.claude/skills/ 目录树*

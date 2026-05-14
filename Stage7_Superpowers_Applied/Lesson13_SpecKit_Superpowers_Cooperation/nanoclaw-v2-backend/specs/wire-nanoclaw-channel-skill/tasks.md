# Tasks · wire-nanoclaw-channel skill 重构

**Input**: `specs/wire-nanoclaw-channel-skill/plan.md` + `spec.md`  
**Target files**:
- `.claude/skills/wire-nanoclaw-channel/SKILL.md` （主目标）
- `.claude/skills/wire-nanoclaw-channel/sanity-check.sh` （FR-5 扩展目标）
- `specs/wire-nanoclaw-channel-skill/spec.md` （T11 回写目标）

---

## 任务依赖图

```
T01 (✅ DONE)
├── T02  重写 frontmatter description
├── T03  重写 Use when + 6段框架图
├── T04  新增 RC-01/02/03/07
│   └── T05  改写 RC-04/05/06
│       └── T06  新增 Common Mistakes
├── T07  新增 Out of Scope
├── T09  扩展 sanity-check.sh
└── T11  回写 spec.md 6段基线子表

T02 ──┐
T03 ──┤
T04 ──┤
T05 ──┤──► T08  合并输出最终 SKILL.md ──► T10  全局自检
T06 ──┤
T07 ──┘
T09 ──────────────────────────────────────► T10  全局自检
```

**并行层**（T01 已完成，以下可同时派 sub-agent）：
- **第一并行层**：T02 · T03 · T04 · T07 · T09 · T11（互不依赖，均只依赖 T01）
- **第二串行层**：T05（等 T04）→ T06（等 T04 + T05）
- **第三汇聚层**：T08（等 T02 T03 T04 T05 T06 T07 全部完成）
- **终局**：T10（等 T08 + T09）

---

## 任务详单

### T01 · 读取基线（已完成 · plan.md T01 产出）

- **状态**：✅ DONE（Step 6 已固化）
- **输入**：`.claude/skills/wire-nanoclaw-channel/SKILL.md`（当时 419 行）· `.claude/skills/wire-nanoclaw-channel/sanity-check.sh`
- **输出**：`plan.md` 中的"SKILL.md 段落列表（共 14 段）"表格 + "sanity-check.sh 现有 6 段基线"表格
- **验收**：
  ```bash
  grep -c "^| # | 段落标题" specs/wire-nanoclaw-channel-skill/plan.md   # → 1
  grep -c "^| 段1 |" specs/wire-nanoclaw-channel-skill/plan.md           # → 1
  grep -c "^| 段6 |" specs/wire-nanoclaw-channel-skill/plan.md           # → 1
  ```

---

### T02 · 重写 frontmatter description

- **阶段**：GREEN
- **输入**：`spec.md` FR-1 三戒律表 + FR-3 CSO 关键词清单
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 的 frontmatter `description:` 行
- **具体要求**：
  - 以 `Use when` 开头
  - 不含 `you` / `your`（大小写均不允许）
  - 含全部 5 类 CSO 关键词：channel · wire 或 routing 或 messaging_group · adapter · token 或 auth 或 credentials · pitfall 或 failure 或 troubleshoot
  - 整行字符数 ≤ 500（含 `description: ` 前缀）
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "^description: Use when" "$SKILL"                                   # → 1
  grep -iP "^description:.*\byou\b" "$SKILL"                                  # → 空输出
  awk '/^description:/{print length($0)}' "$SKILL"                             # → ≤ 500
  grep -iP "^description:.*\bchannel\b" "$SKILL"                              # → 1 行
  grep -iP "^description:.*(wire|routing|messaging_group)" "$SKILL"           # → 1 行
  grep -iP "^description:.*\badapter\b" "$SKILL"                              # → 1 行
  grep -iP "^description:.*(token|auth|credentials)" "$SKILL"                 # → 1 行
  grep -iP "^description:.*(pitfall|failure|troubleshoot)" "$SKILL"           # → 1 行
  ```
- **失败 fallback**：若 CSO 关键词放不下（行超 500 字符），删掉 `troubleshoot`（优先级最低）保留 `failure` + `pitfall`；若仍超，删掉 `pitfall` 保留 `failure`
- **预估时长**：10 min

---

### T03 · 重写 Use when 段 + 6 段框架图

- **阶段**：GREEN
- **输入**：`plan.md` 段落清单中"整体链路 6 段闭环（框架图）"（行 18–34）· `spec.md` FR-2 骨架
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 的 Use when 段（≤3 行）+ 框架图（去 hardcode，`<channel>` 占位）
- **具体要求**：
  - 移除所有对 Stage 1 / daily-news-agent 的引用
  - 框架图中所有 channel 名（wechat / feishu / discord / telegram）替换为 `<channel>`
  - Use when 段不超 3 行
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -iE "\b(daily-news-agent|Stage 1)\b" "$SKILL"                           # → 空输出
  grep -iE "^[^#>].*\b(wechat|feishu|discord|telegram)\b" "$SKILL" | grep -v "Out of Scope"  # → 空输出（框架图区段）
  grep -c "Use when" "$SKILL"                                                   # → ≥ 1
  ```
- **失败 fallback**：若 `<channel>` 占位替换后框架图语义不清，在框架图标题行加注 `# 以 <channel> 代替实际 channel 名` 一行注释（不计入正文词数）
- **预估时长**：15 min

---

### T04 · 新增 RC-01 / RC-02 / RC-03 / RC-07 三件套

- **阶段**：GREEN
- **输入**：`spec.md` FR-2 表格中 RC-01 / RC-02 / RC-03 / RC-07 的症状 + 修复动作列
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 中 4 个新 RC 段，每段包含：
  - 症状关键词（1 行）
  - 至少 1 条诊断命令（bash）
  - 至少 1 条修复命令（bash 或操作步骤）
- **具体要求（逐条）**：
  - **RC-01**：症状=`src/channels/<channel>.ts` 不存在但 SKILL.md 存在；修复=`git show origin/channels:src/channels/<channel>.ts > src/channels/<channel>.ts`
  - **RC-02**：症状=`pnpm run build` 报 TS2322 + pnpm list 有两个 chat 版本；诊断=`pnpm list chat --depth=0`；修复=pin chat 到与 adapter 一致精确版本 + `pnpm install`
  - **RC-03**：症状=`attempt 1 (1s delay)` log 出现服务"挂住"；诊断=看 retry 错误类型是否 ResourceNotFoundError；修复=检查 credentials，不重启
  - **RC-07**：症状=按 add-* 步骤完成但无 `Channel adapter started` log；诊断=`grep -i "adapter started\|adapter null" logs/nanoclaw.log`；修复=检查 `.env` credentials 非 placeholder
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "RC-01" "$SKILL"    # → ≥ 1
  grep -c "RC-02" "$SKILL"    # → ≥ 1
  grep -c "RC-03" "$SKILL"    # → ≥ 1
  grep -c "RC-07" "$SKILL"    # → ≥ 1
  grep -c "pnpm list chat" "$SKILL"                    # → ≥ 1
  grep -c "ResourceNotFoundError\|retry" "$SKILL"      # → ≥ 1
  ```
- **失败 fallback**：若 4 个 RC 展开后单个 RC 超过 5 行，合并症状 + 诊断为 1 行（用 `→` 连接），只保留修复命令单独 1 行
- **预估时长**：20 min

---

### T05 · 改写 RC-04 / RC-05 / RC-06

- **阶段**：GREEN
- **依赖**：T04 已完成（RC 编号序列已确定）
- **输入**：`plan.md` 段落清单中 F7（行 342–348）· F8（行 350–358）· F9（行 360–366）· `spec.md` FR-2 RC-04/05/06 行
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 中 RC-04 / RC-05 / RC-06 段（替换原 F7/F8/F9）
- **具体要求**：
  - **RC-04**：保留 3 张表通用 SQL INSERT 模板（messaging_groups / messaging_group_agents / agent_destinations）；删除所有 WeChat / iLink 上下文；F7 内容合并进 RC-04
  - **RC-05**：只保留"先收后推"通用原则；删除 iLink context_token 协议细节（字段名 / 存储 / 失效时间）；F8 内容抽象化后合并进 RC-05
  - **RC-06**：保留"outbound.db 有行 ≠ 真推"+ 三件套验证（log `Message delivered` + `platformMsgId` + 手机确认）；F9 内容合并进 RC-06
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "RC-04" "$SKILL"                                              # → ≥ 1
  grep -c "RC-05" "$SKILL"                                              # → ≥ 1
  grep -c "RC-06" "$SKILL"                                              # → ≥ 1
  grep -c "messaging_groups\|messaging_group_agents\|agent_destinations" "$SKILL"  # → ≥ 3（3 张表均提及）
  grep -iE "^[^#>].*\biLink\b.*context_token" "$SKILL"                 # → 空输出（iLink 协议细节已删）
  grep -c "platformMsgId" "$SKILL"                                      # → ≥ 1
  ```
- **失败 fallback**：若 SQL 模板展开后词数超限（与 T02-T04 合计 > 500 词），将 3 条 INSERT 语句改为内联注释块格式（`<!-- INSERT template: ... -->`，不计入正文词数）
- **预估时长**：20 min

---

### T06 · 新增 Common Mistakes 节

- **阶段**：GREEN
- **依赖**：T04（RC-03 / RC-06 编号已固化）+ T05（RC-06 已写完）
- **输入**：`spec.md` FR-4 表格（CM-01 至 CM-05）
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 中 `## Common Mistakes` 节，含 CM-01 到 CM-05 共 5 条
- **具体要求**：
  - CM-03（outbound.db 误判）：写为 reference 形式 → "见 RC-06 三件套验证"
  - CM-04（retry 重启）：写为 reference 形式 → "见 RC-03 retry 诊断"
  - CM-01 / CM-02 / CM-05：完整写出错误做法 + 正确做法
  - 格式：markdown 表格或 `| CM-XX |` 行，使验收 grep 可命中
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "Common Mistakes" "$SKILL"                  # → ≥ 1
  grep -c "CM-0[1-5]" "$SKILL"                        # → 5（CM-01 到 CM-05 均存在）
  grep -iP "CM-03.*RC-06|RC-06.*CM-03" "$SKILL"       # → ≥ 1（CM-03 reference RC-06）
  grep -iP "CM-04.*RC-03|RC-03.*CM-04" "$SKILL"       # → ≥ 1（CM-04 reference RC-03）
  ```
- **失败 fallback**：若 5 条 CM 展开后词数超 500 总限，将 CM-05（operator DM 不自动建组）改为单行 reference → "见 RC-04 手动 SQL wire"
- **预估时长**：15 min

---

### T07 · 新增 Out of Scope 节

- **阶段**：GREEN
- **输入**：`spec.md` Out of Scope 表格（6 条）· `plan.md` 删除理由列
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 中 `## Out of Scope` 节
- **具体要求**：
  - 明示 ANTHROPIC_BASE_URL → `setup/` 或 `init-onecli`
  - 明示 iLink context_token 细节 → `add-wechat`
  - 明示 Telegram withRetry 30s 时长 → `add-telegram`
  - 明示 F1-F4 各归属的 superpowers skill
  - channel 名（wechat / telegram）在此节中以引用块 `> ` 格式出现（豁免 hardcode grep）
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "Out of Scope" "$SKILL"                                  # → ≥ 1
  grep -iP "ANTHROPIC_BASE_URL" "$SKILL"                           # → ≥ 1
  grep -iP "iLink|context_token" "$SKILL"                          # → ≥ 1（在 Out of Scope 节内）
  grep -iP "add-wechat|add-telegram" "$SKILL"                      # → ≥ 1（归属引用）
  grep -iP "superpowers" "$SKILL"                                  # → ≥ 1（F1-F4 归属）
  ```
- **失败 fallback**：若 Out of Scope 节内的 channel 名（wechat/telegram）被 hardcode grep（T10）误报，将该行格式改为 `> ` 引用块或 HTML 注释 `<!-- wechat -->`
- **预估时长**：10 min

---

### T08 · 合并改动 · 输出最终 SKILL.md

- **阶段**：GREEN（汇聚）
- **依赖**：T02 · T03 · T04 · T05 · T06 · T07 全部完成
- **输入**：T02-T07 各自的输出段落
- **输出**：`.claude/skills/wire-nanoclaw-channel/SKILL.md` 完整最终版，已删除：
  - F1-F6（6 个 failure mode 段落）
  - 段1.2 OneCLI secret 配置子节
  - 段1.4 stale container check
  - 段3 wechat/feishu 特有认证表格
  - F8 iLink 协议细节
  - SKILL.md inline 一键自检脚本（行 370–409）
  - 关联资料段（行 412–419）
- **验收命令**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  grep -c "F1\b\|F2\b\|F3\b\|F4\b\|F5\b\|F6\b" "$SKILL"          # → 0（原 F1-F6 段已删）
  grep -c "brainstorming HARD-GATE\|15 subagent\|worktree merge" "$SKILL"  # → 0
  grep -c "inline.*自检\|一键自检" "$SKILL"                         # → 0
  grep -c "关联资料" "$SKILL"                                       # → 0
  grep -c "stale container" "$SKILL"                               # → 0
  wc -w < "$SKILL"                                                  # → ≤ 500（正文词数）
  ```
- **失败 fallback**：若 `wc -w` 超 500，按优先级裁剪：先去 Out of Scope 节中的多余归属行（保留 ANTHROPIC_BASE_URL + iLink + Telegram withRetry 3 条核心）；再压缩 RC 诊断命令注释行
- **预估时长**：15 min

---

### T09 · 扩展 sanity-check.sh

- **阶段**：GREEN（与 T02-T07 并行）
- **输入**：`plan.md` "sanity-check.sh 扩展清单"节（行 105–127）
- **输出**：`.claude/skills/wire-nanoclaw-channel/sanity-check.sh`，在现有 6 段后新增：
  1. 脚本头部大小写转换（`CHANNEL_LOW` / `CHANNEL_UP` 变量，加在第 10 行附近）
  2. 段7：SDK peer dep 版本一致性检查
  3. 段8：credentials 存在性检查（非 placeholder）
  4. 段9：pre-flight 文件完整性检查
- **验收命令**：
  ```bash
  SH=".claude/skills/wire-nanoclaw-channel/sanity-check.sh"
  bash -n "$SH"                                                                  # → exit 0（语法正确）
  grep -c "CHANNEL_LOW\|CHANNEL_UP" "$SH"                                        # → ≥ 2
  grep -c "pnpm list chat" "$SH"                                                 # → ≥ 1（段7）
  grep -cP "(TOKEN|KEY|SECRET).*=.*(?!placeholder)" "$SH"                       # → ≥ 1（段8 pattern 存在）
  grep -c "src/channels/\${CHANNEL_LOW}" "$SH"                                   # → ≥ 1（段9）
  grep -c "src/channels/index.ts" "$SH"                                          # → ≥ 1（段9 import check）
  ```
- **失败 fallback**：若 credentials negative lookahead PCRE 在 bash `grep -P` 下语法报错，改为两步检查：`grep -i "${CHANNEL_UP}.*TOKEN.*=" .env | grep -iv "placeholder\|your_\|REPLACE_ME"`
- **预估时长**：20 min

---

### T10 · 全局自检

- **阶段**：REFACTOR-pre
- **依赖**：T08（最终 SKILL.md）+ T09（扩展后 sanity-check.sh）
- **输入**：最终 `.claude/skills/wire-nanoclaw-channel/SKILL.md` + `.claude/skills/wire-nanoclaw-channel/sanity-check.sh`
- **输出**：自检报告（每条 FR/NFR 的 grep 结果 + sanity-check.sh dry-run 结果），输出到 stdout；若全部 pass 无需写文件
- **验收命令（8 条，全部必须 pass）**：
  ```bash
  SKILL=".claude/skills/wire-nanoclaw-channel/SKILL.md"
  SH=".claude/skills/wire-nanoclaw-channel/sanity-check.sh"

  # 1. FR-1 三戒律
  grep -c "^description: Use when" "$SKILL"                               # → 1
  grep -iP "^description:.*\byou\b" "$SKILL"                              # → 空输出
  awk '/^description:/{print (length($0) <= 500) ? "OK" : "FAIL"}' "$SKILL"  # → OK
  awk 'NR>3{c+=NF} END{print (c<=500) ? "OK" : "FAIL"}' "$SKILL"        # → OK（正文词数）

  # 2. FR-2 RC 覆盖
  for rc in RC-01 RC-02 RC-03 RC-04 RC-05 RC-06 RC-07; do
    grep -q "$rc" "$SKILL" && echo "$rc OK" || echo "$rc MISSING"
  done                                                                     # → 全部 OK

  # 3. NFR-1 hardcode check（functional path，Out of Scope 引用块豁免）
  grep -nE "^[^#>|].*\b(wechat|telegram|feishu|discord)\b" "$SKILL"      # → 空输出

  # 4. FR-4 Common Mistakes ≥ 4
  [ "$(grep -c "CM-0[1-9]" "$SKILL")" -ge 4 ] && echo "OK" || echo "FAIL"  # → OK

  # 5. sanity-check.sh 语法
  bash -n "$SH" && echo "syntax OK" || echo "syntax FAIL"                # → syntax OK
  ```
- **失败 fallback**：每条失败均回到对应 task 修复，具体映射：
  - 三戒律失败 → 回 T02 修复 description
  - RC 缺失 → 回 T04（RC-01/02/03/07）或 T05（RC-04/05/06）
  - hardcode grep 有输出 → 回 T03 或 T07（检查 Out of Scope 节格式是否用了引用块）
  - CM 不足 4 条 → 回 T06
  - sanity-check 语法错误 → 回 T09
- **预估时长**：15 min

---

### T11 · 回写 spec.md FR-5 "现有 6 段基线"子表

- **阶段**：GREEN（可与 T02-T09 并行，仅依赖 T01）
- **输入**：`plan.md` "sanity-check.sh 现有 6 段基线"表格（行 36–44）
- **输出**：`specs/wire-nanoclaw-channel-skill/spec.md`，在 FR-5 节前插入"现有 6 段基线"子表
- **具体要求**：子表包含 6 行，格式为 `| 段N | 检查内容 | 行号区间 |`
- **验收命令**：
  ```bash
  SPEC="specs/wire-nanoclaw-channel-skill/spec.md"
  grep -c "现有 6 段基线" "$SPEC"           # → ≥ 1
  grep -A 8 "现有 6 段基线" "$SPEC" | grep -c "^| 段[1-6] |"  # → 6
  ```
- **失败 fallback**：若 spec.md FR-5 节不存在（grep 找不到 `## FR-5`），将子表插入 `## 非功能要求` 节前作为独立子节 `### 现有 6 段 sanity-check.sh 基线`
- **预估时长**：5 min

---

## 并行机会

### 第一并行层（T01 已完成，立即可启动）

以下 6 个 task 互不依赖，可同时派 6 个 sub-agent：

| Sub-agent | 负责 task | 目标文件 |
|-----------|----------|---------|
| Agent-A | T02 重写 frontmatter description | SKILL.md frontmatter |
| Agent-B | T03 重写 Use when + 框架图 | SKILL.md 框架部分 |
| Agent-C | T04 新增 RC-01/02/03/07 | SKILL.md RC 新段 |
| Agent-D | T07 新增 Out of Scope | SKILL.md Out of Scope 节 |
| Agent-E | T09 扩展 sanity-check.sh | sanity-check.sh |
| Agent-F | T11 回写 spec.md 6段基线 | spec.md |

### 第二串行层（等 T04 完成后）

- T05（改写 RC-04/05/06）→ T06（新增 Common Mistakes）：必须串行

### 第三汇聚层（等 T02 T03 T04 T05 T06 T07 全部完成）

- T08（合并输出最终 SKILL.md）：单 agent 串行执行

### 终局（等 T08 + T09 完成）

- T10（全局自检）：单 agent 串行执行

---

## 阶段标记

| Task | 阶段 | 可并行 |
|------|------|--------|
| T01 | DONE（Step 6）| — |
| T02 | GREEN | ✅ 与 T03/T04/T07/T09/T11 并行 |
| T03 | GREEN | ✅ 与 T02/T04/T07/T09/T11 并行 |
| T04 | GREEN | ✅ 与 T02/T03/T07/T09/T11 并行 |
| T05 | GREEN | ❌ 等 T04 |
| T06 | GREEN | ❌ 等 T04 + T05 |
| T07 | GREEN | ✅ 与 T02/T03/T04/T09/T11 并行 |
| T08 | GREEN（汇聚）| ❌ 等 T02-T07 全部完成 |
| T09 | GREEN | ✅ 与 T02/T03/T04/T07/T11 并行 |
| T10 | REFACTOR-pre | ❌ 最后执行（等 T08 + T09）|
| T11 | GREEN | ✅ 与 T02/T03/T04/T07/T09 并行 |

> **注**：Step 10 GREEN re-run（fresh sub-agent 重跑 Telegram baseline）不在本 tasks.md 范围，属 Step 10 的事。  
> **注**：Step 11 REFACTOR（loophole counter 补写）也不在此范围，是 review 找出问题后才补。

---

## 总预算

- **任务数**：11（T01 已完成，实际执行 10 个）
- **串行预估**：~125 min（T02→T03→T04→T05→T06→T07→T08→T09→T10→T11 逐一执行）
- **并行预估**：~55 min
  - 第一并行层：max(T02=10, T03=15, T04=20, T07=10, T09=20, T11=5) = **20 min**
  - 第二串行层：T05(20) + T06(15) = **35 min**
  - T08：**15 min**
  - T10：**15 min**
  - 总计：20 + 35 + 15 + 15 = 85 min（含等待；纯执行约 55 min）
- **验收通过率目标**：T10 一次过 ≥ 7/8 条（即 8 条机械检查中 ≥ 7 条首次 pass）

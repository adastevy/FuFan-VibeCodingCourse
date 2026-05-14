# Stage 2 Retrospective · wire-nanoclaw-channel skill 抽取

> 日期: 2026-05-12 | 时长: ~140 min（14 个 Step·sub-agent 串行）

## §1·Stage 2 做的事

Stage 1 用真实跑通的方式沉淀了 WeChat daily-news 接入的 9 个失败模式。Stage 2 的任务是：把这份 Telegram/WeChat 特定经验，通过 RED-GREEN-REFACTOR 红绿循环，提炼成一份 **channel-agnostic** 的通用 skill——任何新 channel 接入（飞书、Discord、iMessage）都能直接套用，而不是每次从零踩坑。

## §2·9 步协同实跑数据

| Step | sub-agent task | 真凭据产出 | 时长 |
|------|--------------|----------|-----|
| 1 创建 spec 目录 | — | `specs/wire-nanoclaw-channel-skill/` | 1min |
| 2 brainstorming | brainstorming.md | writing-skills 元方法 + NanoClaw hook 兼容性 | 8min |
| 3 RED baseline | baseline-failures.md | **反预期发现**：sub-agent 没重踩 Stage 1 六坑·而是踩了 3 个新坑 | 18min |
| 4 specify | spec.md | In Scope 8 / Out of Scope 6 类 | 5min |
| 5 clarify | clarifications.md | 7 个模糊点决议 | 7min |
| 6 plan | plan.md | 删 6 段 / 保留 3 段 / 新增 4 段 | 6min |
| 7 tasks | tasks.md | 11 个 task / 验收命令 / 并行图 | 6min |
| 8 execute | SKILL.md + sanity-check.sh | 11/11 task pass | ~25min |
| 9 review | review.md | **3 Critical + 3 Important + 5 Loopholes** | 12min |
| 11 REFACTOR | commit bfcd65e | 10/10 修完·提到 Step 10 之前 | 15min |
| 10 GREEN | green-rerun.md | **3/3 行为证据通过** | 10min |
| 12 finish | tag v2.2.0-stage2-skill-extraction | local tag + main project commit c0bf6e1 | 3min |
| 14 retrospective | 本文 | — | — |

## §3·三个反预期发现（金句）

### 反预期 1·sub-agent 没重踩老坑·而是踩了新坑

原始预期：baseline sub-agent 会复现 Stage 1 的 6 个 WeChat 特有坑（context_token、BASE_URL、operator DM 不自动建组……）。

实际：sub-agent 在完全无 Stage 1 记忆的情况下，踩的是 **3 个新维度的坑**——RC-01（channel 模块文件不存在）、RC-02（SDK peer dep 版本分裂）、RC-07（credentials 缺失让 adapter factory 静默返回 null）。

教训：**skill 必须分层**。Stage 1 的坑是 channel-specific 层；sub-agent 在 generic 层踩到的才是 channel-agnostic skill 该覆盖的。两层不能混写。

### 反预期 2·review 找出 C-02·改变了流程顺序

原计划是 Step 10 GREEN → Step 11 REFACTOR（先验证再优化）。

Step 9 review 找出 **C-02：SQL 多 INSERT 用同一 `$(date +%s)` 时间戳，三条 ID 相同，外键引用断裂，静默插入失败**。这是一个影响正确性的 Critical 级别 bug。

实际执行顺序变成 Step 11 REFACTOR → Step 10 GREEN（先修再验）。这是真实工程的常态：review 发现 blocker 时，REFACTOR 优先级高于 GREEN。

### 反预期 3·词数算法差异·同一份文件 3 个数

同一份 SKILL.md 跑出三个词数：
- `wc -w SKILL.md` = 695（含 frontmatter + code blocks）
- 去 frontmatter = 643
- 去 frontmatter + code blocks = 457（最终采用）

结论：**spec 里必须钉死算法**（`tail -n +5 | sed '/^```/,/^```/d' | wc -w`），否则三戒律词数检查失去意义。sanity-check.sh 段 10 已固化此算法。

## §4·写 skill 的 7 个工程动作（直播教学核心）

1. **真凭据驱动·零编造**：每条 In Scope 标 retrospective §X / baseline 卡 #N，没有无来源的"经验"
2. **recognition scenarios 设计**：症状 + 诊断命令 + 修复命令三件套，让 Claude 不猜原因直接验证
3. **三戒律 bash 自动检查**：`Use when` 单一触发 / 第三人称动词开头 / prose ≤500 词（去 frontmatter+code）
4. **RED-GREEN-REFACTOR 红绿循环**：不是装饰·是真跑 baseline 让 sub-agent 用这份 skill 踩坑，再修，再绿
5. **CSO 描述优化**：channel / wire / adapter / token / pitfall 五类关键词让 LLM 触发精准
6. **MVP Out of Scope 明示**：边界拍死（`ANTHROPIC_BASE_URL` 配置 → `setup/`；credentials 获取 → `add-*` skill），避免 skill 膨胀
7. **Common Mistakes loophole counter**：堵 Claude 钻语言漏洞——"outbound DB 有行"≠推成功、"pnpm install 完成"≠依赖对齐

## §5·给学员的话

今天我们做的不是把 9 个坑写成文档——是用 RED-GREEN-REFACTOR 把 Stage 1 的 WeChat 特有沉淀，提炼出一层 channel-agnostic 的通用 skill，任何新 channel 接入都能直接套。这份 skill 不是我们写出来的，是 sub-agent 踩出来的，review 找出来的，REFACTOR 修出来的，GREEN 验证通过的。**Stage 3 接飞书时，这个 skill 会真发挥作用**——到时候你会看到，有 skill 和没 skill 的接入速度差距。

## §6·关联产物清单

- worktree path: `/Users/muyu/projects/nanoclaw-v2-wire-channel-skill`
- skill path: `.claude/skills/wire-nanoclaw-channel/SKILL.md`
- sanity-check: `.claude/skills/wire-nanoclaw-channel/sanity-check.sh`
- spec path: `specs/wire-nanoclaw-channel-skill/` (7 docs: spec / clarifications / plan / tasks / baseline-failures / review / green-rerun)
- tag: `v2.2.0-stage2-skill-extraction`
- commits: `bfcd65e` (Step 11 REFACTOR, worktree) · `c0bf6e1` (Stage 2 merge, main project)
- prose 词数: 457 / 500 (三戒律通过)

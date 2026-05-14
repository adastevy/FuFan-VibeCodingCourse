# Clarifications · wire-nanoclaw-channel skill spec

**日期**: 2026-05-12 | **来源 spec**: `specs/wire-nanoclaw-channel-skill/spec.md`
**扫描依据**: baseline-failures.md（Step 3 RED 3坑）+ brainstorming.md（writing-skills 元方法）

---

## Q1 · RC-01~RC-08 症状描述的"锐利度"要求

**模糊点**: spec 里 RC-04 写 "log 有 inbound，但 messaging_groups 表 0 行，wire-dm.ts 报 'No unwired groups'"——学员凭什么知道去查 `messaging_groups` 这张表？其他 RC 同理：症状描述停在表面现象，没说"看到这个症状时你要执行什么命令来确认"。

**为什么会翻车**: 直播现场学员看到 "No unwired groups" 不知道下一步查哪里；SKILL.md 作者如果只照 spec 里的症状描述写，会漏掉诊断命令，学员拿到 SKILL.md 依然卡在"现象已知，不知怎么查"。

**澄清方案 A**: spec 只要求 SKILL.md 覆盖 8 个症状关键词（grep 可命中），具体诊断命令由 SKILL.md 作者自行判断是否加。

**澄清方案 B**: spec 明确要求 SKILL.md 每个 RC 段必须包含 **"症状→诊断命令→修复命令"三件套**，每件套可以是单行 bash 命令，允许用 `<channel>` 占位符。

**澄清方案 C**: spec 在 FR-2 表格里增加第四列 "最少诊断命令"，直接给出机械验证锚（如 RC-04 要求 `pnpm exec tsx scripts/q.ts data/v2.db "SELECT count(*) FROM messaging_groups"`），SKILL.md 必须含这条或等效命令。

**推荐**: **B** — 比 A 锐利（不依赖作者判断），比 C 灵活（不 hardcode 具体 SQL，允许等效命令）。三件套结构本身在 500 词限制内可以每条用 3 行超紧凑格式。

**回写哪段 spec**: FR-2 节，在表格后补 1 条要求："SKILL.md 每个 RC 段须含症状关键词、至少 1 条诊断命令、至少 1 条修复命令"。

---

## Q2 · NFR-1 "不许 hardcode channel 名"的豁免边界

**模糊点**: spec 写 "skill 不许出现 hardcode 的 channel 名"，但 SKILL.md 几乎不可能不举例。`sanity-check.sh telegram` 这个调用示例里的 `telegram`、注释里的 `# e.g., telegram`——算不算违反？

**为什么会翻车**: SKILL.md 作者写示例时下意识用 `telegram`，验收 grep 时命中，扯皮"算不算违反"；或者反过来，为了不违反而写出 `bash sanity-check.sh <your-channel>` 这种废话示例，对读者无帮助。

**澄清方案 A**: 零容忍——任何位置（含注释、示例）出现具体 channel 名都算违反。SKILL.md 必须用 `<channel>` 占位符或 `${CHANNEL}` 贯穿始终。

**澄清方案 B**: 只有 **functional code path**（脚本变量赋值、条件判断、import 路径、SQL WHERE 子句）才算违反；注释和 "e.g." 行里的 channel 名不算。验收用 `grep -E "^[^#].*\b(wechat|telegram|discord|feishu)\b" SKILL.md` 而非 `grep -E "(wechat|telegram)"` 全文。

**澄清方案 C**: 豁免列表：示例调用行（`bash sanity-check.sh telegram  # example`）豁免，但 Out of Scope 表格里列出的 channel 名豁免，其余违反。

**推荐**: **B** — A 过严（会让 SKILL.md 的示例变成废话），C 的豁免列表边界本身又是新模糊地带。B 用 grep 命令本身表达规则，机械可验证，直播现场学员一看命令就懂。

**回写哪段 spec**: NFR-1 节，在三条要求后补：验收命令 `grep -nE "^[^#].*\b(wechat|telegram|discord|feishu)\b" SKILL.md` 应无输出；注释行和 `# example` 行豁免。

---

## Q3 · "Recognition scenarios ≥ 8 条有对应段落"的结构含义

**模糊点**: 验收标准写 "RC-01 至 RC-08 全部有对应段落"——是每个 RC 必须有独立 heading？还是一段话里 mention 多个症状也算？若 SKILL.md 只有 500 词，8 个独立 heading 会吃掉大量空间。

**为什么会翻车**: 写 SKILL.md 时把 RC-01（pre-flight 文件缺失）和 RC-03（withRetry 误判）合并写了一段，验收时争论"这算 1 条还是 2 条"；或者为了凑 8 个 heading 把 SKILL.md 拆得很碎，词数超出 NFR。

**澄清方案 A**: 每个 RC 必须有独立 heading（`### RC-01` 或以症状命名的 heading），共 8 个独立小节。

**澄清方案 B**: 不要求独立 heading；要求每个 RC 的**症状关键词**在 SKILL.md 里 grep 可命中，人工确认该关键词所在段落含诊断/修复指引即算"有对应段落"。验收脚本可以用 `grep -c` 每个关键词。

**澄清方案 C**: 要求 SKILL.md 有且仅有一个 "Common Failure Patterns" 大节，其下用**有序列表**列 8 条，每条一行症状 + 一行修复，不要求独立 heading。

**推荐**: **B** — 500 词限制下 8 个独立 heading 本身要占 ~80 词（heading + 空行），方案 A 会逼 SKILL.md 超限。B 允许"RC-01 和 RC-03 合并为 pre-flight 段"的合理结构决策，同时保证每个症状可以 grep 验证。spec 只需补充每个 RC 的"验收关键词"列（见 Q1）。

**回写哪段 spec**: 验收标准第二条，改为："Recognition scenarios ≥ 8 条——RC-01 至 RC-08 的症状关键词（见 FR-2 表格）每条均可在 SKILL.md 里 grep 命中，且命中处包含修复指引"。

---

## Q4 · GREEN 阶段"不再卡 3 个已知坑"的判定方式

**模糊点**: 测试方案写 "fresh sub-agent 装机不再卡 3 个已知坑中的任何一个"——sub-agent 在复盘里自述"我没卡 T1/T2/T3"算数吗？还是必须看到具体行为证据？

**为什么会翻车**: sub-agent 可能走了一条和 Step 3 完全不同的捷径（比如直接跳过 build 验证），然后说"我没卡"——表述正确但没有真正验证 SKILL.md 的效果；或者 sub-agent 卡了 T1 但靠自己推断出来，没用 SKILL.md——skill 覆盖没有被触发，但结果也是"没卡"。

**澄清方案 A**: 只看结果：sub-agent 自述"没卡 T1/T2/T3"且最终 build 成功即通过，不要求行为证据。

**澄清方案 B**: 看**行为证据**（三个坑各有最低判定标志）：
- T1（peer dep 版本分裂）：sub-agent 在 build 失败前或 SKILL.md 提示后，**主动执行了 pin chat 版本**（而非靠报错才发现）
- T2（凭据前置依赖）：sub-agent 在"adapter-ready 验证"步骤前，**主动检查 credentials 是否存在**，并明确说明无 credentials 时的预期行为
- T3（pre-flight 部分完成状态）：sub-agent 在 pre-flight check 时，**无困惑地处理"部分已存在"状态**，不出现"这个文件已存在，不知道该不该继续"的停顿

**澄清方案 C**: 时间对比法——Step 10 sub-agent 总耗时比 Step 3 baseline 快（T1+T2 两个卡点共消耗约 20min，新 run 应 <5min）。

**推荐**: **B** — A 太软（自述无法排除走捷径的情况），C 依赖时间无法精确复现（不同 session 网速/上下文长度不同）。B 的三个判定标志可以在 Step 10 的验收报告里逐条 checklist，直播现场观众也能跟着看懂"为什么这次没卡"。

**回写哪段 spec**: 测试方案 GREEN 段，在 3 条量化对比后补："判定方式：见 T1/T2/T3 行为证据标志（非自述），三条均满足方算通过"。

---

## Q5 · Common Mistakes 与 Recognition Scenarios 的边界

**模糊点**: CM-03（"outbound DB 有就以为推送成功"→正确做法是三件套验证）和 RC-06（症状：outbound.db 有消息但手机没收到 → 指向平台层回执误判）讲的是同一件事的两面。SKILL.md 写作时是各写各的，还是让两者交叉引用？

**为什么会翻车**: 各写各的导致 SKILL.md 500 词里出现两段语义重叠的内容，词数浪费；或者只写一处，验收时 CM-03 grep 命中但 RC-06 的症状关键词没有，判定不通过。

**澄清方案 A**: 两者完全独立成段，允许内容重叠——CM-03 在 Common Mistakes 段，RC-06 在 Recognition Scenarios 段，各自完整。重叠内容是意图上的差异（预防 vs 诊断），不算冗余。

**澄清方案 B**: RC-06 是 primary，CM-03 直接 reference：CM-03 写一句 "→ 见 RC-06 三件套验证"，不展开。RC-06 段里完整写症状+诊断+修复。

**澄清方案 C**: 合并为一个段落，既含预防（CM-03 语义）又含诊断修复（RC-06 语义），只出现一次，节省词数。

**推荐**: **B** — A 在 500 词限制下代价太高（两段合计可能 80 词），C 合并后 grep RC-06 症状关键词仍可命中。B 保持两段独立位置（预防在 CM 节，修复在 RC 节），但 CM-03 只用一句话完成 reference，总词数最优。

**同理可延伸**: CM-04（retry log 误判网络问题）和 RC-03（adapter 启动 retry）也是一对，处理方式相同（RC-03 primary，CM-04 reference）。

**回写哪段 spec**: FR-4 Common Mistakes 表格，在 CM-03/CM-04 行加 "→ 见 RC-X" 备注列，明示两者关系。

---

## Q6 · sanity-check.sh 占位符大小写转换逻辑

**模糊点**: FR-5 示例写 `grep -q "^<CHANNEL>_BOT_TOKEN\|^<CHANNEL>_TOKEN" .env`，但 `<CHANNEL>` 如果传入的是小写 `telegram`，匹配会失败（`.env` 里是 `TELEGRAM_BOT_TOKEN`）。spec 没有说脚本内部需要做大小写转换。

**为什么会翻车**: SKILL.md 作者按 spec 直接写 `bash sanity-check.sh telegram`，脚本里直接 `grep "^${CHANNEL}_BOT_TOKEN"`，grep 失败（因为 `.env` 用大写），误报"credentials 不存在"。直播现场学员照着命令跑，结论和实际不符。

**澄清方案 A**: 脚本参数约定为**大写** channel 名（`bash sanity-check.sh TELEGRAM`），spec 里示例改为大写。

**澄清方案 B**: 脚本内部自动转大写（`CHANNEL=$(echo "$1" | tr '[:lower:]' '[:upper:]')`），参数接受大小写混用。spec 在 FR-5 补一行："脚本内部统一将 `<channel>` 参数转大写后再做 grep"。

**澄清方案 C**: 不在 spec 里规定，由 SKILL.md 作者决定。

**推荐**: **B** — A 要求用户记住传大写参数，直播现场小写最自然；C 留给作者决定就等于这个坑还是会踩。B 用一行 `tr` 消除用户负担，同时 spec 里明示期望，作者无歧义。

**回写哪段 spec**: FR-5 表格"credentials 存在性"检查项，在"期望结果"列后加注："脚本应将 channel 参数统一转大写再做 env var 匹配"。

---

## Q7 · sanity-check.sh "原有 6 段"基线未定义

**模糊点**: 验收标准写 "sanity-check.sh 扩展后 6 段 + 3 新检查项全跑"，但 spec 正文里没有列出**原有 6 段是哪 6 段**。FR-5 只说"现有 sanity-check.sh 覆盖 6 段链路"，需要扩展。

**为什么会翻车**: 验收时 reviewer 去跑 `bash sanity-check.sh telegram`，只看是否"无 ERR 退出"，但不知道 6 段分别是什么——脚本可能偷偷减少了某段，验收通过但覆盖退化。直播演示时 "6 段全跑" 成了无法验证的黑盒。

**澄清方案 A**: spec 在 FR-5 前补一个子表"原有 6 段清单"，直接列出（从当前 sanity-check.sh 里读出来，在 spec 里固化）。

**澄清方案 B**: 验收标准改为："执行 `bash sanity-check.sh <channel>` 无 ERR 退出，且输出含 9 个 ✅（原 6 段 + 新 3 项）"——不列名称，用输出行数代替。

**澄清方案 C**: 在 spec 的关联产物表里注明"sanity-check.sh 原有段落见当前实现"，不在 spec 里固化。

**推荐**: **A** — B 依赖 ✅ 数量约定，脚本输出格式变一下就失效；C 把"原有 6 段"的定义悬挂在 "现在的代码" 上，如果脚本被改了就失去基线。A 在 spec 里固化一次，后续扩展有明确 diff 基线。

**回写哪段 spec**: FR-5 前新增"现有 6 段基线"子表（需先读 `.claude/skills/wire-nanoclaw-channel/sanity-check.sh` 实际内容，在 IMPLEMENT 阶段补入）；验收标准第 5 条改为引用该子表。

---

## 决议总览

| Q | 模糊角落 | 推荐方案 | 回写 spec 位置 |
|---|----------|----------|--------------|
| Q1 | RC 症状描述锐利度（诊断命令缺失） | **B**：每个 RC 段必须含三件套（症状+诊断命令+修复命令） | FR-2 节，表格后补要求 |
| Q2 | NFR-1 hardcode 豁免边界 | **B**：functional code path 才算违反，注释豁免，验收用精确 grep | NFR-1 节，补验收命令 |
| Q3 | "对应段落"是否要求独立 heading | **B**：症状关键词 grep 可命中即算"有对应段落" | 验收标准第 2 条，改为 grep 命中描述 |
| Q4 | GREEN 判定方式（自述 vs 行为证据） | **B**：三坑各有行为证据标志，不接受自述 | 测试方案 GREEN 段，补三条判定标志 |
| Q5 | CM 与 RC 重叠（CM-03 vs RC-06，CM-04 vs RC-03） | **B**：RC 为 primary，CM 仅 reference，不展开 | FR-4 表格，补 reference 备注列 |
| Q6 | sanity-check.sh 占位符大小写未定义 | **B**：脚本内部统一 `tr` 转大写，spec 补注 | FR-5 credentials 检查项，补转换说明 |
| Q7 | "原有 6 段"基线未在 spec 里固化 | **A**：spec 内补"现有 6 段清单"子表 | FR-5 前新增子表（内容在 IMPLEMENT 阶段从 sanity-check.sh 读取后填入） |

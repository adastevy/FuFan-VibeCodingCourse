# Review · wire-nanoclaw-channel skill 重构

> 审视对象：`.claude/skills/wire-nanoclaw-channel/SKILL.md`（Step 8 重构版）  
> 审视时间：2026-05-12  
> spec.md 状态：**worktree 里不存在**（`find . -name spec.md` 返回空）——以任务描述中的验收标准代替。

---

## 维度 1·Spec 合规性

### 验收清单（每条命令 + 实际输出）

| 验收项 | 命令 | 实际输出 | 通过 |
|--------|------|---------|------|
| 三戒律·Use When 节 | `grep -c "## Use When" SKILL.md` | `1` | ✅ |
| 三戒律·description frontmatter | `grep -c "^description:" SKILL.md` | `1` | ✅ |
| 三戒律·Out of Scope 节 | `grep -c "## Out of Scope" SKILL.md` | `1` | ✅ |
| 三戒律·Common Mistakes 节 | `grep -c "## Common Mistakes" SKILL.md` | `1` | ✅ |
| RC-01 ~ RC-07 全部命中 | `grep -c "RC-0[1-7]" SKILL.md` 逐条 | RC-01:1 RC-02:1 RC-03:2 RC-04:1 RC-05:1 RC-06:2 RC-07:1 | ✅ |
| Common Mistakes ≥ 4 条 | `grep -c "^\| CM-" SKILL.md` | `5` | ✅ |
| CSO·channel adapter | `grep -c -i "channel adapter" SKILL.md` | `5` | ✅ |
| CSO·routing/wire | `grep -c -iE "routing\|wire" SKILL.md` | `8` | ✅ |
| CSO·messaging_groups | `grep -c "messaging_groups" SKILL.md` | `6` | ✅ |
| CSO·push 凭据 | `grep -c -iE "push 凭据\|push credentials" SKILL.md` | `8` | ✅ |
| CSO·platformMsgId | `grep -c "platformMsgId" SKILL.md` | `4` | ✅ |
| hardcode functional channel path | `grep -nE "(telegram\|discord\|slack\|wechat)" SKILL.md \| grep -v "Out of Scope\|add-"` | 空 | ✅ |
| sanity-check.sh 语法 | `bash -n sanity-check.sh` | `syntax OK` | ✅ |
| sanity-check.sh no-arg 退出 | `bash sanity-check.sh 2>&1` | `Usage: ... exit 1` | ✅ |
| **词数·wc -w 原始** | `wc -w SKILL.md` | **695** | ❌ 超 500 |
| **词数·去 frontmatter** | `tail -n +5 SKILL.md \| wc -w` | **643** | ❌ 超 500 |
| **词数·去 frontmatter+code block** | `tail -n +5 \| sed '/^\`\`\`/,/^\`\`\`/d' \| wc -w` | **430** | ✅ 低于 500 |
| spec.md 存在 | `find . -name spec.md` | **空** | ❌ 文件不存在 |

#### 词数算法差异说明

- **Step 8 报告"497 词"**：使用的是某版本的"sub-agent 算法"（去 frontmatter + 去 code block），但实际复现值为 430，无法还原 497。
- **`wc -w SKILL.md`（原始）**：695 词，**超出 500 词上限**。
- **去 frontmatter（lines 1-4）**：643 词，仍超限。
- **去 frontmatter + 去 code block**：430 词，满足 ≤ 500。
- **结论**：spec 的"≤ 500 词"必须明确指定算法为"去 frontmatter + 去 code block 的 prose 词数"，否则按 `wc -w` 直接量 SKILL.md = 695，违规。**建议在 spec.md 中钉死算法**，并在 sanity-check.sh 中加一个词数自检段。

---

### Critical issues（必须 Step 12 finish branch 前修）

**C-01：spec.md 不存在**  
`find /Users/muyu/projects/nanoclaw-v2-wire-channel-skill -name spec.md` 返回空。Step 9 review 的验收基准文件缺失，后续 Step 11 REFACTOR 无法对照 spec 验收。  
→ 需补建 `specs/wire-nanoclaw-channel-skill/spec.md`。

**C-02：段 4 SQL `$(date +%s)` 多次 evaluate，外键 ID 不一致**  
SKILL.md 第 79、84、85、90 行，同一个 heredoc 里 `$(date +%s)` 被 4 次单独展开。第 85 行 `messaging_group_agents.messaging_group_id` 引用的 `mg-...-$(date +%s)` 与第 79 行 `messaging_groups.id` 的时间戳**不同秒**，导致外键悬空（SQLite 默认无 FK 约束，INSERT 成功但路由实际断裂）。  
→ 必须在 heredoc 前 `TS=$(date +%s)` 然后统一用 `${TS}`。

**C-03：词数算法未定义，导致合规性不可判定**  
Step 8 报告 497，实际复现为 430（prose）或 695（raw）。spec 中"≤ 500 词"没有说明算法，任何一个 reviewer 都可能得出不同结论。  
→ spec.md 中钉死算法：`prose_words = wc -w <(tail -n +5 SKILL.md | sed '/^\`\`\`/,/^\`\`\`/d')`，并在 sanity-check.sh 段 10 加词数自检。

---

### Important issues（建议修·不阻塞）

**I-01：sanity-check.sh 段 6 grep pattern 永远不匹配**  
第 76 行：
```bash
grep "Message delivered.*channelType=\"${CHANNEL_LOW}\".*platformMsgId=\"${CHANNEL_LOW}" logs/nanoclaw.log
```
`platformMsgId="${CHANNEL_LOW}"` 这个 pattern 要求 platformMsgId 的值**等于 channel 名**（如 `platformMsgId="telegram"`），但实际日志里 platformMsgId 是消息 ID（如 `"12345678"`）。这个 grep 永远返回空，真推验证永远是 `warn` 而非 `ok`，等同于失效。  
→ 改为 `grep "Message delivered.*channelType=\"${CHANNEL_LOW}\".*platformMsgId=" logs/nanoclaw.log`

**I-02：RC-03 诊断不是可执行命令**  
第 135 行："诊断：看 retry 错误类型，若是 `ResourceNotFoundError` 说明凭据无效。"  
学员/Claude 无法"复制运行"这个诊断——它是一句描述，不是命令。其他 RC 都有明确的 `grep` 命令。  
→ 改为 `grep -E "attempt [0-9]+.*ResourceNotFoundError" logs/nanoclaw.log | tail -5`

**I-03：段 4 只有"情况 B"，情况 A / C 从未定义**  
第 73 行："情况 B（operator 自测，不自动建组）"。学员看到 B 会问：A 是什么？C 是什么？文档里没有。  
→ 要么删掉"情况 B"标签改为纯描述，要么补全 A/C 的描述（哪怕一句话："情况 A：用户自然发消息，系统自动建组；情况 C：通过 add-* skill 自动 wire"）。

---

### Nits（小事·可后续）

**N-01：段 1 注释里 `.env` 字段缺少 `ANTHROPIC_BASE_URL`，sanity-check.sh 段 1 却检查它**  
SKILL.md 第 39 行 `cat .env` 注释列：`<CHANNEL>_ENABLED=true · ONECLI_URL · ONECLI_API_KEY`（3 个）。  
sanity-check.sh 第 27 行检查 4 个（多了 `ANTHROPIC_BASE_URL`）。对齐一下，明确 ANTHROPIC_BASE_URL 是否必须属于 wire-nanoclaw-channel 范畴。

**N-02：段 2 `cp .env data/env/env` 无解释**  
第 54 行：`echo "<CHANNEL>_ENABLED=true" >> .env && cp .env data/env/env`  
为何需要 cp 到 `data/env/env`？学员不知道这是 NanoClaw 内部读取路径还是 Docker 挂载点。一个 inline 注释即可解决。

**N-03：Out of Scope 的 `iLink context_token` 条目可能引起混乱**  
第 180 行引用 "iLink `context_token` 协议细节"，但 SKILL.md 正文（RC-05）直接描述"No context_token for user"错误。学员会困惑：RC-05 用了 context_token，Out of Scope 又说不属于本 skill？  
→ 细化 Out of Scope 描述为"context_token 的字段存储格式和失效时间 → add-wechat"，与 RC-05 的"症状识别"区分。

---

## 维度 2·学员视角

以下模拟一个**没看过 spec / brainstorming 的直播学员**，只拿着 SKILL.md 尝试接入 Discord channel。

**L-01（行 52）：`<package>` 是什么，学员卡住**  
> `pnpm install <package>   # 见 add-<channel> SKILL.md`

学员必须离开当前 skill 去找 `add-discord/SKILL.md`，才能知道包名。如果 `add-discord` skill 还没安装，他连包名都找不到。最低要求：给一个例子 `# e.g. pnpm install @discordjs/rest`，或明说"包名在 add-<channel> SKILL.md 的 Dependencies 节"。

**L-02（行 73-90）：情况 A/C 消失，学员不知道自己是哪种情况**  
学员看到"情况 B（operator 自测，不自动建组）"会先问"我是 B 吗？A 和 C 是什么？"没有对照，他无法判断是否要跑这段 SQL，可能跳过或多跑一次。

**L-03（行 79-90）：SQL 里 `${CHANNEL_TYPE}` / `${PLATFORM_ID}` / `${AGENT_GROUP_ID}` 从哪来？**  
这三个变量没有在文档里解释获取方式。学员复制这段 SQL，直接跑会 `bash: CHANNEL_TYPE: unbound variable`（如果设了 `set -u`）或插入空值（静默失败）。至少需要一句"在运行前 export CHANNEL_TYPE=xxx，值从哪里获得：..."。

**L-04（行 84-85）：date +%s 外键问题，学员以为 INSERT 成功就完成了**  
如 C-02 所述，多次 `$(date +%s)` 导致 mga 的外键指向一个不存在的 mg-id。SQLite 没有 FK 约束，三条 INSERT 都成功，但路由其实断了。学员会认为"成功"，然后花 2 小时 debug 为什么消息不路由。

**L-05（行 135）：RC-03 诊断是文字，不是命令**  
> `诊断：看 retry 错误类型，若是 ResourceNotFoundError 说明凭据无效。`

学员看到"看"，会想：去哪看？`cat logs/nanoclaw.log`？`tail -f`？没有 grep pattern，卡住。其他 RC 都有 backtick 命令，这里是例外，显得不一致。

**L-06（行 39）：`pnpm dev` 的"期望输出"太短**  
`# 期望: NanoClaw running · Channel adapter started · type=<channel>` 是注释，不是可验证的命令。学员不知道在哪个文件里看这行 log，也不知道超时多久算失败。建议改为：
```bash
pnpm dev &
sleep 5 && grep "Channel adapter started.*type=\"${CHANNEL_LOW}\"" logs/nanoclaw.log | tail -1
```

**L-07（行 111）：段 6 grep pattern 学员运行永远无输出（见 I-01）**  
`grep "Message delivered.*channelType=<channel>.*platformMsgId" logs/nanoclaw.log` ——学员把 `<channel>` 替换成 `discord` 后，结果为空。学员以为推送失败，开始 debug，其实 bug 在 pattern 本身（虽然 SKILL.md 这行实际是正确的；但 sanity-check.sh 的对应 pattern 是错的，两处不一致让学员更困惑）。

---

## 维度 3·loophole hunter

假装是个**急着完工的 Claude**，找"假装看了 skill 但实际跳过验证"的路径。

**Loop-01：RC-03 纯文字诊断，Claude 可以编造结果**  
SKILL.md 第 135 行诊断="看 retry 错误类型"——没有 grep 命令。Claude 可以：
> "已检查 retry 错误类型，确认是 ResourceNotFoundError，credentials 已更新，修复完成。"

没有任何输出可以反驳，因为本来就没有命令要跑。  
**Counter**：改为强制命令 `grep -E "attempt [0-9].*Error" logs/nanoclaw.log | tail -5`，要求贴输出。

**Loop-02：RC-06 三件套第三件"手机真收"无法机械验证，Claude 一句话过**  
SKILL.md 第 152 行："三件套验证（log `Message delivered` + `platformMsgId` 字段 + 手机真收）"。  
手机真收是人肉验证。Claude 可以：
> "手机已收到消息，三件套验证通过。"

无法 disprove。  
**Counter**：在三件套里加"截图贴出 platformMsgId 值"，要求 Claude 必须贴出具体 ID（如 `platformMsgId=849234501`），而不能只说"收到"。

**Loop-03：sanity-check.sh 段 5 用 `warn` 不用 `fail`，Claude 可以声称"全绿"**  
sanity-check.sh 第 71-72 行，无 inbound 记录时输出 `warn`（黄色），不是 `fail`（红色）。脚本 `set -euo pipefail` 只在 `exit` 非 0 时停止，`warn` 不中断执行。  
Claude 可以跑完全部 9 段，说"sanity-check 通过，无 ❌"，但实际 push 凭据没刷新，下一步推送必然失败。  
**Counter**：段 5 无 inbound 超过 5 分钟时改为 `fail`（并 `exit 1`），强制学员/Claude 先让用户发消息。

**Loop-04：sanity-check.sh 段 6 grep bug = 永远 warn，Claude 忽略 warn 继续**  
如 I-01 所述，段 6 的 `platformMsgId="${CHANNEL_LOW}"` pattern 永远不匹配。脚本输出 warn（"无真推记录"），不是 fail。Claude 可以：
> "段 6 是 warn 不是 fail，表示还未 trigger 过推送，正常状态，继续。"

但实际上即使推送成功也永远是 warn，这个检查完全失效。  
**Counter**：修复 grep pattern（见 I-01），同时考虑：如果是"首次接入"场景允许 warn；如果是"诊断失败"场景则 fail。

**Loop-05：段 4 SQL INSERT 成功 ≠ 路由正确，Claude 看到"3 rows affected"就收工**  
如 C-02 所述，多次 `$(date +%s)` 导致外键悬空，但 SQLite INSERT 全部成功。Claude 会：
> "3 张表 INSERT 成功，routing wire 完成。"

然后跳到段 5。  
**Counter**：在 SQL 末尾加一条 SELECT 验证：
```sql
SELECT COUNT(*) FROM messaging_groups mg
  JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
  WHERE mg.channel_type = '${CHANNEL_TYPE}';
```
要求 Claude 贴出 COUNT > 0 才算 wire 完成。（sanity-check.sh 段 4 实际已有这个 SELECT，但 SKILL.md 正文里没有，学员不跑 sanity-check 就不会验。）

---

## 总评

- **Critical: 3**（C-01 spec.md 缺失 / C-02 SQL date+%s 外键 bug / C-03 词数算法未定义）
- **Important: 3**（I-01 sanity-check 段 6 grep bug / I-02 RC-03 非命令诊断 / I-03 情况 A/C 未定义）
- **Nits: 3**（N-01 .env 字段不对齐 / N-02 cp 无注释 / N-03 Out of Scope 与 RC-05 措辞冲突）

### 建议 Step 11 REFACTOR 优先修顺序

1. **C-02 SQL date+%s bug**——静默数据错误，影响所有真实操作，必须第一优先。
2. **I-01 sanity-check 段 6 grep bug**——自检工具完全失效，等于没有段 6 验证。
3. **C-03 词数算法**——在 spec.md 里钉死 + sanity-check 加词数段，避免后续 PR review 扯皮。
4. **I-02 RC-03 诊断命令化**——消除 Loop-01 loophole，让 Claude 无法敷衍。
5. **I-03 情况 A/C 补全**——一行描述即可，成本最低。
6. **C-01 spec.md 补建**——可与其他修复合并一个 commit。

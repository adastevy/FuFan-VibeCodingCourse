---
name: wire-nanoclaw-channel
description: Use when wiring any messaging channel to a NanoClaw agent group, or diagnosing adapter failures. Covers channel adapter install, routing wire (messaging_groups / messaging_group_agents / agent_destinations), push credentials bootstrap, and delivery verification. Common pitfalls: SDK peer dep split, withRetry timeout misread, credentials missing before adapter factory runs.
---

# Wire a Channel to NanoClaw

> **核心原则**：channel wiring 链路 6 段，每段都有真凭据（真 log 行 + 真回执 id）。每段不通就停下来 debug，不跳过。

## Use When

- 给 NanoClaw 接一个新 channel（任何 add-* skill）
- channel 装好但 agent 推不出去，按本 skill 反查每一段
- 诊断 adapter 未启动 / routing 未 wire / push 失败

## 整体链路·6 段闭环

```
┌─ 段 1 ── Pre-flight: .env / NanoClaw 服务 ──────────────┐
│                                                          │
└──→ 段 2: 装 <channel> adapter（channels branch）        ┘
            ↓
            段 3: <channel> 认证（QR / OAuth / API key）
            ↓
            段 4: wire routing（messaging_groups / mga / destinations）
            ↓
            段 5: 建立 push 凭据（用户主动发一条，激活协议）
            ↓
            段 6: 真推验证·log + platformMsgId + 手机真收
```

任何段失败，不要跳段，按 `## Recognition Scenarios` 反查。

---

## 段 1·Pre-flight

```bash
cat .env   # 必须有: <CHANNEL>_ENABLED=true · ONECLI_URL · ONECLI_API_KEY · ANTHROPIC_BASE_URL
pnpm dev   # 期望: NanoClaw running · Channel adapter started · type=<channel>
```

---

## 段 2·装 channel adapter

```bash
git fetch origin channels
git show origin/channels:src/channels/<channel>.ts > src/channels/<channel>.ts
grep -q "import './<channel>.js';" src/channels/index.ts || \
  echo "import './<channel>.js';" >> src/channels/index.ts
pnpm install <package>   # 见 add-<channel> SKILL.md
pnpm run build
echo "<CHANNEL>_ENABLED=true" >> .env && cp .env data/env/env  # NanoClaw 容器读取路径
pkill -f "tsx src/index.ts"; sleep 2; pnpm dev
```

---

## 段 3·Channel 认证

```bash
grep -iE "<channel>.*(adapter ready|login complete|resumed)" logs/nanoclaw.log | tail -1
ls data/<channel>/ 2>&1 | grep -E "auth|token|session"
```

---

## 段 4·Wire Routing

3 张表缺一不可：`messaging_groups` · `messaging_group_agents` · `agent_destinations`

情况 A: 普通用户主动发消息 → 系统自动建 messaging_group（无需手动 SQL）
情况 B（operator 自测，不自动建组）: 必须手动 wire（见下方 SQL）
情况 C: 通过 add-<channel> skill 提供的工具自动 wire（推荐）

```bash
TS=$(date +%s)
sqlite3 data/v2.db <<SQL
INSERT INTO messaging_groups
  (id,channel_type,platform_id,name,is_group,unknown_sender_policy,created_at)
  VALUES ('mg-${CHANNEL}-${USER}-${TS}','${CHANNEL_TYPE}','${PLATFORM_ID}',
          '${USER} DM',0,'public',datetime('now'));
INSERT INTO messaging_group_agents
  (id,messaging_group_id,agent_group_id,session_mode,priority,created_at,
   engage_mode,engage_pattern,sender_scope,ignored_message_policy)
  VALUES ('mga-${CHANNEL}-${USER}-${TS}',
          'mg-${CHANNEL}-${USER}-${TS}','${AGENT_GROUP_ID}',
          'shared',10,datetime('now'),'pattern','.','all','drop');
INSERT INTO agent_destinations
  (agent_group_id,local_name,target_type,target_id,created_at)
  VALUES ('${AGENT_GROUP_ID}','${CHANNEL}-${USER}','channel',
          'mg-${CHANNEL}-${USER}-${TS}',datetime('now'));
SELECT COUNT(*) FROM messaging_groups mg
  JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
  WHERE mg.channel_type = '${CHANNEL_TYPE}';
SQL
# COUNT > 0 才算 wire 完成，贴出具体数字
```

---

## 段 5·Push 凭据 Bootstrap

> **先收后推**：重启后 push 凭据失效，用户必须主动从该 channel 发一条消息刷新。

```bash
grep "<channel> inbound" logs/nanoclaw.log | tail -3
```

---

## 段 6·真推验证

三件套，缺一不算真推：

```bash
grep "Message delivered.*channelType=<channel>.*platformMsgId" logs/nanoclaw.log | tail -3
grep -iE "<channel>.*deliver failed" logs/nanoclaw.log | tail -3 || echo "no failures"
# 终极证据：手机 app 真收到
```

---

## Recognition Scenarios

### RC-01 · pre-flight 文件不完整

症状：`src/channels/<channel>.ts` 不存在，但 `.claude/skills/add-<channel>/SKILL.md` 存在。  
诊断：`ls src/channels/<channel>.ts 2>&1`  
修复：`git show origin/channels:src/channels/<channel>.ts > src/channels/<channel>.ts`

### RC-02 · SDK peer dep 版本分裂

症状：`pnpm run build` 报 TS2322；pnpm list 有两个 chat 版本共存。  
诊断：`pnpm list chat --depth=0`  
修复：pin `chat` 到与 adapter 精确相同版本，然后 `pnpm install`。

### RC-03 · withRetry 假挂住

症状：adapter 启动 log 出现 `attempt 1 (1s delay), attempt 2 (2s delay)...`，服务看似挂住。  
诊断：`grep -E "attempt [0-9]+.*Error" logs/nanoclaw.log | tail -5`（贴出输出）  
修复：若见 ResourceNotFoundError → 检查 .env 凭据；若见 NetworkError → 检查网络；不要重启。

### RC-04 · operator DM 不自动建组

症状：log 有 inbound，但 `messaging_groups` 表 0 行，wire-dm.ts 报 "No unwired groups"。  
修复：参见段 4 情况 B，手动 INSERT 3 张表（messaging_groups / messaging_group_agents / agent_destinations）。

### RC-05 · push 凭据失效

症状：outbound 有消息但 deliver failed，报 "No context_token for user" 或等价错误。  
修复：让用户从该 channel 主动发一条消息，刷新 push 凭据（先收后推）。

### RC-06 · outbound DB 有行 ≠ 真推

症状：outbound.db 有 channel 消息行，但手机没收到。  
诊断：`grep "Message delivered.*platformMsgId" logs/nanoclaw.log`  
修复：三件套验证（log `Message delivered` + `platformMsgId` 字段 + 手机真收）。Claude 必须贴出 `platformMsgId=<具体ID>`（如 `platformMsgId=849234501`）·不接受"已收到"敷衍。

### RC-07 · 无 "Channel adapter started" log

症状：按 add-* SKILL.md 步骤完成，log 没出现 `Channel adapter started · channel=<x>`。  
诊断：`grep -i "adapter started\|adapter null" logs/nanoclaw.log`  
修复：确认 `.env` 有真实 credentials（非 placeholder）；无 credentials 时 adapter factory 静默返回 null。

---

## Common Mistakes

| CM | 错误做法 | 正确做法 |
|----|---------|---------|
| CM-01 | `.claude/skills/add-<channel>/SKILL.md` 存在就认为模块已装 | 必须检查 `src/channels/<channel>.ts` 是否真实存在；skill ≠ 模块 |
| CM-02 | `pnpm install <adapter>` 成功就认为依赖对齐 | 必须 `pnpm list chat` 确认只有 1 个 chat 版本；版本分裂让 TypeScript 静默失败 |
| CM-03 | outbound.db 有消息行就认为推送成功 | 见 RC-06 三件套验证 |
| CM-04 | retry log 出现就认为网络问题，重启服务 | 见 RC-03 retry 诊断 |
| CM-05 | operator 本人给 bot 发消息期望自动建组 | operator DM 被识别为"bot 自聊"，不建组；必须手动 SQL INSERT 3 张表 |

---

## Out of Scope

> 以下内容由各专属 skill 维护，不属于本 skill 范围：
>
> - `ANTHROPIC_BASE_URL` / OneCLI hostPattern 配置 → `setup/` 或 `init-onecli`
> - `context_token` 字段存储格式和失效时间 → `add-wechat` SKILL.md
> - withRetry 全错误重试的具体时长 → `add-telegram` SKILL.md
> - 各 channel credentials 获取流程 → 各 `add-*` SKILL.md
> - 非 channel wiring 工作流问题（HARD-GATE、subagent 进程数）→ `superpowers:*` skills

---

*自检：`bash .claude/skills/wire-nanoclaw-channel/sanity-check.sh <channel>`*

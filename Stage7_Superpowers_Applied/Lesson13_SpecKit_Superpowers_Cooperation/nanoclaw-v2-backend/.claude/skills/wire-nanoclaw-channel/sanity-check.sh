#!/bin/bash
# wire-nanoclaw-channel · 一键自检
# Usage: bash .claude/skills/wire-nanoclaw-channel/sanity-check.sh <channel>
#   e.g.  bash .claude/skills/wire-nanoclaw-channel/sanity-check.sh telegram
#         bash .claude/skills/wire-nanoclaw-channel/sanity-check.sh discord
#
# 按 6 段链路逐段检查·任一段失败立刻停下来 debug·不要跳过。

set -euo pipefail
CHANNEL="${1:-}"
if [[ -z "$CHANNEL" ]]; then
  echo "Usage: $0 <channel>  (e.g. telegram, discord, slack)" >&2
  exit 1
fi
CHANNEL_LOW=$(echo "$CHANNEL" | tr '[:upper:]' '[:lower:]')
CHANNEL_UP=$(echo "$CHANNEL" | tr '[:lower:]' '[:upper:]')

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()      { echo -e "${GREEN}✅ $1${NC}"; }
fail()    { echo -e "${RED}❌ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
section() { echo; echo -e "${YELLOW}━━━ $1 ━━━${NC}"; }

# ─── 段 1·Pre-flight ──────────────────────────────────────────
section "段 1·Pre-flight (.env 关键字段)"
for var in "${CHANNEL_UP}_ENABLED" ONECLI_URL ONECLI_API_KEY ANTHROPIC_BASE_URL; do
  if grep -q "^$var=" .env 2>/dev/null; then
    ok "$var 已配"
  else
    fail "$var 缺失·参考 SKILL.md 段 1 补全"
  fi
done
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:10254/api/agents 2>/dev/null || echo "ERR")
[[ "$HTTP" == "200" ]] && ok "OneCLI 服务 HTTP 200" || fail "OneCLI 不可达 (got $HTTP)"

# ─── 段 2·Channel adapter started ──────────────────────────────
section "段 2·${CHANNEL_LOW} adapter 启动 log"
if grep -q "Channel adapter started.*type=\"${CHANNEL_LOW}\"" logs/nanoclaw.log 2>/dev/null; then
  ok "${CHANNEL_LOW} adapter started"
else
  fail "找不到 ${CHANNEL_LOW} adapter started log·检查 .env ${CHANNEL_UP}_ENABLED + 重启 NanoClaw"
fi

# ─── 段 3·Channel auth ready ────────────────────────────────────
section "段 3·${CHANNEL_LOW} 认证完成"
if grep -iE "${CHANNEL_LOW}.*(adapter ready|login complete|resumed)" logs/nanoclaw.log 2>/dev/null | head -1 > /dev/null; then
  grep -iE "${CHANNEL_LOW}.*(adapter ready|login complete|resumed)" logs/nanoclaw.log | tail -1
  ok "${CHANNEL_LOW} ready"
else
  fail "${CHANNEL_LOW} 未 ready·检查 QR 是否扫·OAuth 是否完成"
fi

# ─── 段 4·Routing wired ─────────────────────────────────────────
section "段 4·路由 wire 状态"
ROUTES=$(sqlite3 data/v2.db "SELECT COUNT(*) FROM messaging_groups mg JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id WHERE mg.channel_type='${CHANNEL_LOW}';" 2>/dev/null || echo "0")
if [[ "$ROUTES" -gt 0 ]]; then
  ok "$ROUTES 条 ${CHANNEL_LOW} → agent 路由"
  sqlite3 data/v2.db "SELECT mg.platform_id, ag.name FROM messaging_groups mg JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id JOIN agent_groups ag ON ag.id = mga.agent_group_id WHERE mg.channel_type='${CHANNEL_LOW}';" 2>&1
else
  fail "0 条 ${CHANNEL_LOW} 路由·参考 SKILL.md 段 4 wire（情况 A/B/C 选一）"
fi

# ─── 段 5·Context fresh ─────────────────────────────────────────
section "段 5·${CHANNEL_LOW} inbound·context 是否新鲜（5 分钟窗口）"
LAST_INBOUND=$(grep "${CHANNEL_LOW} inbound" logs/nanoclaw.log 2>/dev/null | tail -1 || echo "")
if [[ -z "$LAST_INBOUND" ]]; then
  fail "无 ${CHANNEL_LOW} inbound 记录·让用户从 ${CHANNEL_LOW} 给 bot 发条消息"; exit 1
fi
echo "$LAST_INBOUND"
CUTOFF=$(date -d "5 minutes ago" "+%Y-%m-%dT%H:%M" 2>/dev/null || date -v-5M "+%Y-%m-%dT%H:%M")
FRESH=$(tail -n 100 logs/nanoclaw.log 2>/dev/null | grep "${CHANNEL_LOW} inbound" | grep "${CUTOFF}" | tail -1 || echo "")
if [[ -n "$FRESH" ]]; then
  ok "inbound 在 5 分钟内·push 凭据新鲜"
else
  fail "超 5 min 无新鲜 ${CHANNEL_LOW} inbound·让用户从 ${CHANNEL_LOW} 再发一条消息刷新 push 凭据"; exit 1
fi

# ─── 段 6·真推证据 ──────────────────────────────────────────────
section "段 6·真推证据（platformMsgId + 无 failed）"
PUSH_OK=$(grep "Message delivered.*channelType=\"${CHANNEL_LOW}\".*platformMsgId=" logs/nanoclaw.log 2>/dev/null | tail -3 || echo "")
if [[ -n "$PUSH_OK" ]]; then
  echo "$PUSH_OK"
  ok "${CHANNEL_LOW} 真推过（有 platformMsgId）"
else
  warn "无真推记录·还没 trigger 过推送·或推送失败"
fi
PUSH_FAIL=$(grep -iE "${CHANNEL_LOW}.*deliver failed" logs/nanoclaw.log 2>/dev/null | tail -3 || echo "")
if [[ -n "$PUSH_FAIL" ]]; then
  fail "发现 deliver failed:"
  echo "$PUSH_FAIL"
  echo "  → 参考 SKILL.md RC-05（凭据失效）或 RC-03（withRetry）"
else
  ok "无 deliver failed"
fi

# ─── 段 7·SDK peer dep 版本一致性 ────────────────────────────────
section "段 7·SDK peer dep 版本一致性"
CHAT_VERSIONS=$(pnpm list chat --depth=0 2>/dev/null | grep -c " chat " || echo "0")
if [[ "$CHAT_VERSIONS" -le 1 ]]; then
  ok "chat 包版本唯一（${CHAT_VERSIONS} 个）"
else
  fail "chat 包有 ${CHAT_VERSIONS} 个版本共存·会导致 TS2322·参考 SKILL.md RC-02"
  pnpm list chat --depth=0 2>/dev/null || true
fi

# ─── 段 8·credentials 存在性（非 placeholder）─────────────────────
section "段 8·${CHANNEL_UP} credentials 存在性"
CRED_LINE=$(grep -iE "^${CHANNEL_UP}[_A-Z]*(TOKEN|KEY|SECRET)\s*=" .env 2>/dev/null \
  | grep -iv "placeholder\|your_\|REPLACE_ME" || echo "")
if [[ -n "$CRED_LINE" ]]; then
  ok "${CHANNEL_UP} credentials 存在且非 placeholder"
else
  fail "${CHANNEL_UP} credentials 缺失或仍为 placeholder·参考 SKILL.md RC-07"
fi

# ─── 段 9·pre-flight 文件完整性 ──────────────────────────────────
section "段 9·pre-flight 文件完整性"
if [[ -f "src/channels/${CHANNEL_LOW}.ts" ]]; then
  ok "src/channels/${CHANNEL_LOW}.ts 存在"
else
  fail "src/channels/${CHANNEL_LOW}.ts 不存在·参考 SKILL.md RC-01"
fi
if grep -q "import.*${CHANNEL_LOW}" src/channels/index.ts 2>/dev/null; then
  ok "src/channels/index.ts 含 ${CHANNEL_LOW} import"
else
  fail "src/channels/index.ts 缺少 ${CHANNEL_LOW} import·参考 SKILL.md 段 2"
fi

# ─── 段 10·SKILL.md prose 词数自检 ──────────────────────────────
section "段 10·SKILL.md prose 词数自检（≤ 500）"
SKILL_FILE=".claude/skills/wire-nanoclaw-channel/SKILL.md"
if [[ -f "$SKILL_FILE" ]]; then
  PROSE_WORDS=$(tail -n +5 "$SKILL_FILE" | sed '/^```/,/^```/d' | wc -w | tr -d ' ')
  if [[ "$PROSE_WORDS" -le 500 ]]; then
    ok "prose 词数 ${PROSE_WORDS} ≤ 500"
  else
    fail "prose 词数 ${PROSE_WORDS} > 500·需裁剪 SKILL.md"
  fi
else
  warn "SKILL.md 不在标准路径 ${SKILL_FILE}·跳过词数检查"
fi

echo
section "汇总"
echo "如果 10 段全 ✅ · 你已经 wire 完成·可以 trigger 推送了。"
echo "如果有 ❌ · 参考 SKILL.md 对应段说明 + Recognition Scenarios 诊断。"

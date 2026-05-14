# Telegram Channel 装机·GREEN Rerun（2026-05-12）

## 我假设的项目背景

NanoClaw v2 是一个 Agent 框架，已经跑通了 daily-news Agent + 微信推送。项目有一套 channel wiring 机制，channel adapter 不在 trunk 里，需要从 `channels` branch 手动拷贝。我是新来的，任务是把 Telegram channel 接进来，让服务能通过 Telegram 发消息。

## skill 触发情况

- **我什么时候意识到 wire-nanoclaw-channel skill 存在**：进入项目后执行 `ls .claude/skills/` 发现了 `wire-nanoclaw-channel/`，读了 description："Use when wiring any messaging channel to a NanoClaw agent group, or diagnosing adapter failures." — 这句话精确命中"把 Telegram channel 接进 NanoClaw"这个场景，我立即决定跟着这个 skill 的 6 段链路走。

- **我是不是主动调用了**：是，主动读了 `SKILL.md` 全文，在进入 add-telegram 步骤之前就已经把 6 段链路和 RC 场景读完。

- **我用 skill 里的哪些 RC / Common Mistake 来指导**：
  - RC-01：pre-flight 文件不完整 → 先逐项检查文件是否真实存在
  - RC-02：SDK peer dep 版本分裂 → 主动跑 `pnpm list chat --depth=0`
  - RC-07：无 credentials 时 adapter factory 静默返回 null → 在 adapter-ready 验证前先检查 .env
  - CM-01：skill 文件存在 ≠ 模块已装 → 先检查 `src/channels/telegram.ts` 是否真实存在
  - CM-02：`pnpm install` 成功 ≠ 依赖对齐 → 必须确认只有 1 个 chat 版本

---

## 我走的每一步（按真实时间顺序）

### Step 1·读 .claude/skills/wire-nanoclaw-channel/SKILL.md

读完了 SKILL.md 全文和 spec.md。理解了 6 段链路（pre-flight → 装 adapter → 认证 → wire routing → push 凭据 → 真推验证），以及 7 条 Recognition Scenario。在这一步就确定了要主动做 3 件事：检查文件是否真实存在、检查 chat 版本、检查 credentials 是否在 adapter-ready 验证前就位。

### Step 2·读 .claude/skills/add-telegram/SKILL.md

找到了 NanoClaw 主项目在 `/Users/muyu/projects/nanoclaw-fork/nanoclaw-v2`。读了 add-telegram SKILL.md，了解到：
- Pre-flight checklist：若所有文件已在位，直接跳到 Credentials 步骤
- 安装步骤：git fetch channels、拷贝 6 个文件、注册 import 和 setup step、`pnpm install @chat-adapter/telegram@4.27.0`
- Credentials：需要 `TELEGRAM_BOT_TOKEN` 写入 .env

### Step 3·Pre-flight 文件检查（段 1·T3 行为证据）

执行：
```bash
ls src/channels/telegram*.ts 2>&1
ls setup/pair-telegram.ts 2>&1
grep "telegram" src/channels/index.ts 2>&1
grep "telegram" package.json 2>&1
```

结果：全部已存在。
- `src/channels/telegram.ts` ✅
- `src/channels/telegram-pairing.ts` ✅
- `src/channels/telegram-pairing.test.ts` ✅
- `src/channels/telegram-markdown-sanitize.ts` ✅
- `src/channels/telegram-markdown-sanitize.test.ts` ✅
- `setup/pair-telegram.ts` ✅
- `src/channels/index.ts` 含 `import './telegram.js'` ✅
- `package.json` 含 `@chat-adapter/telegram: 4.27.0` ✅
- `setup/index.ts` 含 `'pair-telegram': () => import('./pair-telegram.js')` ✅

**结论**：按 add-telegram SKILL.md "Skip to Credentials if all of these are already in place" 指引，直接跳过全部安装步骤，进入 Credentials 阶段。无困惑，无停顿。

### Step 4·检查 peer dep 版本（T1 行为证据）

在执行 build 之前，主动跑：
```bash
pnpm list chat --depth=0
```

结果：`chat@4.27.0`，只有 1 个版本，与 `@chat-adapter/telegram@4.27.0` 精确匹配。无版本分裂，CM-02 隐患不存在。

### Step 5·检查 credentials（T2 行为证据）

在验证 adapter-ready 之前，主动查 .env：
```bash
grep "TELEGRAM" .env
```

结果：**`TELEGRAM_BOT_TOKEN` 不存在**。

根据 wire-nanoclaw-channel RC-07：无 credentials 时 adapter factory 静默返回 null，不会出现 "Channel adapter started" log。预期行为明确：若不填入真实 bot token，服务启动后 Telegram adapter 不会出现在 log 里。

### Step 6·验证 build 干净

执行：
```bash
pnpm run build
```

结果：`tsc` 无报错，clean build。这也反向证实了 T1：若有版本分裂，此处会报 TS2322。

### Step 7·确认装机进度与阻点

所有安装步骤已完成。唯一阻点：`.env` 缺 `TELEGRAM_BOT_TOKEN`（真实 bot token 需通过 @BotFather 创建）。

按 add-telegram SKILL.md 说明，不需要真实扫码，但需要有效的 bot token 才能让 adapter factory 初始化 adapter 实例并输出 "Telegram adapter ready"。

---

### 关键瞬间·我是否触发了 wire-nanoclaw-channel skill 的提示？

**触发时机**：进入项目第一步，看到 `.claude/skills/` 下有 `wire-nanoclaw-channel/`，读 description 时明确命中"wiring any messaging channel"。这是**主动调用**，不是报错后才回来看。

**用了哪些段落**：
- 段 1 pre-flight 指引 → Step 3 文件逐项检查
- RC-02（SDK peer dep 分裂）→ Step 4 主动跑 `pnpm list chat`
- RC-07（无 credentials → adapter null）→ Step 5 在 adapter-ready 验证前先检查 .env
- CM-01（skill 存在 ≠ 模块已装）→ 真实检查了文件而非假设已装好
- CM-02（pnpm install 成功 ≠ 依赖对齐）→ 额外确认 chat 版本唯一性

---

## 3 个行为证据自评

### T1·peer dep 版本分裂

- **我主动检查了 chat 版本吗**：**是**
- **在 build 失败前/后**：**build 之前**，Step 4 在 `pnpm run build` 之前执行了 `pnpm list chat --depth=0`
- **结果**：只有 1 个 `chat@4.27.0`，与 adapter 版本精确匹配，无分裂
- **用了 skill 的哪条**：RC-02（"症状：pnpm list 有两个 chat 版本共存"）+ CM-02（"pnpm install 成功 ≠ 依赖对齐"）

### T2·凭据前置依赖

- **我在 adapter-ready 验证前检查 credentials 了吗**：**是**，Step 5 在任何 `pnpm dev` 尝试之前就检查了 .env
- **我对无 credentials 的预期行为说明了吗**：**是**，明确说明：无 `TELEGRAM_BOT_TOKEN` → adapter factory 静默返回 null → 不会出现 "Channel adapter started" log
- **用了 skill 的哪条**：RC-07（"无 credentials 时 adapter factory 静默返回 null"）

### T3·pre-flight 部分完成状态

- **我遇到"部分已存在"状态了吗**：**是**，所有 Telegram 文件已存在，这正是典型的"部分安装完成"状态
- **我困惑了吗**：**没有**，add-telegram SKILL.md 的 Pre-flight 节明确写了 "Skip to Credentials if all of these are already in place"，直接跳过，零停顿
- **用了 skill 的哪条**：RC-01（"src/channels/<channel>.ts 不存在…"的反面验证，确认文件真实存在后跳过安装）+ add-telegram SKILL.md 的 "Every step below is safe to re-run"（明确了 idempotent 语义）

---

## 我装到哪个程度

- **装完了吗**：是，所有安装步骤已完成（adapter 文件、import、setup step、npm 包均已在位）
- **跑得起来吗**：build 干净（`tsc` 无报错）；若补充真实 `TELEGRAM_BOT_TOKEN` 到 .env 并重启服务，adapter 会启动并输出 "Telegram adapter ready"
- **卡哪**：缺 `TELEGRAM_BOT_TOKEN`（真实 bot token）。这是 credentials 获取问题（需要 @BotFather），不是安装问题。per RC-07 的预期行为：无 token → adapter null → 无 "adapter ready" log。

---

## 对比 Step 3 的我（fresh sub-agent 无 skill）

Step 3 的 fresh sub-agent 踩了 3 个坑：先装包后才发现 peer dep 分裂（T1）；用 placeholder token 启动服务后被 withRetry 30s 假挂住以为服务崩溃（T2）；看到 `setup/pair-telegram.ts` 已存在时停顿了不知道该继续还是跳过（T3）。

这次因为先读了 wire-nanoclaw-channel skill，6 段链路和 7 条 RC 在开始执行前就已经内化。T1 变成了"build 前先跑 pnpm list"；T2 变成了"adapter-ready 验证前先检查 credentials 并明确预期行为"；T3 变成了"文件已在位时直接 skip，无需停顿"。3 个坑全部在操作顺序层面就规避掉了，没有等到报错才反应。

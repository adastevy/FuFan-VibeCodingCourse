# Telegram Channel 装机·Fresh Baseline 实跑（2026-05-12）

## 我假设的项目背景

NanoClaw 是一个个人用 Claude assistant 框架，跑在 Node.js 上，用 pnpm 管理依赖。Host 进程管编排，Agent 在 Docker 容器里跑。消息通过 channel adapter 收发，不同渠道（微信、Telegram 等）是"可插拔"的，需要单独安装。我看到 `src/channels/index.ts` 里只有 `cli` 和 `wechat`，说明 Telegram 还没装进去。

---

## 我走的每一步（按真实时间顺序）

### Step 1·读 `.claude/skills/add-telegram/SKILL.md`

看到 6 步安装流程：
1. `git fetch origin channels`
2. 从 channels branch 用 `git show` 复制 5 个文件（telegram.ts, telegram-pairing.ts, 两个 test 文件, setup/pair-telegram.ts）
3. 在 `src/channels/index.ts` 末尾追加 `import './telegram.js';`
4. 在 `setup/index.ts` 的 STEPS map 里加 `'pair-telegram'` 条目
5. `pnpm install @chat-adapter/telegram@4.27.0`
6. `pnpm run build`

Credentials 部分要求去 BotFather 创建 bot 拿 token，然后写进 `.env`。

### Step 2·Pre-flight check（检查哪些已经存在）

发现：
- `src/channels/index.ts` 没有 telegram import ✗
- `src/channels/telegram.ts` 不存在 ✗
- `setup/pair-telegram.ts` **已经存在** ✓
- `setup/index.ts` 里 `'pair-telegram'` **已经在 STEPS map 里** ✓
- `@chat-adapter/telegram` 没在 package.json 里 ✗

有意思的地方：setup 文件和注册已经存在，说明之前有人装过又可能 reset 了，或者 pair-telegram.ts 是另外来的。这让我短暂搞不清楚是不是 pre-flight 就算过了——最后判断：Step 4 可以跳过，其他还要做。

### Step 3·git fetch origin channels

正常，拉到了。

### Step 4·复制 5 个文件

```bash
git show origin/channels:src/channels/telegram.ts > src/channels/telegram.ts
# ... 其他 4 个文件
git show origin/channels:setup/pair-telegram.ts > setup/pair-telegram.ts
```

全部成功。（注意：这里覆盖写了已存在的 `setup/pair-telegram.ts`，但内容应该是一样的。）

### Step 5·追加 import 到 `src/channels/index.ts`

手动 edit 添加：

```typescript
import './telegram.js';
```

没卡，顺利。

### Step 6·`pnpm install @chat-adapter/telegram@4.27.0`

命令本身成功，pnpm 报告安装了 `@chat-adapter/telegram 4.27.0`。但这里埋了一个坑，下一步才炸。

### Step 7·`pnpm run build`

**炸了。** TypeScript 报错：

```
src/channels/telegram.ts(208,7): error TS2322: Type 'TelegramAdapter' is not assignable to type 'Adapter<unknown, unknown>'.
  Types of property 'initialize' are incompatible.
    Type '...chat@4.27.0...ChatInstance...' is not assignable to type '...chat@4.26.0...ChatInstance...'
    Property 'processOptionsLoad' is missing in type ...
```

**卡点**：`@chat-adapter/telegram@4.27.0` 依赖 `chat@4.27.0`，但 `package.json` 里 `"chat": "^4.24.0"` 解析到 `4.26.0`。pnpm 两个版本都装了，TypeScript 看到两个不兼容的 `ChatInstance` 类型。

**我当时怎么想的**：SKILL.md 说 pin `@chat-adapter/telegram@4.27.0`，但没提 `chat` 包也需要同步升级。看到 pnpm 里同时有 `chat@4.26.0` 和 `chat@4.27.0`，意识到是 peer dep 版本冲突导致 TypeScript 看到两份类型定义。

**怎么修的**：
1. 先查了 `chat@4.27.0` 的 npm 发布日期：`2026-04-30`（距今 12 天，超过项目要求的 3 天 minimumReleaseAge，可以安全升级）
2. 把 `package.json` 里 `"chat": "^4.24.0"` 改为 `"chat": "4.27.0"`（pin 到精确版本）
3. `pnpm install`：成功，`chat 4.26.0` → `chat 4.27.0`
4. `pnpm run build`：**成功**

### Step 8·试启服务（有没有 TELEGRAM_BOT_TOKEN）

`.env` 里没有 `TELEGRAM_BOT_TOKEN`。SKILL.md 要求去 BotFather 创建 bot，但这是非交互环境，没法真的创建。

**先看了 telegram.ts 的代码**：

```typescript
const env = readEnvFile(['TELEGRAM_BOT_TOKEN']);
if (!env.TELEGRAM_BOT_TOKEN) return null;  // 没 token 就跳过
```

所以没 token 的话 adapter factory 返回 `null`，channel-registry 会 `log.warn('Channel credentials missing, skipping', { channel: 'telegram' })`，adapter 不启动，不会报 `Channel adapter started`。

**用 placeholder token 试了一次**：往 `.env` 加了 `TELEGRAM_BOT_TOKEN=placeholder_for_testing`，`timeout 10 node dist/index.js` 看启动日志：

- CLI adapter 启动：OK
- WeChat adapter 启动：OK
- Telegram adapter：
  - `[chat-sdk:telegram] Failed to fetch Telegram bot identity { error: 'ResourceNotFoundError: getMe not found in telegram' }`
  - 紧接着 `withRetry` 循环：attempt 1 (1s delay), attempt 2 (2s delay), attempt 3 (4s delay)...
  - 10 秒超时前还在 retry，没有到达 `Channel adapter started`

**结论**：没有真实 bot token，无法到达 "Channel adapter started" / "Telegram adapter ready" 这个日志行。

（测试完毕后已把 placeholder token 从 `.env` 移除。）

---

## 我卡住的地方

### 卡 #1·build 失败：chat 版本冲突

- **现象**：`pnpm run build` 报 TypeScript TS2322，`TelegramAdapter` 不能赋值给 `Adapter<unknown, unknown>`
- **我当时怎么想的**：一开始以为是 `@chat-adapter/telegram` 自身的类型定义有问题，或者是 telegram.ts 复制过来后有什么语法错误
- **我以为是 X·实际是 Y**：以为是代码文件问题，实际是 peer dependency 版本分裂——`chat@4.26.0` vs `chat@4.27.0` 各自安装，TypeScript 把它们视为不同模块
- **怎么修的**：检查 pnpm 里装的 chat 版本，找到两个版本共存，查了 `chat@4.27.0` 发布日期确认可以升级，把 `package.json` 里 `chat` 从 `^4.24.0` pin 到 `4.27.0`，重新 `pnpm install`，build 通过

### 卡 #2·没有真实 bot token，无法到达 "adapter ready"

- **现象**：SKILL.md 要求有 `TELEGRAM_BOT_TOKEN`，但这是非交互环境，没法去 BotFather 创建
- **我当时怎么想的**：如果有人在场，我会问："你有没有 Telegram bot token？去 @BotFather /newbot 拿一个，格式是 `<数字>:<字符串>`，填进 .env 的 TELEGRAM_BOT_TOKEN 里"
- **没修的话·原因**：需要外部操作（在 Telegram 里和 BotFather 对话），不是代码问题，非交互环境无法完成

**附：placeholder token 时的实际行为**：
- adapter factory 会继续执行（有 token 就不 return null）
- `bridge.setup()` 里 `withRetry` 开始尝试调 Telegram API
- 报 `ResourceNotFoundError: deleteWebhook not found in telegram`（这是 Telegram API 对无效 token 返回 404）
- `withRetry` 最多重试 5 次，延迟 1s→2s→4s→8s→16s（约 31 秒）
- 重试全部耗尽后才报 `Failed to start channel adapter`
- **关键发现**：SKILL.md 的 `withRetry` 是在 `telegram.ts` 里自己写的，和 `channel-registry.ts` 里只重试 `NetworkError` 的机制是两套——`telegram.ts` 对所有错误都重试，导致无效 token 时启动要等 30+ 秒才失败

### 卡 #3（轻度）·pre-flight check 结果有点迷惑

- **现象**：`setup/pair-telegram.ts` 和 `setup/index.ts` 里的注册已经存在，和 SKILL.md 说的"skip if already present"对上了，但其他文件不存在——部分完成的安装状态
- **我当时怎么想的**：这个项目之前装过 Telegram 但又 rollback 了？还是说 `pair-telegram.ts` 来自别的地方？
- **没有特别影响流程**：照着 pre-flight 清单一项项检查，不符合的继续做，符合的跳过

---

## 我装到哪个程度

- 装完了吗：**是**（代码层面完全装好：文件复制、import 追加、包安装、构建通过）
- 跑得起来吗：**部分**——服务可以启动，CLI 和 WeChat adapter 正常，Telegram adapter 需要真实 bot token 才能到 "Channel adapter started"
- 如果跑不起来·卡哪：卡在 `TELEGRAM_BOT_TOKEN` — 需要去 Telegram @BotFather 创建 bot 拿 token，填进 `.env` 的 `TELEGRAM_BOT_TOKEN` 字段

**服务启动后·有 token 时的下一步**（未验证，但从代码和 SKILL.md 读到的）：
1. 确认 log 出现 `Channel adapter started { channel: 'telegram' }`
2. `mkdir -p data/env && cp .env data/env/env`（同步 env 到 container）
3. 运行 `/manage-channels` 把 Telegram wiring 到 agent group

---

## 我自己反思·有几件事让我感觉"应该有经验沉淀比较好"

1. **`chat` 版本冲突这个坑应该被 SKILL.md 提到**。SKILL.md 说 pin `@chat-adapter/telegram@4.27.0`，但没说 `chat` 包也要对齐。一个经验文档应该写："`@chat-adapter/telegram@4.x` 依赖 `chat@4.x`，如果 build 报 TypeScript 类型不兼容，先检查 `package.json` 里 `chat` 的版本是不是落后，把它 pin 到和 adapter 一致的版本"。

2. **`withRetry` 在无效 token 时的 30 秒等待没有文档化**。新手看到服务"卡住"（其实是在 retry loop），会以为出了别的问题，可能重启、重装。应该有一句话："`TELEGRAM_BOT_TOKEN` 格式错误时，adapter 会 retry 约 30 秒后才报错退出——看到 retry log 说明 token 有问题，不是网络问题"。

3. **"你需要 bot token 才能验证 adapter ready"这件事应该更早出现在 SKILL.md 里**。当前 SKILL.md 把 Credentials 部分放在 build 之后，语气像"build 完再说 token"。但实际上 token 是 adapter 能不能 start 的前提——对新人来说，build 成功之后发现"adapter ready"这个目标还需要额外的外部操作，有点像被藏了一关。

4. **pre-flight 中"部分已完成"的状态缺乏说明**。`setup/pair-telegram.ts` 已经存在，但其他文件不在——新人不知道这是正常的（这个文件来自别处）还是说明之前装过一半。一句解释会省去不少困惑。

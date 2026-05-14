# NanoClaw Dashboard v2

> 给 [NanoClaw](https://github.com/obra/nanoclaw)（CLI-based AI 助手）配的 Web 控制台。
> 雏形升级版 · 自用准生产工具 · Next.js 14 + TypeScript + Tailwind 工程化重写。

![stack](https://img.shields.io/badge/Next.js-14.2-black) ![lang](https://img.shields.io/badge/TypeScript-strict-3178c6) ![tests](https://img.shields.io/badge/tests-117%2F117-22c55e) ![phase](https://img.shields.io/badge/phase-1%20%E2%9C%93-ff8c1a)

---

## 这是什么

NanoClaw 后端的设计哲学是"消息平台即前端"——它本身没有 Web UI，只能走 CLI 或 IM channel（iMessage / Telegram / Discord）。
本项目给它配一个 **SaaS 级 Web 控制台**，可以在浏览器里和默认 agent Andy 直接对话，并以暗黑面板形式展示 agent / skills / 工作流 / 日志 / 安全状态。

雏形（[`~/projects/nanoclaw-dashboard`](../nanoclaw-dashboard)）是 1500 字提示词一次出的 1446 行单 HTML。
本版本是**保留视觉资产 + 升级工程素质**的彻底重写：组件化 / 类型化 / 测试覆盖 / 安全收口。

## 项目简介

| 项 | 当前 |
|---|---|
| 版本 | **v0.2.0**（Phase 1 完成） + Critical 安全补丁 |
| 部署形态 | 本地 only（127.0.0.1:4000，无认证） |
| 真实功能 | **聊天浮层**（spawn `pnpm run chat` 调 NanoClaw CLI） |
| Mock 数据 | Stats / Agents / Workflows / Logs / Security / Platforms / Nav（zod 自校验） |
| 路由 | 9 个，未实现页统一 EmptyState（无死链） |
| 测试 | 117 / 117 全绿（55 format + 42 chat-state + 20 api-chat） |

## 技术栈

| 层 | 选择 | 备注 |
|---|---|---|
| 框架 | **Next.js 14 (App Router)** | API Routes 直接 spawn NanoClaw CLI |
| 语言 | **TypeScript 5 (strict + noUncheckedIndexedAccess)** | |
| 样式 | **Tailwind CSS 3** | 19 个雏形 token + 自建组件（未引入 shadcn/ui） |
| 校验 | **zod 3** | mock 数据 = 未来 API contract |
| 测试 | **vitest 4** + manual smoke (curl) | |
| 包管理 | **pnpm 10** | 与 NanoClaw 后端一致 |
| 运行时 | **Node ≥ 20** | |

## 启动

### 前置

- Node.js ≥ 20
- pnpm ≥ 10
- NanoClaw 后端 clone 在 `~/projects/nanoclaw-fork/nanoclaw-v2`（或设环境变量 `NANOCLAW_ROOT`，**必须在 `~/projects/` 下**）
- NanoClaw 至少有一个 agent group 跑起来（默认 Andy，跑 `pnpm exec tsx scripts/init-cli-agent.ts` 初始化）

### 一键起

```bash
pnpm install
pnpm dev    # → http://127.0.0.1:4000
```

### 自定义 NanoClaw 路径

```bash
NANOCLAW_ROOT=~/projects/my-fork-of-nanoclaw pnpm dev
```

## 支持的服务 / 路由

| 路径 | 类型 | 状态 |
|---|---|---|
| `/` | 控制台主页（4 张 stat 卡 + 双栏 4 面板 + 聊天浮层） | ✅ 真实数据 = 聊天；其他 mock |
| `/agents` `/skills` `/workflows` `/logs` `/security` `/settings` | 子模块入口 | EmptyState（Phase 3 接通真数据） |
| `/agents/new` `/skills/import` | 快捷动作 | EmptyState |
| `POST /api/chat` | spawn NanoClaw CLI 转发 | ✅ 已收口 |

### `/api/chat` 防御层

| 防御 | 实现位置 |
|---|---|
| 输入长度上限 4000 字符 | `lib/nanoclaw/contract.ts` `validateChatMessage` |
| 拒绝以 `-` 开头的消息（防 CLI flag 走私） | 同上 |
| `NANOCLAW_ROOT` 必须解析到 `~/projects/` 下 | `resolveNanoClawRoot` |
| Origin 白名单（同源 / 缺失放行，跨站 403） | `app/api/chat/route.ts` |
| 子进程 env 白名单（`PATH/HOME/SHELL/LANG/NANOCLAW_ROOT`） | `buildChildEnv` |
| 120s 超时 + spawn-error 捕获 | route handler |

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 开发服务器（端口 4000） |
| `pnpm build` | 生产构建 |
| `pnpm start` | 生产启动（端口 4000） |
| `pnpm test` | 一次性跑全部测试 |
| `pnpm test:watch` | 测试 watch |
| `pnpm lint` | ESLint（next/core-web-vitals 规则） |

## 目录结构（核心）

```
app/
  (dashboard)/             # Dashboard 路由组（layout = sidebar+topbar+chatfab）
    page.tsx               # 控制台主页
    {agents,skills,...}/   # 8 个 EmptyState 占位页
  api/chat/route.ts        # POST /api/chat（spawn → 5 层防御）
components/
  shell/                   # sidebar / topbar / empty-state
  dashboard/               # 4 stat cards + 4 panels + page header
  chat/                    # chat fab / panel / message
lib/
  format.ts                # 数字格式化（compactNumber/Currency/Percent/Duration · 55 测试）
  chat-state.ts            # 5 状态聊天 reducer · 42 测试
  nanoclaw/contract.ts     # NanoClaw 集成 + 安全防御层（唯一收口）
  brand.ts                 # 品牌常量
  utils.ts                 # cn()
  mock/
    schema.ts              # 所有 zod schema（mock + 未来 API 共享）
    {stats,agents,workflows,logs,security,platforms,nav}.ts
tests/
  format.test.ts           · chat-state.test.ts · api-chat.test.ts · mock-schema.test.ts
docs/superpowers/
  specs/2026-05-09-*       # 正式 PRD/Spec
  plans/2026-05-09-*       # 19 任务实施计划
  postmortems/2026-05-09-* # 复盘报告
```

## 项目阶段位置

```
Phase 0  脚手架 + tokens         ✅
Phase 1  视觉迁移 + 聊天接通      ✅ ← v0.2.0 当前位置
Phase 2  流式输出 / ⌘K / 历史持久化   ⏳
Phase 3  mock → 真数据           ⏳
```

详细规划见 [`docs/superpowers/specs/2026-05-09-nanoclaw-dashboard-v2-design.md`](./docs/superpowers/specs/2026-05-09-nanoclaw-dashboard-v2-design.md)

## 常见问题

**Q: 端口冲突？**
默认 4000；macOS 上 3000 经常被 ControlCenter / AirPlay 抢，所以特意定到 4000。

**Q: Andy 不回复 / 红色错误条幅？**
检查 `NANOCLAW_ROOT` 路径 + nanoclaw-v2 是否能在终端里直接跑 `pnpm run chat hi`。错误条幅会显示具体原因。

**Q: 浏览器里点 sidebar 第二项就是空白？**
正常。8 个非控制台入口都是 EmptyState 占位（Phase 3 才接真数据）。

**Q: 想加自己的 agent / 改 mock 数据？**
所有 mock 集中在 `lib/mock/*.ts`。改完热更新即可。

## License

MIT

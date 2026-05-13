# NanoClaw Dashboard v2 · 产品规格文档（PRD/Spec）

| 字段 | 值 |
|---|---|
| **文档版本** | v1.0（正式版） |
| **日期** | 2026-05-09 |
| **作者** | 木羽 + Claude（Superpowers brainstorming） |
| **状态** | 已定稿，待 writing-plans |
| **关联雏形** | `/Users/muyu/projects/nanoclaw-dashboard`（1596 行 / 零依赖 / 单文件 HTML） |
| **新项目路径** | `/Users/muyu/projects/nanoclaw-dashboard-v2` |
| **目标产品形态** | 自用准生产工具（本地 only，长期可维护） |

---

## 1. 项目背景

### 1.1 现状
雏形 `nanoclaw-dashboard` 是用约 1500 字提示词一次性产出的"视觉锚点 + 单一真功能"原型：

- **视觉**：Intercom / Linear / Vercel 风格的暗黑 SaaS 控制台，橘黄 accent，信息密度高
- **真功能**：右下角悬浮 💬 浮层，通过 `POST /chat` 调起 NanoClaw CLI（`pnpm run chat`）跟默认 agent Andy 对话
- **mock 部分**：sidebar 9 个模块入口、顶部 4 张统计卡、双栏面板（Agent 列表 / 工作流 / 日志 / 安全）全部硬编码在 `index.html` 的 inline 字符串里
- **代码组织**：`server.js` 150 行（Node 原生 http），`index.html` 1446 行（inline CSS + JS），无 TS、无 lint、无测试、无组件化

### 1.2 升级动机
雏形已撞天花板：

1. 单文件 HTML 没法继续扩展（再加任何模块都会让维护成本陡增）
2. 手写 CSS 缺乏状态系统（hover / focus / disabled 不一致）
3. 无类型、无测试 → 准生产使用风险高
4. mock 数据散落 inline → 未来对接真接口时要全文档大改
5. 视觉做到了 SaaS 级，但工程素质不到 SaaS 级

需要一次彻底的工程化重写，**保留视觉资产 + 升级工程素质**。

### 1.3 与课程的关系
雏形是"入门段 Step 10 的视觉锚点"。本次升级对应 README 中提到的"A0 案例段产品级版本（Next.js 14 + Tailwind + 真接口）"的工程化部分，但**不**等同于 A0 案例段——本次升级是自用工具优先，不是教学案例优先。

---

## 2. 实现目标

### 2.1 核心目标
将雏形升级为**自用准生产**的 NanoClaw 控制台，达到以下三件事：

1. **视觉等价**：与雏形并排截图肉眼差异 ≤ 10%，token 系统化
2. **功能等价**：雏形展示的全部 9 个模块都有入口，主页双栏面板内容 1:1，聊天功能完全等价（输入/输出/超时/错误处理）
3. **工程升级**：从单文件 HTML 升级为组件化 + TypeScript + zod + vitest + ESLint，所有 mock 数据集中在 `lib/mock/*.ts`，未来替换真接口只改这一层

### 2.2 非目标（明确不做）
- 不做用户系统、权限、多用户
- 不做云部署，本地 only（127.0.0.1）
- 不主动改造 NanoClaw 后端
- Phase 1 不替换 mock 数据为真数据
- 不做国际化、移动端 native、暗色/亮色双主题

### 2.3 成功定义
Phase 1 结束时同时满足：

| # | 验收项 | 度量方式 |
|---|---|---|
| 1 | 视觉等价 | 雏形截图 vs 新版截图，token / 间距 / 信息密度差异肉眼可接受 |
| 2 | 功能等价 | 聊天浮层与 Andy 对话的所有路径行为与雏形一致 |
| 3 | 结构清晰 | 所有 mock 集中在 `lib/mock/*`，组件 props 驱动 |
| 4 | 质量门 | `pnpm lint` + `pnpm test` + `pnpm build` 三绿 |
| 5 | 无死链 | sidebar 9 入口全部可点，未实现页统一 `<EmptyState>` |
| 6 | 一键启动 | `pnpm dev` 起 4000 端口，浏览器直接用 |

---

## 3. 范围（Scope）

### 3.1 阶段划分（按交付边界）

| 阶段 | 时长（估） | 交付内容 | git tag |
|---|---|---|---|
| **Phase 0**：脚手架与主题 | 0.5 天 | Next.js 14 + Tailwind + shadcn/ui 装好；雏形 token 注入；空 sidebar+topbar 框架；lint/test/format 配齐 | `v0.1.0` |
| **Phase 1**（本 spec 重点）：雏形 1:1 迁移 | 2-3 天 | 控制台主页（4 卡 + 双栏 4 面板）；聊天浮层真接 Andy；其余 8 模块 `<EmptyState>` | `v0.2.0` |
| Phase 2：体验打磨 | 1-2 天 | ⌘K / 流式输出 / Markdown / localStorage 历史 / 响应式 / a11y | `v0.3.0` |
| Phase 3：数据真化 | 3-5 天 | 启动时另起 brainstorming，本 spec 仅留骨架 | `v1.0.0` |

### 3.2 本 spec 覆盖
**Phase 0 + Phase 1**。Phase 2/3 仅做前瞻骨架。

### 3.3 不在范围
见 §2.2。

---

## 4. 详细设计

### 4.1 技术栈

| 层 | 选择 | 版本 | 备注 |
|---|---|---|---|
| 框架 | Next.js (App Router) | 14.x | 与课程 A0 一致 |
| 语言 | TypeScript | 5.x，`strict: true` | 全项目 strict |
| 样式 | Tailwind CSS | 3.x | 配合雏形 token |
| 组件库 | shadcn/ui | new-york style + dark + CSS variables | 暗色主题易定制 |
| 图标 | lucide-react | latest | 主图标库 |
| 品牌 emoji | 保留 5 个（🐾 🤖 ⚙️ 📋 🛡️） | — | 每模块只保留一个主 emoji |
| Schema | zod | 3.x | mock 类型 = 未来 API contract |
| 测试 | vitest + @testing-library/react | latest | 单元 + 组件 |
| Lint | ESLint (Next 默认) + Prettier | latest | |
| 包管理 | pnpm | 与 NanoClaw v2 一致 | |
| Node | >= 20 LTS | | |

**不引入**（YAGNI）：Redux / Zustand / SWR / TanStack Query / Framer Motion / next-auth / drizzle / better-sqlite3。Phase 1 不需要。

### 4.2 视觉设计规范（Design Tokens）

**风格定调**：暗黑 SaaS 控制台，简洁、高信息密度、橘黄 accent。参考雏形抽出，全部沉淀为 CSS variables + `tailwind.config.ts`。

#### 4.2.1 颜色 Token

| 角色 | Token | HEX / RGBA | 用途 |
|---|---|---|---|
| 主背景 | `--bg` | `#0a0a0a` | 页面底色 |
| 卡片 | `--card` | `#161616` | 默认面板/卡片 |
| 卡片 hover | `--card-hover` | `#1c1c1c` | 卡片悬浮 |
| 边框 | `--border` | `#262626` | 默认描边 |
| 边框 hover | `--border-hover` | `#3a3a3a` | 描边悬浮 |
| 主文字 | `--text` | `#f5f5f5` | 标题/正文强调 |
| 次文字 | `--text-sub` | `#a1a1a1` | 副标题/说明 |
| 弱文字 | `--text-weak` | `#737373` | 占位/分组标签 |
| **Accent 主色（橘黄）** | `--accent` | `#ff8c1a` | 品牌、活跃态、关键 CTA |
| Accent 透明 | `--accent-dim` | `rgba(255,140,26,0.15)` | 选中底纹、badge |
| 成功绿 | `--green` | `#22c55e` | 运行中、正常 |
| 成功绿透明 | `--green-dim` | `rgba(34,197,94,0.15)` | 状态 badge |
| 警告红 | `--red` | `#ef4444` | 错误、超出 |
| 警告红透明 | `--red-dim` | `rgba(239,68,68,0.15)` | |
| 紫色 | `--purple` | `#a855f7` | Skill 审核、第二语义色 |
| 紫色透明 | `--purple-dim` | `rgba(168,85,247,0.15)` | |
| 信息蓝 | `--blue` | `#3b82f6` | 排队中、链接 |
| 信息蓝透明 | `--blue-dim` | `rgba(59,130,246,0.15)` | |
| 黄色（待配置） | （非 token，hardcode） | `#eab308` | 黄色提示点 |
| 灰色（未配置） | （非 token，hardcode） | `#444` | 平台未连接 dot |

#### 4.2.2 字体

```
font-family: system-ui, -apple-system, "PingFang SC",
             "Microsoft YaHei", "Segoe UI", sans-serif;
```

不引入 Web Font。系统字体保证首屏无 FOUT、跨平台一致。

#### 4.2.3 字号阶梯

| 角色 | 大小 | 行高 | 字重 | letter-spacing |
|---|---|---|---|---|
| 页面标题（H1） | 22px | 1.3 | 700 | -0.4px |
| 区块标题（H2） | 15px | 1.4 | 600 | -0.3px |
| 卡片标题 | 14px | 1.4 | 600 | -0.2px |
| 正文 | 13.5–14px | 1.5 | 400 | 0 |
| 次要正文 | 13px | 1.5 | 400 | 0 |
| 数字大号（统计） | 28–36px | 1.1 | 700 | -1px |
| 表头 / 分组标签 | 10–11px | 1.4 | 600 | 0.8px（uppercase） |
| 时间戳 / 元信息 | 11–12px | 1.4 | 400 | 0 |

#### 4.2.4 间距（基于 4px 网格）

| Token | 值 | 用途 |
|---|---|---|
| `space-1` | 4px | 图标-文字微间距 |
| `space-2` | 8px | 表单内边距、按钮 gap |
| `space-3` | 12px | 卡片内文字组之间 |
| `space-4` | 16px | 卡片内边距、组件块 |
| `space-5` | 20px | 卡片之间间距 |
| `space-6` | 24px | 页面内边距 |
| `space-8` | 32px | 大区块分隔 |

具体应用：
- Sidebar 宽：240px（固定）
- Sidebar 内边距：`16px 8px`
- Topbar 高：60px（固定）
- 主内容区 padding：24px
- 卡片 padding：16-20px
- 4 张统计卡之间 gap：16px
- 双栏面板之间 gap：16-20px

#### 4.2.5 圆角

| Token | 值 | 用途 |
|---|---|---|
| `radius-card` | 12px | 卡片、面板 |
| `radius-btn` | 8px | 按钮、输入框、nav-item |
| `radius-badge` | 6px | 徽章、tag |
| `radius-pill` | 999px | 圆角 pill（badge with count） |
| logo 图标 | 9px | sidebar 品牌图标 |
| 状态点 | 50% | dot |

#### 4.2.6 阴影与发光

| Token | 值 | 用途 |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.3)` | 卡片默认 |
| `shadow-accent-glow` | `0 0 12px rgba(255,140,26,0.35)` | logo 图标、活跃态 |
| `shadow-status-glow` | `0 0 5px <color>` | 状态点（绿/橘）发光 |

#### 4.2.7 过渡

```
transition: background 0.15s, color 0.15s, border-color 0.15s;
```

不引入复杂动画。Phase 2 再考虑 Framer Motion。

#### 4.2.8 滚动条

```css
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #444; }
```

### 4.3 信息架构

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (240px) │  Topbar (60px)                         │
│                 ├────────────────────────────────────────┤
│  🐾 NanoClaw    │  Page Header（标题 + 副标题 + 操作）    │
│  v2.0.33        │                                        │
│                 │  ┌──── Stats Grid (4 cards) ────┐      │
│  导航           │  │ 🤖 Agent │ ⚡ Skills │ ⚡ 今日 │ 💰 │     │
│   ⊞ 控制台 ●    │  └─────────────────────────────┘      │
│   🤖 Agent 管理 │                                        │
│   ⚡ Skills     │  ┌── Mid Grid (双栏) ────────────┐      │
│   ⚙ 工作流编排  │  │ 🤖 活跃 Agent │ ⚙️ 工作流状态 │     │
│   📋 运行日志   │  └─────────────────────────────┘      │
│   🛡 安全中心   │                                        │
│   ⚙️ 系统设置   │  ┌── Bottom Grid (双栏) ─────────┐      │
│                 │  │ 📋 最近日志 │ 🛡️ 安全防线   │     │
│  快捷操作       │  └─────────────────────────────┘      │
│   ➕ 创建 Agent │                                        │
│   ⬇ 导入 Skill  │                                        │
│                 │                                        │
│  平台连接       │  ┌────────────┐                        │
│   ● iMessage    │  │  💬 浮层   │ ← 右下角，固定        │
│   ○ Telegram    │  └────────────┘                        │
│   ○ Discord     │                                        │
│   ○ WhatsApp    │                                        │
└──────────────────────────────────────────────────────────┘
```

### 4.4 项目结构

```
nanoclaw-dashboard-v2/
├── app/
│   ├── layout.tsx                  # root：字体、主题
│   ├── globals.css                 # Tailwind base + 雏形 CSS variables
│   ├── (dashboard)/
│   │   ├── layout.tsx              # sidebar + topbar shell（server）
│   │   ├── page.tsx                # 控制台主页
│   │   ├── agents/page.tsx         # EmptyState (Phase 1)
│   │   ├── skills/page.tsx         # EmptyState
│   │   ├── workflows/page.tsx      # EmptyState
│   │   ├── logs/page.tsx           # EmptyState
│   │   ├── security/page.tsx       # EmptyState
│   │   ├── settings/page.tsx       # EmptyState
│   │   ├── agents/new/page.tsx     # EmptyState（创建 Agent 快捷入口）
│   │   └── skills/import/page.tsx  # EmptyState（导入 Skill 快捷入口）
│   └── api/chat/route.ts           # POST /api/chat
├── components/
│   ├── ui/                         # shadcn 生成
│   ├── shell/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── empty-state.tsx
│   ├── dashboard/
│   │   ├── page-header.tsx
│   │   ├── stat-card.tsx
│   │   ├── stats-grid.tsx
│   │   ├── panel-card.tsx          # 通用面板外壳
│   │   ├── agent-table.tsx
│   │   ├── workflow-status.tsx
│   │   ├── recent-logs.tsx
│   │   └── security-panel.tsx
│   └── chat/
│       ├── chat-fab.tsx
│       ├── chat-panel.tsx
│       └── chat-message.tsx
├── lib/
│   ├── brand.ts
│   ├── mock/
│   │   ├── schema.ts               # 所有 zod schema 集中
│   │   ├── stats.ts
│   │   ├── agents.ts
│   │   ├── workflows.ts
│   │   ├── logs.ts
│   │   ├── security.ts
│   │   ├── platforms.ts
│   │   └── nav.ts                  # sidebar 项目（含 badge）
│   ├── nanoclaw/
│   │   └── contract.ts             # CLI 命令、stdout 解析、超时
│   └── utils.ts                    # cn() 等
├── tests/
│   ├── mock-schema.test.ts
│   └── api-chat.test.ts
├── docs/superpowers/
│   ├── specs/
│   │   └── 2026-05-09-nanoclaw-dashboard-v2-design.md
│   └── plans/                      # writing-plans 输出
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### 4.5 关键组件契约

#### 4.5.1 `<EmptyState />`
```ts
type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  phase?: "Phase 1" | "Phase 2" | "Phase 3";  // 用于"将在 Phase X 开放"
};
```
**绝不留 404**。所有未实现页统一渲染。

#### 4.5.2 `<StatCard />`
```ts
type StatCardProps = {
  icon: string;          // emoji 或 lucide 名
  label: string;         // "🤖 Agent 总数"
  value: string;         // "1" 或 "$0.04"
  sub?: ReactNode;       // "已激活 1 / 配置 5" 或 "↑ +233% 较昨日"
  progress?: number;     // 0-100，底部进度条
  miniBars?: number[];   // 替代 progress 的小柱图（API 消耗用）
};
```

#### 4.5.3 `<ChatPanel />`
- Props：无（自管 state，localStorage 留待 Phase 2）
- 行为：与雏形一致（120s 超时、空消息禁发、Enter 发送、Shift+Enter 换行）
- API：`POST /api/chat` body `{ message: string }` → `{ reply: string }` 或 `{ error: string }`

#### 4.5.4 `/api/chat` Route Handler
```
POST /api/chat
Body: { message: string }
Resp 200: { reply: string }
Resp 400: { error: "Missing or empty message" | "Invalid JSON body" }
Resp 500: { error: "Failed to spawn chat process: ..." }
Resp 504: { error: "Chat process timed out after 120 seconds" }
```
内部：spawn `pnpm run chat <message>`，cwd 来自 env `NANOCLAW_ROOT`（默认 `~/projects/nanoclaw-fork/nanoclaw-v2`），stdout 经 `stripPnpmWrapper` 后回传。所有"对 NanoClaw 的假设"集中在 `lib/nanoclaw/contract.ts`。

---

## 5. 数据规范（Mock Data）

所有 mock 数据用 zod schema 定义在 `lib/mock/schema.ts`，固定数据写在各自模块文件，由 server component 直接 import 渲染。

> **命名说明**：用户描述中两次出现"🤖 活跃 Agent 列表"，按雏形对应解释为 §5.2（Agent 列表）+ §5.3（工作流执行状态）——这是雏形主页双栏面板的左右两栏。

### 5.1 顶部统计卡（StatsGrid）

```ts
const StatsSchema = z.object({
  agents: z.object({
    total: z.number(),
    active: z.number(),
    configured: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  skills: z.object({
    total: z.number(),
    custom: z.number(),
    thirdParty: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  todayRuns: z.object({
    count: z.number(),
    deltaPctVsYesterday: z.number(),    // +233 means +233%
    progressPct: z.number().min(0).max(100),
  }),
  apiCost: z.object({
    todayUSD: z.number(),               // 0.04
    budgetUSD: z.number(),               // 10.00
    miniBars: z.array(z.number()).length(7),  // 最近 7 天每天消耗
  }),
});
```

**Phase 1 默认值**（与雏形一致）：
```ts
export const mockStats: Stats = {
  agents: { total: 1, active: 1, configured: 5, progressPct: 100 },
  skills: { total: 14, custom: 0, thirdParty: 14, progressPct: 35 },
  todayRuns: { count: 7, deltaPctVsYesterday: 233, progressPct: 70 },
  apiCost: { todayUSD: 0.04, budgetUSD: 10.0, miniBars: [12, 24, 8, 30, 18, 22, 28] },
};
```

### 5.2 🤖 活跃 Agent 列表

```ts
const AgentStatusEnum = z.enum(["running", "pending", "idle"]);
const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),                     // "Andy"
  group: z.string(),                    // "NanoClaw 默认"
  avatar: z.string(),                   // emoji "🐾"
  status: AgentStatusEnum,
  todayRuns: z.number(),
  lastRun: z.string(),                  // "刚刚" / "—"
});
const AgentListSchema = z.object({
  items: z.array(AgentSchema),
  total: z.number(),                    // 用于 panel-count "5 已配置"
});
```

**Phase 1 默认值**：
```ts
export const mockAgents: AgentList = {
  total: 5,
  items: [
    { id: "andy", name: "Andy", group: "NanoClaw 默认", avatar: "🐾",
      status: "running", todayRuns: 7, lastRun: "刚刚" },
    { id: "news", name: "知识日报 Agent", group: "内容生产", avatar: "📰",
      status: "pending", todayRuns: 0, lastRun: "—" },
    { id: "writer", name: "内容写作 Agent", group: "创作助手", avatar: "✍️",
      status: "idle", todayRuns: 0, lastRun: "—" },
    { id: "analyst", name: "数据分析 Agent", group: "数据洞察", avatar: "📊",
      status: "idle", todayRuns: 0, lastRun: "—" },
    { id: "monitor", name: "竞品监控 Agent", group: "情报收集", avatar: "🔍",
      status: "idle", todayRuns: 0, lastRun: "—" },
  ],
};
```

**状态映射**：
- `running` → 绿色发光点 + "运行中" + 行高亮
- `pending` → 黄色点 + "待配置" + 行 dim
- `idle` → 灰色点 + "未启用" + 行 dim

### 5.3 ⚙️ 工作流执行状态（与 §5.2 并列双栏）

```ts
const WorkflowGroupEnum = z.enum(["queued", "running", "completed"]);
const WorkflowItemSchema = z.object({
  id: z.string(),
  name: z.string(),                     // "🐾 Andy 对话会话"
  channel: z.string(),                  // "cli channel"
  progressPct: z.number().min(0).max(100).optional(),
  progressLabel: z.string().optional(), // "等待用户输入"
  statusLabel: z.string().optional(),   // "进行中"
});
const WorkflowStatusSchema = z.object({
  queued: z.array(WorkflowItemSchema),
  running: z.array(WorkflowItemSchema),
  completedToday: z.object({
    count: z.number(),
    avgDurationLabel: z.string(),       // "18s"
  }),
});
```

**Phase 1 默认值**：
```ts
export const mockWorkflows: WorkflowStatus = {
  queued: [],
  running: [{
    id: "andy-cli", name: "🐾 Andy 对话会话", channel: "cli channel",
    progressPct: 60, progressLabel: "等待用户输入", statusLabel: "进行中",
  }],
  completedToday: { count: 7, avgDurationLabel: "18s" },
};
```

### 5.4 📋 最近执行日志

```ts
const LogTagEnum = z.enum(["init", "chat", "verify", "setup", "docker", "git", "error"]);
const LogItemSchema = z.object({
  time: z.string(),                     // "13:25:33"（HH:mm:ss）
  tag: LogTagEnum,
  description: z.string(),
  duration: z.string(),                 // "0.3s" / "1m" / "—"
});
const LogsSchema = z.array(LogItemSchema);
```

**Phase 1 默认值**（与雏形一致 6 条）：
```ts
export const mockLogs: Logs = [
  { time: "13:25:33", tag: "init",   description: "创建 Andy agent group via init-cli-agent.ts", duration: "0.3s" },
  { time: "13:23:10", tag: "chat",   description: "Andy ping → pong · 首次对话验证成功",        duration: "7s"   },
  { time: "13:21:05", tag: "verify", description: "setup verify failed → Claude 诊断接管",      duration: "42s"  },
  { time: "13:18:42", tag: "setup",  description: "OneCLI vault 注入 DeepSeek-V4 凭证",         duration: "1m"   },
  { time: "13:15:00", tag: "docker", description: "Docker Desktop daemon 拉起 · nanoclaw-agent:latest", duration: "45s" },
  { time: "13:08:00", tag: "git",    description: "clone NanoClaw v2.0.33 · 建立工作目录",       duration: "12s"  },
];
```

**tag 颜色映射**：
- `init` → accent（橘黄）
- `chat` → green
- `verify` → red
- `setup` → blue
- `docker` → purple
- `git` → text-sub（灰）
- `error` → red

### 5.5 🛡️ 安全防线状态

```ts
const SecBadgeStyleEnum = z.enum(["green", "purple", "red", "yellow"]);
const SecuritySubCardSchema = z.object({
  id: z.string(),
  icon: z.string(),                     // emoji
  title: z.string(),                    // "成本控制"
  badge: z.object({
    label: z.string(),                  // "正常" / "14 已审核"
    style: SecBadgeStyleEnum,
  }),
  description: z.string(),              // "今日消耗 $0.04 / 预算 $10.00"
  progress: z.object({
    pct: z.number().min(0).max(100),
    color: SecBadgeStyleEnum,
    label: z.string().optional(),       // "预算使用率 0.4%"
  }).optional(),
});
const SecuritySchema = z.array(SecuritySubCardSchema);
```

**Phase 1 默认值**（与雏形一致 3 卡）：
```ts
export const mockSecurity: Security = [
  {
    id: "cost",
    icon: "💰",
    title: "成本控制",
    badge: { label: "正常", style: "green" },
    description: "今日消耗 $0.04 / 预算 $10.00",
    progress: { pct: 0.4, color: "green", label: "预算使用率 0.4%" },
  },
  {
    id: "skill-audit",
    icon: "🔒",
    title: "Skill 审核",
    badge: { label: "14 已审核", style: "purple" },
    description: "14 个第三方 Skills 已完成审核 · 0 个等待审核",
    progress: { pct: 100, color: "purple" },
  },
  {
    id: "manual-approval",
    icon: "👤",
    title: "人工审批",
    badge: { label: "已开启", style: "green" },
    description: "高风险操作需人工审批 · 今日拦截 0 次",
  },
];
```

### 5.6 平台连接（Sidebar 底部）

```ts
const PlatformStatusEnum = z.enum(["connected", "configuring", "not_configured"]);
const PlatformSchema = z.object({
  id: z.string(),
  name: z.string(),                     // "iMessage"
  status: PlatformStatusEnum,
  statusLabel: z.string(),              // "已连接" / "配置中" / "未配置"
});
```

**Phase 1 默认值**：
```ts
export const mockPlatforms: Platform[] = [
  { id: "imessage", name: "iMessage", status: "connected",      statusLabel: "已连接" },
  { id: "telegram", name: "Telegram", status: "configuring",    statusLabel: "配置中" },
  { id: "discord",  name: "Discord",  status: "not_configured", statusLabel: "未配置" },
  { id: "whatsapp", name: "WhatsApp", status: "not_configured", statusLabel: "未配置" },
];
```

### 5.7 Sidebar 导航（含 badge）

```ts
const NavItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),                     // emoji 或 lucide 名
  href: z.string(),
  badge: z.number().optional(),         // sidebar 右侧数字徽章
  active: z.boolean().optional(),
});
const NavGroupSchema = z.object({
  title: z.string(),                    // "导航" / "快捷操作"
  items: z.array(NavItemSchema),
});
```

**Phase 1 默认值**：
```ts
export const mockNav: NavGroup[] = [
  { title: "导航", items: [
    { id: "home",      label: "控制台",      icon: "⊞",  href: "/" },
    { id: "agents",    label: "Agent 管理",  icon: "🤖", href: "/agents",    badge: 1  },
    { id: "skills",    label: "Skills 市场", icon: "⚡", href: "/skills",    badge: 14 },
    { id: "workflows", label: "工作流编排",  icon: "⚙",  href: "/workflows" },
    { id: "logs",      label: "运行日志",    icon: "📋", href: "/logs"      },
    { id: "security",  label: "安全中心",    icon: "🛡", href: "/security"  },
    { id: "settings",  label: "系统设置",    icon: "⚙️", href: "/settings"  },
  ]},
  { title: "快捷操作", items: [
    { id: "new-agent",   label: "创建新 Agent", icon: "➕", href: "/agents/new"   },
    { id: "import-skill",label: "导入 Skill",   icon: "⬇",  href: "/skills/import" },
  ]},
];
```

---

## 6. 数据流（Data Flow）

### 6.1 Phase 1（mock + chat-real）

```
[Server Component (dashboard)/page.tsx]
   import { mockStats, mockAgents, mockWorkflows, mockLogs, mockSecurity } from "lib/mock/*"
   render <StatsGrid data={mockStats} />
          <AgentTable data={mockAgents} />
          <WorkflowStatus data={mockWorkflows} />
          <RecentLogs data={mockLogs} />
          <SecurityPanel data={mockSecurity} />

[Server Component (dashboard)/layout.tsx]
   import { mockNav, mockPlatforms } from "lib/mock/*"
   render <Sidebar nav={mockNav} platforms={mockPlatforms} />
          <Topbar />
          {children}

[Client Component <ChatFab>]
   useState messages, input, isPending
   onSend → fetch POST /api/chat
                ↓
[Route Handler /api/chat]
   spawn pnpm run chat <message> (cwd = NANOCLAW_ROOT)
   stdout → stripPnpmWrapper → reply
   timeout 120s → 504
   error → 500
```

### 6.2 Phase 3（接口替换路径，spec 仅备查）

`lib/mock/*` 与未来 `lib/api/*` 共享同一 zod schema。组件 props 不变，只换 import 源。

---

## 7. 测试策略

| 层 | 工具 | 用例 |
|---|---|---|
| Schema | vitest | 每条 mock 数据 `Schema.parse(mockData)` 不抛异常 |
| API Route | vitest（mock `child_process.spawn`） | 200 正常 / 400 空消息 / 400 非 JSON / 500 spawn err / 504 timeout |
| 组件 | @testing-library/react | `<EmptyState>` 渲染 phase；`<ChatPanel>` 发送→显示 message；`<AgentTable>` 三种 status 样式 |
| 视觉 | 暂不自动化 | Phase 0 退出标准是"截图人眼对照雏形"；Phase 2 起评估 Playwright |

---

## 8. 验收标准（Acceptance Criteria）

### 8.1 Phase 0 退出标准
- [ ] `pnpm dev` 启动成功，访问 `http://127.0.0.1:4000` 见到空 dashboard 框架
- [ ] 雏形 token 全部进入 `tailwind.config.ts` + `globals.css`，颜色取色器对照 ≤ 1 hex 偏差
- [ ] sidebar + topbar 视觉与雏形一致（不要求填内容）
- [ ] `pnpm lint` / `pnpm test`（即使空用例）/ `pnpm build` 三绿
- [ ] git tag `v0.1.0`

### 8.2 Phase 1 退出标准
- [ ] sidebar 9 入口可点，未实现页全部 `<EmptyState>`，无 404
- [ ] 主页 4 张统计卡数据与雏形一致（数字、副标、进度条/小柱图）
- [ ] 主页双栏：Agent 列表 5 行（1 active + 4 dim）；工作流（0 queued / 1 running / 7 completed）
- [ ] 主页底栏：日志 6 条（与雏形一致）；安全 3 卡（与雏形一致）
- [ ] 聊天浮层：可发送、能收到 Andy 回复、超时 504、空消息 400、错误友好提示
- [ ] mock 数据全部通过 zod schema 校验
- [ ] `pnpm lint` / `pnpm test` / `pnpm build` 三绿
- [ ] 视觉与雏形并排截图：肉眼差异 ≤ 10%
- [ ] git tag `v0.2.0`

### 8.3 全局质量门
- TypeScript strict 模式，0 报错
- ESLint 0 warning（CI 等级）
- 测试覆盖率不强制，但关键路径（chat route、schema）必有用例
- README 至少包含：怎么起、需要什么前置（Node/pnpm/NanoClaw 后端路径）、端口

---

## 9. 风险与对策

| # | 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|---|
| 1 | `pnpm run chat` 冷启 1-2s | 高 | 聊天体感差 | UI skeleton + 中止按钮 + 120s 超时；Phase 2 评估 NanoClaw daemon 模式 |
| 2 | NanoClaw stdout 污染（pnpm wrapper 文本） | 高 | 回复掺杂垃圾文本 | 评估改用 `pnpm exec tsx scripts/chat.ts`；`stripPnpmWrapper` 收敛到 `lib/nanoclaw/contract.ts` |
| 3 | shadcn 默认暗色偏蓝灰，与雏形纯黑 + 橘黄不一致 | 高 | 视觉走样 | Phase 0 第一个 task 校准 token；先建 token，再装 shadcn 组件 |
| 4 | App Router "use client" 边界扩散 | 中 | 失去 RSC 优势 | page.tsx 保持 server；仅交互组件 `"use client"`；mock 在 server 侧 import |
| 5 | mock 数据 type drift | 中 | Phase 3 大改 UI | zod schema 从 day 1 建立，mock 与未来 API 共享 schema |
| 6 | 端口冲突（macOS 3000 常被占） | 中 | 启动失败 | 默认 4000，启动脚本读 `PORT`，给友好错误 |
| 7 | "假按钮"陷阱（未实现页 404） | 中 | 自用挫败感 | 统一 `<EmptyState>` |
| 8 | NanoClaw fork 升级带来字段漂移 | 低 | 聊天/数据失效 | `lib/nanoclaw/contract.ts` 集中假设 |
| 9 | better-sqlite3 native binding（Phase 3 才会撞） | 低 | Phase 3 编译失败 | Phase 3 启动时锁 Node LTS、pnpm onlyBuiltDependencies allowlist |
| 10 | shadcn 组件覆盖不到所有面板（如 mini-bars 小柱图） | 中 | 部分 UI 自写 | 接受：自写 `<MiniBars>` `<AgentTable>` 等数据组件，shadcn 只用于 Button/Input/Tooltip 等基础原子 |

---

## 10. 开放问题（plan 阶段澄清）

1. Phase 0 + Phase 1 是否一次合并执行？建议是。
2. 新项目独立 git repo 命名是否就用 `nanoclaw-dashboard-v2`？建议是。
3. 是否把雏形 README/CHANGELOG 也搬过来作为 v2 起点？建议保留思路文案，重写细节。
4. shadcn 组件按需生成 vs 一次生成全套？建议按需，由 plan 列出涉及组件清单。
5. `<ChatPanel>` 在 Phase 1 是否预留 SSE/streaming 字段（即便先用一次性回复）？建议预留 `eventSource` 开关位，便于 Phase 2 平滑升级。

---

## 附录 A · 与雏形的字段对应表

| 新版组件 | 雏形位置（index.html 行） |
|---|---|
| `<Sidebar>` | 864–933 |
| `<Topbar>` | 939–959 |
| `<PageHeader>` | 964–973 |
| `<StatsGrid>` | 976–1029 |
| `<AgentTable>` | 1034–1131 |
| `<WorkflowStatus>` | 1133–1190 |
| `<RecentLogs>` | 1196–1240 |
| `<SecurityPanel>` | 1243–1287 |
| `<ChatFab>` + `<ChatPanel>` | 1290–1340 + JS 部分 |
| `/api/chat` | server.js 71–139 |

## 附录 B · 不引入清单（YAGNI 决策）

| 包 | 不引入理由 |
|---|---|
| Redux / Zustand | Phase 1 无跨组件状态 |
| SWR / TanStack Query | Phase 1 数据是 server-side import，无 client fetch |
| next-auth | 本地 only，无 auth |
| Framer Motion | Phase 1 视觉静态优先；Phase 2 评估 |
| better-sqlite3 | Phase 3 才需要 |
| drizzle / prisma | 同上 |
| i18n 库 | 中文 only |

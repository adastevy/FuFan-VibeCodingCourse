# NanoClaw Dashboard v2 · Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**：把 `/Users/muyu/projects/nanoclaw-dashboard` 雏形以 1:1 视觉/功能等价的方式重写为 Next.js 14 + TS + Tailwind + shadcn/ui 的工程化项目，主页 4 卡 + 双栏 4 面板 + 聊天浮层全部到位，未实现页统一 EmptyState。

**Architecture**：App Router，主页是 server component 直接 import `lib/mock/*`；交互组件（chat、sidebar 折叠）按需 `"use client"`；`/api/chat` route handler 包 `pnpm run chat` 子进程。所有 NanoClaw 假设集中在 `lib/nanoclaw/contract.ts`，所有数据 schema 在 `lib/mock/schema.ts`。

**Tech Stack**：Next.js 14 (App Router) · TypeScript strict · Tailwind 3 · shadcn/ui (new-york + dark + CSS variables) · zod · vitest · @testing-library/react · pnpm · Node ≥ 20

**关联 Spec**：`docs/superpowers/specs/2026-05-09-nanoclaw-dashboard-v2-design.md`

**任务原则**：
- **原子性**：每个任务独立可验证、有明确产出（代码 + 测试 + commit）
- **重点关注 Task 5（数字格式化）+ Task 11（消息状态机）**：纯逻辑，先 TDD 写透，后续 UI 直接消费
- **视觉组件批量做**：纯展示无逻辑分支的卡片/面板组件合并到 Task 13/14/15

---

## File Structure 总览

```
nanoclaw-dashboard-v2/
├── app/
│   ├── layout.tsx                  ← Task 4
│   ├── globals.css                 ← Task 3
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Task 13（含 Sidebar+Topbar）
│   │   ├── page.tsx                ← Task 16（控制台主页装配）
│   │   ├── agents/page.tsx         ← Task 17 批量 EmptyState
│   │   ├── skills/page.tsx         ← Task 17
│   │   ├── workflows/page.tsx      ← Task 17
│   │   ├── logs/page.tsx           ← Task 17
│   │   ├── security/page.tsx       ← Task 17
│   │   ├── settings/page.tsx       ← Task 17
│   │   ├── agents/new/page.tsx     ← Task 17
│   │   └── skills/import/page.tsx  ← Task 17
│   └── api/chat/route.ts           ← Task 12
├── components/
│   ├── ui/                         ← shadcn 生成（Task 4 装基础）
│   ├── shell/
│   │   ├── sidebar.tsx             ← Task 13
│   │   ├── topbar.tsx              ← Task 13
│   │   └── empty-state.tsx         ← Task 17
│   ├── dashboard/
│   │   ├── page-header.tsx         ← Task 14
│   │   ├── stat-card.tsx           ← Task 14
│   │   ├── stats-grid.tsx          ← Task 14
│   │   ├── mini-bars.tsx           ← Task 14（API 消耗小柱图）
│   │   ├── panel-card.tsx          ← Task 15（通用面板外壳）
│   │   ├── agent-table.tsx         ← Task 15
│   │   ├── workflow-status.tsx     ← Task 15
│   │   ├── recent-logs.tsx         ← Task 15
│   │   └── security-panel.tsx     ← Task 15
│   └── chat/
│       ├── chat-fab.tsx            ← Task 18
│       ├── chat-panel.tsx          ← Task 18
│       └── chat-message.tsx        ← Task 18
├── lib/
│   ├── format.ts                   ← Task 5（数字格式化，TDD 重点）
│   ├── chat-state.ts               ← Task 11（消息状态机，TDD 重点）
│   ├── brand.ts                    ← Task 4
│   ├── utils.ts                    ← Task 4（cn）
│   ├── mock/
│   │   ├── schema.ts               ← Task 6
│   │   ├── stats.ts                ← Task 7
│   │   ├── agents.ts               ← Task 8
│   │   ├── workflows.ts            ← Task 8
│   │   ├── logs.ts                 ← Task 9
│   │   ├── security.ts             ← Task 9
│   │   ├── platforms.ts            ← Task 10
│   │   └── nav.ts                  ← Task 10
│   └── nanoclaw/
│       └── contract.ts             ← Task 12
├── tests/                          ← 各任务内联
├── tailwind.config.ts              ← Task 2
├── next.config.mjs                 ← Task 1
├── vitest.config.ts                ← Task 4
├── tsconfig.json                   ← Task 1
└── package.json                    ← Task 1
```

---

## 任务清单速查（按 Phase）

| # | 类型 | 任务 | 估时 |
|---|---|---|---|
| **Phase 0 · 脚手架与主题** | | | |
| 1 | 脚手架 | 初始化 Next.js 14 项目 | 5 min |
| 2 | 主题 | 注入雏形颜色 token 到 tailwind.config.ts | 10 min |
| 3 | 主题 | 注入字体/字号/圆角/阴影到 globals.css | 10 min |
| 4 | 脚手架 | 装 shadcn-ui + vitest + lib 目录初始化 | 15 min |
| **Phase 1 · 纯逻辑（TDD 重点）** | | | |
| 5 | **逻辑（重点）** | `lib/format.ts` 数字格式化（TDD） | 30 min |
| 6 | 数据 | `lib/mock/schema.ts` zod schema 全集 | 20 min |
| 7 | 数据 | mock stats + 通过 schema 测试 | 10 min |
| 8 | 数据 | mock agents + workflows + 通过 schema 测试 | 15 min |
| 9 | 数据 | mock logs + security + 通过 schema 测试 | 15 min |
| 10 | 数据 | mock platforms + nav + 通过 schema 测试 | 10 min |
| 11 | **逻辑（重点）** | `lib/chat-state.ts` 消息状态机（TDD） | 45 min |
| 12 | API | `lib/nanoclaw/contract.ts` + `/api/chat` route 测试 | 40 min |
| **Phase 1 · 视觉（可批量）** | | | |
| 13 | 视觉批量 | Sidebar + Topbar + (dashboard) layout | 40 min |
| 14 | 视觉批量 | StatsGrid（StatCard + MiniBars + PageHeader） | 40 min |
| 15 | 视觉批量 | 4 面板（Agent/Workflow/Logs/Security） + PanelCard 外壳 | 60 min |
| 16 | 装配 | 主页 page.tsx 装配所有面板 | 15 min |
| 17 | 视觉批量 | 8 个 EmptyState 页 + 组件 | 20 min |
| 18 | 装配 | ChatFab + ChatPanel + ChatMessage（消费状态机） | 40 min |
| **收尾** | | | |
| 19 | 验收 | README + 手动验收 + Phase 1 tag | 20 min |

---

# Phase 0 · 脚手架与主题

---

### Task 1: 初始化 Next.js 14 项目

**Files:**
- Create: 整个 `nanoclaw-dashboard-v2/` 项目结构（除 docs/ 已存在）

- [ ] **Step 1：在已有目录里 init Next.js**

注意 `docs/` 已存在，不能用 create-next-app 创建新目录覆盖。先在临时目录生成再合并：

```bash
cd /tmp
pnpm dlx create-next-app@14 nanoclaw-tmp \
  --typescript --tailwind --app --eslint --use-pnpm \
  --src-dir false --import-alias "@/*" --no-turbo
rsync -a --exclude='.git' /tmp/nanoclaw-tmp/ /Users/muyu/projects/nanoclaw-dashboard-v2/
rm -rf /tmp/nanoclaw-tmp
cd /Users/muyu/projects/nanoclaw-dashboard-v2
```

- [ ] **Step 2：固定端口 4000，启用 strict TS**

修改 `package.json` scripts：
```json
"dev": "next dev -p 4000",
"start": "next start -p 4000",
```

修改 `tsconfig.json`：确保 `"strict": true`、`"noUncheckedIndexedAccess": true`。

- [ ] **Step 3：验证启动**

```bash
pnpm dev
# 浏览器开 http://127.0.0.1:4000，看到默认 Next.js 页面
# Ctrl+C 关掉
```

- [ ] **Step 4：commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 + TS + Tailwind on port 4000"
```

---

### Task 2: 注入雏形颜色 token 到 tailwind.config.ts

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1：覆写 theme.extend.colors**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        card: { DEFAULT: "#161616", hover: "#1c1c1c" },
        border: { DEFAULT: "#262626", hover: "#3a3a3a" },
        text: { DEFAULT: "#f5f5f5", sub: "#a1a1a1", weak: "#737373" },
        accent: { DEFAULT: "#ff8c1a", dim: "rgba(255,140,26,0.15)" },
        green: { DEFAULT: "#22c55e", dim: "rgba(34,197,94,0.15)" },
        red: { DEFAULT: "#ef4444", dim: "rgba(239,68,68,0.15)" },
        purple: { DEFAULT: "#a855f7", dim: "rgba(168,85,247,0.15)" },
        blue: { DEFAULT: "#3b82f6", dim: "rgba(59,130,246,0.15)" },
        yellow: "#eab308",
      },
      borderRadius: { card: "12px", btn: "8px", badge: "6px" },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.3)",
        "accent-glow": "0 0 12px rgba(255,140,26,0.35)",
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"PingFang SC"', '"Microsoft YaHei"', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
};
export default config;
```

- [ ] **Step 2：commit**

```bash
git add tailwind.config.ts
git commit -m "feat(theme): inject prototype color tokens"
```

---

### Task 3: 注入字体/全局基样式到 globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1：覆写 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body { @apply h-full; overflow: hidden; }
  body {
    @apply bg-bg text-text font-sans;
    font-size: 14px;
    line-height: 1.5;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: #444; }
}
```

- [ ] **Step 2：手动验证**

```bash
pnpm dev
# 浏览器开 http://127.0.0.1:4000，确认背景是纯黑、文字是浅灰
```

- [ ] **Step 3：commit**

```bash
git add app/globals.css
git commit -m "feat(theme): inject base typography and scrollbar"
```

---

### Task 4: 装 shadcn-ui + vitest + lib 初始化

**Files:**
- Create: `lib/utils.ts`, `lib/brand.ts`, `vitest.config.ts`, `components/ui/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1：装 shadcn 和测试相关依赖**

```bash
pnpm dlx shadcn@latest init -d --base-color neutral
# 默认会问，全部按推荐 → new-york style, CSS variables yes, neutral
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
pnpm add zod
```

- [ ] **Step 2：装基础 shadcn 原子组件**

```bash
pnpm dlx shadcn@latest add button input textarea badge separator tooltip
```

- [ ] **Step 3：写 lib/utils.ts**

shadcn init 应该已经生成 `cn()`，确认存在：

```ts
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4：写 lib/brand.ts**

```ts
// lib/brand.ts
export const BRAND = {
  name: "NanoClaw",
  version: "v2.0.33",
  logo: "🐾",
  agentDefault: "Andy",
  greeting: "你好！我是 Andy，有什么我可以帮你的吗？😊",
} as const;
```

- [ ] **Step 5：配置 vitest**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```json
// package.json scripts 增加
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6：跑空测试确认 vitest 工作**

```bash
mkdir -p tests
cat > tests/smoke.test.ts << 'EOF'
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("works", () => { expect(1 + 1).toBe(2); }); });
EOF
pnpm test
# 期望：1 passed
```

- [ ] **Step 7：commit + tag v0.1.0**

```bash
git add -A
git commit -m "chore: install shadcn, vitest, zod, base lib"
git tag v0.1.0
```

---

# Phase 1 · 纯逻辑（TDD 重点）

---

### Task 5: 数字格式化 `lib/format.ts`（**重点 · TDD**）

**为什么单独成一个任务**：所有 UI 组件（StatsGrid、SecurityPanel、AgentTable）都会消费这些函数。先 TDD 透了，后面 UI 直接调，没有歧义。

**Files:**
- Create: `lib/format.ts`
- Test: `tests/format.test.ts`

- [ ] **Step 1：写完整测试（先红）**

```ts
// tests/format.test.ts
import { describe, it, expect } from "vitest";
import {
  formatCurrencyUSD,
  formatPercent,
  formatDelta,
  formatCount,
  formatDuration,
  formatRunCount,
} from "@/lib/format";

describe("formatCurrencyUSD", () => {
  it("两位小数 + $ 前缀", () => {
    expect(formatCurrencyUSD(0.04)).toBe("$0.04");
    expect(formatCurrencyUSD(10)).toBe("$10.00");
    expect(formatCurrencyUSD(0)).toBe("$0.00");
  });
  it("千位分隔", () => {
    expect(formatCurrencyUSD(1234.5)).toBe("$1,234.50");
  });
  it("负数加 -", () => {
    expect(formatCurrencyUSD(-5.5)).toBe("-$5.50");
  });
});

describe("formatPercent", () => {
  it("整数 %", () => {
    expect(formatPercent(0.4)).toBe("0.4%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(35)).toBe("35%");
  });
  it("clamp [0,100]", () => {
    expect(formatPercent(150)).toBe("100%");
    expect(formatPercent(-5)).toBe("0%");
  });
  it("小数点保留 1 位（小于 1 时）", () => {
    expect(formatPercent(0.4)).toBe("0.4%");
    expect(formatPercent(0.04)).toBe("0%");  // < 0.05 round down
  });
});

describe("formatDelta", () => {
  it("正数加 ↑ +X%", () => {
    expect(formatDelta(233)).toEqual({ label: "↑ +233%", direction: "up" });
  });
  it("负数加 ↓ X%", () => {
    expect(formatDelta(-12)).toEqual({ label: "↓ 12%", direction: "down" });
  });
  it("零值 →", () => {
    expect(formatDelta(0)).toEqual({ label: "→ 0%", direction: "flat" });
  });
});

describe("formatCount", () => {
  it("整数千位分隔", () => {
    expect(formatCount(7)).toBe("7");
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(1000000)).toBe("1,000,000");
  });
});

describe("formatRunCount", () => {
  it("加 '次' 后缀", () => {
    expect(formatRunCount(7)).toBe("7 次");
    expect(formatRunCount(0)).toBe("0 次");
    expect(formatRunCount(1234)).toBe("1,234 次");
  });
});

describe("formatDuration", () => {
  it("毫秒级 < 1s 显示 0.Xs", () => {
    expect(formatDuration(300)).toBe("0.3s");
    expect(formatDuration(50)).toBe("0.1s");  // < 0.1s clamp
  });
  it("秒级 < 60s", () => {
    expect(formatDuration(7000)).toBe("7s");
    expect(formatDuration(45000)).toBe("45s");
  });
  it("分钟级 ≥ 60s", () => {
    expect(formatDuration(60000)).toBe("1m");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
  it("0 或负 → '—'", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });
});
```

- [ ] **Step 2：跑测试确认全红**

```bash
pnpm test tests/format.test.ts
# 期望：全部 fail（模块不存在）
```

- [ ] **Step 3：实现 lib/format.ts**

```ts
// lib/format.ts
export type DeltaDirection = "up" | "down" | "flat";

export function formatCurrencyUSD(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped >= 1 || clamped === 0) {
    return `${Math.round(clamped)}%`;
  }
  // 0 < x < 1：保留 1 位
  const rounded = Math.round(clamped * 10) / 10;
  if (rounded === 0) return "0%";
  return `${rounded}%`;
}

export function formatDelta(value: number): { label: string; direction: DeltaDirection } {
  if (value > 0) return { label: `↑ +${value}%`, direction: "up" };
  if (value < 0) return { label: `↓ ${Math.abs(value)}%`, direction: "down" };
  return { label: `→ 0%`, direction: "flat" };
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatRunCount(n: number): string {
  return `${formatCount(n)} 次`;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) {
    const sec = Math.max(0.1, Math.round(ms / 100) / 10);
    return `${sec}s`;
  }
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const remainSec = Math.round((ms % 60_000) / 1000);
  return remainSec === 0 ? `${minutes}m` : `${minutes}m ${remainSec}s`;
}
```

- [ ] **Step 4：跑测试确认全绿**

```bash
pnpm test tests/format.test.ts
# 期望：所有 it 全部 pass
```

- [ ] **Step 5：commit**

```bash
git add lib/format.ts tests/format.test.ts
git commit -m "feat(format): add number/currency/percent/duration formatters with TDD"
```

---

### Task 6: zod schema 全集 `lib/mock/schema.ts`

**Files:**
- Create: `lib/mock/schema.ts`
- Test: `tests/mock-schema.test.ts`

- [ ] **Step 1：写 schema**

```ts
// lib/mock/schema.ts
import { z } from "zod";

export const StatsSchema = z.object({
  agents: z.object({
    total: z.number(), active: z.number(), configured: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  skills: z.object({
    total: z.number(), custom: z.number(), thirdParty: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  todayRuns: z.object({
    count: z.number(), deltaPctVsYesterday: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  apiCost: z.object({
    todayUSD: z.number(), budgetUSD: z.number(),
    miniBars: z.array(z.number()).length(7),
  }),
});

export const AgentStatusEnum = z.enum(["running", "pending", "idle"]);
export const AgentSchema = z.object({
  id: z.string(), name: z.string(), group: z.string(), avatar: z.string(),
  status: AgentStatusEnum,
  todayRuns: z.number(),
  lastRun: z.string(),
});
export const AgentListSchema = z.object({
  total: z.number(),
  items: z.array(AgentSchema),
});

export const WorkflowItemSchema = z.object({
  id: z.string(), name: z.string(), channel: z.string(),
  progressPct: z.number().min(0).max(100).optional(),
  progressLabel: z.string().optional(),
  statusLabel: z.string().optional(),
});
export const WorkflowStatusSchema = z.object({
  queued: z.array(WorkflowItemSchema),
  running: z.array(WorkflowItemSchema),
  completedToday: z.object({
    count: z.number(),
    avgDurationLabel: z.string(),
  }),
});

export const LogTagEnum = z.enum(["init", "chat", "verify", "setup", "docker", "git", "error"]);
export const LogItemSchema = z.object({
  time: z.string(),
  tag: LogTagEnum,
  description: z.string(),
  duration: z.string(),
});
export const LogsSchema = z.array(LogItemSchema);

export const SecBadgeStyleEnum = z.enum(["green", "purple", "red", "yellow"]);
export const SecuritySubCardSchema = z.object({
  id: z.string(), icon: z.string(), title: z.string(),
  badge: z.object({ label: z.string(), style: SecBadgeStyleEnum }),
  description: z.string(),
  progress: z.object({
    pct: z.number().min(0).max(100),
    color: SecBadgeStyleEnum,
    label: z.string().optional(),
  }).optional(),
});
export const SecuritySchema = z.array(SecuritySubCardSchema);

export const PlatformStatusEnum = z.enum(["connected", "configuring", "not_configured"]);
export const PlatformSchema = z.object({
  id: z.string(), name: z.string(),
  status: PlatformStatusEnum, statusLabel: z.string(),
});
export const PlatformsSchema = z.array(PlatformSchema);

export const NavItemSchema = z.object({
  id: z.string(), label: z.string(), icon: z.string(), href: z.string(),
  badge: z.number().optional(),
});
export const NavGroupSchema = z.object({
  title: z.string(),
  items: z.array(NavItemSchema),
});
export const NavSchema = z.array(NavGroupSchema);

export type Stats = z.infer<typeof StatsSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AgentList = z.infer<typeof AgentListSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type LogItem = z.infer<typeof LogItemSchema>;
export type Logs = z.infer<typeof LogsSchema>;
export type SecuritySubCard = z.infer<typeof SecuritySubCardSchema>;
export type Security = z.infer<typeof SecuritySchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type NavGroup = z.infer<typeof NavGroupSchema>;
```

- [ ] **Step 2：写 smoke test**

```ts
// tests/mock-schema.test.ts
import { describe, it, expect } from "vitest";
import * as S from "@/lib/mock/schema";

describe("schema smoke", () => {
  it("AgentStatusEnum accepts valid", () => {
    expect(S.AgentStatusEnum.parse("running")).toBe("running");
  });
  it("AgentStatusEnum rejects invalid", () => {
    expect(() => S.AgentStatusEnum.parse("zombie")).toThrow();
  });
  it("StatsSchema shape", () => {
    const s = S.StatsSchema.parse({
      agents: { total: 1, active: 1, configured: 5, progressPct: 100 },
      skills: { total: 14, custom: 0, thirdParty: 14, progressPct: 35 },
      todayRuns: { count: 7, deltaPctVsYesterday: 233, progressPct: 70 },
      apiCost: { todayUSD: 0.04, budgetUSD: 10, miniBars: [1,2,3,4,5,6,7] },
    });
    expect(s.agents.total).toBe(1);
  });
});
```

- [ ] **Step 3：跑测试**

```bash
pnpm test tests/mock-schema.test.ts
# 期望：3 pass
```

- [ ] **Step 4：commit**

```bash
git add lib/mock/schema.ts tests/mock-schema.test.ts
git commit -m "feat(mock): add zod schemas for all dashboard data"
```

---

### Task 7: mock stats

**Files:**
- Create: `lib/mock/stats.ts`
- Modify: `tests/mock-schema.test.ts` 增加一条断言

- [ ] **Step 1：写数据**

```ts
// lib/mock/stats.ts
import { StatsSchema, type Stats } from "./schema";

const data: Stats = {
  agents: { total: 1, active: 1, configured: 5, progressPct: 100 },
  skills: { total: 14, custom: 0, thirdParty: 14, progressPct: 35 },
  todayRuns: { count: 7, deltaPctVsYesterday: 233, progressPct: 70 },
  apiCost: { todayUSD: 0.04, budgetUSD: 10.0, miniBars: [12, 24, 8, 30, 18, 22, 28] },
};

export const mockStats: Stats = StatsSchema.parse(data);
```

- [ ] **Step 2：测试**

```ts
// 追加到 tests/mock-schema.test.ts
import { mockStats } from "@/lib/mock/stats";
describe("mockStats", () => {
  it("通过 schema 校验", () => {
    expect(() => S.StatsSchema.parse(mockStats)).not.toThrow();
  });
});
```

```bash
pnpm test
```

- [ ] **Step 3：commit**

```bash
git add lib/mock/stats.ts tests/mock-schema.test.ts
git commit -m "feat(mock): add stats fixture with self-validation"
```

---

### Task 8: mock agents + workflows

**Files:**
- Create: `lib/mock/agents.ts`, `lib/mock/workflows.ts`
- Modify: `tests/mock-schema.test.ts`

- [ ] **Step 1：写 agents**

```ts
// lib/mock/agents.ts
import { AgentListSchema, type AgentList } from "./schema";

const data: AgentList = {
  total: 5,
  items: [
    { id: "andy",    name: "Andy",            group: "NanoClaw 默认", avatar: "🐾",
      status: "running", todayRuns: 7, lastRun: "刚刚" },
    { id: "news",    name: "知识日报 Agent",   group: "内容生产",      avatar: "📰",
      status: "pending", todayRuns: 0, lastRun: "—" },
    { id: "writer",  name: "内容写作 Agent",   group: "创作助手",      avatar: "✍️",
      status: "idle",    todayRuns: 0, lastRun: "—" },
    { id: "analyst", name: "数据分析 Agent",   group: "数据洞察",      avatar: "📊",
      status: "idle",    todayRuns: 0, lastRun: "—" },
    { id: "monitor", name: "竞品监控 Agent",   group: "情报收集",      avatar: "🔍",
      status: "idle",    todayRuns: 0, lastRun: "—" },
  ],
};

export const mockAgents: AgentList = AgentListSchema.parse(data);
```

- [ ] **Step 2：写 workflows**

```ts
// lib/mock/workflows.ts
import { WorkflowStatusSchema, type WorkflowStatus } from "./schema";

const data: WorkflowStatus = {
  queued: [],
  running: [{
    id: "andy-cli",
    name: "🐾 Andy 对话会话",
    channel: "cli channel",
    progressPct: 60,
    progressLabel: "等待用户输入",
    statusLabel: "进行中",
  }],
  completedToday: { count: 7, avgDurationLabel: "18s" },
};

export const mockWorkflows: WorkflowStatus = WorkflowStatusSchema.parse(data);
```

- [ ] **Step 3：测试 + commit**

追加到 `tests/mock-schema.test.ts`：
```ts
import { mockAgents } from "@/lib/mock/agents";
import { mockWorkflows } from "@/lib/mock/workflows";
it("mockAgents valid", () => { expect(() => S.AgentListSchema.parse(mockAgents)).not.toThrow(); });
it("mockWorkflows valid", () => { expect(() => S.WorkflowStatusSchema.parse(mockWorkflows)).not.toThrow(); });
```

```bash
pnpm test && git add -A && git commit -m "feat(mock): add agents and workflows fixtures"
```

---

### Task 9: mock logs + security

**Files:**
- Create: `lib/mock/logs.ts`, `lib/mock/security.ts`

- [ ] **Step 1：写 logs**

```ts
// lib/mock/logs.ts
import { LogsSchema, type Logs } from "./schema";

const data: Logs = [
  { time: "13:25:33", tag: "init",   description: "创建 Andy agent group via init-cli-agent.ts", duration: "0.3s" },
  { time: "13:23:10", tag: "chat",   description: "Andy ping → pong · 首次对话验证成功",        duration: "7s"   },
  { time: "13:21:05", tag: "verify", description: "setup verify failed → Claude 诊断接管",      duration: "42s"  },
  { time: "13:18:42", tag: "setup",  description: "OneCLI vault 注入 DeepSeek-V4 凭证",         duration: "1m"   },
  { time: "13:15:00", tag: "docker", description: "Docker Desktop daemon 拉起 · nanoclaw-agent:latest", duration: "45s" },
  { time: "13:08:00", tag: "git",    description: "clone NanoClaw v2.0.33 · 建立工作目录",       duration: "12s"  },
];
export const mockLogs: Logs = LogsSchema.parse(data);
```

- [ ] **Step 2：写 security**

```ts
// lib/mock/security.ts
import { SecuritySchema, type Security } from "./schema";

const data: Security = [
  { id: "cost", icon: "💰", title: "成本控制",
    badge: { label: "正常", style: "green" },
    description: "今日消耗 $0.04 / 预算 $10.00",
    progress: { pct: 0.4, color: "green", label: "预算使用率 0.4%" }},
  { id: "skill-audit", icon: "🔒", title: "Skill 审核",
    badge: { label: "14 已审核", style: "purple" },
    description: "14 个第三方 Skills 已完成审核 · 0 个等待审核",
    progress: { pct: 100, color: "purple" }},
  { id: "manual-approval", icon: "👤", title: "人工审批",
    badge: { label: "已开启", style: "green" },
    description: "高风险操作需人工审批 · 今日拦截 0 次" },
];
export const mockSecurity: Security = SecuritySchema.parse(data);
```

- [ ] **Step 3：测试 + commit**

追加测试 + `pnpm test`，然后：
```bash
git add -A && git commit -m "feat(mock): add logs and security fixtures"
```

---

### Task 10: mock platforms + nav

**Files:**
- Create: `lib/mock/platforms.ts`, `lib/mock/nav.ts`

- [ ] **Step 1：写 platforms**

```ts
// lib/mock/platforms.ts
import { PlatformsSchema, type Platform } from "./schema";

const data: Platform[] = [
  { id: "imessage", name: "iMessage", status: "connected",      statusLabel: "已连接" },
  { id: "telegram", name: "Telegram", status: "configuring",    statusLabel: "配置中" },
  { id: "discord",  name: "Discord",  status: "not_configured", statusLabel: "未配置" },
  { id: "whatsapp", name: "WhatsApp", status: "not_configured", statusLabel: "未配置" },
];
export const mockPlatforms: Platform[] = PlatformsSchema.parse(data);
```

- [ ] **Step 2：写 nav**

```ts
// lib/mock/nav.ts
import { NavSchema, type NavGroup } from "./schema";

const data: NavGroup[] = [
  { title: "导航", items: [
    { id: "home",      label: "控制台",      icon: "⊞",   href: "/" },
    { id: "agents",    label: "Agent 管理",  icon: "🤖",  href: "/agents",    badge: 1  },
    { id: "skills",    label: "Skills 市场", icon: "⚡",  href: "/skills",    badge: 14 },
    { id: "workflows", label: "工作流编排",  icon: "⚙",   href: "/workflows" },
    { id: "logs",      label: "运行日志",    icon: "📋",  href: "/logs"      },
    { id: "security",  label: "安全中心",    icon: "🛡",  href: "/security"  },
    { id: "settings",  label: "系统设置",    icon: "⚙️",  href: "/settings"  },
  ]},
  { title: "快捷操作", items: [
    { id: "new-agent",    label: "创建新 Agent", icon: "➕", href: "/agents/new"   },
    { id: "import-skill", label: "导入 Skill",   icon: "⬇",  href: "/skills/import" },
  ]},
];
export const mockNav: NavGroup[] = NavSchema.parse(data);
```

- [ ] **Step 3：测试 + commit**

```bash
pnpm test && git add -A && git commit -m "feat(mock): add platforms and nav fixtures"
```

---

### Task 11: 消息状态机 `lib/chat-state.ts`（**重点 · TDD**）

**为什么单独成一个任务**：聊天浮层的所有交互（发送、加载、超时、错误、重试、中止、消息追加）都是状态转移。先把状态机用 reducer 写透并 TDD 全覆盖，UI 层只渲染 + dispatch action，不藏逻辑。这是整个 Phase 1 最容易写错的地方。

**Files:**
- Create: `lib/chat-state.ts`
- Test: `tests/chat-state.test.ts`

#### 状态设计

```
ConversationState = {
  messages: Message[]                  // 已确认的消息
  pending: PendingMessage | null       // 当前进行中的消息
  inputDraft: string                   // 输入框内容
  error: string | null                 // 顶层错误
}

Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  status: "delivered"
}

PendingMessage = {
  id: string
  userMessage: Message                 // 用户已发送的消息
  status: "sending" | "success" | "error" | "timeout" | "aborted"
  errorReason?: string                 // status 为 error/timeout 时
}

Actions =
  | { type: "DRAFT_CHANGED"; value: string }
  | { type: "SEND_INITIATED"; id: string; content: string; timestamp: number }
  | { type: "REPLY_RECEIVED"; id: string; content: string; timestamp: number }
  | { type: "REPLY_FAILED"; id: string; reason: string }
  | { type: "REPLY_TIMED_OUT"; id: string }
  | { type: "REPLY_ABORTED"; id: string }
  | { type: "RETRY"; id: string }       // 把失败消息重新放回 draft
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" }
```

- [ ] **Step 1：写测试（先红）**

```ts
// tests/chat-state.test.ts
import { describe, it, expect } from "vitest";
import { initialState, reducer, canSend, type State } from "@/lib/chat-state";

const t = 1700000000000;

describe("chat-state · initial", () => {
  it("初始状态干净", () => {
    expect(initialState.messages).toEqual([]);
    expect(initialState.pending).toBeNull();
    expect(initialState.inputDraft).toBe("");
    expect(initialState.error).toBeNull();
  });
});

describe("chat-state · DRAFT_CHANGED", () => {
  it("更新 inputDraft", () => {
    const s = reducer(initialState, { type: "DRAFT_CHANGED", value: "hi" });
    expect(s.inputDraft).toBe("hi");
  });
});

describe("chat-state · SEND_INITIATED", () => {
  it("把 userMessage 放进 pending，清空 draft", () => {
    const s1 = reducer(initialState, { type: "DRAFT_CHANGED", value: "ping" });
    const s2 = reducer(s1, { type: "SEND_INITIATED", id: "m1", content: "ping", timestamp: t });
    expect(s2.inputDraft).toBe("");
    expect(s2.pending).not.toBeNull();
    expect(s2.pending!.id).toBe("m1");
    expect(s2.pending!.status).toBe("sending");
    expect(s2.pending!.userMessage.content).toBe("ping");
    expect(s2.pending!.userMessage.role).toBe("user");
    expect(s2.messages).toEqual([]);
  });
  it("已有 pending 时拒绝二次发送（保持原状）", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "a", timestamp: t });
    const s2 = reducer(s1, { type: "SEND_INITIATED", id: "m2", content: "b", timestamp: t + 1 });
    expect(s2.pending!.id).toBe("m1");
  });
});

describe("chat-state · REPLY_RECEIVED", () => {
  it("把 user message 和 assistant reply 一起 append 到 messages", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "ping", timestamp: t });
    const s2 = reducer(s1, { type: "REPLY_RECEIVED", id: "m1", content: "pong", timestamp: t + 100 });
    expect(s2.pending).toBeNull();
    expect(s2.messages.length).toBe(2);
    expect(s2.messages[0].role).toBe("user");
    expect(s2.messages[0].content).toBe("ping");
    expect(s2.messages[1].role).toBe("assistant");
    expect(s2.messages[1].content).toBe("pong");
    expect(s2.error).toBeNull();
  });
  it("id 不匹配时忽略（防错乱）", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "ping", timestamp: t });
    const s2 = reducer(s1, { type: "REPLY_RECEIVED", id: "m9", content: "stale", timestamp: t });
    expect(s2.pending!.id).toBe("m1");
    expect(s2.messages.length).toBe(0);
  });
});

describe("chat-state · REPLY_FAILED / TIMED_OUT / ABORTED", () => {
  function setup(): State {
    return reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "ping", timestamp: t });
  }
  it("FAILED 保留 user 消息 + 在 pending 标记 error", () => {
    const s = reducer(setup(), { type: "REPLY_FAILED", id: "m1", reason: "spawn err" });
    expect(s.pending!.status).toBe("error");
    expect(s.pending!.errorReason).toBe("spawn err");
    expect(s.error).toBe("spawn err");
    expect(s.messages.length).toBe(1);
    expect(s.messages[0].role).toBe("user");
  });
  it("TIMED_OUT", () => {
    const s = reducer(setup(), { type: "REPLY_TIMED_OUT", id: "m1" });
    expect(s.pending!.status).toBe("timeout");
    expect(s.error).toMatch(/超时/);
  });
  it("ABORTED", () => {
    const s = reducer(setup(), { type: "REPLY_ABORTED", id: "m1" });
    expect(s.pending!.status).toBe("aborted");
    expect(s.messages.length).toBe(1);
  });
});

describe("chat-state · RETRY", () => {
  it("把失败消息内容塞回 draft，清掉 pending 和 error", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "ping", timestamp: t });
    const s2 = reducer(s1, { type: "REPLY_FAILED", id: "m1", reason: "x" });
    const s3 = reducer(s2, { type: "RETRY", id: "m1" });
    expect(s3.inputDraft).toBe("ping");
    expect(s3.pending).toBeNull();
    expect(s3.error).toBeNull();
    // user 消息应被移除（避免重复）
    expect(s3.messages.length).toBe(0);
  });
});

describe("chat-state · CLEAR_ERROR / RESET", () => {
  it("CLEAR_ERROR 仅清掉 error", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "x", timestamp: t });
    const s2 = reducer(s1, { type: "REPLY_FAILED", id: "m1", reason: "boom" });
    const s3 = reducer(s2, { type: "CLEAR_ERROR" });
    expect(s3.error).toBeNull();
    expect(s3.pending).not.toBeNull();
  });
  it("RESET 回到 initialState", () => {
    const s1 = reducer(initialState, { type: "SEND_INITIATED", id: "m1", content: "x", timestamp: t });
    expect(reducer(s1, { type: "RESET" })).toEqual(initialState);
  });
});

describe("chat-state · canSend", () => {
  it("有非空 draft 且无 pending → true", () => {
    expect(canSend({ ...initialState, inputDraft: "hi" })).toBe(true);
  });
  it("draft 全空格 → false", () => {
    expect(canSend({ ...initialState, inputDraft: "   " })).toBe(false);
  });
  it("有 pending sending → false", () => {
    const s1 = reducer(initialState, { type: "DRAFT_CHANGED", value: "x" });
    const s2 = reducer(s1, { type: "SEND_INITIATED", id: "m1", content: "x", timestamp: t });
    // 此时 draft 已被清空，但模拟用户又输入
    expect(canSend({ ...s2, inputDraft: "y" })).toBe(false);
  });
});
```

- [ ] **Step 2：跑测试确认全红**

```bash
pnpm test tests/chat-state.test.ts
# 期望：全部 fail
```

- [ ] **Step 3：实现 lib/chat-state.ts**

```ts
// lib/chat-state.ts
export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  status: "delivered";
}

export type PendingStatus = "sending" | "success" | "error" | "timeout" | "aborted";

export interface PendingMessage {
  id: string;
  userMessage: Message;
  status: PendingStatus;
  errorReason?: string;
}

export interface State {
  messages: Message[];
  pending: PendingMessage | null;
  inputDraft: string;
  error: string | null;
}

export type Action =
  | { type: "DRAFT_CHANGED"; value: string }
  | { type: "SEND_INITIATED"; id: string; content: string; timestamp: number }
  | { type: "REPLY_RECEIVED"; id: string; content: string; timestamp: number }
  | { type: "REPLY_FAILED"; id: string; reason: string }
  | { type: "REPLY_TIMED_OUT"; id: string }
  | { type: "REPLY_ABORTED"; id: string }
  | { type: "RETRY"; id: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const initialState: State = {
  messages: [],
  pending: null,
  inputDraft: "",
  error: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DRAFT_CHANGED":
      return { ...state, inputDraft: action.value };

    case "SEND_INITIATED": {
      if (state.pending) return state;  // 拒绝二次发送
      const userMessage: Message = {
        id: action.id,
        role: "user",
        content: action.content,
        timestamp: action.timestamp,
        status: "delivered",
      };
      return {
        ...state,
        inputDraft: "",
        pending: { id: action.id, userMessage, status: "sending" },
        error: null,
      };
    }

    case "REPLY_RECEIVED": {
      if (!state.pending || state.pending.id !== action.id) return state;
      const assistant: Message = {
        id: `${action.id}-r`,
        role: "assistant",
        content: action.content,
        timestamp: action.timestamp,
        status: "delivered",
      };
      return {
        ...state,
        messages: [...state.messages, state.pending.userMessage, assistant],
        pending: null,
        error: null,
      };
    }

    case "REPLY_FAILED":
    case "REPLY_TIMED_OUT":
    case "REPLY_ABORTED": {
      if (!state.pending || state.pending.id !== action.id) return state;
      const status: PendingStatus =
        action.type === "REPLY_FAILED" ? "error" :
        action.type === "REPLY_TIMED_OUT" ? "timeout" : "aborted";
      const reason =
        action.type === "REPLY_FAILED" ? action.reason :
        action.type === "REPLY_TIMED_OUT" ? "聊天超时（120s）" :
        "已中止";
      return {
        ...state,
        // 失败时也把 user message append（避免用户输入丢失感）
        messages: [...state.messages, state.pending.userMessage],
        pending: { ...state.pending, status, errorReason: reason },
        error: status === "aborted" ? null : reason,
      };
    }

    case "RETRY": {
      if (!state.pending || state.pending.id !== action.id) return state;
      // 把失败前的 user message 从 messages 里抽掉，内容塞回 draft
      const lastIdx = state.messages.findLastIndex(m => m.id === action.id);
      const messages = lastIdx >= 0
        ? [...state.messages.slice(0, lastIdx), ...state.messages.slice(lastIdx + 1)]
        : state.messages;
      return {
        ...state,
        inputDraft: state.pending.userMessage.content,
        messages,
        pending: null,
        error: null,
      };
    }

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "RESET":
      return initialState;
  }
}

export function canSend(state: State): boolean {
  return !state.pending && state.inputDraft.trim().length > 0;
}
```

- [ ] **Step 4：跑测试全绿**

```bash
pnpm test tests/chat-state.test.ts
# 期望：所有 it 全部 pass
```

- [ ] **Step 5：commit**

```bash
git add lib/chat-state.ts tests/chat-state.test.ts
git commit -m "feat(chat): add message state machine with TDD coverage"
```

---

### Task 12: NanoClaw contract + `/api/chat` route

**Files:**
- Create: `lib/nanoclaw/contract.ts`, `app/api/chat/route.ts`
- Test: `tests/api-chat.test.ts`

- [ ] **Step 1：写 contract（集中所有 NanoClaw 假设）**

```ts
// lib/nanoclaw/contract.ts
import path from "path";

export const NANOCLAW_ROOT =
  process.env.NANOCLAW_ROOT ||
  path.join(process.env.HOME || "", "projects", "nanoclaw-fork", "nanoclaw-v2");

export const CHAT_CMD = "pnpm";
export const CHAT_ARGS = (msg: string) => ["run", "chat", msg];
export const CHAT_TIMEOUT_MS = 120_000;

/** 过滤 pnpm/tsx 启动器输出，只保留真实 agent 回复 */
export function stripPnpmWrapper(text: string): string {
  return text
    .split("\n")
    .filter(line =>
      !/^>\s+nanoclaw@/.test(line) &&
      !/^>\s+tsx\s+/.test(line) &&
      !/^\s*$/.test(line)
    )
    .join("\n")
    .trim();
}
```

- [ ] **Step 2：写 route**

```ts
// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import {
  NANOCLAW_ROOT, CHAT_CMD, CHAT_ARGS, CHAT_TIMEOUT_MS, stripPnpmWrapper,
} from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const message = (body as { message?: unknown })?.message;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Missing or empty message" }, { status: 400 });
  }
  const trimmed = message.trim();

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(CHAT_CMD, CHAT_ARGS(trimmed), {
      cwd: NANOCLAW_ROOT, shell: false, env: { ...process.env },
    });
    let stdout = "", stderr = "";
    let responded = false;
    const respond = (r: NextResponse) => { if (!responded) { responded = true; resolve(r); } };

    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });

    proc.on("close", () => {
      const reply = stripPnpmWrapper(stdout || stderr || "") || "(Andy 没有返回内容)";
      respond(NextResponse.json({ reply }));
    });
    proc.on("error", err => {
      respond(NextResponse.json(
        { error: "Failed to spawn chat process: " + err.message },
        { status: 500 },
      ));
    });

    const timer = setTimeout(() => {
      proc.kill();
      respond(NextResponse.json(
        { error: "Chat process timed out after 120 seconds" },
        { status: 504 },
      ));
    }, CHAT_TIMEOUT_MS);
    proc.on("close", () => clearTimeout(timer));
  });
}
```

- [ ] **Step 3：写测试（mock spawn）**

```ts
// tests/api-chat.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripPnpmWrapper } from "@/lib/nanoclaw/contract";

describe("stripPnpmWrapper", () => {
  it("过滤 pnpm 标头和空行", () => {
    const input = `> nanoclaw@2.0.33 chat\n> tsx scripts/chat.ts\n\nHello\n`;
    expect(stripPnpmWrapper(input)).toBe("Hello");
  });
  it("不包含污染时原样返回", () => {
    expect(stripPnpmWrapper("Hi\nThere")).toBe("Hi\nThere");
  });
});

// route 端到端测试用 contract 模拟即可，spawn 的 mock 这里走 manual-fetch 路径
describe("POST /api/chat (light)", () => {
  it("空 message 应 400", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://x/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "  " }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
  it("非 JSON body 应 400", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://x/api/chat", {
      method: "POST", body: "not json",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/api-chat.test.ts
# 期望：4 pass
```

- [ ] **Step 5：commit**

```bash
git add lib/nanoclaw/contract.ts app/api/chat/route.ts tests/api-chat.test.ts
git commit -m "feat(api): add /api/chat route with NanoClaw spawn contract"
```

---

# Phase 1 · 视觉（可批量）

> **批量原则**：Task 13/14/15/17 每个里包含多个静态展示组件，全部纯 props 驱动、无业务逻辑分支、消费 Task 5 的 format 函数与 Task 6 的 schema 类型。每个任务结束时 `pnpm dev` 浏览器目测一次即可，无需写组件单测（visual diff 雏形截图）。

---

### Task 13: 批量 - Sidebar + Topbar + Dashboard layout

**Files:**
- Create: `components/shell/sidebar.tsx`, `components/shell/topbar.tsx`, `app/(dashboard)/layout.tsx`

- [ ] **Step 1：Sidebar**（消费 `mockNav` + `mockPlatforms`）

```tsx
// components/shell/sidebar.tsx
import Link from "next/link";
import { mockNav } from "@/lib/mock/nav";
import { mockPlatforms } from "@/lib/mock/platforms";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const dotByStatus = {
  connected:      "bg-green shadow-[0_0_5px_#22c55e]",
  configuring:    "bg-yellow",
  not_configured: "bg-[#444]",
} as const;

export function Sidebar({ activeHref = "/" }: { activeHref?: string }) {
  return (
    <aside className="w-60 min-w-60 bg-card border-r border-border flex flex-col h-screen overflow-y-auto shrink-0">
      <div className="px-4 py-5 pb-4 border-b border-border flex items-center gap-2.5">
        <div className="w-9 h-9 bg-accent rounded-[9px] flex items-center justify-center text-xl shrink-0 shadow-accent-glow">
          {BRAND.logo}
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] font-bold tracking-tight">{BRAND.name}</div>
          <div className="text-[11px] text-text-weak">{BRAND.version}</div>
        </div>
      </div>

      {mockNav.map(group => (
        <div className="px-2 pt-4 pb-1" key={group.title}>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-text-weak px-2 pb-1.5">
            {group.title}
          </div>
          {group.items.map(item => (
            <Link key={item.id} href={item.href} className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-btn text-[13.5px] text-text-sub hover:bg-white/5 hover:text-text transition-colors mb-px",
              activeHref === item.href && "bg-accent-dim text-accent font-medium",
            )}>
              <span className="w-4 text-center text-sm">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto bg-accent-dim text-accent text-[10px] font-semibold px-1.5 py-px rounded-[10px]">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}

      <div className="mt-auto px-2 pt-3 pb-4 border-t border-border">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-text-weak px-2 pb-2">
          平台连接
        </div>
        {mockPlatforms.map(p => (
          <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-text-sub">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotByStatus[p.status])} />
            <span>{p.name}</span>
            <span className="ml-auto text-[11px] text-text-weak">{p.statusLabel}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2：Topbar**

```tsx
// components/shell/topbar.tsx
export function Topbar() {
  return (
    <header className="h-15 min-h-15 bg-card border-b border-border flex items-center px-6 gap-3" style={{ height: 60, minHeight: 60 }}>
      <div className="flex-1 max-w-[420px] relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-weak text-sm">🔍</span>
        <input
          disabled
          placeholder="搜索 Agent / Skill / 日志…（Phase 2 开放）"
          className="w-full bg-bg border border-border rounded-btn py-1.5 pl-9 pr-12 text-[13px] text-text outline-none focus:border-accent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-weak border border-border px-1.5 py-px rounded">⌘K</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-[12px] text-text-sub">
        <span className="px-2 py-1 rounded-btn bg-green-dim text-green">● 在线</span>
      </div>
      <div className="w-9 h-9 rounded-full bg-accent-dim text-accent font-semibold flex items-center justify-center text-[13px]" title="木羽">
        MY
      </div>
    </header>
  );
}
```

- [ ] **Step 3：(dashboard)/layout.tsx**

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4：手动验证 + commit**

```bash
pnpm dev
# 浏览器开 / ，确认看到完整的 sidebar（含 9 项导航 + 平台连接）+ topbar
git add -A && git commit -m "feat(shell): add sidebar, topbar, dashboard layout"
```

---

### Task 14: 批量 - PageHeader + StatsGrid + StatCard + MiniBars

**Files:**
- Create: `components/dashboard/{page-header,stat-card,stats-grid,mini-bars}.tsx`

- [ ] **Step 1：写 4 个文件**

```tsx
// components/dashboard/page-header.tsx
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="text-[22px] font-bold tracking-tight leading-tight">{title}</div>
        <div className="text-[13px] text-text-sub mt-1">{subtitle}</div>
      </div>
    </div>
  );
}
```

```tsx
// components/dashboard/mini-bars.tsx
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-9 mt-2">
      {values.map((v, i) => (
        <div key={i} className="w-2 rounded-sm bg-accent/60"
             style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}
```

```tsx
// components/dashboard/stat-card.tsx
import { cn } from "@/lib/utils";
import { MiniBars } from "./mini-bars";

export type StatCardProps = {
  label: string;
  value: string;
  sub?: React.ReactNode;
  progress?: number;
  miniBars?: number[];
  bigValue?: boolean;
};

export function StatCard({ label, value, sub, progress, miniBars, bigValue }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-card p-4 hover:border-border-hover hover:bg-card-hover transition-colors shadow-card">
      <div className="text-[13px] text-text-sub">{label}</div>
      <div className={cn("font-bold tracking-tighter mt-2", bigValue ? "text-[36px]" : "text-[28px]")}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-text-sub mt-1 flex items-center gap-1">{sub}</div>}
      {progress !== undefined && (
        <div className="h-1 bg-border rounded-full overflow-hidden mt-3">
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
      {miniBars && <MiniBars values={miniBars} />}
    </div>
  );
}
```

```tsx
// components/dashboard/stats-grid.tsx
import { type Stats } from "@/lib/mock/schema";
import { formatCurrencyUSD, formatCount, formatDelta, formatPercent } from "@/lib/format";
import { StatCard } from "./stat-card";

export function StatsGrid({ data }: { data: Stats }) {
  const delta = formatDelta(data.todayRuns.deltaPctVsYesterday);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatCard label="🤖 Agent 总数" value={formatCount(data.agents.total)}
        sub={<>已激活 {data.agents.active} <span className="text-text-weak">/</span> 配置 {data.agents.configured}</>}
        progress={data.agents.progressPct} />
      <StatCard label="⚡ Skills 总数" value={formatCount(data.skills.total)}
        sub={<>{data.skills.custom} 自定义 <span className="text-text-weak">/</span> {data.skills.thirdParty} 第三方</>}
        progress={data.skills.progressPct} />
      <StatCard label="⚡ 今日执行" value={formatCount(data.todayRuns.count)}
        sub={<><span className={delta.direction === "up" ? "text-green" : delta.direction === "down" ? "text-red" : "text-text-sub"}>{delta.label}</span> 较昨日同期</>}
        progress={data.todayRuns.progressPct} />
      <StatCard label="💰 API 消耗" value={formatCurrencyUSD(data.apiCost.todayUSD)} bigValue
        sub={<span className="flex justify-between w-full">
          <span>预算 {formatCurrencyUSD(data.apiCost.budgetUSD)}</span>
          <span>{formatPercent((data.apiCost.todayUSD / data.apiCost.budgetUSD) * 100)}</span>
        </span>}
        miniBars={data.apiCost.miniBars} />
    </div>
  );
}
```

- [ ] **Step 2：commit**

```bash
git add -A && git commit -m "feat(dashboard): add page header and stats grid"
```

---

### Task 15: 批量 - PanelCard + 4 面板（AgentTable / WorkflowStatus / RecentLogs / SecurityPanel）

**Files:**
- Create: `components/dashboard/{panel-card,agent-table,workflow-status,recent-logs,security-panel}.tsx`

- [ ] **Step 1：PanelCard 通用外壳**

```tsx
// components/dashboard/panel-card.tsx
export function PanelCard({
  title, count, link, children,
}: {
  title: React.ReactNode; count?: string; link?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-card overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="text-[14px] font-semibold tracking-tight">
          {title} {count && <span className="text-text-weak font-normal">· {count}</span>}
        </div>
        {link && <div className="text-[12px] text-accent cursor-pointer hover:underline">{link}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2：AgentTable**

```tsx
// components/dashboard/agent-table.tsx
import { type AgentList } from "@/lib/mock/schema";
import { formatRunCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PanelCard } from "./panel-card";

const statusStyles = {
  running: { dot: "bg-green shadow-[0_0_5px_#22c55e]", label: "运行中", badge: "bg-green-dim text-green" },
  pending: { dot: "bg-yellow",                          label: "待配置", badge: "bg-yellow/15 text-yellow" },
  idle:    { dot: "bg-[#444]",                          label: "未启用", badge: "bg-white/5 text-text-weak" },
} as const;

export function AgentTable({ data }: { data: AgentList }) {
  return (
    <PanelCard title="🤖 活跃 Agent 列表" count={`${data.total} 已配置`} link="查看全部 →">
      <table className="w-full text-[13px]">
        <thead className="text-[10px] uppercase tracking-wider text-text-weak">
          <tr><th className="text-left pb-3">Agent 名称</th><th className="text-left pb-3">状态</th>
              <th className="text-left pb-3">今日执行</th><th className="text-left pb-3">最后运行</th></tr>
        </thead>
        <tbody>
          {data.items.map(a => {
            const s = statusStyles[a.status];
            const dim = a.status !== "running";
            return (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0", dim ? "bg-white/5" : "bg-accent-dim")}>
                      {a.avatar}
                    </div>
                    <div>
                      <div className={cn("font-medium", dim ? "text-text-weak" : "text-text")}>{a.name}</div>
                      <div className="text-[11px] text-text-weak">{a.group}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge text-[11px]", s.badge)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} /> {s.label}
                  </span>
                </td>
                <td className={cn("text-[13px]", dim && "text-text-weak")}>{formatRunCount(a.todayRuns)}</td>
                <td className="text-[13px] text-text-sub">{a.lastRun}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PanelCard>
  );
}
```

- [ ] **Step 3：WorkflowStatus**

```tsx
// components/dashboard/workflow-status.tsx
import { type WorkflowStatus as WS } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";

export function WorkflowStatus({ data }: { data: WS }) {
  return (
    <PanelCard title="⚙️ 工作流执行状态" link="管理 →">
      <div className="space-y-4">
        {/* 排队中 */}
        <Group color="text-blue" label="排队中" count={data.queued.length}>
          {data.queued.length === 0
            ? <div className="text-[12px] text-text-weak">暂无排队任务</div>
            : data.queued.map(it => <Item key={it.id} name={it.name} channel={it.channel} />)}
        </Group>
        <hr className="border-border" />
        {/* 执行中 */}
        <Group color="text-yellow" label="执行中" count={data.running.length}>
          {data.running.map(it => (
            <div key={it.id} className="bg-bg border border-border rounded-btn p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[13px] font-medium">{it.name}</div>
                <div className="text-[11px] text-text-weak px-2 py-0.5 rounded-badge bg-white/5">{it.channel}</div>
              </div>
              {it.progressPct !== undefined && (
                <>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${it.progressPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-text-sub mt-1.5">
                    <span>{it.progressLabel}</span>
                    <span className="text-accent">{it.statusLabel}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </Group>
        <hr className="border-border" />
        {/* 已完成 */}
        <Group color="text-green" label="已完成" count={data.completedToday.count}>
          <div className="text-[12px] text-text-sub">
            ✓&nbsp;&nbsp;今日已完成 {data.completedToday.count} 次执行，平均耗时 {data.completedToday.avgDurationLabel}
          </div>
        </Group>
      </div>
    </PanelCard>
  );
}

function Group({ color, label, count, children }:
  { color: string; label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[12px]">
        <span className={color}>●</span>
        <span className="text-text-sub">{label}</span>
        <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-pill text-text-weak">{count}</span>
      </div>
      <div className="space-y-2 pl-3">{children}</div>
    </div>
  );
}
function Item({ name, channel }: { name: string; channel: string }) {
  return <div className="text-[12px] text-text-sub">{name} · <span className="text-text-weak">{channel}</span></div>;
}
```

- [ ] **Step 4：RecentLogs**

```tsx
// components/dashboard/recent-logs.tsx
import { type Logs } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";
import { cn } from "@/lib/utils";

const tagStyles: Record<string, string> = {
  init:   "bg-accent-dim text-accent",
  chat:   "bg-green-dim text-green",
  verify: "bg-red-dim text-red",
  setup:  "bg-blue-dim text-blue",
  docker: "bg-purple-dim text-purple",
  git:    "bg-white/5 text-text-sub",
  error:  "bg-red-dim text-red",
};

export function RecentLogs({ data }: { data: Logs }) {
  return (
    <PanelCard title="📋 最近执行日志" link="完整日志 →">
      <div className="space-y-2.5">
        {data.map((l, i) => (
          <div key={i} className="grid grid-cols-[78px_72px_1fr_auto] items-center gap-3 text-[13px]">
            <div className="text-[11px] text-text-weak font-mono">{l.time}</div>
            <div className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-badge text-center", tagStyles[l.tag])}>
              {l.tag}
            </div>
            <div className="text-text truncate">{l.description}</div>
            <div className="text-[11px] text-text-weak">{l.duration}</div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
```

- [ ] **Step 5：SecurityPanel**

```tsx
// components/dashboard/security-panel.tsx
import { type Security } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";
import { cn } from "@/lib/utils";

const badgeStyles = {
  green:  "bg-green-dim text-green",
  purple: "bg-purple-dim text-purple",
  red:    "bg-red-dim text-red",
  yellow: "bg-yellow/15 text-yellow",
} as const;
const fillStyles = {
  green:  "bg-green",
  purple: "bg-purple",
  red:    "bg-red",
  yellow: "bg-yellow",
} as const;

export function SecurityPanel({ data }: { data: Security }) {
  return (
    <PanelCard title="🛡️ 安全防线状态" link="设置 ⚙">
      <div className="space-y-3">
        {data.map(c => (
          <div key={c.id} className="bg-bg border border-border rounded-btn p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-medium">{c.icon} {c.title}</div>
              <span className={cn("text-[11px] px-2 py-0.5 rounded-badge", badgeStyles[c.badge.style])}>
                {c.badge.label}
              </span>
            </div>
            <div className="text-[12px] text-text-sub">{c.description}</div>
            {c.progress && (
              <>
                <div className="h-1 bg-border rounded-full overflow-hidden mt-2">
                  <div className={cn("h-full", fillStyles[c.progress.color])} style={{ width: `${c.progress.pct}%` }} />
                </div>
                {c.progress.label && <div className="text-[11px] text-text-weak mt-1">{c.progress.label}</div>}
              </>
            )}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
```

- [ ] **Step 6：commit**

```bash
git add -A && git commit -m "feat(dashboard): add 4 panels (agents, workflows, logs, security)"
```

---

### Task 16: 装配主页 page.tsx

**Files:**
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1：写 page.tsx**

```tsx
// app/(dashboard)/page.tsx
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { AgentTable } from "@/components/dashboard/agent-table";
import { WorkflowStatus } from "@/components/dashboard/workflow-status";
import { RecentLogs } from "@/components/dashboard/recent-logs";
import { SecurityPanel } from "@/components/dashboard/security-panel";
import { mockStats } from "@/lib/mock/stats";
import { mockAgents } from "@/lib/mock/agents";
import { mockWorkflows } from "@/lib/mock/workflows";
import { mockLogs } from "@/lib/mock/logs";
import { mockSecurity } from "@/lib/mock/security";

export default function ConsolePage() {
  return (
    <>
      <PageHeader title="控制台"
        subtitle={`欢迎回来，所有系统运行正常 · 今天已处理 ${mockStats.todayRuns.count} 次对话`} />
      <StatsGrid data={mockStats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <AgentTable data={mockAgents} />
        <WorkflowStatus data={mockWorkflows} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentLogs data={mockLogs} />
        <SecurityPanel data={mockSecurity} />
      </div>
    </>
  );
}
```

- [ ] **Step 2：手动验证**

```bash
pnpm dev
# 浏览器开 / ，并排雏形 http://127.0.0.1:7777 比对
# 确认 4 卡 + 双栏 4 面板都到位
```

- [ ] **Step 3：commit**

```bash
git add -A && git commit -m "feat(dashboard): assemble console main page"
```

---

### Task 17: 批量 - EmptyState 组件 + 8 个子页

**Files:**
- Create: `components/shell/empty-state.tsx`
- Create: 8 个 `app/(dashboard)/<route>/page.tsx`

- [ ] **Step 1：EmptyState 组件**

```tsx
// components/shell/empty-state.tsx
import { PageHeader } from "@/components/dashboard/page-header";

export function EmptyState({
  title, subtitle, icon, phase = "Phase 2",
}: {
  title: string; subtitle: string; icon: string; phase?: "Phase 2" | "Phase 3";
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <div className="text-[15px] text-text font-semibold mb-1">该功能将在 {phase} 开放</div>
        <div className="text-[13px] text-text-sub max-w-md">
          目前已在 Phase 1 中保留入口，避免空链接。下个阶段会接入真实数据并提供完整交互。
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2：8 个子页（高度雷同，逐个写）**

```tsx
// app/(dashboard)/agents/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="🤖" title="Agent 管理" subtitle="管理所有 agent group · 启停 · 编辑配置" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/skills/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="⚡" title="Skills 市场" subtitle="浏览/启用/审核第三方 Skills" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/workflows/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="⚙" title="工作流编排" subtitle="创建/编辑/触发 cron 任务" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/logs/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="📋" title="运行日志" subtitle="实时查看 agent 执行日志与报错" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/security/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="🛡" title="安全中心" subtitle="权限审计 · 敏感操作记录 · 成本告警" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/settings/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="⚙️" title="系统设置" subtitle="API key 管理 · 模型切换 · 全局参数" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/agents/new/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="➕" title="创建新 Agent" subtitle="向导式创建 agent group" phase="Phase 3" />;
}
```

```tsx
// app/(dashboard)/skills/import/page.tsx
import { EmptyState } from "@/components/shell/empty-state";
export default function Page() {
  return <EmptyState icon="⬇" title="导入 Skill" subtitle="从仓库或本地导入 skill" phase="Phase 3" />;
}
```

- [ ] **Step 3：手动验证**

```bash
pnpm dev
# 点击 sidebar 8 个非控制台入口，确认每个都有 EmptyState，无 404
```

- [ ] **Step 4：commit**

```bash
git add -A && git commit -m "feat(empty): add EmptyState component and 8 placeholder pages"
```

---

### Task 18: ChatFab + ChatPanel + ChatMessage（消费状态机）

**Files:**
- Create: `components/chat/{chat-fab,chat-panel,chat-message}.tsx`
- Modify: `app/(dashboard)/layout.tsx`（挂 ChatFab）

- [ ] **Step 1：ChatMessage（纯展示）**

```tsx
// components/chat/chat-message.tsx
"use client";
import { type Message } from "@/lib/chat-state";
import { cn } from "@/lib/utils";

export function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const time = new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour12: false });
  return (
    <div className={cn("mb-3 max-w-[85%]", isUser ? "ml-auto" : "")}>
      <div className={cn(
        "rounded-btn px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
        isUser ? "bg-accent text-bg" : "bg-card border border-border text-text",
      )}>{msg.content}</div>
      <div className={cn("text-[10px] text-text-weak mt-1", isUser ? "text-right" : "")}>{time}</div>
    </div>
  );
}
```

- [ ] **Step 2：ChatPanel（消费状态机）**

```tsx
// components/chat/chat-panel.tsx
"use client";
import { useReducer, useRef, useEffect } from "react";
import { reducer, initialState, canSend, type Message } from "@/lib/chat-state";
import { BRAND } from "@/lib/brand";
import { ChatMessage } from "./chat-message";
import { cn } from "@/lib/utils";

const greetingMsg: Message = {
  id: "sys-greeting", role: "system",
  content: BRAND.greeting, timestamp: 0, status: "delivered",
};

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state.messages, state.pending]);

  async function send() {
    if (!canSend(state)) return;
    const id = `m-${Date.now()}`;
    const content = state.inputDraft.trim();
    dispatch({ type: "SEND_INITIATED", id, content, timestamp: Date.now() });
    try {
      const resp = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await resp.json();
      if (resp.ok) {
        dispatch({ type: "REPLY_RECEIVED", id, content: data.reply, timestamp: Date.now() });
      } else if (resp.status === 504) {
        dispatch({ type: "REPLY_TIMED_OUT", id });
      } else {
        dispatch({ type: "REPLY_FAILED", id, reason: data.error || "未知错误" });
      }
    } catch (e) {
      dispatch({ type: "REPLY_FAILED", id, reason: (e as Error).message });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) return null;
  const failedPending = state.pending && state.pending.status !== "sending";

  return (
    <div className="fixed bottom-24 right-6 w-[380px] h-[560px] bg-card border border-border rounded-card shadow-2xl flex flex-col z-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span>{BRAND.logo}</span>
          <span className="font-semibold text-[14px]">和 {BRAND.agentDefault} 对话</span>
          <span className="w-2 h-2 rounded-full bg-green shadow-[0_0_5px_#22c55e]" />
        </div>
        <button onClick={onClose} className="text-text-weak hover:text-text">✕</button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <ChatMessage msg={greetingMsg} />
        {state.messages.map(m => <ChatMessage key={m.id} msg={m} />)}
        {state.pending?.status === "sending" && (
          <div className="text-[12px] text-text-weak italic">Andy 正在思考…</div>
        )}
        {failedPending && state.pending && (
          <div className="text-[12px] text-red bg-red-dim rounded-btn px-3 py-2 mt-2 flex justify-between items-center">
            <span>{state.pending.errorReason}</span>
            <button className="underline ml-2"
              onClick={() => dispatch({ type: "RETRY", id: state.pending!.id })}>重试</button>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <textarea
          ref={taRef}
          value={state.inputDraft}
          onChange={e => dispatch({ type: "DRAFT_CHANGED", value: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="按 Enter 发送，Shift+Enter 换行"
          rows={2}
          className="w-full bg-bg border border-border rounded-btn p-2 text-[13.5px] outline-none focus:border-accent resize-none"
        />
        <div className="flex justify-end mt-2">
          <button onClick={() => void send()}
            disabled={!canSend(state)}
            className={cn("px-4 py-1.5 rounded-btn text-[13px] font-medium",
              canSend(state) ? "bg-accent text-bg" : "bg-white/5 text-text-weak cursor-not-allowed")}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3：ChatFab**

```tsx
// components/chat/chat-fab.tsx
"use client";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";

export function ChatFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChatPanel open={open} onClose={() => setOpen(false)} />
      <button onClick={() => setOpen(o => !o)}
        title="和 Andy 对话"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent text-bg text-2xl flex items-center justify-center shadow-accent-glow z-40 hover:scale-105 transition-transform">
        💬
      </button>
    </>
  );
}
```

- [ ] **Step 4：挂到 layout**

修改 `app/(dashboard)/layout.tsx`：
```tsx
import { ChatFab } from "@/components/chat/chat-fab";
// ...
<main className="flex-1 overflow-y-auto p-6">{children}</main>
<ChatFab />  {/* 加在 main-wrapper 末尾 */}
```

- [ ] **Step 5：手动验证**

```bash
pnpm dev
# 1. 主页右下角看到 💬 按钮
# 2. 点开浮层，发"ping"，等几秒看到 Andy 回复
# 3. 再发空消息，按钮 disabled
# 4. 关掉 NanoClaw 后端再发消息，看到失败 + 重试按钮
```

- [ ] **Step 6：commit**

```bash
git add -A && git commit -m "feat(chat): add chat fab/panel/message consuming state machine"
```

---

# 收尾

---

### Task 19: README + 手动验收 + Phase 1 tag

**Files:**
- Create: `README.md`

- [ ] **Step 1：写 README**

```markdown
# NanoClaw Dashboard v2

> Next.js 14 升级版控制台 · 自用工具 · 视觉与 v1 雏形对齐 · 工程化重写

## 前置
- Node.js ≥ 20
- pnpm
- NanoClaw 后端在 `~/projects/nanoclaw-fork/nanoclaw-v2`（或设置 `NANOCLAW_ROOT` 环境变量）
- 至少一个 agent group（默认 Andy）

## 启动
\`\`\`bash
pnpm install
pnpm dev   # http://127.0.0.1:4000
\`\`\`

## 目录结构
- `app/(dashboard)/` Dashboard 页面
- `app/api/chat/` 聊天 API
- `components/` 视觉组件
- `lib/format.ts` 数字格式化
- `lib/chat-state.ts` 消息状态机
- `lib/mock/*` 所有 mock 数据 + zod schema
- `lib/nanoclaw/contract.ts` NanoClaw 集成假设的唯一收口

## 常用脚本
- `pnpm dev` 开发
- `pnpm build` 生产构建
- `pnpm test` 跑测试
- `pnpm lint` 代码检查
```

- [ ] **Step 2：跑全套质量门**

```bash
pnpm lint && pnpm test && pnpm build
# 三绿
```

- [ ] **Step 3：与雏形并排截图对比**

```bash
# 终端 1：旧雏形
cd /Users/muyu/projects/nanoclaw-dashboard && PORT=7777 node server.js
# 终端 2：新版
cd /Users/muyu/projects/nanoclaw-dashboard-v2 && pnpm dev
# 浏览器对比 7777 vs 4000
```

人眼检查 Phase 1 验收清单（spec §8.2 全部勾选）。

- [ ] **Step 4：tag**

```bash
git add -A && git commit -m "docs: add README"
git tag v0.2.0
```

---

## Self-Review

**Spec 覆盖**：
- §1-3 背景/目标/范围 → 不直接对应 task，但 README + Phase 0+1 整体实现
- §4.1 技术栈 → Task 1, 4
- §4.2 视觉 token → Task 2, 3
- §4.3 信息架构 → Task 13, 16
- §4.4 项目结构 → 全部 task 累计
- §4.5 组件契约（EmptyState/StatCard/ChatPanel/api-chat） → Task 17, 14, 18, 12
- §5 数据 7 个 mock → Task 6-10
- §6 数据流 → Task 12, 16, 18 配合
- §7 测试 → Task 5, 6, 11, 12 自带；视觉组件 Task 13-18 走人眼
- §8 验收 → Task 19
- §9 风险 → 已在各任务 step 落地（120s 超时 / EmptyState / port 4000 / contract 收口）
- §10 开放问题 → Phase 0+1 一次合并执行（已确认）；独立 repo `nanoclaw-dashboard-v2`（已 init）

**类型一致性**：
- `Stats / Agent / WorkflowStatus / Logs / Security / Platform / NavGroup` 在 Task 6 定义，Task 7-10 / 13-16 全部消费同名
- `State / Action / Message / PendingMessage` 在 Task 11 定义，Task 18 消费一致
- `formatRunCount / formatCurrencyUSD / formatDelta / formatPercent / formatCount` 在 Task 5 定义，Task 14 消费一致

**无 placeholder**：每个 step 都有具体代码或具体命令。

---

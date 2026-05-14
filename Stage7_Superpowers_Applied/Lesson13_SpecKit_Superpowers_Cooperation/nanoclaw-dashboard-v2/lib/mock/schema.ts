// TODO(Important #11 / Architect A5): 把这个文件移到 `lib/contract/schema.ts`，
//   它不只是 mock 的私有 schema，components 也直接 import 它当 type 源。
//   留在 `lib/mock/` 下，Phase 3 删 mock 时 components 会断链。
import { z } from "zod";

/* ─── Stats（4 张统计卡） ─── */
export const StatsSchema = z.object({
  agents: z.object({
    total: z.number(),
    active: z.number(),
    paused: z.number(),
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
    deltaPctVsYesterday: z.number(),
    progressPct: z.number().min(0).max(100),
  }),
  apiCost: z.object({
    todayCNY: z.number(),
    budgetCNY: z.number(),
    miniBars: z.array(z.number()).length(7),
  }),
});

/* ─── Agent ─── */
export const AgentStatusEnum = z.enum(["running", "pending", "idle"]);
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  avatar: z.string(),
  status: AgentStatusEnum,
  todayRuns: z.number(),
  lastRun: z.string(),
});
export const AgentListSchema = z.object({
  total: z.number(),
  items: z.array(AgentSchema),
});

/* ─── Workflow ─── */
export const WorkflowItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel: z.string(),
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

/* ─── Logs ─── */
export const LogTagEnum = z.enum([
  "init",
  "chat",
  "verify",
  "setup",
  "docker",
  "git",
  "error",
]);
export const LogItemSchema = z.object({
  time: z.string(),
  tag: LogTagEnum,
  description: z.string(),
  duration: z.string(),
});
export const LogsSchema = z.array(LogItemSchema);

/* ─── Security ─── */
export const SecBadgeStyleEnum = z.enum(["green", "purple", "red", "yellow"]);
export const SecuritySubCardSchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string(),
  badge: z.object({
    label: z.string(),
    style: SecBadgeStyleEnum,
  }),
  description: z.string(),
  progress: z
    .object({
      pct: z.number().min(0).max(100),
      color: SecBadgeStyleEnum,
      label: z.string().optional(),
    })
    .optional(),
});
export const SecuritySchema = z.array(SecuritySubCardSchema);

/* ─── Platforms（sidebar 底部） ─── */
export const PlatformStatusEnum = z.enum([
  "connected",
  "configuring",
  "not_configured",
]);
export const PlatformSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: PlatformStatusEnum,
  statusLabel: z.string(),
});
export const PlatformsSchema = z.array(PlatformSchema);

/* ─── Sidebar Nav ─── */
export const NavItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  href: z.string(),
  badge: z.number().optional(),
});
export const NavGroupSchema = z.object({
  title: z.string(),
  items: z.array(NavItemSchema),
});
export const NavSchema = z.array(NavGroupSchema);

/* ─── Topbar Quick Badges ─── */
export const TopbarBadgeSchema = z.object({
  label: z.string(),
  style: z.enum(["green", "purple", "blue", "accent"]),
  marker: z.string(), // ● ◆
});
export const TopbarBadgesSchema = z.array(TopbarBadgeSchema);

/* ─── Inferred types ─── */
export type Stats = z.infer<typeof StatsSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AgentList = z.infer<typeof AgentListSchema>;
export type AgentStatus = z.infer<typeof AgentStatusEnum>;
export type WorkflowItem = z.infer<typeof WorkflowItemSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type LogTag = z.infer<typeof LogTagEnum>;
export type LogItem = z.infer<typeof LogItemSchema>;
export type Logs = z.infer<typeof LogsSchema>;
export type SecBadgeStyle = z.infer<typeof SecBadgeStyleEnum>;
export type SecuritySubCard = z.infer<typeof SecuritySubCardSchema>;
export type Security = z.infer<typeof SecuritySchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type NavItem = z.infer<typeof NavItemSchema>;
export type NavGroup = z.infer<typeof NavGroupSchema>;
export type TopbarBadge = z.infer<typeof TopbarBadgeSchema>;

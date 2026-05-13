import { NavSchema, type NavGroup, TopbarBadgesSchema, type TopbarBadge } from "./schema";

const navData: NavGroup[] = [
  {
    title: "导航",
    items: [
      { id: "home", label: "控制台", icon: "⊞", href: "/" },
      { id: "agents", label: "Agent 管理", icon: "🤖", href: "/agents", badge: 1 },
      { id: "skills", label: "Skills 市场", icon: "⚡", href: "/skills", badge: 14 },
      { id: "workflows", label: "工作流编排", icon: "⚙", href: "/workflows" },
      { id: "logs", label: "运行日志", icon: "📋", href: "/logs" },
      { id: "security", label: "安全中心", icon: "🛡", href: "/security" },
      { id: "settings", label: "系统设置", icon: "⚙️", href: "/settings" },
    ],
  },
  {
    title: "快捷操作",
    items: [
      { id: "new-agent", label: "创建新 Agent", icon: "➕", href: "/agents/new" },
      { id: "import-skill", label: "导入 Skill", icon: "⬇", href: "/skills/import" },
    ],
  },
];

export const mockNav: NavGroup[] = NavSchema.parse(navData);

const topbarBadges: TopbarBadge[] = [
  { label: "1 Agents 运行中", style: "green", marker: "●" },
  { label: "14 Skills 已部署", style: "purple", marker: "◆" },
];

export const mockTopbarBadges: TopbarBadge[] = TopbarBadgesSchema.parse(topbarBadges);

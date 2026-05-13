import { SecuritySchema, type Security } from "./schema";
import { formatCurrencyCNY, formatPercent } from "@/lib/format";

const COST_TODAY_CNY = 0.28;
const BUDGET_CNY = 70.0;
const USAGE_FRACTION = COST_TODAY_CNY / BUDGET_CNY;

const data: Security = [
  {
    id: "cost",
    icon: "💰",
    title: "成本控制",
    badge: { label: "正常", style: "green" },
    description: `今日消耗 ${formatCurrencyCNY(COST_TODAY_CNY)} / 预算 ${formatCurrencyCNY(BUDGET_CNY)}`,
    progress: {
      pct: USAGE_FRACTION * 100,
      color: "green",
      label: `预算使用率 ${formatPercent(USAGE_FRACTION)}`,
    },
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

export const mockSecurity: Security = SecuritySchema.parse(data);

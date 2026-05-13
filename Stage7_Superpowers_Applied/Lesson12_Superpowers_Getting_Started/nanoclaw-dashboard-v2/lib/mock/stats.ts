// TODO(Important #10 / Architect A3): 改成 `export async function getStats(): Promise<Stats>`，
//   page.tsx 用 `const stats = await getStats()`。Phase 3 切真接口时无需改 page。
//   当前是同步常量导出，Phase 3 接入异步 API 时所有 page 都要改 async。
import { StatsSchema, type Stats } from "./schema";

const data: Stats = {
  agents: { total: 1, active: 1, paused: 0, progressPct: 100 },
  skills: { total: 14, custom: 0, thirdParty: 14, progressPct: 35 },
  todayRuns: { count: 7, deltaPctVsYesterday: 233, progressPct: 70 },
  apiCost: {
    todayCNY: 0.28,
    budgetCNY: 70.0,
    miniBars: [12, 24, 8, 30, 18, 22, 28],
  },
};

export const mockStats: Stats = StatsSchema.parse(data);

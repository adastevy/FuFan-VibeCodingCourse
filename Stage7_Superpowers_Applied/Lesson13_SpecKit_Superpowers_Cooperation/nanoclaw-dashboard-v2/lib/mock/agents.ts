import { AgentListSchema, type AgentList } from "./schema";

const data: AgentList = {
  total: 5,
  items: [
    {
      id: "andy",
      name: "Andy",
      group: "NanoClaw 默认",
      avatar: "🐾",
      status: "running",
      todayRuns: 7,
      lastRun: "刚刚",
    },
    {
      id: "news",
      name: "知识日报 Agent",
      group: "Stage 1·内容生产",
      avatar: "📰",
      status: "running",
      todayRuns: 5,
      lastRun: "今天 10:50",
    },
    {
      id: "writer",
      name: "内容写作 Agent",
      group: "创作助手",
      avatar: "✍️",
      status: "idle",
      todayRuns: 0,
      lastRun: "—",
    },
    {
      id: "analyst",
      name: "数据分析 Agent",
      group: "数据洞察",
      avatar: "📊",
      status: "idle",
      todayRuns: 0,
      lastRun: "—",
    },
    {
      id: "monitor",
      name: "竞品监控 Agent",
      group: "情报收集",
      avatar: "🔍",
      status: "idle",
      todayRuns: 0,
      lastRun: "—",
    },
  ],
};

export const mockAgents: AgentList = AgentListSchema.parse(data);

import { WorkflowStatusSchema, type WorkflowStatus } from "./schema";
import { formatDuration } from "@/lib/format";

const AVG_DURATION_SECONDS = 18;

const data: WorkflowStatus = {
  queued: [],
  running: [
    {
      id: "andy-cli",
      name: "🐾 Andy 对话会话",
      channel: "cli channel",
      progressPct: 60,
      progressLabel: "等待用户输入",
      statusLabel: "进行中",
    },
  ],
  completedToday: {
    count: 7,
    avgDurationLabel: formatDuration(AVG_DURATION_SECONDS),
  },
};

export const mockWorkflows: WorkflowStatus = WorkflowStatusSchema.parse(data);

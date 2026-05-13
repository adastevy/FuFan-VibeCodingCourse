import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { AgentTable } from "@/components/dashboard/agent-table";
import { WorkflowStatusPanel } from "@/components/dashboard/workflow-status";
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
      <PageHeader
        title="控制台"
        subtitle={`欢迎回来，所有系统运行正常 · 今天已处理 ${mockStats.todayRuns.count} 次对话`}
        actions={
          <>
            <SecondaryButton>导出报告</SecondaryButton>
            <PrimaryButton>+ 新建 Agent</PrimaryButton>
          </>
        }
      />
      <StatsGrid data={mockStats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <AgentTable data={mockAgents} />
        <WorkflowStatusPanel data={mockWorkflows} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentLogs data={mockLogs} />
        <SecurityPanel data={mockSecurity} />
      </div>
    </>
  );
}

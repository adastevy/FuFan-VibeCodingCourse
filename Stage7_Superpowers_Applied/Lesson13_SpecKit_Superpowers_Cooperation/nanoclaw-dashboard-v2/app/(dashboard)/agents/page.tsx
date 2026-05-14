import { PageHeader, PrimaryButton } from "@/components/dashboard/page-header";
import { AgentTable } from "@/components/dashboard/agent-table";
import { DailyNewsPanel } from "@/components/dashboard/daily-news-panel";
import { mockAgents } from "@/lib/mock/agents";

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agent 管理"
        subtitle={`管理所有 agent group · 启停 · 编辑配置 · 共 ${mockAgents.total} 个 Agent`}
        actions={<PrimaryButton>+ 新建 Agent</PrimaryButton>}
      />

      {/* Agent 列表 */}
      <div className="grid grid-cols-1 gap-5 mb-5">
        <AgentTable data={mockAgents} />
      </div>

      {/* 知识日报 Agent 详情卡（Stage 1 落地 Agent 的真实运行状态·读 NanoClaw 后端真 sqlite） */}
      <div className="grid grid-cols-1 gap-5">
        <DailyNewsPanel />
      </div>
    </>
  );
}

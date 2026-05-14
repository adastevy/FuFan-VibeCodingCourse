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
import { DailyNewsPanel } from "@/components/dashboard/daily-news-panel";
import Link from "next/link";
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
      {/* Stage 1 成果·第一眼就要看到·所以提到第一行 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <DailyNewsPanel />
        {/* Stage 3 入口 */}
        <Link
          href="/content-generation"
          className="bg-card border border-border rounded-card p-5 flex flex-col gap-3 hover:border-accent transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✍️</span>
            <div>
              <div className="text-[14px] font-semibold">多平台内容生成</div>
              <div className="text-[12px] text-text-weak mt-0.5">Stage 3 · 小红书 / 公众号 / 微博</div>
            </div>
            <span className="ml-auto text-accent opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </div>
          <div className="text-[12px] text-text-weak leading-relaxed">
            输入话题，AI 自动完成调研 + 三平台写作，约 3 分钟产出 3 篇风格迥异的文章
          </div>
          <div className="flex gap-2 mt-auto">
            {["📕 小红书", "📰 公众号", "🐦 微博"].map((p) => (
              <span key={p} className="text-[11px] px-2 py-0.5 rounded-badge bg-accent-dim text-accent">
                {p}
              </span>
            ))}
          </div>
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <AgentTable data={mockAgents} />
        <WorkflowStatusPanel data={mockWorkflows} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <RecentLogs data={mockLogs} />
        <SecurityPanel data={mockSecurity} />
      </div>
    </>
  );
}

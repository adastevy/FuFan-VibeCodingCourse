import { type AgentList } from "@/lib/mock/schema";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PanelCard } from "./panel-card";

const statusStyles = {
  running: {
    dot: "bg-green shadow-green-glow",
    label: "运行中",
    badge: "bg-green-dim text-green",
  },
  pending: {
    dot: "bg-yellow",
    label: "待配置",
    badge: "bg-yellow/15 text-yellow",
  },
  idle: {
    dot: "bg-[#444]",
    label: "未启用",
    badge: "bg-white/5 text-text-weak",
  },
} as const;

export function AgentTable({ data }: { data: AgentList }) {
  return (
    <PanelCard
      title="🤖 活跃 Agent 列表"
      count={`${data.total} 已配置`}
      link="查看全部 →"
    >
      <table className="w-full text-[13px]">
        <thead className="text-[10px] uppercase tracking-[0.08em] text-text-weak">
          <tr>
            <th className="text-left pb-3 font-semibold">Agent 名称</th>
            <th className="text-left pb-3 font-semibold">状态</th>
            <th className="text-left pb-3 font-semibold">今日执行</th>
            <th className="text-left pb-3 font-semibold">最后运行</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((a) => {
            const s = statusStyles[a.status];
            const dim = a.status !== "running";
            return (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0",
                        dim ? "bg-white/5" : "bg-accent-dim",
                      )}
                    >
                      {a.avatar}
                    </div>
                    <div>
                      <div
                        className={cn(
                          "font-medium",
                          dim ? "text-text-weak" : "text-text",
                        )}
                      >
                        {a.name}
                      </div>
                      <div className="text-[11px] text-text-weak">{a.group}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge text-[11px]",
                      s.badge,
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />{" "}
                    {s.label}
                  </span>
                </td>
                <td className={cn("text-[13px]", dim && "text-text-weak")}>
                  {compactNumber(a.todayRuns)} 次
                </td>
                <td className="text-[13px] text-text-sub">{a.lastRun}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PanelCard>
  );
}

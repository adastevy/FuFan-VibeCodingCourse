import { type Logs } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";
import { cn } from "@/lib/utils";

const tagStyles: Record<string, string> = {
  init: "bg-accent-dim text-accent",
  chat: "bg-green-dim text-green",
  verify: "bg-red-dim text-red",
  setup: "bg-blue-dim text-blue",
  docker: "bg-purple-dim text-purple",
  git: "bg-white/5 text-text-sub",
  error: "bg-red-dim text-red",
};

export function RecentLogs({ data }: { data: Logs }) {
  return (
    <PanelCard title="📋 最近执行日志" link="完整日志 →">
      <div className="space-y-2.5">
        {data.map((l, i) => (
          <div
            key={i}
            className="grid grid-cols-[78px_72px_1fr_auto] items-center gap-3 text-[13px]"
          >
            <div className="text-[11px] text-text-weak font-mono">{l.time}</div>
            <div
              className={cn(
                "text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-badge text-center font-semibold",
                tagStyles[l.tag],
              )}
            >
              {l.tag}
            </div>
            <div className="text-text truncate">{l.description}</div>
            <div className="text-[11px] text-text-weak">{l.duration}</div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

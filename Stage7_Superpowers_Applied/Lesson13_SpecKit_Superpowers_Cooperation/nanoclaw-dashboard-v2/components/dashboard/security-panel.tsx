import { type Security } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";
import { cn } from "@/lib/utils";

const badgeStyles = {
  green: "bg-green-dim text-green",
  purple: "bg-purple-dim text-purple",
  red: "bg-red-dim text-red",
  yellow: "bg-yellow/15 text-yellow",
} as const;

const fillStyles = {
  green: "bg-green",
  purple: "bg-purple",
  red: "bg-red",
  yellow: "bg-yellow",
} as const;

export function SecurityPanel({ data }: { data: Security }) {
  return (
    <PanelCard title="🛡️ 安全防线状态" link="设置 ⚙">
      <div className="space-y-3">
        {data.map((c) => (
          <div key={c.id} className="bg-bg border border-border rounded-btn p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-medium">
                {c.icon} {c.title}
              </div>
              <span
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-badge",
                  badgeStyles[c.badge.style],
                )}
              >
                {c.badge.label}
              </span>
            </div>
            <div className="text-[12px] text-text-sub">{c.description}</div>
            {c.progress && (
              <>
                <div className="h-1 bg-border rounded-full overflow-hidden mt-2">
                  <div
                    className={cn("h-full", fillStyles[c.progress.color])}
                    style={{ width: `${c.progress.pct}%` }}
                  />
                </div>
                {c.progress.label && (
                  <div className="text-[11px] text-text-weak mt-1">
                    {c.progress.label}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

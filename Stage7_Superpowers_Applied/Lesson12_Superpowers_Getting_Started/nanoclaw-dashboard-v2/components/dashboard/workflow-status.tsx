import { type WorkflowStatus } from "@/lib/mock/schema";
import { PanelCard } from "./panel-card";
import { cn } from "@/lib/utils";

function GroupHeader({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 text-[12px]">
      <span className={color}>●</span>
      <span className="text-text-sub">{label}</span>
      <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full text-text-weak">
        {count}
      </span>
    </div>
  );
}

export function WorkflowStatusPanel({ data }: { data: WorkflowStatus }) {
  return (
    <PanelCard title="⚙️ 工作流执行状态" link="管理 →">
      <div className="space-y-4">
        {/* 排队中 */}
        <div>
          <GroupHeader color="text-blue" label="排队中" count={data.queued.length} />
          {data.queued.length === 0 ? (
            <div className="text-[12px] text-text-weak pl-3">暂无排队任务</div>
          ) : (
            <div className="space-y-2 pl-3">
              {data.queued.map((it) => (
                <div key={it.id} className="text-[12px] text-text-sub">
                  {it.name} · <span className="text-text-weak">{it.channel}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* 执行中 */}
        <div>
          <GroupHeader color="text-yellow" label="执行中" count={data.running.length} />
          <div className="space-y-2 pl-3">
            {data.running.map((it) => (
              <div key={it.id} className="bg-bg border border-border rounded-btn p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[13px] font-medium">{it.name}</div>
                  <div
                    className={cn(
                      "text-[11px] text-text-weak px-2 py-0.5 rounded-badge bg-white/5",
                    )}
                  >
                    {it.channel}
                  </div>
                </div>
                {it.progressPct !== undefined && (
                  <>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${it.progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-text-sub mt-1.5">
                      <span>{it.progressLabel}</span>
                      <span className="text-accent">{it.statusLabel}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* 已完成 */}
        <div>
          <GroupHeader
            color="text-green"
            label="已完成"
            count={data.completedToday.count}
          />
          <div className="text-[12px] text-text-sub pl-3">
            ✓&nbsp;&nbsp;今日已完成 {data.completedToday.count} 次执行，平均耗时{" "}
            {data.completedToday.avgDurationLabel}
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

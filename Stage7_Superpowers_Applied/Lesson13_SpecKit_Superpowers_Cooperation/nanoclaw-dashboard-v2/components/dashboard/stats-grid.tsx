import { type Stats } from "@/lib/mock/schema";
import {
  compactNumber,
  formatCurrencyCNY,
  formatPercent,
} from "@/lib/format";
import { StatCard } from "./stat-card";

export function StatsGrid({ data }: { data: Stats }) {
  const usage = data.apiCost.todayCNY / data.apiCost.budgetCNY;
  const deltaUp = data.todayRuns.deltaPctVsYesterday > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="🤖 Agent 总数"
        value={compactNumber(data.agents.total)}
        sub={
          <>
            <span className="text-green">● {data.agents.active} 运行中</span>
            <span className="text-text-weak">/</span>
            <span>{data.agents.paused} 暂停</span>
          </>
        }
        progress={data.agents.progressPct}
      />
      {/* TODO(Important #15): "Skills 总数" 与下面的 "今日执行" 共用 ⚡ emoji，视觉索引失效；
          下次迭代换一个 emoji（如 🧰 或 🔌）。 */}
      <StatCard
        label="⚡ Skills 总数"
        value={compactNumber(data.skills.total)}
        sub={
          <>
            <span>{data.skills.custom} 自定义</span>
            <span className="text-text-weak">/</span>
            <span>{data.skills.thirdParty} 第三方</span>
          </>
        }
        progress={data.skills.progressPct}
      />
      <StatCard
        label="⚡ 今日执行"
        value={compactNumber(data.todayRuns.count)}
        sub={
          <>
            <span className={deltaUp ? "text-green" : "text-red"}>
              {deltaUp ? "↑" : "↓"} {deltaUp ? "+" : ""}
              {data.todayRuns.deltaPctVsYesterday}%
            </span>
            <span className="ml-1">较昨日同期</span>
          </>
        }
        progress={data.todayRuns.progressPct}
      />
      <StatCard
        label="💰 API 消耗"
        value={formatCurrencyCNY(data.apiCost.todayCNY)}
        bigValue
        sub={
          <span className="flex justify-between w-full">
            <span>预算 {formatCurrencyCNY(data.apiCost.budgetCNY)}</span>
            <span>{formatPercent(usage)}</span>
          </span>
        }
        miniBars={data.apiCost.miniBars}
      />
    </div>
  );
}

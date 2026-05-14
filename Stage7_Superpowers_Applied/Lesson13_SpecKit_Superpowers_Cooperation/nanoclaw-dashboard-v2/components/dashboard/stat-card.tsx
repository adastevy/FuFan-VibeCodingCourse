import { cn } from "@/lib/utils";
import { MiniBars } from "./mini-bars";

export type StatCardProps = {
  label: string;
  value: string;
  sub?: React.ReactNode;
  progress?: number;
  miniBars?: number[];
  bigValue?: boolean;
};

export function StatCard({
  label,
  value,
  sub,
  progress,
  miniBars,
  bigValue,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-card p-4 hover:border-border-hover hover:bg-card-hover transition-colors shadow-card">
      <div className="text-[13px] text-text-sub">{label}</div>
      <div
        className={cn(
          "font-bold tracking-tighter mt-2 leading-none",
          bigValue ? "text-[36px]" : "text-[28px]",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[12px] text-text-sub mt-2 flex items-center gap-1">
          {sub}
        </div>
      )}
      {progress !== undefined && (
        <div className="h-[3px] bg-border rounded-full overflow-hidden mt-3">
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
      {miniBars && <MiniBars values={miniBars} />}
    </div>
  );
}

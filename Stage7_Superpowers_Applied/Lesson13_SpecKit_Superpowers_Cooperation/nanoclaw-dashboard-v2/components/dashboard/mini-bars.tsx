import { cn } from "@/lib/utils";

/**
 * 7 天 mini 柱图。最后一根（今天）用 accent 色高亮。
 */
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-9 mt-2">
      {values.map((v, i) => {
        const isToday = i === values.length - 1;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm",
              isToday ? "bg-accent/80" : "bg-[#333]",
            )}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

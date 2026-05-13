import { mockTopbarBadges } from "@/lib/mock/nav";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const badgeStyles = {
  green: "bg-green-dim text-green",
  purple: "bg-purple-dim text-purple",
  blue: "bg-blue-dim text-blue",
  accent: "bg-accent-dim text-accent",
} as const;

export function Topbar() {
  return (
    <header
      className="bg-card border-b border-border flex items-center px-6 gap-3"
      style={{ height: 60, minHeight: 60 }}
    >
      {/* Search · Critical #5 修复：disabled 视觉化（自用工具不能让用户分不清占位 vs bug） */}
      <div
        className="flex-1 max-w-[420px] relative cursor-not-allowed"
        title="Phase 2 开放"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-weak text-sm pointer-events-none opacity-50">
          🔍
        </span>
        <input
          disabled
          placeholder="搜索（Phase 2 开放）"
          className="w-full bg-bg border border-border/60 rounded-btn py-[7px] pl-9 pr-12 text-[13px] text-text-weak outline-none placeholder:text-text-weak opacity-50 cursor-not-allowed"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-weak border border-border px-1.5 py-px rounded opacity-50">
          ⌘K
        </span>
      </div>

      <div className="flex-1" />

      {/* Quick badges */}
      <div className="flex items-center gap-2">
        {mockTopbarBadges.map((b) => (
          <div
            key={b.label}
            className={cn(
              "text-[11.5px] px-2 py-1 rounded-btn font-medium flex items-center gap-1.5",
              badgeStyles[b.style],
            )}
          >
            <span>{b.marker}</span> {b.label}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          title="通知"
          className="relative w-9 h-9 bg-card border border-border rounded-btn text-text-sub hover:bg-card-hover hover:border-border-hover hover:text-text transition-colors flex items-center justify-center"
        >
          🔔
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red" />
        </button>
        <div
          title={BRAND.user.name}
          className="w-9 h-9 rounded-full bg-accent text-bg font-semibold flex items-center justify-center text-[13px]"
        >
          {BRAND.user.initials}
        </div>
      </div>
    </header>
  );
}

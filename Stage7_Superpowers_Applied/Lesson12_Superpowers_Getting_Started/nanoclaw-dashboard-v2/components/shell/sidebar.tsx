import Link from "next/link";
import { mockNav } from "@/lib/mock/nav";
import { mockPlatforms } from "@/lib/mock/platforms";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const dotByStatus = {
  connected: "bg-green shadow-green-glow",
  configuring: "bg-yellow",
  not_configured: "bg-[#444]",
} as const;

export function Sidebar({ activeHref = "/" }: { activeHref?: string }) {
  return (
    <aside className="w-60 min-w-60 bg-card border-r border-border flex flex-col h-screen overflow-y-auto shrink-0">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-border flex items-center gap-2.5">
        <div className="w-9 h-9 bg-accent rounded-[9px] flex items-center justify-center text-xl shrink-0 shadow-accent-glow">
          {BRAND.logo}
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] font-bold tracking-tight">{BRAND.name}</div>
          <div className="text-[11px] text-text-weak">{BRAND.version}</div>
        </div>
      </div>

      {/* Nav groups */}
      {mockNav.map((group) => (
        <div className="px-2 pt-4 pb-1" key={group.title}>
          <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-weak px-2 pb-1.5">
            {group.title}
          </div>
          {group.items.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-[7px] rounded-btn text-[13.5px] mb-px transition-colors",
                  active
                    ? "bg-accent-dim text-accent font-medium"
                    : "text-text-sub hover:bg-white/5 hover:text-text",
                )}
              >
                <span className="w-4 text-center text-sm shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto bg-accent-dim text-accent text-[10px] font-semibold px-1.5 py-px rounded-[10px]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Platforms */}
      <div className="mt-auto px-2 pt-3 pb-4 border-t border-border">
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-weak px-2 pb-2">
          平台连接
        </div>
        {mockPlatforms.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 px-2 py-[5px] rounded-md text-[12.5px] text-text-sub"
          >
            <span className={cn("w-[7px] h-[7px] rounded-full shrink-0", dotByStatus[p.status])} />
            <span>{p.name}</span>
            <span className="ml-auto text-[11px] text-text-weak">{p.statusLabel}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

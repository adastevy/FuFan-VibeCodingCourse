export function PanelCard({
  title,
  count,
  link,
  children,
}: {
  title: React.ReactNode;
  count?: string;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-card overflow-hidden shadow-card flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="text-[14px] font-semibold tracking-tight">
          {title}
          {count && <span className="text-text-weak font-normal"> · {count}</span>}
        </div>
        {link && (
          <div className="text-[12px] text-accent cursor-pointer hover:underline">
            {link}
          </div>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

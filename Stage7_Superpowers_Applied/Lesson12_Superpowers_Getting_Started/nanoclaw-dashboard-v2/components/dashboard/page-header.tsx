export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <div className="text-[22px] font-bold tracking-tight leading-tight">{title}</div>
        {subtitle && <div className="text-[13px] text-text-sub mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * Critical #5 修复：占位按钮显式 disabled + tooltip + 视觉降权，
 * 避免自用用户分不清"占位 vs bug"。
 */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const isPlaceholder = !onClick;
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPlaceholder}
      title={title || (isPlaceholder ? "Phase 2 开放" : undefined)}
      className={
        isPlaceholder || disabled
          ? "px-3.5 py-2 rounded-btn bg-accent/40 text-bg/70 font-medium text-[12.5px] cursor-not-allowed"
          : "px-3.5 py-2 rounded-btn bg-accent text-bg font-medium text-[12.5px] hover:opacity-90 transition-opacity"
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const isPlaceholder = !onClick;
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPlaceholder}
      title={title || (isPlaceholder ? "Phase 2 开放" : undefined)}
      className={
        isPlaceholder || disabled
          ? "px-3.5 py-2 rounded-btn bg-card border border-border text-text-weak text-[12.5px] cursor-not-allowed opacity-60"
          : "px-3.5 py-2 rounded-btn bg-card border border-border text-text-sub text-[12.5px] hover:bg-card-hover hover:border-border-hover hover:text-text transition-colors"
      }
    >
      {children}
    </button>
  );
}

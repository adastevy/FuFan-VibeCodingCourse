import { PageHeader } from "@/components/dashboard/page-header";

type Phase = "Phase 2" | "Phase 3";

export function EmptyState({
  title,
  subtitle,
  icon,
  phase = "Phase 3",
}: {
  title: string;
  subtitle: string;
  icon: string;
  phase?: Phase;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {/* TODO(Important #14): "Phase X 开放" 是开发语言，应改为产品语言（"功能开发中"）。 */}
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4 opacity-80">{icon}</div>
        <div className="text-[15px] text-text font-semibold mb-1">
          该功能将在 {phase} 开放
        </div>
        <div className="text-[13px] text-text-sub max-w-md">
          目前已在 Phase 1 中保留入口，避免空链接。下个阶段会接入真实数据并提供完整交互。
        </div>
      </div>
    </>
  );
}

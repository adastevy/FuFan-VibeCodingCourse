import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="📋"
      title="运行日志"
      subtitle="实时查看 agent 执行日志与报错"
    />
  );
}

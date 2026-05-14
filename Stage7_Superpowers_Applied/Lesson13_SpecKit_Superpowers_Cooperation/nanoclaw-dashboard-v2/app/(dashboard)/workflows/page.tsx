import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="⚙"
      title="工作流编排"
      subtitle="创建 / 编辑 / 触发 cron 任务"
    />
  );
}

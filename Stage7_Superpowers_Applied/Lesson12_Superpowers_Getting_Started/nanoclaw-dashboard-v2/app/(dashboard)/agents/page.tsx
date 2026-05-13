import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="🤖"
      title="Agent 管理"
      subtitle="管理所有 agent group · 启停 · 编辑配置"
    />
  );
}

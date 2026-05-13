import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="➕"
      title="创建新 Agent"
      subtitle="向导式创建 agent group"
    />
  );
}

import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="⚙️"
      title="系统设置"
      subtitle="API key 管理 · 模型切换 · 全局参数"
    />
  );
}

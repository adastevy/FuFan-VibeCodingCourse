import { EmptyState } from "@/components/shell/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon="🛡"
      title="安全中心"
      subtitle="权限审计 · 敏感操作记录 · 成本告警"
    />
  );
}

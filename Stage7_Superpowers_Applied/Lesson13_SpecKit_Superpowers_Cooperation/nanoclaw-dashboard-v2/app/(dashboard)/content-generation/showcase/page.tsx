import { PageHeader } from "@/components/dashboard/page-header";
import { ContentShowcase } from "@/components/dashboard/content-showcase";

export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  return (
    <>
      <PageHeader
        title="多平台内容生成 · 作品集"
        subtitle="全部真生成历史 — 小红书 / 公众号 / 微博"
      />
      <ContentShowcase />
    </>
  );
}

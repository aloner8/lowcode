import PageDesigner from '@/components/page-designer/PageDesigner';

export default async function PlatformPageDesignerPage({ params }: { readonly params: Promise<{ platformId: string; pageId: string }> }) {
  const { platformId, pageId } = await params;
  return <PageDesigner workspace="platform-page" platformId={platformId} pageId={decodeURIComponent(pageId)} />;
}

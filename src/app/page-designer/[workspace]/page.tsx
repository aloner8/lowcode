import PageDesigner from '@/components/page-designer/PageDesigner';

export default async function PageDesignerPage({ params }: { readonly params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <PageDesigner workspace={workspace} />;
}

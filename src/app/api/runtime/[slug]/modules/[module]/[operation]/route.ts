import { handleModuleRequest } from '@/lib/services/moduleHttp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ slug: string; module: string; operation: string }> }) {
  const { slug, module, operation } = await context.params;
  return handleModuleRequest(request, module, operation, slug);
}

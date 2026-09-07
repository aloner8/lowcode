import { handleModuleRequest } from '@/lib/services/moduleHttp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ module: string; operation: string }> }) {
  const { module, operation } = await context.params;
  return handleModuleRequest(request, module, operation);
}

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { TemplateStudioClient } from "@/components/template-studio/TemplateStudioClient";
import { getCurrentUser } from "@/lib/auth/authActions";

export default async function TemplateStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  return (
    <AdminShell user={user} mainClassName="p-0">
      <TemplateStudioClient templateId={id} />
    </AdminShell>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, History } from "lucide-react";
import AppRuntimeControl from "@/components/admin/AppRuntimeControl";
import { getCurrentUser } from "@/lib/auth/authActions";
import { loadAdminAppDetail } from "@/lib/admin/appAdminData";

export const dynamic = "force-dynamic";

const dateTime = (value: string | null) => value
  ? new Date(value).toLocaleString("th-TH")
  : "—";

export default async function AdminAppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
  const app = await loadAdminAppDetail(id, user.id, user.globalRole === "GOD");
  if (!app) notFound();

  return <div className="d-flex flex-column gap-3">
    <div>
      <Link href="/admin/apps" className="adm-link">← เว็บไซต์</Link>
      <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
        <h1 className="adm-page-title mb-0">{app.name}</h1>
        <span className={`adm-chip ${app.isSuspended ? "is-danger" : app.isActive ? "is-ok" : "is-off"}`}>
          {app.isSuspended ? "ระงับ" : app.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </div>
      <p className="adm-page-sub mb-0">{app.slug} · {app.customer.name}</p>
    </div>

    <div className="row g-3">
      <div className="col-12 col-xl-8">
        <section className="adm-card p-3 h-100">
          <div className="adm-card-head px-0 pt-0"><h2 className="adm-card-title">App Detail</h2></div>
          <dl className="adm-facts mb-0">
            <div><dt>แม่แบบ</dt><dd>{app.template.name}<span className="adm-cell-sub d-block">{app.template.slug}</span></dd></div>
            <div><dt>Revision</dt><dd>{app.revision ? `#${app.revision.number} · ${app.revision.digest.slice(0, 12)}` : "Unavailable"}</dd></div>
            <div><dt>ฐานข้อมูล</dt><dd className="font-monospace">{app.tenantDbName}</dd></div>
            <div><dt>Schema revision</dt><dd className="font-monospace">{app.schemaRevision ?? "ยังไม่ provision"}</dd></div>
            <div><dt>พอร์ต</dt><dd>{app.port}</dd></div>
            <div><dt>แพ็กเกจ</dt><dd>{app.packageName}</dd></div>
          </dl>
        </section>
      </div>
      <div className="col-12 col-xl-4">
        <section className="adm-card p-3 h-100">
          <div className="adm-card-head px-0 pt-0"><h2 className="adm-card-title">Runtime</h2></div>
          {app.canControl ? <AppRuntimeControl appId={app.id} initial={app.runtime} /> : <>
            <span className={`adm-chip ${app.runtime.observedState === "RUNNING" ? "is-ok" : app.runtime.observedState === "FAILED" ? "is-danger" : "is-off"}`}>{app.runtime.observedState}</span>
            <p className="adm-cell-sub mt-2 mb-0">บัญชีนี้มีสิทธิ์ดูสถานะ แต่ไม่มีสิทธิ์ Start/Stop</p>
          </>}
          <p className="adm-cell-sub mt-2 mb-0">Health ล่าสุด: {dateTime(app.runtime.healthCheckedAt)}</p>
          {app.runtime.error && <p className="text-danger small mb-0">{app.runtime.error}</p>}
        </section>
      </div>
    </div>

    <section className="adm-card p-3">
      <div className="adm-card-head px-0 pt-0"><h2 className="adm-card-title">โควต้า Customer</h2></div>
      <div className="row g-3">
        <div className="col-12 col-md-6"><div className="border rounded-3 p-3"><span className="adm-cell-sub d-block">App ที่สร้าง</span><strong>{app.quota.apps} / {app.quota.maxApps || "ไม่จำกัด"}</strong></div></div>
        <div className="col-12 col-md-6"><div className="border rounded-3 p-3"><span className="adm-cell-sub d-block">Running / Reserved</span><strong>{app.quota.running} / {app.quota.maxRunning || "ไม่จำกัด"}</strong></div></div>
      </div>
    </section>

    <section className="adm-card">
      <div className="adm-card-head"><h2 className="adm-card-title">Domains</h2></div>
      <div className="table-responsive"><table className="adm-table">
        <thead><tr><th>Domain</th><th>สถานะ</th><th>ตรวจพร้อมเมื่อ</th><th>ข้อผิดพลาด</th></tr></thead>
        <tbody>{app.domains.length ? app.domains.map((domain) => <tr key={domain.domain}>
          <td><span className="font-monospace">{domain.domain}</span>{domain.isPrimary && <span className="adm-chip is-info ms-2">Primary</span>}</td>
          <td><span className={`adm-chip ${domain.readiness === "READY" ? "is-ok" : "is-warn"}`}>{domain.readiness}</span></td>
          <td>{dateTime(domain.verifiedAt)}</td><td>{domain.error ?? "—"}</td>
        </tr>) : <tr><td colSpan={4} className="text-center adm-cell-sub">ยังไม่มี Domain</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="adm-card">
      <div className="adm-card-head">
        <h2 className="adm-card-title"><History size={17} aria-hidden="true" /> งานล่าสุด</h2>
        <Link href={`/audit-logs?entityId=${app.id}`} className="adm-link">Audit logs ที่เกี่ยวข้อง →</Link>
      </div>
      <div className="table-responsive"><table className="adm-table">
        <thead><tr><th>เวลา</th><th>งาน</th><th>สถานะ</th><th>Checkpoint</th><th>ข้อผิดพลาด</th></tr></thead>
        <tbody>{app.operations.length ? app.operations.map((operation) => <tr key={operation.id}>
          <td>{dateTime(operation.createdAt)}</td><td>{operation.type}</td>
          <td><span className={`adm-chip ${operation.status === "COMPLETED" ? "is-ok" : operation.status === "FAILED" ? "is-danger" : "is-warn"}`}>{operation.status}</span></td>
          <td>{operation.checkpoint}</td><td>{operation.error ?? "—"}</td>
        </tr>) : <tr><td colSpan={5} className="text-center adm-cell-sub">ยังไม่มีงาน</td></tr>}</tbody>
      </table></div>
      <div className="p-3 border-top"><Link href={`/app/${app.slug}`} target="_blank" rel="noreferrer" className="adm-btn is-quiet is-sm"><ExternalLink size={14} aria-hidden="true" /> เปิดเว็บไซต์</Link></div>
    </section>
  </div>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ExternalLink, Users } from "lucide-react";
import { loadCustomerDetail } from "@/lib/admin/customerData";

export const dynamic = "force-dynamic";

const statusLabel = { ACTIVE: "เปิดใช้งาน", SUSPENDED: "ระงับ", ARCHIVED: "เก็บถาวร" } as const;
const statusTone = { ACTIVE: "is-ok", SUSPENDED: "is-danger", ARCHIVED: "is-off" } as const;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await loadCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <Link href="/admin/customers" className="adm-link">← หน่วยงานลูกค้า</Link>
        <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
          <h1 className="adm-page-title mb-0">{customer.name}</h1>
          <span className={`adm-chip ${statusTone[customer.status]}`}>{statusLabel[customer.status]}</span>
        </div>
        <p className="adm-page-sub mb-0">{customer.slug} · {customer.primaryDomain ?? "ยังไม่กำหนดโดเมนหลัก"}</p>
      </div>

      <div className="row g-3">
        {[['สมาชิก', customer.memberCount], ['แม่แบบ', customer.templateCount], ['App', customer.appCount]].map(([label, value]) => (
          <div className="col-12 col-sm-4" key={label}><div className="adm-card p-3"><span className="adm-cell-sub d-block">{label}</span><strong className="fs-3">{value}</strong></div></div>
        ))}
      </div>

      <section className="adm-card">
        <div className="adm-card-head"><h2 className="adm-card-title"><Users size={17} aria-hidden="true" /> สมาชิก</h2></div>
        <div className="table-responsive"><table className="adm-table">
          <thead><tr><th>ชื่อ</th><th>บัญชี</th><th>สิทธิ์ Customer</th><th className="text-end">ตรวจสอบมุมมอง</th></tr></thead>
          <tbody>{customer.members.length ? customer.members.map((member) => <tr key={member.id}><td className="adm-cell-strong">{member.fullName}</td><td>{member.username}<span className="adm-cell-sub d-block">{member.email}</span></td><td><span className="adm-chip is-info">{member.role}</span></td><td className="text-end">{member.canImpersonate ? <form action="/api/admin/impersonation" method="post"><input type="hidden" name="targetUserId" value={member.id} /><button type="submit" className="btn btn-sm btn-outline-primary">สวมสิทธิ์</button></form> : <span className="adm-cell-sub">ไม่พร้อมใช้งาน</span>}</td></tr>) : <tr><td colSpan={4} className="text-center adm-cell-sub">ยังไม่มีสมาชิก</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><h2 className="adm-card-title"><Boxes size={17} aria-hidden="true" /> แม่แบบและ App</h2></div>
        <div className="table-responsive"><table className="adm-table">
          <thead><tr><th>แม่แบบ</th><th>การเผยแพร่</th><th className="text-end">App</th></tr></thead>
          <tbody>{customer.templates.length ? customer.templates.map((template) => <tr key={template.id}><td><span className="adm-cell-strong">{template.name}</span><span className="adm-cell-sub d-block">{template.slug}</span></td><td><span className={`adm-chip ${template.publishedRevisionId ? 'is-ok' : 'is-warn'}`}>{template.publishedRevisionId ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span>{template.isPublic && <span className="adm-chip is-info ms-1">Public</span>}</td><td className="text-end">{template.appCount}</td></tr>) : <tr><td colSpan={3} className="text-center adm-cell-sub">ยังไม่มีแม่แบบ</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><h2 className="adm-card-title">เว็บไซต์</h2></div>
        <div className="table-responsive"><table className="adm-table">
          <thead><tr><th>App</th><th>แม่แบบ</th><th>แพ็กเกจ</th><th className="text-end">สถานะ</th></tr></thead>
          <tbody>{customer.apps.length ? customer.apps.map((app) => <tr key={app.id}><td><Link className="adm-cell-strong adm-link" href={`/site/${app.slug}`}>{app.name} <ExternalLink size={13} aria-hidden="true" /></Link><span className="adm-cell-sub d-block">{app.slug}</span></td><td>{app.templateName}</td><td>{app.packageName}</td><td className="text-end"><span className={`adm-chip ${app.isSuspended ? 'is-danger' : app.isActive ? 'is-ok' : 'is-off'}`}>{app.isSuspended ? 'ระงับ' : app.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td></tr>) : <tr><td colSpan={4} className="text-center adm-cell-sub">ยังไม่มี App</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
  );
}

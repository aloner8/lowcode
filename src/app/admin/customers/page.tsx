import Link from "next/link";
import { Building2, Inbox } from "lucide-react";
import { loadCustomerSummaries } from "@/lib/admin/customerData";

export const dynamic = "force-dynamic";

const statusLabel = { ACTIVE: "เปิดใช้งาน", SUSPENDED: "ระงับ", ARCHIVED: "เก็บถาวร" } as const;
const statusTone = { ACTIVE: "is-ok", SUSPENDED: "is-danger", ARCHIVED: "is-off" } as const;

export default async function CustomersPage() {
  const customers = await loadCustomerSummaries();
  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h1 className="adm-page-title">หน่วยงานลูกค้า</h1>
        <p className="adm-page-sub">ตรวจสอบเจ้าของ แม่แบบ เว็บไซต์ และสถานะของ Customer ทั้งระบบ</p>
      </div>
      <section className="adm-card">
        <div className="adm-card-head">
          <h2 className="adm-card-title"><Building2 size={17} aria-hidden="true" /> Customer ทั้งหมด</h2>
          <span className="adm-chip is-info">{customers.length} รายการ</span>
        </div>
        {customers.length === 0 ? (
          <div className="adm-empty">
            <span className="adm-empty-icon"><Inbox size={22} aria-hidden="true" /></span>
            <p className="adm-empty-title">ยังไม่มี Customer</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="adm-table">
              <thead><tr><th>หน่วยงาน</th><th>โดเมนหลัก</th><th>สมาชิก</th><th>แม่แบบ</th><th>App</th><th className="text-end">สถานะ</th></tr></thead>
              <tbody>{customers.map((customer) => (
                <tr key={customer.id}>
                  <td><Link className="adm-cell-strong adm-link" href={`/admin/customers/${customer.id}`}>{customer.name}</Link><span className="adm-cell-sub d-block">{customer.slug}</span></td>
                  <td>{customer.primaryDomain ?? <span className="adm-cell-sub">ไม่กำหนด</span>}</td>
                  <td>{customer.memberCount}</td><td>{customer.templateCount}</td><td>{customer.appCount}</td>
                  <td className="text-end"><span className={`adm-chip ${statusTone[customer.status]}`}>{statusLabel[customer.status]}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

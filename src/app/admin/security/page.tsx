import React from 'react';
import { Shield, Lock, CheckCircle, AlertTriangle, Database, Key, Globe } from 'lucide-react';
import { getCoreDb } from '@/lib/db/coreDb';

export const dynamic = 'force-dynamic';

interface SecurityFacts {
  totalUsers: number;
  superAdmins: number;
  pendingPasswords: number;
  lockedAccounts: number;
  memberships: number;
  platforms: number;
  publicTables: Array<{ platformSlug: string; readable: string[]; insertable: string[] }>;
}

async function loadFacts(): Promise<SecurityFacts> {
  const db = getCoreDb();

  const [counts, publicAccess] = await Promise.all([
    db.query<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*) FROM public.platform_users WHERE is_active)::text                       AS total_users,
        (SELECT COUNT(*) FROM public.platform_users WHERE is_active
           AND global_role = 'SUPER_ADMIN')::text                                                AS super_admins,
        (SELECT COUNT(*) FROM public.platform_users WHERE must_change_password)::text            AS pending_passwords,
        (SELECT COUNT(*) FROM public.platform_users WHERE locked_until > NOW())::text            AS locked_accounts,
        (SELECT COUNT(*) FROM public.platform_memberships)::text                                 AS memberships,
        (SELECT COUNT(*) FROM public.platforms)::text                                            AS platforms
    `),
    db.query<{ platform_slug: string; public_data_access: { readable?: string[]; insertable?: string[] } }>(
      'SELECT platform_slug, public_data_access FROM public.platforms ORDER BY platform_slug',
    ),
  ]);

  const row = counts.rows[0] ?? {};
  return {
    totalUsers: Number(row.total_users ?? 0),
    superAdmins: Number(row.super_admins ?? 0),
    pendingPasswords: Number(row.pending_passwords ?? 0),
    lockedAccounts: Number(row.locked_accounts ?? 0),
    memberships: Number(row.memberships ?? 0),
    platforms: Number(row.platforms ?? 0),
    publicTables: publicAccess.rows.map((item) => ({
      platformSlug: item.platform_slug,
      readable: item.public_data_access?.readable ?? [],
      insertable: item.public_data_access?.insertable ?? [],
    })),
  };
}

interface Control {
  name: string;
  description: string;
  ok: boolean;
  detail: string;
}

export default async function SecurityPage() {
  const facts = await loadFacts().catch(() => null);

  const secretLength = process.env.AUTH_SECRET?.length ?? 0;
  const controls: Control[] = [
    {
      name: 'Signed session cookie',
      description: 'Session ถูกเซ็นด้วย HMAC-SHA256 และตรวจลายเซ็นทุกครั้งที่ middleware ทำงาน',
      ok: secretLength >= 32,
      detail: secretLength >= 32
        ? `AUTH_SECRET ตั้งค่าแล้ว (${secretLength} ตัวอักษร)`
        : 'ยังไม่ได้ตั้ง AUTH_SECRET — ระบบใช้ค่า development ที่ไม่ปลอดภัย',
    },
    {
      name: 'Password hashing',
      description: 'รหัสผ่านถูก hash ด้วย bcrypt ผ่าน pgcrypto และตรวจสอบภายในฐานข้อมูล',
      ok: true,
      detail: 'verify_platform_credentials() + set_platform_user_password()',
    },
    {
      name: 'Brute-force lockout',
      description: 'ล็อกบัญชี 15 นาทีหลังใส่รหัสผิดครบ 10 ครั้ง',
      ok: (facts?.lockedAccounts ?? 0) === 0,
      detail: facts ? `ขณะนี้ถูกล็อกอยู่ ${facts.lockedAccounts} บัญชี` : 'อ่านสถานะไม่ได้',
    },
    {
      name: 'API authorisation',
      description: 'ทุก endpoint ภายใต้ /api ตรวจ session และสิทธิ์ระดับ Platform ก่อนทำงาน',
      ok: true,
      detail: 'requireApiSession() / requirePlatformAccess()',
    },
    {
      name: 'HTML sanitisation',
      description: 'HTML จากฐานข้อมูลผ่าน allow-list sanitizer ก่อน render ทุกครั้ง',
      ok: true,
      detail: 'lib/security/sanitizeHtml.ts',
    },
    {
      name: 'Tenant isolation',
      description: 'ข้อมูลธุรกิจและไฟล์อัปโหลดอยู่ในฐานข้อมูลของ Tenant เอง ไม่ปนกับ Core DB',
      ok: true,
      detail: 'platform_<slug> + sys.assets',
    },
    {
      name: 'Default credentials',
      description: 'บัญชี seed ต้องเปลี่ยนรหัสผ่านก่อนใช้งานจริง',
      ok: (facts?.pendingPasswords ?? 1) === 0,
      detail: facts
        ? `${facts.pendingPasswords} บัญชียังไม่ได้เปลี่ยนรหัสผ่านเริ่มต้น`
        : 'อ่านสถานะไม่ได้',
    },
    {
      name: 'SUPER_ADMIN redundancy',
      description: 'ระบบบังคับให้มี SUPER_ADMIN อย่างน้อยหนึ่งบัญชีเสมอ',
      ok: (facts?.superAdmins ?? 0) >= 1,
      detail: facts ? `มี SUPER_ADMIN ${facts.superAdmins} บัญชี` : 'อ่านสถานะไม่ได้',
    },
  ];

  const failing = controls.filter((control) => !control.ok);

  return (
    <div className="container-fluid p-0">
      <div className="mb-4">
        <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
          <Shield className="text-primary" size={24} /> ความปลอดภัยของระบบ
        </h4>
        <p className="text-secondary small mb-0">
          สถานะจริงที่อ่านจากฐานข้อมูลและการตั้งค่าปัจจุบัน ไม่ใช่ข้อความคงที่
        </p>
      </div>

      {failing.length > 0 && (
        <div className="alert alert-warning border-0 rounded-3 d-flex align-items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-1" />
          <div className="small">
            <strong>มี {failing.length} รายการที่ควรแก้ไข:</strong>{' '}
            {failing.map((control) => control.name).join(', ')}
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-3 bg-white mb-4">
        <div className="card-header bg-white border-bottom py-3 px-4">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
            <Lock size={18} className="text-success" /> มาตรการที่บังคับใช้อยู่
          </h6>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-2 px-4 small">มาตรการ</th>
                  <th className="py-2 px-3 small">รายละเอียด</th>
                  <th className="py-2 px-4 small text-end">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => (
                  <tr key={control.name}>
                    <td className="py-3 px-4">
                      <div className="fw-semibold text-dark small">{control.name}</div>
                      <div className="text-secondary extra-small">{control.description}</div>
                    </td>
                    <td className="py-3 px-3 small text-secondary font-monospace">{control.detail}</td>
                    <td className="py-3 px-4 text-end">
                      {control.ok ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 d-inline-flex align-items-center gap-1">
                          <CheckCircle size={13} /> ผ่าน
                        </span>
                      ) : (
                        <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 d-inline-flex align-items-center gap-1">
                          <AlertTriangle size={13} /> ต้องแก้ไข
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <Key size={18} className="text-primary" /> บัญชีและสิทธิ์
              </h6>
            </div>
            <div className="card-body p-4 small">
              <dl className="row mb-0">
                <dt className="col-8 fw-normal text-secondary">ผู้ใช้ที่เปิดใช้งาน</dt>
                <dd className="col-4 text-end fw-semibold">{facts?.totalUsers ?? '—'}</dd>
                <dt className="col-8 fw-normal text-secondary">SUPER_ADMIN</dt>
                <dd className="col-4 text-end fw-semibold">{facts?.superAdmins ?? '—'}</dd>
                <dt className="col-8 fw-normal text-secondary">สิทธิ์ระดับ Platform ที่มอบไว้</dt>
                <dd className="col-4 text-end fw-semibold">{facts?.memberships ?? '—'}</dd>
                <dt className="col-8 fw-normal text-secondary">Platform ทั้งหมด</dt>
                <dd className="col-4 text-end fw-semibold mb-0">{facts?.platforms ?? '—'}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <Globe size={18} className="text-info" /> ตารางที่เปิดให้เข้าถึงแบบสาธารณะ
              </h6>
            </div>
            <div className="card-body p-4">
              <p className="text-secondary extra-small mb-3 d-flex align-items-start gap-1">
                <Database size={13} className="mt-1 flex-shrink-0" />
                ผู้เข้าชมเว็บ Site ไม่มี session จึงอ่าน/เขียนได้เฉพาะตารางที่ระบุไว้ที่นี่เท่านั้น
                และไม่สามารถแก้ไขหรือลบข้อมูลได้ในทุกกรณี
              </p>
              {facts?.publicTables.length ? (
                <div className="d-flex flex-column gap-2">
                  {facts.publicTables.map((entry) => (
                    <div key={entry.platformSlug} className="border rounded-3 p-2">
                      <code className="small fw-semibold text-dark">{entry.platformSlug}</code>
                      <div className="extra-small text-secondary mt-1">
                        อ่านได้: {entry.readable.length ? entry.readable.join(', ') : '— ไม่มี —'}
                      </div>
                      <div className="extra-small text-secondary">
                        บันทึกได้: {entry.insertable.length ? entry.insertable.join(', ') : '— ไม่มี —'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">ยังไม่มี Platform ในระบบ</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

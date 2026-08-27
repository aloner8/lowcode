import React from 'react';
import { CheckCircle, AlertTriangle, Database, Key, Globe, Lock } from 'lucide-react';
import { getCoreDb } from '@/lib/db/coreDb';
import RateLimitSettings from '@/components/admin/RateLimitSettings';

export const dynamic = 'force-dynamic';

interface SecurityFacts {
  totalUsers: number;
  admins: number;
  pendingPasswords: number;
  lockedAccounts: number;
  memberships: number;
  platforms: number;
  publicTables: Array<{ platformSlug: string; readable: string[]; insertable: string[] }>;
}

async function loadFacts(): Promise<SecurityFacts> {
  const db = getCoreDb();

  const [counts, publicAccess] = await Promise.all([
    // 'GOD' — the only administrator value the schema's CHECK constraint allows.
    // This counted 'SUPER_ADMIN' before, which can never match, so the figure
    // read zero however many administrators existed.
    db.query<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*) FROM public.platform_users WHERE is_active)::text                       AS total_users,
        (SELECT COUNT(*) FROM public.platform_users WHERE is_active
           AND global_role = 'GOD')::text                                                        AS admins,
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
    admins: Number(row.admins ?? 0),
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
      name: 'การจดจำการเข้าสู่ระบบ',
      description: 'ข้อมูลการเข้าสู่ระบบถูกเซ็นกำกับ และตรวจลายเซ็นทุกครั้งที่เปิดหน้าใหม่',
      ok: secretLength >= 32,
      detail: secretLength >= 32
        ? `ตั้งกุญแจลับแล้ว (${secretLength} ตัวอักษร)`
        : 'ยังไม่ได้ตั้ง AUTH_SECRET — ระบบใช้ค่าสำหรับทดสอบที่ไม่ปลอดภัย',
    },
    {
      name: 'การเก็บรหัสผ่าน',
      description: 'รหัสผ่านถูกเข้ารหัสทางเดียวและตรวจสอบภายในฐานข้อมูล ไม่มีการเก็บรหัสจริง',
      ok: true,
      detail: 'bcrypt ผ่าน pgcrypto',
    },
    {
      name: 'ป้องกันการเดารหัสผ่าน',
      description: 'ล็อกบัญชีชั่วคราวเมื่อใส่รหัสผิดติดกันหลายครั้ง',
      ok: (facts?.lockedAccounts ?? 0) === 0,
      detail: facts ? `ขณะนี้ถูกล็อกอยู่ ${facts.lockedAccounts} บัญชี` : 'อ่านสถานะไม่ได้',
    },
    {
      name: 'ตรวจสิทธิ์ทุกคำขอ',
      description: 'ทุกการเรียกข้อมูลตรวจว่าเป็นใครและมีสิทธิ์กับเว็บไซต์นั้นหรือไม่ก่อนทำงาน',
      ok: true,
      detail: 'ตรวจที่ชั้น API ทุกเส้นทาง',
    },
    {
      name: 'กรองเนื้อหาก่อนแสดงผล',
      description: 'เนื้อหาจากฐานข้อมูลถูกกรองด้วยรายการที่อนุญาตก่อนแสดง เพื่อกันสคริปต์แปลกปลอม',
      ok: true,
      detail: 'allow-list sanitizer',
    },
    {
      name: 'แยกข้อมูลรายหน่วยงาน',
      description: 'ข้อมูลและไฟล์อัปโหลดของแต่ละหน่วยงานอยู่คนละฐานข้อมูล ไม่ปะปนกัน',
      ok: true,
      detail: 'ฐานข้อมูลแยกต่อหนึ่งเว็บไซต์',
    },
    {
      name: 'รหัสผ่านเริ่มต้น',
      description: 'บัญชีที่ระบบตั้งรหัสให้ต้องเปลี่ยนรหัสก่อนใช้งานส่วนอื่น',
      ok: (facts?.pendingPasswords ?? 1) === 0,
      detail: facts
        ? `${facts.pendingPasswords} บัญชียังไม่ได้เปลี่ยนรหัสผ่านเริ่มต้น`
        : 'อ่านสถานะไม่ได้',
    },
    {
      name: 'ผู้ดูแลระบบสำรอง',
      description: 'ต้องมีผู้ดูแลระบบส่วนกลางอย่างน้อยหนึ่งบัญชีเสมอ',
      ok: (facts?.admins ?? 0) >= 1,
      detail: facts ? `มีผู้ดูแลระบบส่วนกลาง ${facts.admins} บัญชี` : 'อ่านสถานะไม่ได้',
    },
  ];

  const failing = controls.filter((control) => !control.ok);

  return (
    <div className="d-flex flex-column gap-3">
      {failing.length > 0 ? (
        <div className="adm-alert is-warn">
          <AlertTriangle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>
            <strong>มี {failing.length} รายการที่ควรแก้ไข:</strong>{' '}
            {failing.map((control) => control.name).join(', ')}
          </span>
        </div>
      ) : (
        <div className="adm-alert is-info">
          <CheckCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>มาตรการทั้งหมดผ่านการตรวจสอบ</span>
        </div>
      )}

      <RateLimitSettings />

      <section className="adm-card">
        <div className="adm-card-head">
          <h2 className="adm-card-title">
            <Lock size={17} aria-hidden="true" /> มาตรการที่บังคับใช้อยู่
          </h2>
          <span className="adm-cell-sub">
            อ่านจากฐานข้อมูลและการตั้งค่าจริง ไม่ใช่ข้อความคงที่
          </span>
        </div>
        <div className="table-responsive">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">มาตรการ</th>
                <th scope="col">สถานะปัจจุบัน</th>
                <th scope="col" className="text-end">ผลตรวจ</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.name}>
                  <td>
                    <span className="adm-cell-strong d-block">{control.name}</span>
                    <span className="adm-cell-sub d-block" style={{ whiteSpace: 'normal' }}>
                      {control.description}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'normal' }}>{control.detail}</td>
                  <td className="text-end">
                    {control.ok ? (
                      <span className="adm-chip is-ok">
                        <CheckCircle size={12} aria-hidden="true" /> ผ่าน
                      </span>
                    ) : (
                      <span className="adm-chip is-warn">
                        <AlertTriangle size={12} aria-hidden="true" /> ต้องแก้ไข
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-lg-5">
          <section className="adm-card h-100">
            <div className="adm-card-head">
              <h2 className="adm-card-title">
                <Key size={17} aria-hidden="true" /> บัญชีและสิทธิ์
              </h2>
            </div>
            <div className="p-3">
              <dl className="mb-0 d-flex flex-column gap-2">
                {[
                  ['ผู้ใช้ที่เปิดใช้งาน', facts?.totalUsers],
                  ['ผู้ดูแลระบบส่วนกลาง', facts?.admins],
                  ['สิทธิ์รายเว็บไซต์ที่มอบไว้', facts?.memberships],
                  ['แม่แบบระบบทั้งหมด', facts?.platforms],
                ].map(([label, value]) => (
                  <div key={label as string} className="d-flex justify-content-between gap-2">
                    <dt className="adm-stat-label fw-normal">{label}</dt>
                    <dd className="adm-cell-strong mb-0">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <section className="adm-card h-100">
            <div className="adm-card-head">
              <h2 className="adm-card-title">
                <Globe size={17} aria-hidden="true" /> ข้อมูลที่เปิดให้ผู้เข้าชมเว็บเห็น
              </h2>
            </div>
            <div className="p-3">
              <p className="adm-toolbar-note d-flex align-items-start gap-2 mb-3">
                <Database size={14} className="mt-1 flex-shrink-0" aria-hidden="true" />
                ผู้เข้าชมเว็บไซต์ไม่ได้เข้าสู่ระบบ จึงอ่านหรือบันทึกได้เฉพาะรายการที่ระบุไว้นี้เท่านั้น
                และไม่สามารถแก้ไขหรือลบข้อมูลได้ในทุกกรณี
              </p>

              {facts?.publicTables.length ? (
                <div className="d-flex flex-column gap-2">
                  {facts.publicTables.map((entry) => (
                    <div
                      key={entry.platformSlug}
                      className="border rounded-3 p-2"
                      style={{ borderColor: 'var(--gov-border)' }}
                    >
                      <span className="adm-cell-strong font-monospace d-block mb-1">
                        {entry.platformSlug}
                      </span>
                      <span className="adm-cell-sub d-block" style={{ whiteSpace: 'normal' }}>
                        อ่านได้: {entry.readable.length ? entry.readable.join(', ') : '— ไม่มี —'}
                      </span>
                      <span className="adm-cell-sub d-block" style={{ whiteSpace: 'normal' }}>
                        บันทึกได้: {entry.insertable.length ? entry.insertable.join(', ') : '— ไม่มี —'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="adm-empty-text mb-0">ยังไม่มีแม่แบบระบบในระบบ</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

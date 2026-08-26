'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { changePasswordAction } from '@/lib/auth/authActions';

interface ChangePasswordFormProps {
  readonly fullName: string;
  /** True while the account still has the password it was created with. */
  readonly required: boolean;
}

export default function ChangePasswordForm({ fullName, required }: ChangePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, {});

  return (
    <section className="card border-0 shadow-sm rounded-3">
      <div className="card-body p-4 p-sm-5">
        <h1 className="h5 fw-bold mb-1 d-flex align-items-center gap-2">
          <KeyRound size={20} className="text-primary" /> เปลี่ยนรหัสผ่าน
        </h1>
        <p className="text-secondary small mb-4">{fullName}</p>

        {required && !state?.success && (
          <div className="alert alert-warning border-0 rounded-3 small d-flex align-items-start gap-2">
            <ShieldAlert size={16} className="flex-shrink-0 mt-1" />
            <span>
              บัญชีนี้ยังใช้รหัสผ่านที่ระบบตั้งให้ตอนสร้าง
              ต้องเปลี่ยนก่อนจึงจะเข้าใช้งานส่วนอื่นได้
            </span>
          </div>
        )}

        {state?.error && (
          <div className="alert alert-danger border-0 rounded-3 small" role="alert">{state.error}</div>
        )}

        {state?.success ? (
          <>
            <div className="alert alert-success border-0 rounded-3 small d-flex align-items-center gap-2">
              <CheckCircle2 size={16} /> {state.success}
            </div>
            <Link href="/admin" className="btn btn-primary w-100">ไปยังหน้าผู้ดูแลระบบ</Link>
          </>
        ) : (
          <form action={formAction}>
            <div className="mb-3">
              <label htmlFor="currentPassword" className="form-label small fw-semibold">รหัสผ่านปัจจุบัน</label>
              <input id="currentPassword" name="currentPassword" type="password"
                     autoComplete="current-password" className="form-control" required />
            </div>

            <div className="mb-3">
              <label htmlFor="newPassword" className="form-label small fw-semibold">รหัสผ่านใหม่</label>
              <input id="newPassword" name="newPassword" type="password" minLength={8}
                     autoComplete="new-password" className="form-control" required />
              <div className="form-text">อย่างน้อย 8 ตัวอักษร</div>
            </div>

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="form-label small fw-semibold">ยืนยันรหัสผ่านใหม่</label>
              <input id="confirmPassword" name="confirmPassword" type="password" minLength={8}
                     autoComplete="new-password" className="form-control" required />
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={isPending}>
              {isPending ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

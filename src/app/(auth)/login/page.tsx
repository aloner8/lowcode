'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction } from '@/lib/auth/authActions';
import { Logo } from '@/components/brand/Logo';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';

/** Where the user will land, shown so a redirect never feels like a detour. */
const DESTINATIONS: Record<string, string> = {
  '/studio': 'DesignStudio',
  '/flow-studio': 'Flow Studio',
  '/admin': 'หน้าผู้ดูแลระบบ',
  '/admin/platforms': 'จัดการ Platform',
  '/admin/apps': 'จัดการเว็บไซต์',
  '/admin/users': 'จัดการผู้ใช้',
  '/audit-logs': 'ประวัติการเปลี่ยนแปลง',
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, {});
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to the error so it is announced and cannot be missed.
  useEffect(() => {
    if (state?.error) errorRef.current?.focus();
  }, [state?.error]);

  const destination = DESTINATIONS[redirect];

  return (
    <section className="auth-card card border-0">
      <div className="card-body p-4 p-sm-5">
        <header className="mb-4">
          <Logo size={40} className="d-lg-none mb-3" />
          <span className="auth-badge d-inline-flex align-items-center gap-1 mb-3">
            <ShieldCheck size={13} aria-hidden="true" /> เฉพาะเจ้าหน้าที่
          </span>
          <h1 className="auth-title h4 mb-1">เข้าสู่ระบบ</h1>
          <p className="auth-subtitle mb-0">
            {destination
              ? <>เข้าสู่ระบบเพื่อไปยัง <strong>{destination}</strong></>
              : 'สำหรับผู้ดูแลระบบและเจ้าหน้าที่ของหน่วยงาน'}
          </p>
        </header>

        {state?.error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="auth-alert d-flex align-items-start gap-2 mb-4"
          >
            <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} noValidate>
          <div className="mb-3">
            <label htmlFor="identifier" className="auth-label form-label">
              ชื่อผู้ใช้ หรือ อีเมล
            </label>
            <div className="auth-field">
              <User size={18} className="auth-field-icon" aria-hidden="true" />
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                required
                className="form-control"
                placeholder="you@example.go.th"
                aria-describedby={state?.error ? 'login-error-hint' : undefined}
              />
            </div>
          </div>

          <div className="mb-2">
            <label htmlFor="password" className="auth-label form-label">รหัสผ่าน</label>
            <div className="auth-field">
              <Lock size={18} className="auth-field-icon" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="form-control"
                placeholder="••••••••"
                onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') ?? false)}
                onBlur={() => setCapsLock(false)}
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Caps Lock is a common cause of "the password is right but it fails". */}
          <p className={`auth-caps ${capsLock ? 'is-on' : ''}`} aria-live="polite">
            {capsLock ? 'เปิด Caps Lock อยู่' : ''}
          </p>

          <button type="submit" className="auth-submit btn w-100" disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <>
                <Loader2 size={17} className="auth-spin" aria-hidden="true" /> กำลังตรวจสอบ…
              </>
            ) : (
              <>
                เข้าสู่ระบบ <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p id="login-error-hint" className="auth-help mb-0">
          ลืมรหัสผ่าน หรือเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
        </p>
      </div>
    </section>
  );
}

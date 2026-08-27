'use client';

import React, { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert, X } from 'lucide-react';
import { changePasswordAction } from '@/lib/auth/authActions';
import { Logo } from '@/components/brand/Logo';

interface ChangePasswordFormProps {
  readonly fullName: string;
  /** True while the account still has the password it was created with. */
  readonly required: boolean;
}

interface Rule {
  readonly label: string;
  readonly met: boolean;
}

/** Four cheap signals; enough to steer people away from obviously weak choices. */
function strengthOf(password: string): { score: number; label: string; tone: string } {
  if (!password) return { score: 0, label: '', tone: '' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: 'อ่อน', tone: 'weak' };
  if (score === 2) return { score: 2, label: 'พอใช้', tone: 'fair' };
  if (score === 3) return { score: 3, label: 'ดี', tone: 'good' };
  return { score: 4, label: 'แข็งแรง', tone: 'strong' };
}

export default function ChangePasswordForm({ fullName, required }: ChangePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, {});

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.error) errorRef.current?.focus();
  }, [state?.error]);

  const strength = useMemo(() => strengthOf(next), [next]);

  const rules: Rule[] = [
    { label: 'อย่างน้อย 8 ตัวอักษร', met: next.length >= 8 },
    { label: 'ไม่ซ้ำกับรหัสผ่านเดิม', met: next.length > 0 && next !== current },
    { label: 'ยืนยันรหัสผ่านตรงกัน', met: confirm.length > 0 && next === confirm },
  ];
  const ready = rules.every((rule) => rule.met) && current.length > 0;

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    autoComplete: string,
  ) => (
    <div className="mb-3">
      <label htmlFor={id} className="auth-label form-label">{label}</label>
      <div className="auth-field">
        <Lock size={18} className="auth-field-icon" aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={reveal ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          className="form-control"
          placeholder="••••••••"
        />
      </div>
    </div>
  );

  return (
    <section className="auth-card card border-0">
      <div className="card-body p-4 p-sm-5">
        <header className="mb-4">
          <Logo size={38} className="mb-3" />
          <h1 className="auth-title h4 mb-1 d-flex align-items-center gap-2">
            <KeyRound size={20} aria-hidden="true" /> เปลี่ยนรหัสผ่าน
          </h1>
          <p className="auth-subtitle mb-0">{fullName}</p>
        </header>

        {required && (
          <div className="auth-notice d-flex align-items-start gap-2 mb-4">
            <ShieldAlert size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <span>
              บัญชีนี้ยังใช้รหัสผ่านที่ระบบตั้งให้ตอนสร้าง
              ตั้งรหัสของคุณเองก่อนจึงจะเข้าใช้งานส่วนอื่นได้
            </span>
          </div>
        )}

        {state?.error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="auth-alert d-flex align-items-start gap-2 mb-4">
            <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} noValidate>
          {field('currentPassword', 'รหัสผ่านปัจจุบัน', current, setCurrent, 'current-password')}

          <hr className="auth-divider" />

          {field('newPassword', 'รหัสผ่านใหม่', next, setNext, 'new-password')}

          {next.length > 0 && (
            <div className="auth-strength mb-3" aria-live="polite">
              <div className={`auth-strength-track tone-${strength.tone}`}>
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={step <= strength.score ? 'is-on' : ''} />
                ))}
              </div>
              <span className={`auth-strength-label tone-${strength.tone}`}>
                ความแข็งแรง: {strength.label}
              </span>
            </div>
          )}

          {field('confirmPassword', 'ยืนยันรหัสผ่านใหม่', confirm, setConfirm, 'new-password')}

          <div className="form-check mb-3">
            <input
              id="revealPasswords"
              type="checkbox"
              className="form-check-input"
              checked={reveal}
              onChange={(event) => setReveal(event.target.checked)}
            />
            <label htmlFor="revealPasswords" className="form-check-label small d-inline-flex align-items-center gap-1">
              {reveal ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              แสดงรหัสผ่าน
            </label>
          </div>

          <ul className="auth-rules list-unstyled mb-4">
            {rules.map((rule) => (
              <li key={rule.label} className={rule.met ? 'is-met' : ''}>
                {rule.met
                  ? <Check size={14} aria-hidden="true" />
                  : <X size={14} aria-hidden="true" />}
                {rule.label}
              </li>
            ))}
          </ul>

          <button type="submit" className="auth-submit btn w-100" disabled={isPending || !ready} aria-busy={isPending}>
            {isPending
              ? <><Loader2 size={17} className="auth-spin" aria-hidden="true" /> กำลังบันทึก…</>
              : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>

        <p className="auth-help mb-0">
          หลังบันทึกสำเร็จ ระบบจะพาไปยังหน้าผู้ดูแลระบบโดยอัตโนมัติ
        </p>
      </div>
    </section>
  );
}

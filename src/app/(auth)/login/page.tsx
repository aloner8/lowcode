'use client';

import React, { useActionState } from 'react';
import { loginAction } from '@/lib/auth/authActions';
import { LogIn, Lock, User, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <div
      className="card border-0 shadow-lg"
      style={{
        background: 'rgba(255, 255, 255, 0.07)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.25rem',
        color: '#f8fafc',
      }}
    >
      <div className="card-body p-4 p-sm-5">
        {/* Header Logo & Title */}
        <div className="text-center mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center mb-3 shadow"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '1rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            }}
          >
            <Sparkles size={32} className="text-white" />
          </div>
          <h4 className="fw-bold mb-1 text-white">Low-Code Studio</h4>
          <p className="text-white-50 small mb-0">เข้าสู่ระบบแม่สำหรับแอดมินและนักพัฒนา (Platform Control)</p>
        </div>

        {/* Error Feedback */}
        {state?.error && (
          <div className="alert alert-danger border-0 bg-danger bg-opacity-25 text-danger-emphasis mb-4 small rounded-3" role="alert">
            {state.error}
          </div>
        )}

        {/* Form — submitted as a Server Action so credentials never touch client state */}
        <form action={formAction}>
          <div className="mb-3">
            <label htmlFor="identifier" className="form-label small text-white-50 fw-medium">
              ชื่อผู้ใช้ หรือ อีเมล
            </label>
            <div className="input-group">
              <span className="input-group-text bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white-50">
                <User size={18} />
              </span>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                className="form-control bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white placeholder-secondary"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label small text-white-50 fw-medium">
              รหัสผ่าน
            </label>
            <div className="input-group">
              <span className="input-group-text bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white-50">
                <Lock size={18} />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="form-control bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn w-100 py-2.5 fw-semibold shadow-sm text-white mb-2 d-flex align-items-center justify-content-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              border: 'none',
              borderRadius: '0.75rem',
            }}
          >
            {isPending ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            ) : (
              <>
                <LogIn size={18} /> เข้าสู่ระบบ (Sign In)
              </>
            )}
          </button>
        </form>

        <p className="text-white-50 extra-small text-center mb-0 mt-3">
          บัญชีผู้ใช้ถูกจัดเก็บและตรวจสอบที่ฐานข้อมูล — ติดต่อผู้ดูแลระบบหากลืมรหัสผ่าน
        </p>
      </div>
    </div>
  );
}

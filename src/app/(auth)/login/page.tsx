'use client';

import React, { useState, useTransition } from 'react';
import { loginAction } from '@/lib/auth/authActions';
import { LogIn, Lock, User, Sparkles, ShieldCheck, Code2 } from 'lucide-react';

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('identifier', identifier);
    formData.append('password', password);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  const fillQuickLogin = (user: 'admin' | 'aloner') => {
    if (user === 'admin') {
      setIdentifier('admin@platform.com');
      setPassword('1qaz@WSX');
    } else {
      setIdentifier('aloner');
      setPassword('1qaz@WSX');
    }
  };

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
        {errorMessage && (
          <div className="alert alert-danger border-0 bg-danger bg-opacity-25 text-danger-emphasis mb-4 small rounded-3" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small text-white-50 fw-medium">ชื่อผู้ใช้ หรือ อีเมล</label>
            <div className="input-group">
              <span className="input-group-text bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white-50">
                <User size={18} />
              </span>
              <input
                type="text"
                className="form-control bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white placeholder-secondary"
                placeholder="admin@platform.com หรือ aloner"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small text-white-50 fw-medium">รหัสผ่าน</label>
            <div className="input-group">
              <span className="input-group-text bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white-50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                className="form-control bg-dark bg-opacity-50 border-secondary border-opacity-25 text-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn w-100 py-2.5 fw-semibold shadow-sm text-white mb-4 d-flex align-items-center justify-content-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              border: 'none',
              borderRadius: '0.75rem',
            }}
          >
            {isPending ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <>
                <LogIn size={18} /> เข้าสู่ระบบ (Sign In)
              </>
            )}
          </button>
        </form>

        <hr className="border-secondary border-opacity-25 my-4" />

        {/* Quick Credentials Test Panel */}
        <div className="text-center">
          <p className="text-white-50 extra-small mb-2 fw-medium">บัญชีทดสอบด่วน (Quick Test Accounts):</p>
          <div className="d-flex gap-2">
            <button
              type="button"
              onClick={() => fillQuickLogin('admin')}
              className="btn btn-outline-light btn-sm w-50 py-1.5 small bg-white bg-opacity-10 border-white border-opacity-25 text-white d-flex align-items-center justify-content-center gap-1.5"
            >
              <ShieldCheck size={14} className="text-danger" /> Admin User
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('aloner')}
              className="btn btn-outline-light btn-sm w-50 py-1.5 small bg-white bg-opacity-10 border-white border-opacity-25 text-white d-flex align-items-center justify-content-center gap-1.5"
            >
              <Code2 size={14} className="text-info" /> Dev: aloner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw, Save, Unlock, AlertTriangle } from 'lucide-react';

interface Policy {
  policyKey: string;
  label: string;
  description: string | null;
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
  isEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
}

interface Lockout {
  policyKey: string;
  identity: string;
  attempts: number;
  lockedUntil: string;
}

/** Human-readable duration, since policies are stored in seconds. */
const duration = (seconds: number) => {
  if (seconds === 0) return 'ไม่ล็อก';
  if (seconds < 60) return `${seconds} วินาที`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} นาที`;
  return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)} ชั่วโมง`;
};

/**
 * Rate-limit configuration, editable by the service provider (GOD).
 *
 * Limits are stored in the database and read on every check, so a change here
 * takes effect immediately without a deploy.
 */
export default function RateLimitSettings() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<Policy>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/rate-limits', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถอ่านนโยบายได้');
      setPolicies(payload.policies as Policy[]);
      setLockouts(payload.lockouts as Lockout[]);
      setDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านนโยบายได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const valueOf = (policy: Policy, field: keyof Policy) =>
    (draft[policy.policyKey]?.[field] ?? policy[field]) as never;

  const edit = (policyKey: string, field: keyof Policy, value: number | boolean) =>
    setDraft((previous) => ({ ...previous, [policyKey]: { ...previous[policyKey], [field]: value } }));

  const save = async (policy: Policy) => {
    setBusy(policy.policyKey);
    setError('');
    setSaved('');
    try {
      const response = await fetch('/api/rate-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyKey: policy.policyKey, ...draft[policy.policyKey] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึกไม่สำเร็จ');
      setSaved(policy.policyKey);
      await load();
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  };

  const release = async (lockout: Lockout) => {
    setBusy(lockout.identity);
    try {
      const response = await fetch(
        `/api/rate-limits?policyKey=${encodeURIComponent(lockout.policyKey)}&identity=${encodeURIComponent(lockout.identity)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ปลดล็อกไม่สำเร็จ');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ปลดล็อกไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="card border-0 shadow-sm rounded-3 bg-white mb-4">
      <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h6 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
            <Gauge size={18} className="text-primary" /> จำกัดอัตราการเรียกใช้งาน (Rate Limit)
          </h2>
          <p className="text-secondary extra-small mb-0 mt-1">
            ค่าเหล่านี้เก็บในฐานข้อมูลและมีผลทันที ไม่ต้อง deploy ใหม่
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary"
                onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="card-body p-0">
        {error && <div className="alert alert-danger border-0 rounded-0 mb-0 small">{error}</div>}

        {loading && policies.length === 0 ? (
          <p className="text-muted small text-center py-4 mb-0">กำลังโหลด…</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="small ps-4">นโยบาย</th>
                  <th className="small text-center" style={{ width: 110 }}>ครั้งสูงสุด</th>
                  <th className="small text-center" style={{ width: 130 }}>ช่วงนับ (วินาที)</th>
                  <th className="small text-center" style={{ width: 130 }}>ล็อก (วินาที)</th>
                  <th className="small text-center" style={{ width: 90 }}>เปิดใช้</th>
                  <th className="small text-end pe-4" style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const dirty = Boolean(draft[policy.policyKey]);
                  return (
                    <tr key={policy.policyKey}>
                      <td className="ps-4">
                        <div className="fw-semibold small text-dark">{policy.label}</div>
                        <div className="extra-small text-secondary">{policy.description}</div>
                        <code className="extra-small text-secondary">{policy.policyKey}</code>
                      </td>
                      <td className="text-center">
                        <input type="number" min={1} max={10000} className="form-control form-control-sm text-center"
                               value={valueOf(policy, 'maxAttempts')}
                               onChange={(event) => edit(policy.policyKey, 'maxAttempts', Number(event.target.value))}
                               aria-label={`จำนวนครั้งสูงสุดของ ${policy.label}`} />
                      </td>
                      <td className="text-center">
                        <input type="number" min={10} max={86400} className="form-control form-control-sm text-center"
                               value={valueOf(policy, 'windowSeconds')}
                               onChange={(event) => edit(policy.policyKey, 'windowSeconds', Number(event.target.value))}
                               aria-label={`ช่วงเวลานับของ ${policy.label}`} />
                        <span className="extra-small text-secondary">{duration(valueOf(policy, 'windowSeconds'))}</span>
                      </td>
                      <td className="text-center">
                        <input type="number" min={0} max={86400} className="form-control form-control-sm text-center"
                               value={valueOf(policy, 'lockoutSeconds')}
                               onChange={(event) => edit(policy.policyKey, 'lockoutSeconds', Number(event.target.value))}
                               aria-label={`ระยะเวลาล็อกของ ${policy.label}`} />
                        <span className="extra-small text-secondary">{duration(valueOf(policy, 'lockoutSeconds'))}</span>
                      </td>
                      <td className="text-center">
                        <div className="form-check form-switch d-inline-block">
                          <input type="checkbox" className="form-check-input"
                                 checked={valueOf(policy, 'isEnabled')}
                                 onChange={(event) => edit(policy.policyKey, 'isEnabled', event.target.checked)}
                                 aria-label={`เปิดใช้ ${policy.label}`} />
                        </div>
                      </td>
                      <td className="text-end pe-4">
                        <button type="button"
                                className={`btn btn-sm ${saved === policy.policyKey ? 'btn-success' : 'btn-primary'}`}
                                disabled={!dirty || busy === policy.policyKey}
                                onClick={() => void save(policy)}>
                          <Save size={14} className="me-1" />
                          {saved === policy.policyKey ? 'บันทึกแล้ว' : 'บันทึก'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-top p-4">
          <h3 className="h6 fw-bold mb-2 d-flex align-items-center gap-2">
            <AlertTriangle size={16} className="text-warning" /> ที่กำลังถูกล็อกอยู่ ({lockouts.length})
          </h3>
          {lockouts.length === 0 ? (
            <p className="text-muted small mb-0">ไม่มีรายการที่ถูกล็อกในขณะนี้</p>
          ) : (
            <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
              {lockouts.map((lockout) => (
                <li key={`${lockout.policyKey}:${lockout.identity}`}
                    className="d-flex justify-content-between align-items-center border rounded-3 px-3 py-2">
                  <span className="small">
                    <code className="text-dark">{lockout.identity}</code>
                    <span className="text-secondary ms-2">
                      {lockout.policyKey} · {lockout.attempts} ครั้ง · ถึง{' '}
                      {new Date(lockout.lockedUntil).toLocaleString('th-TH')}
                    </span>
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                          disabled={busy === lockout.identity}
                          onClick={() => void release(lockout)}>
                    <Unlock size={14} className="me-1" /> ปลดล็อก
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

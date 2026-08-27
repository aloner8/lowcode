'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw, Unlock, AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react';

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
    <section className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Gauge size={17} aria-hidden="true" /> จำกัดจำนวนครั้งที่เรียกใช้งาน
          </h2>
          <p className="adm-page-sub mt-1 mb-0">
            ป้องกันการเดารหัสผ่านและการยิงคำขอถี่ผิดปกติ — ค่าที่ตั้งมีผลทันที ไม่ต้องติดตั้งใหม่
          </p>
        </div>
        <button
          type="button"
          className="adm-btn is-quiet is-sm"
          onClick={() => void load()}
          disabled={loading}
          aria-label="โหลดค่าล่าสุด"
        >
          <RefreshCw size={14} className={loading ? 'adm-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="p-3 pb-0">
          <div className="adm-alert is-danger" role="alert">
            <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && policies.length === 0 ? (
        <div className="adm-empty">
          <RefreshCw size={22} className="adm-spin mb-2" aria-hidden="true" />
          <p className="adm-empty-text">กำลังโหลด…</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">รายการ</th>
                <th scope="col" className="text-center" style={{ width: 120 }}>ครั้งสูงสุด</th>
                <th scope="col" className="text-center" style={{ width: 150 }}>ภายในเวลา</th>
                <th scope="col" className="text-center" style={{ width: 150 }}>ล็อกนาน</th>
                <th scope="col" className="text-center" style={{ width: 90 }}>เปิดใช้</th>
                <th scope="col" className="text-end" style={{ width: 120 }}>
                  <span className="visually-hidden">บันทึก</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => {
                const dirty = Boolean(draft[policy.policyKey]);
                return (
                  <tr key={policy.policyKey}>
                    <td>
                      <span className="adm-cell-strong d-block">{policy.label}</span>
                      <span className="adm-cell-sub d-block" style={{ whiteSpace: 'normal' }}>
                        {policy.description}
                      </span>
                    </td>
                    <td className="text-center">
                      <input
                        type="number" min={1} max={10000}
                        className="adm-input text-center"
                        value={valueOf(policy, 'maxAttempts')}
                        onChange={(event) => edit(policy.policyKey, 'maxAttempts', Number(event.target.value))}
                        aria-label={`จำนวนครั้งสูงสุดของ ${policy.label}`}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="number" min={10} max={86400}
                        className="adm-input text-center"
                        value={valueOf(policy, 'windowSeconds')}
                        onChange={(event) => edit(policy.policyKey, 'windowSeconds', Number(event.target.value))}
                        aria-label={`ช่วงเวลานับของ ${policy.label} เป็นวินาที`}
                      />
                      <span className="adm-cell-sub d-block mt-1">{duration(valueOf(policy, 'windowSeconds'))}</span>
                    </td>
                    <td className="text-center">
                      <input
                        type="number" min={0} max={86400}
                        className="adm-input text-center"
                        value={valueOf(policy, 'lockoutSeconds')}
                        onChange={(event) => edit(policy.policyKey, 'lockoutSeconds', Number(event.target.value))}
                        aria-label={`ระยะเวลาล็อกของ ${policy.label} เป็นวินาที`}
                      />
                      <span className="adm-cell-sub d-block mt-1">{duration(valueOf(policy, 'lockoutSeconds'))}</span>
                    </td>
                    <td className="text-center">
                      <div className="form-check form-switch d-inline-block">
                        <input
                          type="checkbox" className="form-check-input"
                          checked={valueOf(policy, 'isEnabled')}
                          onChange={(event) => edit(policy.policyKey, 'isEnabled', event.target.checked)}
                          aria-label={`เปิดใช้ ${policy.label}`}
                        />
                      </div>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className={`adm-btn is-sm ${saved === policy.policyKey ? 'is-quiet' : ''}`}
                        disabled={!dirty || busy === policy.policyKey}
                        onClick={() => void save(policy)}
                      >
                        {saved === policy.policyKey ? (
                          <><ShieldCheck size={14} aria-hidden="true" /> บันทึกแล้ว</>
                        ) : (
                          'บันทึก'
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-top p-3">
        <h3 className="adm-card-title mb-2">
          <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--gov-warn)' }} />
          ที่กำลังถูกล็อกอยู่ ({lockouts.length})
        </h3>
        {lockouts.length === 0 ? (
          <p className="adm-empty-text mb-0">ไม่มีรายการที่ถูกล็อกในขณะนี้</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
            {lockouts.map((lockout) => (
              <li
                key={`${lockout.policyKey}:${lockout.identity}`}
                className="d-flex flex-wrap justify-content-between align-items-center gap-2 border rounded-3 px-3 py-2"
                style={{ borderColor: 'var(--gov-border)' }}
              >
                <span>
                  <span className="adm-cell-strong font-monospace d-block">{lockout.identity}</span>
                  <span className="adm-cell-sub">
                    {lockout.policyKey} · พยายาม {lockout.attempts} ครั้ง · ปลดล็อกอัตโนมัติ{' '}
                    {new Date(lockout.lockedUntil).toLocaleString('th-TH')}
                  </span>
                </span>
                <button
                  type="button"
                  className="adm-btn is-quiet is-sm"
                  disabled={busy === lockout.identity}
                  onClick={() => void release(lockout)}
                >
                  <Unlock size={14} aria-hidden="true" /> ปลดล็อกทันที
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

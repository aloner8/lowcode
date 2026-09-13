'use client';

import { useEffect, useState } from 'react';
import type { AppRuntimeState } from '@/lib/runtime/appRuntimeState';

const tone = (state: AppRuntimeState['observedState']) =>
  state === 'RUNNING' ? 'is-ok' : state === 'FAILED' ? 'is-danger' : state === 'STARTING' || state === 'STOPPING' ? 'is-warn' : 'is-off';

export default function AppRuntimeControl({
  appId,
  initial,
}: {
  appId: string;
  initial: Pick<AppRuntimeState, 'desiredState' | 'observedState' | 'error' | 'healthCheckedAt' | 'metrics' | 'metricsAt'>;
}) {
  const [runtime, setRuntime] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shouldPoll = ['STARTING', 'STOPPING'].includes(runtime.observedState) || runtime.observedState === 'RUNNING';
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      fetch(`/api/apps/${appId}/runtime-state`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('อ่านสถานะไม่ได้')))
        .then((payload) => { if (payload.runtime) setRuntime(payload.runtime); })
        .catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [appId, runtime.observedState]);

  const changeState = async (desiredState: 'RUNNING' | 'STOPPED') => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/runtime-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ desiredState }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'สั่งงาน Runtime ไม่สำเร็จ');
      if (payload.runtime) setRuntime(payload.runtime);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สั่งงาน Runtime ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const memory = runtime.metrics?.memoryRssBytes;
  return (
    <div className="d-flex flex-column align-items-end gap-1">
      <span className={`adm-chip ${tone(runtime.observedState)}`}>{runtime.observedState}</span>
      <span className="adm-cell-sub">
        {runtime.metrics && runtime.metricsAt
          ? `${memory === undefined ? 'Memory unavailable' : `${(memory / 1024 / 1024).toFixed(1)} MB`} · uptime ${runtime.metrics.uptimeSeconds ?? 'unavailable'}s`
          : 'Metrics unavailable'}
      </span>
      {runtime.healthCheckedAt && <span className="adm-cell-sub">Health: {new Date(runtime.healthCheckedAt).toLocaleString('th-TH')}</span>}
      {runtime.error && <span className="text-danger small">{runtime.error}</span>}
      {error && <span className="text-danger small" role="alert">{error}</span>}
      <button
        type="button"
        className={`btn btn-sm ${runtime.desiredState === 'RUNNING' ? 'btn-outline-danger' : 'btn-outline-success'}`}
        disabled={busy || runtime.observedState === 'PROVISIONING' || runtime.observedState === 'UNPROVISIONED'}
        onClick={() => void changeState(runtime.desiredState === 'RUNNING' ? 'STOPPED' : 'RUNNING')}
      >
        {busy ? 'กำลังส่งคำสั่ง…' : runtime.desiredState === 'RUNNING' ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}

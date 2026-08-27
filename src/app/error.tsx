'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Home } from 'lucide-react';

/**
 * Route error boundary.
 *
 * The most common failure here is not a bug but a stale tab: after a redeploy
 * the page holds chunk URLs that no longer exist, and Next reports it as
 * "An unexpected response was received from the server". `reset()` cannot fix
 * that — only a full reload can — so those errors are detected and the page
 * reloads itself once, guarded by sessionStorage so a genuine loop cannot form.
 */

const STALE_BUILD_PATTERNS = [
  /unexpected response was received/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /Failed to fetch dynamically imported module/i,
  /Server Action .* was not found/i,
  /importScripts|Loading CSS chunk/i,
];

const RELOAD_GUARD = 'matchanu:reloaded-for-stale-build';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [staleBuild, setStaleBuild] = useState(false);

  useEffect(() => {
    console.error('Route error', error);

    const message = `${error.message ?? ''} ${error.name ?? ''}`;
    const isStale = STALE_BUILD_PATTERNS.some((pattern) => pattern.test(message));
    setStaleBuild(isStale);
    if (!isStale) return;

    // Reload once. If the reloaded page fails the same way it is a real fault,
    // so fall through to the message instead of reloading again.
    let alreadyReloaded = false;
    try {
      alreadyReloaded = window.sessionStorage.getItem(RELOAD_GUARD) === '1';
      window.sessionStorage.setItem(RELOAD_GUARD, '1');
    } catch {
      // Private browsing can refuse storage; skip the auto-reload rather than fail.
      return;
    }
    if (!alreadyReloaded) window.location.reload();
  }, [error]);

  useEffect(() => {
    // Clear the guard once a render succeeds long enough to matter.
    const timer = window.setTimeout(() => {
      try { window.sessionStorage.removeItem(RELOAD_GUARD); } catch { /* ignore */ }
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="auth-shell min-vh-100 d-flex align-items-center justify-content-center p-3">
      <section className="auth-card card border-0" style={{ maxWidth: '34rem' }}>
        <div className="card-body p-4 p-sm-5">
          <span className="auth-badge d-inline-flex align-items-center gap-1 mb-3">
            <AlertTriangle size={13} aria-hidden="true" /> เกิดข้อผิดพลาด
          </span>

          {staleBuild ? (
            <>
              <h1 className="auth-title h5 mb-2">หน้านี้เป็นเวอร์ชันเก่า</h1>
              <p className="auth-subtitle mb-4">
                ระบบมีการอัปเดตหลังจากที่คุณเปิดหน้านี้ไว้ กำลังโหลดเวอร์ชันล่าสุดให้อัตโนมัติ…
                หากไม่เปลี่ยนแปลง ให้ปิดแท็บนี้แล้วเปิดใหม่
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-title h5 mb-2">แสดงหน้านี้ไม่ได้</h1>
              <p className="auth-subtitle mb-4">
                ข้อมูลของคุณไม่ได้รับผลกระทบ ลองใหม่อีกครั้ง
                หากยังไม่ได้ กรุณาแจ้งผู้ดูแลระบบพร้อมรหัสอ้างอิงด้านล่าง
              </p>
            </>
          )}

          <pre className="auth-error-detail small mb-4">
            {error.message || 'Unknown error'}
            {error.digest ? `\nรหัสอ้างอิง: ${error.digest}` : ''}
          </pre>

          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="auth-submit btn flex-grow-1" onClick={() => window.location.reload()}>
              <RefreshCw size={16} aria-hidden="true" /> โหลดหน้าใหม่
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={reset}>
              <RotateCcw size={16} className="me-1" aria-hidden="true" /> ลองอีกครั้ง
            </button>
            <a className="btn btn-outline-secondary" href="/admin">
              <Home size={16} className="me-1" aria-hidden="true" /> หน้าหลัก
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

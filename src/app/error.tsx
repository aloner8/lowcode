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

/**
 * Reload past the browser cache.
 *
 * `location.reload()` refetches the document but Safari in particular keeps
 * serving the previously parsed JavaScript, which is exactly what is stale
 * here. Clearing the Cache Storage entries and navigating to a fresh URL makes
 * the browser resolve every subresource again.
 */
async function hardReload() {
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache Storage is unavailable in some contexts; the navigation below is
    // still worth attempting.
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString(36));
  window.location.replace(url.toString());
}

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
    if (!alreadyReloaded) void hardReload();
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
              <p className="auth-subtitle mb-3">
                ระบบมีการอัปเดตหลังจากที่คุณเปิดหน้านี้ไว้ กำลังโหลดเวอร์ชันล่าสุดให้อัตโนมัติ…
              </p>
              <p className="auth-subtitle mb-4">
                ถ้ายังเห็นข้อความนี้อยู่ แปลว่าเบราว์เซอร์ยังใช้ไฟล์เดิมที่เก็บไว้
                ให้ทำอย่างใดอย่างหนึ่ง:
              </p>
              <ol className="auth-steps mb-4">
                <li><strong>ปิดแท็บนี้ทิ้ง</strong> แล้วเปิดที่อยู่เดิมใหม่อีกครั้ง</li>
                <li>หรือกด <strong>โหลดใหม่แบบล้างแคช</strong> ด้านล่าง</li>
                <li>หรือเปิดในหน้าต่าง <strong>ส่วนตัว / Private</strong> เพื่อยืนยันว่าเป็นแคชจริง</li>
              </ol>
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
            <button type="button" className="auth-submit btn flex-grow-1" onClick={() => void hardReload()}>
              <RefreshCw size={16} aria-hidden="true" /> โหลดใหม่แบบล้างแคช
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

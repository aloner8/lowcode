'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const isStaleBuild = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(`${error.name} ${error.message}`);
    if (!isStaleBuild) return;
    const recoveryKey = 'lowcode-stale-build-recovery';
    if (sessionStorage.getItem(recoveryKey) === '1') { sessionStorage.removeItem(recoveryKey); return; }
    sessionStorage.setItem(recoveryKey, '1');
    window.location.reload();
  }, [error]);

  return <html><body><main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Anuphan, "Noto Sans Thai", system-ui, sans-serif', background: '#f8fafc' }}>
    <section style={{ width: 'min(680px, 100%)', padding: 28, border: '1px solid #fecaca', borderRadius: 16, background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.08)' }}>
      <div style={{ color: '#dc2626', fontWeight: 800, marginBottom: 8 }}>STUDIO RECOVERY</div>
      <h1 style={{ fontSize: 24, margin: '0 0 10px' }}>Studio encountered a client error</h1>
      <p style={{ color: '#64748b' }}>The page is still safe. Retry the current screen; if a deployment replaced its JavaScript files, reload the latest build.</p>
      <pre style={{ whiteSpace: 'pre-wrap', padding: 12, borderRadius: 8, background: '#f1f5f9', color: '#334155', fontSize: 12 }}>{error.message || 'Unknown client error'}{error.digest ? `\nDigest: ${error.digest}` : ''}</pre>
      <div style={{ display: 'flex', gap: 8 }}><button onClick={reset} style={{ border: 0, borderRadius: 8, padding: '9px 15px', background: '#2563eb', color: '#fff', fontWeight: 700 }}>Retry</button><button onClick={() => window.location.reload()} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 15px', background: '#fff', fontWeight: 700 }}>Reload latest build</button></div>
    </section>
  </main></body></html>;
}

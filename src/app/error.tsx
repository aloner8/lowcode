'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Studio route error', error); }, [error]);
  return <div className="h-100 d-flex align-items-center justify-content-center bg-light p-4"><div className="card border-danger shadow-sm" style={{ maxWidth: 680 }}><div className="card-body p-4"><div className="text-danger fw-bold mb-2">STUDIO ERROR</div><h4>This workspace could not be rendered</h4><p className="text-secondary">Your database data was not removed. Retry this view or reload the latest deployed build.</p><pre className="bg-light border rounded p-2 small text-wrap">{error.message || 'Unknown error'}{error.digest ? `\nDigest: ${error.digest}` : ''}</pre><div className="d-flex gap-2"><button className="btn btn-primary" onClick={reset}>Retry view</button><button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>Reload build</button></div></div></div></div>;
}

'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createModules, type Modules } from './client.js';
import { FileManagerPopupComponent, type FileManagerAsset } from './FileManagerPopupComponent.js';
import { useStorageScope } from './StorageScopeContext.js';
import { createFilePicker, type FilePicker, type FilePickOptions } from './fileSelection.js';
export type { FilePicker, FilePickOptions } from './fileSelection.js';
export * from './FileManagerPopupComponent.js';
export * from './FileManagerComponent.js';
export * from './StorageScopeContext.js';

export type ReactModules = Modules & { files: FilePicker };
const ModulesContext = createContext<ReactModules | null>(null);
export function ShareModuleProvider({ baseUrl, children }: { baseUrl?: string; children: React.ReactNode }) {
  const scope = useStorageScope();
  const [selection, setSelection] = useState<FilePickOptions | null>(null);
  const [path, setPath] = useState('/uploads');
  const picker = useMemo(() => createFilePicker(options => { setSelection(options); if (options) setPath(options.currentPath ?? '/uploads'); }), []);
  const modules = useMemo(() => ({ ...createModules({ baseUrl, platformId: scope.platformId }), files: picker.api }), [baseUrl, scope.platformId, picker]);
  useEffect(() => () => picker.cancel(), [picker]);
  return <ModulesContext.Provider value={modules}>{children}
    {selection && <FileManagerPopupComponent open currentPath={path} onCurrentPathChange={setPath}
      mode={selection.mode ?? 'compact'} accept={selection.accept} selectionMode={selection.multiple ? 'multiple' : 'single'}
      onUse={picker.finish} onClose={picker.cancel} />}
  </ModulesContext.Provider>;
}
export function useModules(): ReactModules {
  const modules = useContext(ModulesContext);
  const scope = useStorageScope();
  const defaults = useMemo(() => ({ ...createModules({ platformId: scope.platformId }), files: {
    pick: () => Promise.reject(new Error('The app shell must include ShareModuleProvider to open a file picker')),
  } }), [scope.platformId]);
  return modules ?? defaults;
}

type PickerProps = {
  currentPath?: string;
  mode?: 'compact' | 'full';
  accept?: string;
  label?: string;
} & ({ multiple: true; onSelect?: (files: FileManagerAsset[]) => void } | { multiple?: false; onSelect?: (file: FileManagerAsset | null) => void });

/** A working picker with one path property, also usable without an event handler in Studio. */
export function FileManager(props: PickerProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(props.currentPath ?? '/uploads');
  const [selection, setSelection] = useState<FileManagerAsset[]>([]);
  const finish = (files: FileManagerAsset[]) => {
    setSelection(files); setOpen(false);
    if (props.multiple) props.onSelect?.(files); else props.onSelect?.(files[0] ?? null);
  };
  return <div className="sharemodule-files">
    <button type="button" className="btn btn-outline-primary" onClick={() => { setPath(props.currentPath ?? '/uploads'); setOpen(true); }}>{props.label ?? 'เลือกไฟล์'}</button>
    {selection.length > 0 && <ul aria-label="ไฟล์ที่เลือก">{selection.map(file => <li key={file.id}>{file.name}</li>)}</ul>}
    <FileManagerPopupComponent open={open} currentPath={path} onCurrentPathChange={setPath}
      mode={props.mode ?? 'compact'} selectionMode={props.multiple ? 'multiple' : 'single'} accept={props.accept}
      onUse={finish} onClose={() => { setOpen(false); if (props.multiple) props.onSelect?.([]); else props.onSelect?.(null); }} />
  </div>;
}

export function Login({ afterLogin = '/', providers = ['local'], runtimeSlug, onSuccess }: { afterLogin?: string; providers?: Array<'local' | 'google' | 'line' | 'facebook' | 'ldap' | 'ad-ds' | 'entra'>; runtimeSlug?: string; onSuccess?: () => void }) {
  const modules = useModules();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="sharemodule-login">{providers.includes('local') && <form onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      await modules.auth.login({ email: String(form.get('email')), password: String(form.get('password')) });
      if (onSuccess) onSuccess();
      else { const target = new URL(afterLogin, window.location.origin); if (target.origin !== window.location.origin) throw new Error('Login destination must be within this app'); window.location.assign(target.href); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { setBusy(false); }
  }}>
    <label className="d-block">อีเมล<input className="form-control" name="email" type="email" autoComplete="username" required /></label>
    <label className="d-block mt-2">รหัสผ่าน<input className="form-control" name="password" type="password" autoComplete="current-password" required /></label>
    <button className="btn btn-primary mt-3" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
  </form>}
    {providers.some(provider => provider === 'ldap' || provider === 'ad-ds') && <form className="mt-3" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const form = new FormData(event.currentTarget); setBusy(true); setError('');
      try {
        await modules.auth.directoryLogin({ provider: String(form.get('provider')) === 'ad-ds' ? 'ad-ds' : 'ldap', username: String(form.get('username')), password: String(form.get('password')) });
        if (onSuccess) onSuccess(); else window.location.assign(new URL(afterLogin, window.location.origin).href);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบไม่สำเร็จ'); } finally { setBusy(false); }
    }}>
      <label className="d-block">Directory<select className="form-select" name="provider">{providers.filter(provider => provider === 'ldap' || provider === 'ad-ds').map(provider => <option value={provider} key={provider}>{provider}</option>)}</select></label>
      <label className="d-block mt-2">Username<input className="form-control" name="username" autoComplete="username" required/></label>
      <label className="d-block mt-2">Password<input className="form-control" name="password" type="password" autoComplete="current-password" required/></label>
      <button className="btn btn-primary mt-3" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'Directory sign in'}</button>
    </form>}
    {providers.filter((provider): provider is 'google' | 'line' | 'facebook' | 'entra' => ['google', 'line', 'facebook', 'entra'].includes(provider)).map(provider => <button key={provider} type="button" className="btn btn-outline-secondary mt-2 w-100 text-capitalize" disabled={!runtimeSlug} onClick={() => { if (runtimeSlug) window.location.assign(modules.auth.externalLoginUrl(provider, runtimeSlug)); }}>Continue with {provider}</button>)}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!providers.includes('local') && providers.length === 0 && <p role="alert">No login provider is enabled.</p>}
  </div>;
}

export function QRCode({ value, size = 256, alt = 'QR code' }: { value: string; size?: number; alt?: string }) {
  const modules = useModules();
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void modules.media.qrCode({ value, size, format: 'svg' }).then((result) => { if (active) { setDataUrl(result.dataUrl); setError(''); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to generate QR code'); }); return () => { active = false; }; }, [modules, size, value]);
  // Data URLs returned by the tenant-scoped media service are not compatible with next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return error ? <p role="alert">{error}</p> : dataUrl ? <img src={dataUrl} width={size} height={size} alt={alt}/> : <span aria-busy="true">Generating QR…</span>;
}

export function GoogleMap({ center, zoom = 14, title = 'Google Map' }: { center: { lat: number; lng: number }; zoom?: number; title?: string }) {
  const modules = useModules();
  const { lat, lng } = center;
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void modules.google.maps.embedUrl({ lat, lng, zoom }).then((result) => { if (active) { setUrl(result.url); setError(''); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load map'); }); return () => { active = false; }; }, [lat, lng, modules, zoom]);
  return error ? <p role="alert">{error}</p> : url ? <iframe title={title} src={url} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ border: 0, width: '100%', minHeight: 320 }}/> : <span aria-busy="true">Loading map…</span>;
}

export function GoogleCalendar({ calendarId, timeMin, timeMax }: { calendarId: string; timeMin?: string; timeMax?: string }) {
  const modules = useModules();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void modules.google.calendar.list({ calendarId, timeMin, timeMax }).then((result) => { if (active) setEvents(result.events as Array<Record<string, unknown>>); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load calendar'); }); return () => { active = false; }; }, [calendarId, modules, timeMax, timeMin]);
  if (error) return <p role="alert">{error}</p>;
  return <ul aria-label="Google Calendar events">{events.map((event, index) => <li key={String(event.id || index)}>{String(event.summary || event.id || 'Untitled event')}</li>)}</ul>;
}

export function GoogleForm({ formId, title = 'Google Form' }: { formId: string; title?: string }) {
  const modules = useModules();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void modules.google.forms.get(formId).then((result) => { const form = result.form as Record<string, unknown>; if (active) setUrl(String(form.responderUri || '')); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load form'); }); return () => { active = false; }; }, [formId, modules]);
  return error ? <p role="alert">{error}</p> : url ? <iframe title={title} src={url} style={{ border: 0, width: '100%', minHeight: 640 }}/> : <span aria-busy="true">Loading form…</span>;
}

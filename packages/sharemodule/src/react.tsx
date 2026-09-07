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

export function Login({ afterLogin = '/', onSuccess }: { afterLogin?: string; onSuccess?: () => void }) {
  const modules = useModules();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form onSubmit={async event => {
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
    {error && <p role="alert" className="text-danger">{error}</p>}
    <button className="btn btn-primary mt-3" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
  </form>;
}

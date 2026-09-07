import type { FileManagerAsset } from './FileManagerPopupComponent.js';

export interface FilePickOptions { currentPath?: string; multiple?: boolean; mode?: 'compact' | 'full'; accept?: string }
export interface FilePicker {
  pick(options: FilePickOptions & { multiple: true }): Promise<FileManagerAsset[]>;
  pick(options?: FilePickOptions & { multiple?: false }): Promise<FileManagerAsset | null>;
}

/** Keeps cancellation and unmount from leaving callers waiting forever. */
export function createFilePicker(show: (options: FilePickOptions | null) => void) {
  let pending: { options: FilePickOptions; resolve: (value: FileManagerAsset[] | FileManagerAsset | null) => void } | undefined;
  const finish = (files: FileManagerAsset[]) => {
    const current = pending; pending = undefined;
    if (current) current.resolve(current.options.multiple ? files : files[0] ?? null);
    show(null);
  };
  const pick = (options: FilePickOptions = {}) => {
    if (pending) return Promise.reject(new Error('A file picker is already open'));
    return new Promise<FileManagerAsset[] | FileManagerAsset | null>(resolve => { pending = { options, resolve }; show(options); });
  };
  return { api: { pick } as FilePicker, finish, cancel: () => finish([]) };
}

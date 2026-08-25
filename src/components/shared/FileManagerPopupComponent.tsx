'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, FileArchive, FileCode2, FileSpreadsheet, FileText,
  FileType2, Folder, FolderOpen, Image as ImageIcon, Loader2, Music, Pencil,
  Plus, RefreshCw, Trash2, Upload, Video, X,
} from 'lucide-react';

export interface FileManagerDirectory {
  id: string;
  name: string;
  path: string;
  parentPath?: string | null;
  children?: FileManagerDirectory[];
}

export interface FileManagerAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
  thumbnailUrl?: string;
}

export interface FileManagerLoadResult {
  rootPath?: string;
  currentPath?: string;
  directories?: FileManagerDirectory[];
  files?: FileManagerAsset[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface FileManagerPopupProps {
  open: boolean;
  title?: string;
  rootPath?: string;
  currentPath?: string;
  selectionMode?: 'single' | 'multiple';
  accept?: string;
  pageSize?: number;
  allowUpload?: boolean;
  allowDirectoryMutation?: boolean;
  allowDelete?: boolean;
  useButtonText?: string;
  onLoad?: (context: { rootPath: string; currentPath: string; cursor?: string | null; limit: number }) => Promise<FileManagerLoadResult> | FileManagerLoadResult;
  onCurrentPathChange?: (path: string) => void;
  onUpload?: (files: File[], path: string) => Promise<FileManagerAsset[]> | FileManagerAsset[];
  onCreateDirectory?: (name: string, parentPath: string) => Promise<FileManagerDirectory> | FileManagerDirectory;
  onRename?: (entry: FileManagerDirectory | FileManagerAsset, name: string) => Promise<void> | void;
  onDeleteDirectory?: (directory: FileManagerDirectory) => Promise<void> | void;
  onDeleteFile?: (file: FileManagerAsset) => Promise<void> | void;
  onUse: (files: FileManagerAsset[]) => void;
  onClose: () => void;
}

const joinPath = (parent: string, name: string) => `${parent.replace(/\/$/, '')}/${name}`.replace(/\/+/g, '/');
const isImage = (file: FileManagerAsset) => file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
const formatSize = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const iconFor = (file: FileManagerAsset) => {
  const props = { size: 38, strokeWidth: 1.5 };
  if (isImage(file)) return <ImageIcon {...props} className="text-success" />;
  if (file.mimeType?.startsWith('video/')) return <Video {...props} className="text-danger" />;
  if (file.mimeType?.startsWith('audio/')) return <Music {...props} className="text-primary" />;
  if (/\.(xls|xlsx|csv)$/i.test(file.name)) return <FileSpreadsheet {...props} className="text-success" />;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(file.name)) return <FileArchive {...props} className="text-warning" />;
  if (/\.(html?|css|js|jsx|ts|tsx|json|xml)$/i.test(file.name)) return <FileCode2 {...props} className="text-info" />;
  if (/\.(pdf|doc|docx|txt|rtf)$/i.test(file.name)) return <FileText {...props} className="text-danger" />;
  return <FileType2 {...props} className="text-secondary" />;
};

const DirectoryTree: React.FC<{
  directories: FileManagerDirectory[]; currentPath: string; onSelect: (path: string) => void;
  onRename: (directory: FileManagerDirectory) => void; onDelete: (directory: FileManagerDirectory) => void;
}> = ({ directories, currentPath, onSelect, onRename, onDelete }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const render = (items: FileManagerDirectory[], depth = 0): React.ReactNode => items.map((directory) => {
    const children = directory.children || [];
    const isOpen = expanded[directory.path] ?? currentPath.startsWith(`${directory.path}/`);
    return <React.Fragment key={directory.id}>
      <div className={`file-manager-tree-row d-flex align-items-center rounded-2 ${currentPath === directory.path ? 'active' : ''}`} style={{ paddingLeft: depth * 12 }}>
        <button type="button" className="btn btn-sm border-0 p-1" disabled={!children.length} onClick={() => setExpanded((value) => ({ ...value, [directory.path]: !isOpen }))}>{children.length ? isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/> : <span style={{ width: 13 }}/>}</button>
        <button type="button" className="btn btn-sm border-0 flex-grow-1 text-start text-truncate d-flex align-items-center gap-1" onClick={() => onSelect(directory.path)}>{isOpen ? <FolderOpen size={15}/> : <Folder size={15}/>} {directory.name}</button>
        <button type="button" className="btn btn-sm border-0 p-1 file-manager-row-action" title="Rename" onClick={() => onRename(directory)}><Pencil size={11}/></button>
        <button type="button" className="btn btn-sm border-0 p-1 text-danger file-manager-row-action" title="Delete" onClick={() => onDelete(directory)}><Trash2 size={11}/></button>
      </div>
      {children.length && isOpen ? render(children, depth + 1) : null}
    </React.Fragment>;
  });
  return <>{render(directories)}</>;
};

export const FileManagerPopupComponent: React.FC<FileManagerPopupProps> = ({
  open, title = 'File Manager', rootPath: rootPathProp = '/', currentPath: controlledPath,
  selectionMode = 'single', accept = '*/*', pageSize = 40, allowUpload = true,
  allowDirectoryMutation = true, allowDelete = true, useButtonText = 'นำไปใช้', onLoad,
  onCurrentPathChange, onUpload, onCreateDirectory, onRename, onDeleteDirectory,
  onDeleteFile, onUse, onClose,
}) => {
  const [rootPath, setRootPath] = useState(rootPathProp);
  const [internalPath, setInternalPath] = useState(controlledPath || rootPathProp);
  const currentPath = controlledPath ?? internalPath;
  const [directories, setDirectories] = useState<FileManagerDirectory[]>([]);
  const [files, setFiles] = useState<FileManagerAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (append = false) => {
    if (!open) return;
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const result = onLoad ? await onLoad({ rootPath, currentPath, cursor: append ? cursor : null, limit: pageSize }) : { rootPath, currentPath, directories, files: append ? [] : files, hasMore: false };
      if (result.rootPath) setRootPath(result.rootPath);
      if (result.currentPath && controlledPath === undefined) setInternalPath(result.currentPath);
      if (result.directories) setDirectories(result.directories);
      setFiles((value) => append ? [...value, ...(result.files || [])] : (result.files || []));
      setHasMore(Boolean(result.hasMore));
      setCursor(result.nextCursor || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดไฟล์ได้'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { if (open) { setSelected([]); void load(false); } }, [open, currentPath]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (controlledPath === undefined) setInternalPath(rootPathProp); setRootPath(rootPathProp); }, [rootPathProp, controlledPath]);

  const changePath = (path: string) => { if (controlledPath === undefined) setInternalPath(path); onCurrentPathChange?.(path); };
  const selectedFiles = useMemo(() => files.filter((file) => selected.includes(file.id)), [files, selected]);
  const toggle = (file: FileManagerAsset) => setSelected((value) => selectionMode === 'single' ? [file.id] : value.includes(file.id) ? value.filter((id) => id !== file.id) : [...value, file.id]);

  const uploadFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setLoading(true);
    try {
      const added = onUpload ? await onUpload(incoming, currentPath) : incoming.map((file, index) => ({ id: `local-${Date.now()}-${index}`, name: file.name, path: joinPath(currentPath, file.name), url: URL.createObjectURL(file), mimeType: file.type, size: file.size, updatedAt: new Date().toISOString() }));
      setFiles((value) => [...added, ...value]);
      setSelected(selectionMode === 'single' ? added.slice(0, 1).map((file) => file.id) : added.map((file) => file.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'อัปโหลดไม่สำเร็จ'); }
    finally { setLoading(false); }
  };
  const createDirectory = async () => {
    const name = window.prompt('ชื่อโฟลเดอร์ใหม่'); if (!name?.trim()) return;
    const directory = onCreateDirectory ? await onCreateDirectory(name.trim(), currentPath) : { id: `dir-${Date.now()}`, name: name.trim(), path: joinPath(currentPath, name.trim()), parentPath: currentPath, children: [] };
    setDirectories((value) => [...value, directory]);
  };
  const rename = async (entry: FileManagerDirectory | FileManagerAsset) => { const name = window.prompt('ชื่อใหม่', entry.name); if (!name?.trim() || name === entry.name) return; await onRename?.(entry, name.trim()); setFiles((value) => value.map((file) => file.id === entry.id ? { ...file, name: name.trim() } : file)); setDirectories((value) => value.map((dir) => dir.id === entry.id ? { ...dir, name: name.trim() } : dir)); };
  const removeFile = async (file: FileManagerAsset) => { if (!window.confirm(`ลบไฟล์ “${file.name}” หรือไม่?`)) return; await onDeleteFile?.(file); setFiles((value) => value.filter((item) => item.id !== file.id)); setSelected((value) => value.filter((id) => id !== file.id)); };
  const removeDirectory = async (directory: FileManagerDirectory) => { if (!window.confirm(`ลบโฟลเดอร์ “${directory.name}” หรือไม่?`)) return; await onDeleteDirectory?.(directory); setDirectories((value) => value.filter((item) => item.id !== directory.id)); if (currentPath === directory.path) changePath(rootPath); };

  if (!open) return null;
  return <div className="modal d-block file-manager-popup-backdrop" tabIndex={-1} role="dialog" aria-modal="true">
    <div className="modal-dialog modal-xl modal-dialog-centered"><div className="modal-content file-manager-popup shadow-lg border-0">
      <div className="modal-header"><div><h5 className="modal-title fw-bold">{title}</h5><div className="small text-muted font-monospace mt-1">{currentPath}</div></div><button type="button" className="btn-close" onClick={onClose}/></div>
      <div className="file-manager-toolbar d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom bg-light">
        {allowUpload && <button type="button" className="btn btn-sm btn-success" onClick={() => inputRef.current?.click()}><Upload size={14} className="me-1"/> Upload</button>}
        {allowDirectoryMutation && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void createDirectory()}><Plus size={14} className="me-1"/> New Directory</button>}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load(false)}><RefreshCw size={14} className="me-1"/> Refresh</button>
        <input ref={inputRef} className="d-none" type="file" accept={accept} multiple={selectionMode === 'multiple'} onChange={(event) => { void uploadFiles(Array.from(event.target.files || [])); event.target.value = ''; }}/>
        <span className="ms-auto small text-muted">เลือกแล้ว {selected.length} รายการ</span>
      </div>
      <div className="file-manager-body d-flex overflow-hidden">
        <aside className="file-manager-tree border-end p-2 overflow-auto"><button type="button" className={`btn btn-sm w-100 text-start mb-1 ${currentPath === rootPath ? 'btn-primary' : 'btn-light'}`} onClick={() => changePath(rootPath)}><FolderOpen size={15} className="me-1"/> {rootPath}</button><DirectoryTree directories={directories} currentPath={currentPath} onSelect={changePath} onRename={(directory) => void rename(directory)} onDelete={(directory) => allowDelete && void removeDirectory(directory)}/></aside>
        <main className="file-manager-gallery flex-grow-1 overflow-auto p-3" onScroll={(event) => { const el = event.currentTarget; if (hasMore && !loadingMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 160) void load(true); }}>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {loading ? <div className="h-100 d-flex align-items-center justify-content-center text-muted"><Loader2 className="spin me-2"/> กำลังโหลด...</div> : files.length ? <div className="file-manager-grid">{files.map((file) => <div key={file.id} className={`file-manager-tile card ${selected.includes(file.id) ? 'selected' : ''}`} onDoubleClick={() => { toggle(file); if (selectionMode === 'single') onUse([file]); }}><button type="button" className="file-manager-preview border-0 bg-light" onClick={() => toggle(file)}>{isImage(file) ? <img src={file.thumbnailUrl || file.url} alt={file.name}/> : iconFor(file)}</button><div className="p-2"><div className="small fw-semibold text-truncate" title={file.name}>{file.name}</div><div className="text-muted" style={{ fontSize: 10 }}>{formatSize(file.size)}</div><div className="d-flex justify-content-end gap-1 mt-1"><button className="btn btn-sm border-0 p-1" onClick={() => void rename(file)}><Pencil size={11}/></button>{allowDelete && <button className="btn btn-sm border-0 text-danger p-1" onClick={() => void removeFile(file)}><Trash2 size={11}/></button>}</div></div></div>)}</div> : <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted"><FolderOpen size={42} strokeWidth={1.25}/><div className="mt-2">ยังไม่มีไฟล์ในโฟลเดอร์นี้</div></div>}
          {loadingMore && <div className="text-center py-3 text-muted"><Loader2 size={18} className="spin me-1"/> กำลังโหลดเพิ่ม...</div>}
        </main>
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-light" onClick={onClose}><X size={14} className="me-1"/> ยกเลิก</button><button type="button" className="btn btn-primary px-4" disabled={!selectedFiles.length} onClick={() => onUse(selectedFiles)}>{useButtonText} {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ''}</button></div>
    </div></div>
    <style jsx global>{`
      .file-manager-popup-backdrop{background:rgba(15,23,42,.58);backdrop-filter:blur(2px);z-index:1090}.file-manager-popup{height:min(760px,92vh);border-radius:16px;overflow:hidden}.file-manager-body{min-height:0;flex:1}.file-manager-tree{width:250px;background:#f8fafc}.file-manager-tree-row{min-height:32px}.file-manager-tree-row.active{color:#0d6efd;background:#dbeafe}.file-manager-row-action{opacity:0}.file-manager-tree-row:hover .file-manager-row-action{opacity:1}.file-manager-gallery{min-height:360px}.file-manager-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px}.file-manager-tile{overflow:hidden;border:2px solid transparent;cursor:default}.file-manager-tile.selected{border-color:#0d6efd;box-shadow:0 0 0 2px rgba(13,110,253,.12)}.file-manager-preview{height:112px;display:flex;align-items:center;justify-content:center;overflow:hidden}.file-manager-preview img{width:100%;height:100%;object-fit:cover}@media(max-width:767px){.file-manager-tree{width:160px}.file-manager-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}.file-manager-popup{height:96vh}}
    `}</style>
  </div>;
};

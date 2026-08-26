'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download, AlertTriangle } from 'lucide-react';

export interface FileItem {
  id: string;
  name: string;
  size: number; // bytes
  type: string;
  url: string;
  uploadedAt: string;
}

export interface FileManagerProps {
  title?: string;
  files?: FileItem[];
  maxSizeMb?: number;
  acceptedTypes?: string;
  /**
   * Platform whose tenant database stores the files. Uploads are written to
   * that tenant's `sys.assets` table — never to the core control-plane database.
   * Without it the component runs in preview mode and persists nothing.
   */
  platformId?: string;
  onUpload?: (files: FileList) => void;
  onDelete?: (fileId: string) => void;
  className?: string;
}

interface AssetResponse {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
  createdAt: string;
}

const toFileItem = (asset: AssetResponse): FileItem => ({
  id: asset.id,
  name: asset.fileName,
  size: asset.byteSize,
  type: asset.contentType,
  url: asset.url,
  uploadedAt: new Date(asset.createdAt).toLocaleDateString('th-TH'),
});

export const FileManagerComponent: React.FC<FileManagerProps> = ({
  title = 'File Manager',
  files = [],
  maxSizeMb = 10,
  acceptedTypes = '*',
  platformId,
  onUpload,
  onDelete,
  className = '',
}) => {
  const [fileList, setFileList] = useState<FileItem[]>(files);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isConnected = Boolean(platformId);

  const loadFiles = useCallback(async () => {
    if (!platformId) return;
    try {
      const response = await fetch(`/api/platforms/${platformId}/assets`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถอ่านรายการไฟล์ได้');
      setFileList((payload.assets as AssetResponse[]).map(toFileItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านรายการไฟล์ได้');
    }
  }, [platformId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected?.length) return;
    setError('');

    if (onUpload) {
      onUpload(selected);
      event.target.value = '';
      return;
    }

    if (!platformId) {
      // Preview-only: object URLs are local to this browser tab.
      setFileList((previous) => [
        ...previous,
        ...Array.from(selected).map((file, index) => ({
          id: `preview_${Date.now()}_${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
          uploadedAt: new Date().toLocaleDateString('th-TH'),
        })),
      ]);
      event.target.value = '';
      return;
    }

    const oversize = Array.from(selected).find((file) => file.size > maxSizeMb * 1024 * 1024);
    if (oversize) {
      setError(`ไฟล์ "${oversize.name}" ใหญ่เกิน ${maxSizeMb} MB`);
      event.target.value = '';
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      Array.from(selected).forEach((file) => form.append('file', file));

      const response = await fetch(`/api/platforms/${platformId}/assets`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'อัปโหลดไม่สำเร็จ');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (onDelete) {
      onDelete(id);
      return;
    }
    if (!platformId) {
      setFileList((previous) => previous.filter((file) => file.id !== id));
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/platforms/${platformId}/assets/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ลบไฟล์ไม่สำเร็จ');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไฟล์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`card shadow-sm border-0 bg-white p-4 ${className}`}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">{title}</h5>
        {!isConnected && (
          <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 d-inline-flex align-items-center gap-1">
            <AlertTriangle size={12} /> โหมดพรีวิว — ไม่บันทึกจริง
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger border-0 py-2 small rounded-3">{error}</div>}

      {/* Dropzone */}
      <div className="border border-2 border-dashed rounded p-4 text-center mb-4 bg-light position-relative">
        <Upload size={32} className="text-primary mb-2" />
        <h6 className="fw-semibold mb-1">คลิกหรือลากไฟล์มาวางเพื่ออัปโหลด</h6>
        <p className="small text-muted mb-0">
          ขนาดสูงสุด {maxSizeMb} MB{isConnected ? ' · เก็บใน Tenant Database ของ Site นี้' : ''}
        </p>
        <input
          type="file"
          multiple
          disabled={busy}
          className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
          style={{ cursor: 'pointer' }}
          accept={acceptedTypes}
          onChange={(event) => void handleFileChange(event)}
          aria-label="เลือกไฟล์เพื่ออัปโหลด"
        />
      </div>

      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>ชื่อไฟล์</th>
              <th>ขนาด</th>
              <th>อัปโหลดเมื่อ</th>
              <th className="text-end">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {fileList.length > 0 ? (
              fileList.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      {file.type.includes('image') ? (
                        <ImageIcon size={18} className="text-primary" />
                      ) : (
                        <FileText size={18} className="text-secondary" />
                      )}
                      <span className="fw-medium text-truncate" style={{ maxWidth: '250px' }}>
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td>{formatSize(file.size)}</td>
                  <td className="small text-muted">{file.uploadedAt}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">
                        <Download size={14} />
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        disabled={busy}
                        onClick={() => void handleDelete(file.id)}
                        aria-label={`ลบ ${file.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-3 text-muted">ยังไม่มีไฟล์</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

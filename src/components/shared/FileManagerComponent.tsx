'use client';

import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download } from 'lucide-react';
import { FileManagerPopupComponent, type FileManagerAsset } from './FileManagerPopupComponent';

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
  onUpload?: (files: FileList) => void;
  onDelete?: (fileId: string) => void;
  className?: string;
  rootPath?: string;
  currentPath?: string;
  selectionMode?: 'single' | 'multiple';
  onUse?: (files: FileManagerAsset[]) => void;
}

export const FileManagerComponent: React.FC<FileManagerProps> = ({
  title = 'File Manager',
  files = [],
  maxSizeMb = 10,
  acceptedTypes = '*',
  onDelete,
  className = '',
  rootPath = '/uploads',
  currentPath = '/uploads',
  selectionMode = 'multiple',
  onUse,
}) => {
  const [fileList, setFileList] = useState<FileItem[]>(files);
  const [popupOpen, setPopupOpen] = useState(false);
  const [activePath, setActivePath] = useState(currentPath);

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    } else {
      setFileList((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={`card shadow-sm border-0 bg-white p-4 ${className}`}>
      <h5 className="fw-bold mb-3">{title}</h5>

      {/* Dropzone */}
      <button type="button" className="border border-2 border-dashed rounded p-4 text-center mb-4 bg-light position-relative w-100" onClick={() => setPopupOpen(true)}>
        <Upload size={32} className="text-primary mb-2" />
        <h6 className="fw-semibold mb-1">Click or drag & drop files here to upload</h6>
        <p className="small text-muted mb-0">Max file size: {maxSizeMb} MB</p>
      </button>
      <FileManagerPopupComponent open={popupOpen} title={title} rootPath={rootPath} currentPath={activePath} selectionMode={selectionMode} accept={acceptedTypes} onCurrentPathChange={setActivePath} onUse={(assets) => { setFileList((previous) => [...previous, ...assets.map((asset) => ({ id: asset.id, name: asset.name, size: asset.size || 0, type: asset.mimeType || '', url: asset.url, uploadedAt: asset.updatedAt || new Date().toISOString() }))]); onUse?.(assets); setPopupOpen(false); }} onClose={() => setPopupOpen(false)}/>

      {/* File List */}
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>File Name</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th className="text-end">Action</th>
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
                      <a href={file.url} target="_blank" download className="btn btn-outline-secondary">
                        <Download size={14} />
                      </a>
                      <button className="btn btn-outline-danger" onClick={() => handleDelete(file.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-3 text-muted">
                  No files uploaded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

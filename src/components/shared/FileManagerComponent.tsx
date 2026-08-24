'use client';

import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download } from 'lucide-react';

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
}

export const FileManagerComponent: React.FC<FileManagerProps> = ({
  title = 'File Manager',
  files = [],
  maxSizeMb = 10,
  acceptedTypes = '*',
  onUpload,
  onDelete,
  className = '',
}) => {
  const [fileList, setFileList] = useState<FileItem[]>(files);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (onUpload) {
        onUpload(e.target.files);
      } else {
        // Fallback local state demo
        const newFiles: FileItem[] = Array.from(e.target.files).map((f, i) => ({
          id: `file_${Date.now()}_${i}`,
          name: f.name,
          size: f.size,
          type: f.type,
          url: URL.createObjectURL(f),
          uploadedAt: new Date().toLocaleDateString(),
        }));
        setFileList((prev) => [...prev, ...newFiles]);
      }
    }
  };

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
      <div className="border border-2 border-dashed rounded p-4 text-center mb-4 bg-light position-relative">
        <Upload size={32} className="text-primary mb-2" />
        <h6 className="fw-semibold mb-1">Click or drag & drop files here to upload</h6>
        <p className="small text-muted mb-0">Max file size: {maxSizeMb} MB</p>
        <input
          type="file"
          className="position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer"
          accept={acceptedTypes}
          onChange={handleFileChange}
        />
      </div>

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

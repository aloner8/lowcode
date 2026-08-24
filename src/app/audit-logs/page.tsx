'use client';

import React, { useEffect, useState } from 'react';
import { AuditLogService } from '@/lib/engine/AuditLogService';
import { AuditLog } from '@/types';
import { History, FileText, User, Calendar, RefreshCw, Eye } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await AuditLogService.fetchLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="min-vh-100 bg-light py-4">
      <div className="container">
        {/* Header */}
        <div className="card shadow-sm border-0 p-4 mb-4 bg-white">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-primary text-white p-2 rounded">
                <History size={24} />
              </div>
              <div>
                <span className="badge bg-success me-2">Phase 7 Ready</span>
                <h4 className="fw-bold mb-0 d-inline align-middle">Audit Trail Revision Log Viewer</h4>
              </div>
            </div>

            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center" onClick={loadLogs}>
              <RefreshCw size={14} className={`me-1 ${loading ? 'spin' : ''}`} /> Refresh Logs
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="card shadow-sm border-0 p-4 bg-white mb-4">
          <h5 className="fw-bold mb-3">Revision Log Records</h5>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Changes Summary</th>
                  <th className="text-end">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="small text-muted font-monospace">
                        <Calendar size={14} className="me-1 inline" />
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.action === 'CREATE_APP'
                              ? 'bg-success'
                              : log.action === 'UPDATE_PAGE'
                              ? 'bg-primary'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="small fw-semibold">
                        <User size={14} className="me-1 text-muted inline" />
                        {log.performedBy}
                      </td>
                      <td className="small text-truncate" style={{ maxWidth: '300px' }}>
                        {log.changesSummary}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary py-0"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={14} className="me-1" /> View Snapshot
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No audit log records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Snapshot Modal */}
        {selectedLog && (
          <div className="card shadow-sm border-0 p-4 bg-dark text-white font-monospace">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="text-info fw-bold mb-0">Log Snapshot Details (ID: {selectedLog.id})</h6>
              <button className="btn btn-sm btn-outline-light" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <small className="text-warning d-block mb-1">Snapshot Before Change:</small>
                <pre className="p-2 bg-black rounded overflow-auto" style={{ maxHeight: '200px', fontSize: '12px' }}>
                  {JSON.stringify(selectedLog.snapshotBefore || { message: 'None' }, null, 2)}
                </pre>
              </div>
              <div className="col-md-6">
                <small className="text-success d-block mb-1">Snapshot After Change:</small>
                <pre className="p-2 bg-black rounded overflow-auto" style={{ maxHeight: '200px', fontSize: '12px' }}>
                  {JSON.stringify(selectedLog.snapshotAfter || { message: 'None' }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

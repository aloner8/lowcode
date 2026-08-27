'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Search, SearchX, FileSearch, History } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import { auditActionLabel as actionLabel, auditActionTone as actionTone } from '@/lib/admin/auditLabels';
import { AuditLog } from '@/types';

const thaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/audit-logs?limit=200', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถอ่านประวัติการใช้งานได้');
      setLogs(payload.logs as AuditLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านประวัติการใช้งานได้');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Only the actions actually present are offered, so the filter never has a
  // choice that returns nothing.
  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (!needle) return true;
      return (
        log.performedBy.toLowerCase().includes(needle)
        || (log.changesSummary ?? '').toLowerCase().includes(needle)
        || (log.platformName ?? '').toLowerCase().includes(needle)
      );
    });
  }, [logs, searchTerm, actionFilter]);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="adm-toolbar">
        <p className="adm-toolbar-note">
          บันทึกทุกการเปลี่ยนแปลงในระบบ พร้อมข้อมูลก่อนและหลังแก้ไข — แสดง 200 รายการล่าสุด
        </p>
        <button type="button" className="adm-btn is-quiet is-sm" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'adm-spin' : ''} aria-hidden="true" /> โหลดใหม่
        </button>
      </div>

      {error && (
        <div className="adm-alert is-danger" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="adm-card p-3">
        <div className="row g-2">
          <div className="col-12 col-md-8">
            <label htmlFor="log-search" className="adm-label d-block">ค้นหา</label>
            <div className="auth-field">
              <Search size={17} className="auth-field-icon" aria-hidden="true" />
              <input
                id="log-search"
                className="adm-input"
                style={{ paddingInlineStart: '2.5rem' }}
                placeholder="ผู้ทำรายการ รายละเอียด หรือชื่อแม่แบบ"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="log-action" className="adm-label d-block">ประเภทรายการ</label>
            <select
              id="log-action"
              className="adm-select"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              <option value="">ทุกประเภท</option>
              {actions.map((action) => (
                <option key={action} value={action}>{actionLabel(action)}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="adm-help" aria-live="polite">
          แสดง {filtered.length} จากทั้งหมด {logs.length} รายการ
        </p>
      </div>

      {loading && logs.length === 0 ? (
        <div className="adm-card adm-empty">
          <RefreshCw size={22} className="adm-spin mb-2" aria-hidden="true" />
          <p className="adm-empty-text">กำลังโหลด…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-card adm-empty">
          <span className="adm-empty-icon">
            {logs.length === 0 ? <History size={22} aria-hidden="true" /> : <SearchX size={22} aria-hidden="true" />}
          </span>
          <p className="adm-empty-title">
            {logs.length === 0 ? 'ยังไม่มีประวัติการใช้งาน' : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
          </p>
          <p className="adm-empty-text">
            {logs.length === 0
              ? 'รายการจะปรากฏเมื่อมีการใช้งานระบบ'
              : 'ลองเปลี่ยนคำค้นหรือเลือกประเภทอื่น'}
          </p>
        </div>
      ) : (
        <div className="adm-card">
          <div className="table-responsive">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">เวลา</th>
                  <th scope="col">รายการ</th>
                  <th scope="col">ผู้ทำรายการ</th>
                  <th scope="col">รายละเอียด</th>
                  <th scope="col" className="text-end">ข้อมูลที่เปลี่ยน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="adm-nowrap">{thaiDateTime(log.createdAt)}</td>
                    <td>
                      <span className={`adm-chip ${actionTone(log.action)}`}>{actionLabel(log.action)}</span>
                    </td>
                    <td>
                      <span className="adm-cell-strong d-block">{log.performedBy}</span>
                      {log.platformName && <span className="adm-cell-sub">{log.platformName}</span>}
                    </td>
                    <td style={{ whiteSpace: 'normal', minWidth: '16rem' }}>{log.changesSummary}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="adm-btn is-quiet is-sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <FileSearch size={13} aria-hidden="true" />
                        <span className="d-none d-lg-inline">ดูรายละเอียด</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminModal
        isOpen={Boolean(selectedLog)}
        wide
        title="ข้อมูลที่เปลี่ยนแปลง"
        subtitle={
          selectedLog
            ? `${actionLabel(selectedLog.action)} · ${selectedLog.performedBy} · ${thaiDateTime(selectedLog.createdAt)}`
            : undefined
        }
        onClose={() => setSelectedLog(null)}
        footer={
          <button type="button" className="adm-btn is-quiet" onClick={() => setSelectedLog(null)}>ปิด</button>
        }
      >
        {selectedLog && (
          <>
            <p className="adm-toolbar-note mb-3">{selectedLog.changesSummary}</p>
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <p className="adm-label d-block">ก่อนแก้ไข</p>
                <pre className="auth-error-detail small mb-0" style={{ maxHeight: '16rem' }}>
                  {selectedLog.snapshotBefore
                    ? JSON.stringify(selectedLog.snapshotBefore, null, 2)
                    : 'ไม่มีข้อมูลก่อนหน้า (เป็นการเพิ่มข้อมูลใหม่)'}
                </pre>
              </div>
              <div className="col-12 col-lg-6">
                <p className="adm-label d-block">หลังแก้ไข</p>
                <pre className="auth-error-detail small mb-0" style={{ maxHeight: '16rem' }}>
                  {selectedLog.snapshotAfter
                    ? JSON.stringify(selectedLog.snapshotAfter, null, 2)
                    : 'ไม่มีข้อมูลหลังแก้ไข (เป็นการลบข้อมูล)'}
                </pre>
              </div>
            </div>
          </>
        )}
      </AdminModal>
    </div>
  );
}

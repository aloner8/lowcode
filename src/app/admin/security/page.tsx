import React from 'react';
import { Shield, Lock, CheckCircle, Database, Server, Key, Eye } from 'lucide-react';

export default function SecurityPage() {
  const policies = [
    { name: 'profiles (User Profiles)', status: 'RLS Active', description: 'จำกัดสิทธิ์อ่าน/เขียนเฉพาะ User ID หรือ SUPER_ADMIN' },
    { name: 'app_memberships (Studio Access)', status: 'RLS Active', description: 'ควบคุม Developer App Assignment ต่อแต่ละ Tenant' },
    { name: 'apps (Tenant Metadata)', status: 'RLS Active', description: 'จำกัดสิทธิ์แก้ไข App Metadata เฉพาะ SUPER_ADMIN และ APP_OWNER' },
    { name: 'page_layouts (AST Components)', status: 'RLS Active', description: 'อนุญาตให้เฉพาะ DEVELOPER ที่มีสิทธิ์ประจำ App แก้ไขได้' },
  ];

  return (
    <div className="container-fluid p-0">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <Shield className="text-primary" size={24} />
            ตั้งค่าความปลอดภัย & Supabase Row Level Security (RLS)
          </h4>
          <p className="text-secondary small mb-0">
            ตรวจสอบนโยบายการเข้าถึงข้อมูลตารางหลักใน Core DB ของเว็บแม่
          </p>
        </div>
      </div>

      {/* RLS Table Cards */}
      <div className="card border-0 shadow-sm rounded-3 bg-white mb-4">
        <div className="card-header bg-white border-bottom py-3 px-4">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
            <Lock size={18} className="text-success" />
            ตารางและนโยบาย RLS ที่เปิดใช้งาน (Active Database Policies)
          </h6>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-2.5 px-4 small">ตาราง (Table Name)</th>
                  <th className="py-2.5 px-3 small">คำอธิบาย Security Rule</th>
                  <th className="py-2.5 px-4 small text-end">สถานะ Policy</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-4 fw-semibold text-dark">
                      <code>{p.name}</code>
                    </td>
                    <td className="py-3 px-3 small text-secondary">{p.description}</td>
                    <td className="py-3 px-4 text-end">
                      <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 px-2.5 py-1">
                        <CheckCircle size={12} className="me-1" />
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Default System Accounts Info */}
      <div className="card border-0 shadow-sm rounded-3 bg-white">
        <div className="card-header bg-white border-bottom py-3 px-4">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
            <Key size={18} className="text-warning" />
            ข้อมูลบัญชีเริ่มต้นสำหรับทดสอบระบบ (Platform Core Accounts)
          </h6>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="p-3 bg-danger bg-opacity-10 rounded-3 border border-danger border-opacity-25">
                <div className="fw-bold text-danger mb-1 d-flex align-items-center gap-2">
                  <Shield size={16} /> 🔴 Super Admin Account
                </div>
                <div className="small text-secondary">
                  <strong>Email:</strong> <code>admin@platform.com</code>
                </div>
                <div className="small text-secondary">
                  <strong>Username:</strong> <code>admin</code>
                </div>
                <div className="small text-secondary">
                  <strong>Password:</strong> <code>1qaz@WSX</code>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="p-3 bg-primary bg-opacity-10 rounded-3 border border-primary border-opacity-25">
                <div className="fw-bold text-primary mb-1 d-flex align-items-center gap-2">
                  <Key size={16} /> 🔵 First Developer Account
                </div>
                <div className="small text-secondary">
                  <strong>Email:</strong> <code>aloner@platform.com</code>
                </div>
                <div className="small text-secondary">
                  <strong>Username:</strong> <code>aloner</code>
                </div>
                <div className="small text-secondary">
                  <strong>Password:</strong> <code>1qaz@WSX</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

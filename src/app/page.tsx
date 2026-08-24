import Link from 'next/link';
import { Layers, Database, Palette, Cpu, Play, CheckCircle2, History, Zap, Layout, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="container py-5">
      <div className="text-center mb-5">
        <span className="badge bg-primary text-white mb-2 px-3 py-2 rounded-pill fs-6">
          Low-Code Engine 2026 Complete
        </span>
        <h1 className="display-4 fw-bold text-dark">Studio & Dynamic Control Plane</h1>
        <p className="lead text-muted mx-auto" style={{ maxWidth: '750px' }}>
          ระบบสร้างและบริหารจัดการ Low-Code Web Application พร้อม Dynamic Shared Components,
          React Flow Engine, Multi-Theme Customizer และ Tenant Database Isolation
        </p>
      </div>

      {/* Status Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card h-100 shadow-sm border-0 bg-white p-3">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-primary text-white p-2 rounded me-3">
                <Database size={24} />
              </div>
              <div>
                <h6 className="card-subtitle text-muted">Core Database</h6>
                <h5 className="card-title mb-0">PostgreSQL</h5>
              </div>
            </div>
            <p className="card-text small text-muted">
              Mother Port <strong>:33000</strong> | Child Ports <strong>:33001, :33002</strong>
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100 shadow-sm border-0 bg-white p-3">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-success text-white p-2 rounded me-3">
                <Layers size={24} />
              </div>
              <div>
                <h6 className="card-subtitle text-muted">UI Foundation</h6>
                <h5 className="card-title mb-0">Bootstrap 5 + React</h5>
              </div>
            </div>
            <p className="card-text small text-muted">
              9 Shared Components + Tailwind Overrides + Design Tokens
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100 shadow-sm border-0 bg-white p-3">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-info text-white p-2 rounded me-3">
                <Palette size={24} />
              </div>
              <div>
                <h6 className="card-subtitle text-muted">Theme System</h6>
                <h5 className="card-title mb-0">Multi-Theme Engine</h5>
              </div>
            </div>
            <p className="card-text small text-muted">
              ฉีด CSS Variables (`--bs-primary`, `--bs-border-radius`) Dynamic เข้าสู่ `:root`
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100 shadow-sm border-0 bg-white p-3">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-dark text-white p-2 rounded me-3">
                <Cpu size={24} />
              </div>
              <div>
                <h6 className="card-subtitle text-muted">Runtime Architecture</h6>
                <h5 className="card-title mb-0">Thin Dynamic Player</h5>
              </div>
            </div>
            <p className="card-text small text-muted">
              รัน App ลูกผ่าน Port Binding + Tenant DB Isolation
            </p>
          </div>
        </div>
      </div>

      {/* Control Studio Quick Navigation Links */}
      <div className="card border-0 shadow-sm p-4 bg-white mb-4">
        <h4 className="fw-bold mb-3 d-flex align-items-center">
          <CheckCircle2 className="text-success me-2" /> All 7 Phases Fully Completed
        </h4>
        <p className="text-muted mb-4">
          เปิดทดสอบและใช้งานส่วนประกอบของระบบ Low-Code ได้จากลิงก์เมนูด้านล่างนี้:
        </p>

        <div className="row g-3">
          <div className="col-md-4">
            <Link href="/admin" className="card h-100 border border-primary border-opacity-50 text-decoration-none hover-shadow p-3 bg-primary bg-opacity-10">
              <div className="d-flex align-items-center mb-2">
                <Shield className="text-primary me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">UI Admin Control Center (/admin)</h6>
              </div>
              <p className="small text-muted mb-0">ศูนย์ควบคุม Web แม่ สำหรับผู้ใช้งาน Admin & Developer (aloner)</p>
            </Link>
          </div>

          <div className="col-md-4">
            <Link href="/studio" className="card h-100 border text-decoration-none hover-shadow p-3 bg-light">
              <div className="d-flex align-items-center mb-2">
                <Play className="text-primary me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">DesignMode Studio (App แม่)</h6>
              </div>
              <p className="small text-muted mb-0">หน้าสตูดิโอ Drag & Drop ออกแบบหน้าเว็บและปรับสไตล์ CSS Theme</p>
            </Link>
          </div>

          <div className="col-md-4">
            <Link href="/flow-studio" className="card h-100 border text-decoration-none hover-shadow p-3 bg-light">
              <div className="d-flex align-items-center mb-2">
                <Zap className="text-warning me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">Visual Flow Studio</h6>
              </div>
              <p className="small text-muted mb-0">หน้าลากสาย React Flow Visual Workflow Builder & Interpreter</p>
            </Link>
          </div>

          <div className="col-md-4">
            <Link href="/app/demo-client-a" className="card h-100 border text-decoration-none hover-shadow p-3 bg-light">
              <div className="d-flex align-items-center mb-2">
                <Cpu className="text-success me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">App ลูก Dynamic Player (:33001)</h6>
              </div>
              <p className="small text-muted mb-0">รัน App ลูกสดๆ ดึง JSON AST + Theme + Tenant DB Isolation</p>
            </Link>
          </div>

          <div className="col-md-4">
            <Link href="/renderer-demo" className="card h-100 border text-decoration-none hover-shadow p-3 bg-light">
              <div className="d-flex align-items-center mb-2">
                <Layout className="text-info me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">Dynamic Page Renderer Demo</h6>
              </div>
              <p className="small text-muted mb-0">ทดสอบ Engine วาดหน้าเว็บทั้งหน้าจากโครงสร้าง JSON AST ใน DB</p>
            </Link>
          </div>

          <div className="col-md-4">
            <Link href="/audit-logs" className="card h-100 border text-decoration-none hover-shadow p-3 bg-light">
              <div className="d-flex align-items-center mb-2">
                <History className="text-danger me-2" size={20} />
                <h6 className="fw-bold mb-0 text-dark">Audit Trail Logs Viewer</h6>
              </div>
              <p className="small text-muted mb-0">เรียกดู Log ประวัติการแก้ไขย้อนหลังและ snapshot diff</p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

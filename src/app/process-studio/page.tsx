import Link from 'next/link';
import { ArrowRight, Workflow } from 'lucide-react';

export default function ProcessStudioPage() {
  return <div className="container-fluid py-4"><h2>กระบวนการทำงาน</h2><p className="text-secondary">เครื่องมือสำหรับออกแบบและประกอบลำดับการทำงาน</p><div className="card" style={{ maxWidth: 520 }}><div className="card-body d-flex align-items-center gap-3"><Workflow className="text-primary" size={32} /><div className="flex-grow-1"><h5 className="mb-1">ออกแบบขั้นตอน</h5><p className="text-secondary small mb-0">สร้าง Trigger, Action, Condition และเส้นทางของ Flow</p></div><Link href="/flow-studio" className="btn btn-primary"><ArrowRight size={16} /></Link></div></div></div>;
}

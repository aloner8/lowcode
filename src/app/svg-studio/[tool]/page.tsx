import { notFound } from 'next/navigation';
import ParameterizedObjectStudio from '@/components/studio/ParameterizedObjectStudio';

const tools: Record<string, { title: string; description: string }> = {
  background: { title: 'ออกแบบพื้นหลัง', description: 'สร้างพื้นหลัง SVG ที่เปลี่ยนสี รูปทรง และขนาดผ่าน Parameters' },
  button: { title: 'ออกแบบปุ่ม', description: 'สร้างปุ่มและสถานะ hover / active เป็น Object ที่ใช้ซ้ำได้' },
  card: { title: 'ออกแบบการ์ด + Animation', description: 'ประกอบ Card และกำหนด animation, duration และ easing' },
  icon: { title: 'ออกแบบ ICON', description: 'วาดและจัดเก็บ Icon แบบ SVG พร้อมสีและขนาดที่ปรับได้' },
  'art-text': { title: 'ข้อความศิลป์', description: 'สร้างข้อความ SVG พร้อม stroke, gradient และ effect' },
  frame: { title: 'กรอบรูป', description: 'สร้างกรอบรูปแบบ responsive พร้อม mask และ decoration' },
  'auto-form': { title: 'Form Auto Draw with Field', description: 'สร้าง Form Object อัตโนมัติจากรายการ Field และ Parameters' },
};

export default async function SvgToolPage({ params }: { readonly params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const definition = tools[tool];
  if (!definition) notFound();
  return <ParameterizedObjectStudio kind={`svg:${tool}`} {...definition} />;
}

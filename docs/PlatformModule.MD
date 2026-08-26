# 🏢 การออกแบบสถาปัตยกรรมระดับ Platform Master & Tenant Apps (PlatformModule.MD)

> **แนวคิดหลัก:** นำเสนอโครงสร้าง **Platform Master Solution (แม่พิมพ์ระบบหลัก)** เช่น `PlatformERP`, `PlatformCRM`, `PlatformHRM` ซึ่งทำหน้าที่เป็นพิมพ์เขียวต้นแบบ (Master Blueprint) ที่สามารถกด Provision แตกออกเป็น **Tenant Apps (App ลูก)** ที่รันแยก Docker Container/Port ได้หลายตัว  
> **คุณสมบัติการสืบทอด (Inheritance & Cascading Updates):** เมื่อมีการแก้ไข UI Layout, Workflow Logic หรือ Theme ที่ระดับ Platform Master ผลลัพธ์จะถูกถ่ายทอด (Cascade) ไปยัง Tenant Apps ทุกตัวที่สังกัดสังกัด Platform นั้นทันที โดยแต่ละ Tenant App สามารถกรอง/ทับสิทธิ์ (Override & Filter) การตั้งค่าเฉพาะตัวได้ผ่าน `tenant_overrides`  
> **เอกสารประกอบ:** ใช้ควบคู่กับ [PlanOverView.MD](file:///c:/code/lowcode/PlanOverView.MD) และ [DeveloperAdminPage.MD](file:///c:/code/lowcode/DeveloperAdminPage.MD)

---

## 📌 1. วัตถุประสงค์และภาพรวมสถาปัตยกรรม (Architecture Hierarchy)

ลำดับขั้นของสถาปัตยกรรมเดิมถูกยกระดับขึ้นเป็น 3 ชั้น (3-Tier Architecture):

```
                               ┌─────────────────────────────────────────┐
                               │ 🏢 Platform Master Solutions (พิมพ์เขียว)│
                               │    (e.g., PlatformERP, PlatformCRM)     │
                               └────────────────────┬────────────────────┘
                                                    │
                                   ถ่ายทอด Master Layouts, Flows & Themes
                                                    │
                           ┌────────────────────────┴────────────────────────┐
                           ▼                                                 ▼
          ┌──────────────────────────────────┐              ┌──────────────────────────────────┐
          │ 📦 Tenant App A (Instance 1)     │              │ 📦 Tenant App B (Instance 2)     │
          │  - Parent: PlatformERP           │              │  - Parent: PlatformERP           │
          │  - Port: :3001 | Client-A DB     │              │  - Port: :3002 | Client-B DB     │
          │  - Overrides: PrimaryColor=Green │              │  - Overrides: Hide Inventory Module│
          └──────────────────────────────────┘              └──────────────────────────────────┘
```

### 1.1 ความสามารถหลัก (Core Capabilities)
1. **Platform Solution Blueprints:**
   - สร้างโซลูชันสำเร็จรูประดับองค์กร (เช่น `PlatformERP`, `PlatformCRM`) ไว้ที่ระบบแม่
   - กำหนด **Master Page AST Layouts**, **Master Workflow AST**, **Master Theme Presets**, **Feature Flags Standard**
2. **Cascading Live Update Engine:**
   - เมื่อนักพัฒนาแก้ไข Layout หรือตรรกะใน `PlatformERP` (เช่น เพิ่มปุ่ม Export PDF ในหน้าฟอร์ม) App ลูกทุกตัวที่สืบทอดจาก `PlatformERP` จะได้รับการอัปเดตทันที
3. **Granular Tenant Overrides & Feature Filtering:**
   - แต่อนุญาตให้แต่ละ Tenant App สามารถกำหนด `tenant_overrides` เฉพาะตัวได้ เช่น:
     - **Visual Overrides:** สลับสีกราฟิก/สีปุ่มเฉพาะองค์กร (Client A สีเขียว, Client B สีส้ม)
     - **Feature Flag Filtering:** ปิด/เปิดบางเมนู (เช่น Client A ไม่เอาโมดูลคลังสินค้า)
     - **Layout Extensions:** เพิ่ม Component พิเศษเฉพาะ Client A ในพื้นที่ต่อเติม (Extension Slot)

---

## 💾 2. การปรับปรุงฐานข้อมูล PostgreSQL Core DB (Database Schema)

เพื่อรองรับสถาปัตยกรรม Platform Master จะต้องเพิ่มตาราง `platforms` และผูก Foreign Key เข้ากับ `apps` ใน `supabase/schema.sql`:

```sql
-- ==========================================
-- 1. Platforms Table (พิมพ์เขียว Platform Master Solution)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_slug VARCHAR(100) UNIQUE NOT NULL, -- e.g. "platform-erp", "platform-crm"
    platform_name VARCHAR(255) NOT NULL,        -- e.g. "PlatformERP Standard Edition"
    description TEXT,
    category VARCHAR(100) DEFAULT 'ERP',
    master_theme_config JSONB NOT NULL DEFAULT '{
        "preset": "corporate-emerald",
        "mode": "light",
        "primaryColor": "#0d6efd",
        "borderRadius": "0.375rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Apps Table Extension (ผูกเข้ากับ parent platform_id)
-- ==========================================
ALTER TABLE public.apps 
ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tenant_overrides JSONB NOT NULL DEFAULT '{
    "disabledFeatures": [],
    "themeOverrides": {},
    "componentPropsOverrides": {}
}'::jsonb;
```

---

## ⚙️ 3. กลไกการประมวลผลการสืบทอด (Inheritance & Merging Engine)

เมื่อ App ลูกทำการโหลด UI จาก `AppRuntimeFetcher` ตัว Engine จะรันกระบวนการ **Deep Merge & Filter** ดังนี้:

```typescript
// ลำดับขั้นตอนการ Merge Layout และ Config ของ App ลูก
export function resolveChildAppRuntime(
  platformMasterLayout: ComponentNode[],
  tenantOverrides: TenantOverrides
): ComponentNode[] {
  const disabledList = tenantOverrides.disabledFeatures || [];
  const propsOverrides = tenantOverrides.componentPropsOverrides || {};

  // 1. กรอง Component หรือ Module ที่ถูกปิดใช้งานใน Tenant App ออก
  const filteredTree = platformMasterLayout.filter(
    (node) => !disabledList.includes(node.id) && !disabledList.includes(node.type)
  );

  // 2. ปรับแต่ง Props และ Style ทับด้วย Tenant Specific Overrides
  return filteredTree.map((node) => {
    const nodeOverride = propsOverrides[node.id];
    if (nodeOverride) {
      return {
        ...node,
        props: { ...node.props, ...nodeOverride.props },
        style: { ...node.style, ...nodeOverride.style },
      };
    }
    return node;
  });
}
```

---

## 🎨 4. การปรับปรุง UI Admin Page (`/admin/platforms` & `/admin/apps`)

### 4.1 หน้าจัดการ Platform Solutions (`/admin/platforms`)
- **Platform Cards Grid:** แสดงรายการพิมพ์เขียว `PlatformERP`, `PlatformCRM`, `PlatformHRM`
- **Provision Tenant App Button:** ปุ่มกดแตก App ลูกใหม่จาก Platform พิมพ์เขียวที่เลือก พร้อมระบุ Port, Subdomain และ Tenant DB Name
- **Master Design Studio Link:** ปุ่มกดแก้ไข Master Layout / Master Flow ซึ่งเมื่อแก้เสร็จแล้วจะมีผลทันทีกับ Tenant Apps ทั้งหมด

### 4.2 หน้าจัดการ Tenant Apps (`/admin/apps`)
- แสดง Badge ระบุว่า App ลูกแต่ละตัวสืบทอดมาจาก Platform แม่พิมพ์อันไหน (เช่น `Inherited from: PlatformERP`)
- **Tenant Config Overrides Modal:** Modal สำหรับติ๊กเปิด/ปิด Feature และปรับแต่งสีกราฟิกประจำ Tenant นั้นๆ

---

## 📂 5. โครงสร้างไฟล์ที่จะเพิ่ม/ปรับปรุงในระบบ (File Plan)

```
src/
├── app/
│   ├── admin/
│   │   ├── platforms/                  # [NEW] หน้าบริหารจัดการ Platform Master Solutions
│   │   │   └── page.tsx
│   │   ├── apps/                       # [MODIFY] อัปเดตให้รองรับ Select Platform Parent & Overrides
│   │   │   └── page.tsx
├── components/
│   ├── admin/
│   │   ├── PlatformCard.tsx            # [NEW] Card Component แสดง Platform Master Blueprint
│   │   ├── PlatformFormModal.tsx       # [NEW] Modal สร้าง Platform Solution ใหม่
│   │   └── TenantOverrideModal.tsx     # [NEW] Modal ปรับแต่ง Overrides ประจำ Tenant App
├── lib/
│   ├── engine/
│   │   └── PlatformMergeEngine.ts      # [NEW] Engine รวม Master Layout + Tenant Overrides
```

---

## 🏁 6. ขั้นตอนการลงมือพัฒนาจริง (Execution Plan)

1. **Step 1: DB Schema Migration & Seed Data**
   - อัปเดต `supabase/schema.sql` เพิ่มตาราง `platforms` และคอลัมน์ `platform_id`, `tenant_overrides` ใน `apps`
   - เพิ่ม Seed Data สร้าง `PlatformERP` เป็นพิมพ์เขียวแม่บท และเชื่อม `demo-client-a` เข้ากับ `PlatformERP`
2. **Step 2: TypeScript Types Update**
   - อัปเดต `src/types/index.ts` เพิ่ม `PlatformConfig` และ `TenantOverrides`
3. **Step 3: Build Inheritance & Merge Engine**
   - สร้าง `src/lib/engine/PlatformMergeEngine.ts`
4. **Step 4: Admin Platform UI (`/admin/platforms`) & Provisioning Flow**
   - สร้างหน้า `/admin/platforms` และอัปเดตหน้า `/admin/apps` ให้เลือก Platform Master เมื่อสร้าง Tenant App ใหม่ได้

---
*เอกสารฉบับนี้จัดทำขึ้นสำหรับการวางสถาปัตยกรรมระดับ Platform Master & Tenant Apps*

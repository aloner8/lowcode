# 🏆 Walkthrough: ระบบ Low-Code Web Application (เสร็จสมบูรณ์ทั้ง 7 เฟส)

ระบบ Low-Code Web Application พร้อมสถาปัตยกรรม **Mother DesignMode Studio (Port 33000)** และ **Child App Dynamic Player (Port 33001, 33002)** ได้รับการพัฒนาเสร็จสมบูรณ์ 100% ครบถ้วนตามแผนงานใน [PlanOverView.MD](file:///c:/code/lowcode/PlanOverView.MD)

---

## 📌 สรุปผลงานในแต่ละเฟส (Phase Summary)

### ✅ Phase 1: รากฐานระบบ & Database Schema
- **Next.js 15+ App Router, TypeScript, Bootstrap 5 & Tailwind CSS Integration**
- **PostgreSQL DDL Schema:** [supabase/schema.sql](file:///c:/code/lowcode/supabase/schema.sql) สร้างตาราง `apps`, `page_layouts`, `workflow_trees`, `audit_logs`
- **Core Types Definition:** [src/types/index.ts](file:///c:/code/lowcode/src/types/index.ts)

### ✅ Phase 2: คลัง Shared Components 9 ตัว & Multi-Theme Engine
- **Shared Component Library:** [src/components/shared/](file:///c:/code/lowcode/src/components/shared/)
  1. `FieldInputComponent.tsx`
  2. `FormComponent.tsx`
  3. `TableDataComponent.tsx`
  4. `GalleryComponent.tsx`
  5. `FileManagerComponent.tsx`
  6. `DynamicHtmlComponent.tsx`
  7. `HtmlEditorComponent.tsx`
  8. `NavMenuComponent.tsx`
  9. `SlideMenuComponent.tsx`
- **CSS Theme Provider & Design Tokens:** [ThemeEngine.tsx](file:///c:/code/lowcode/src/components/shared/ThemeEngine.tsx) ผูก CSS Variables เข้ากับ Bootstrap 5 (`--bs-primary`, `--bs-border-radius`, `--bs-body-bg`)

### ✅ Phase 3: Dynamic Component Renderer Engine
- **Component Registry:** [ComponentRegistry.ts](file:///c:/code/lowcode/src/lib/engine/ComponentRegistry.ts)
- **Dynamic Page Renderer:** [DynamicPageRenderer.tsx](file:///c:/code/lowcode/src/components/engine/DynamicPageRenderer.tsx) แปลง JSON AST ออกมาเป็นหน้าเว็บจริง

### ✅ Phase 4: DesignMode Studio (App แม่ - Port :33000)
- **Studio Interface (3 Columns):** [src/app/studio/page.tsx](file:///c:/code/lowcode/src/app/studio/page.tsx)
  - Palette Panel ซ้าย
  - Interactive Canvas ตรงกลาง (พร้อม Live Preview & Theme Switcher)
  - Property Inspector ขวา (แก้ไข Label, Props, Delete/Duplicate/Move)

### ✅ Phase 5: Visual Flow Engine & Logic Interpreter
- **React Flow Studio (@xyflow/react):** [src/app/flow-studio/page.tsx](file:///c:/code/lowcode/src/app/flow-studio/page.tsx)
- **Custom Nodes:** [CustomNodes.tsx](file:///c:/code/lowcode/src/components/flow/CustomNodes.tsx) (`TriggerNode`, `ActionNode`, `ConditionNode`)
- **Workflow Interpreter Engine:** [WorkflowInterpreter.ts](file:///c:/code/lowcode/src/lib/engine/WorkflowInterpreter.ts)

### ✅ Phase 6: App ลูก Dynamic Runtime Player (Port :33001, :33002)
- **Thin Dynamic Player Route:** [src/app/app/[appSlug]/page.tsx](file:///c:/code/lowcode/src/app/app/%5BappSlug%5D/page.tsx)
- **Tenant DB Isolation Helper:** [tenantClient.ts](file:///c:/code/lowcode/src/lib/supabase/tenantClient.ts) เชื่อมต่อ DB Name ส่วนตัวของแต่ละ App ลูก
- **App Runtime Fetcher:** [AppRuntimeFetcher.ts](file:///c:/code/lowcode/src/lib/engine/AppRuntimeFetcher.ts)

### ✅ Phase 7: Docker Containerization, Nginx & Audit Logging
- **Multi-stage Dockerfile:** [Dockerfile](file:///c:/code/lowcode/Dockerfile)
- **Docker Compose:** [docker-compose.yml](file:///c:/code/lowcode/docker-compose.yml) กำหนด Port แม่ `33000` และ Port ลูก `33001`, `33002`
- **Nginx Reverse Proxy Generator & Conf:** [NginxConfigGenerator.ts](file:///c:/code/lowcode/src/lib/engine/NginxConfigGenerator.ts), [nginx.conf](file:///c:/code/lowcode/docker/nginx/nginx.conf)
### ✅ Phase 8: ระบบ User + Auth และ UI Admin Page (Web แม่ Platform Control Center)
- **การออกแบบและเอกสารสถาปัตยกรรม:** [DeveloperAdminPage.MD](file:///c:/code/lowcode/DeveloperAdminPage.MD)
- **การแยก Auth ชัดเจน:** Platform Auth (Core DB) แยกขาดจาก Tenant Auth (Child App DBs)
- **Supabase SSR Helpers & Middleware:** [server.ts](file:///c:/code/lowcode/src/lib/supabase/server.ts), [middleware.ts](file:///c:/code/lowcode/src/middleware.ts), [authActions.ts](file:///c:/code/lowcode/src/lib/auth/authActions.ts)
- **บัญชีผู้ใช้งานระบบแม่เริ่มต้น:**
  - 🔴 **Super Admin:** Email `admin@platform.com` / Username `admin` | Password `1qaz@WSX`
  - 🔵 **First Developer:** Email `aloner@platform.com` / Username `aloner` | Password `1qaz@WSX`
- **UI Admin Control Pages & Components:** [src/app/admin/](file:///c:/code/lowcode/src/app/admin/)
  - `/login`: [LoginPage](file:///c:/code/lowcode/src/app/(auth)/login/page.tsx)
  - `/admin`: [Overview Dashboard](file:///c:/code/lowcode/src/app/admin/page.tsx)
  - `/admin/users`: [User & Developer Management](file:///c:/code/lowcode/src/app/admin/users/page.tsx)
  - `/admin/apps`: [Tenant App Control Panel](file:///c:/code/lowcode/src/app/admin/apps/page.tsx)
### ✅ Phase 9: Platform Master Solutions & Cascading Inheritance
- **การออกแบบและเอกสารสถาปัตยกรรม:** [PlatformModule.MD](file:///c:/code/lowcode/PlatformModule.MD)
- **ตารางพิมพ์เขียวระบบหลัก (Core DB Schema):** ตาราง `public.platforms` เชื่อม Foreign Key กับ `public.apps` (คอลัมน์ `platform_id` และ `tenant_overrides`)
- **Inheritance & Merging Engine:** [PlatformMergeEngine.ts](file:///c:/code/lowcode/src/lib/engine/PlatformMergeEngine.ts) รวม Master Layout + Tenant Overrides
- **UI Platform Blueprints Page:** [PlatformsPage](file:///c:/code/lowcode/src/app/admin/platforms/page.tsx) (`/admin/platforms`) แสดงรายการแม่แบบ `PlatformERP`, `PlatformCRM` และ Spawn Tenant App

---

## 🌐 เส้นทาง URL สำหรับทดสอบในระบบ (Available Routes)

| URL Route | คำอธิบายระบบ |
|---|---|
| `/` | [Home Dashboard](file:///c:/code/lowcode/src/app/page.tsx) - หน้าแรกสรุประบบและรวมลิงก์เข้าทุกส่วน |
| `/login` | [Login Page](file:///c:/code/lowcode/src/app/(auth)/login/page.tsx) - เข้าสู่ระบบแม่ (`admin` / `1qaz@WSX`, `aloner` / `1qaz@WSX`) |
| `/admin` | [UI Admin Control](file:///c:/code/lowcode/src/app/admin/page.tsx) - ศูนย์ควบคุมเว็บแม่ ผู้ใช้งาน สิทธิ์ และ Tenant Apps |
| `/admin/platforms` | [Platform Master Blueprints](file:///c:/code/lowcode/src/app/admin/platforms/page.tsx) - แม่แบบโซลูชันหลัก (PlatformERP, PlatformCRM) สั่ง Spawn Tenant App |
| `/admin/users` | [User & Role Management](file:///c:/code/lowcode/src/app/admin/users/page.tsx) - บริหารจัดการนักพัฒนาและสิทธิ์ Studio Access |
| `/admin/apps` | [Tenant App Control](file:///c:/code/lowcode/src/app/admin/apps/page.tsx) - บริหารจัดการ Port, Subdomain และ Tenant DB |
| `/admin/security` | [Security & RLS Settings](file:///c:/code/lowcode/src/app/admin/security/page.tsx) - ตรวจสอบ RLS Policies ใน Core DB |
| `/studio` | [DesignMode Studio](file:///c:/code/lowcode/src/app/studio/page.tsx) - ออกแบบหน้าเว็บ App แม่ Drag & Drop |
| `/flow-studio` | [Visual Flow Studio](file:///c:/code/lowcode/src/app/flow-studio/page.tsx) - ลากสาย Workflow Engine |
| `/app/demo-client-a` | [Child App Dynamic Player](file:///c:/code/lowcode/src/app/app/%5BappSlug%5D/page.tsx) - App ลูกรันบน Port 33001 |
| `/shared-demo` | [9 Shared Components Showcase](file:///c:/code/lowcode/src/app/shared-demo/page.tsx) - คลัง Components + Theme Switcher |
| `/renderer-demo` | [Dynamic Page Renderer Demo](file:///c:/code/lowcode/src/app/renderer-demo/page.tsx) - ทดสอบวาดหน้าเว็บจาก JSON DB |
| `/audit-logs` | [Audit Logs Viewer](file:///c:/code/lowcode/src/app/audit-logs/page.tsx) - ตรวจสอบ Log ประวัติและ Diff Snapshot |


---

## ⚡ วิธีการรันและใช้งานโปรเจกต์

### 1. การรันในโหมดพัฒนา (Development Mode)
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:33000`

### 2. บัญชีเข้าใช้งานระบบแม่สำหรับทดสอบ (Test Credentials)
- **Super Admin:** Login ด้วย `admin@platform.com` หรือ `admin` | Password: `1qaz@WSX`
- **Developer:** Login ด้วย `aloner@platform.com` หรือ `aloner` | Password: `1qaz@WSX`

### 3. การรันในโหมด Docker Compose Production
```bash
docker-compose up --build -d
```
- App แม่ (DesignMode Studio & Admin): `http://localhost:33000`
- App ลูก Client A: `http://localhost:33001`
- App ลูก Client B: `http://localhost:33002`


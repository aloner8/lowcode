# 🗺️ แผนผังการพัฒนาระบบ Low-Code Web Application (PlanOverView.MD)
> **Stack หลักที่เลือก:** Next.js (App Router) + Supabase (PostgreSQL) + React Flow + Dynamic Shared Components  
> **UI Base Framework:** Bootstrap 5 (React-Bootstrap / Bootstrap CSS Variables) + Tailwind CSS / Custom CSS Overrides  
> **เป้าหมายสถาปัตยกรรม:** App แม่ (DesignMode Studio) ──สร้าง/บันทึก JSON──> Supabase Core DB <──ดึงไปรันสด── App ลูก (Thin Dynamic Player Docker Container)

---

## 📌 สรุปภาพรวมของเฟสการพัฒนา (Phased Roadmap)

```
[ Phase 1 ] ──> [ Phase 2 ] ──> [ Phase 3 ] ──> [ Phase 4 ] ──> [ Phase 5 ] ──> [ Phase 6 ] ──> [ Phase 7 ]
  รากฐาน DB       คลัง Shared      Engine วาด       DesignMode     Visual Flow    App ลูก Dynamic Docker Deploy,
 & Data Model    Components     หน้าจาก JSON      Visual Studio   Workflow Exec  Player & Theme  Nginx & Logs
 & Theme System  (Bootstrap 5)  + CSS Injection  + Theme Switch                 Dynamic Inject
```

---

## 🚀 เฟสการพัฒนาละเอียด (Detailed Phase Breakdown)

### 🔹 Phase 1: รากฐานระบบ & Database Schema (Foundations & Supabase DB)
**เป้าหมาย:** สร้างโครงสร้าง Monorepo/Workspace และวาง Schema ฐานข้อมูลใน Supabase ให้พร้อมรองรับข้อมูล Multi-App และ Multi-Theme

* [x] **1.1 Project Setup:** ตั้งไข่โครงการ Next.js 15+ (App Router, TypeScript, Bootstrap 5 + React-Bootstrap, Tailwind CSS)
* [x] **1.2 Supabase Integration:** เชื่อมต่อ Supabase Client & Admin SDK (`src/lib/supabase/client.ts`)
* [x] **1.3 Core Database Schema Design (App แม่):** สร้าง ตารางหลักใน PostgreSQL (`supabase/schema.sql`):
  * `apps`: เก็บข้อมูลคุณสมบัติ, Port, Subdomain, ชื่อ Tenant DB และ **`theme_config` (JSONB)** ของ App ลูก
  * `page_layouts`: เก็บโครงสร้าง JSON AST ของหน้าจอ (`PagesHtmlDynamicComponent`)
  * `workflow_trees`: เก็บโครงสร้าง JSON AST ของ Flow Logic (React Flow Nodes/Edges)
  * `audit_logs`: เก็บ Log ประวัติการแก้ไขย้อนหลังของ App ลูก
* [x] **1.4 TypeScript Interfaces:** นิยาม Type สำหรับ Component Props, Theme Tokens, Node Flow, และ Dynamic Page Layout (`src/types/index.ts`)

---

### 🔹 Phase 2: คลัง Shared Components มาตรฐานด้วย Bootstrap 5 (Shared Component Library)
**เป้าหมาย:** สร้างชุด UI Components พื้นฐาน 9 ตัว โดยใช้ **Bootstrap 5 UI Foundation** ผูกเข้ากับระบบ **CSS Variables / Design Tokens** ให้สลับ/ปรับแต่งสไตล์ยืดหยุ่นได้เต็มที่

* [x] **2.1 FieldInputComponent:** Text, Number, Select, Date, Checkbox, Radio พร้อม Validation (`src/components/shared/FieldInputComponent.tsx`)
* [x] **2.2 FormComponent:** Container ฟอร์มรับข้อมูล + ปุ่ม Submit และจัดการ State ภายในฟอร์ม (`src/components/shared/FormComponent.tsx`)
* [x] **2.3 TableDataComponent:** ตารางแสดงผลข้อมูล (Sorting, Pagination, Filter, Action Buttons - `src/components/shared/TableDataComponent.tsx`)
* [x] **2.4 GalleryComponent:** Grid แสดงผลรูปภาพ/สื่อพร้อม Modal Lightbox Preview (`src/components/shared/GalleryComponent.tsx`)
* [x] **2.5 FileManagerComponent:** Upload ไฟล์, แสดงรายการไฟล์, ลบไฟล์ (`src/components/shared/FileManagerComponent.tsx`)
* [x] **2.6 DynamicHtmlComponent & HtmlEditorComponent:** ตัวแสดงผล Rich HTML และ WYSIWYG Editor (`src/components/shared/DynamicHtmlComponent.tsx`, `src/components/shared/HtmlEditorComponent.tsx`)
* [x] **2.7 NavMenuComponent & SlideMenuComponent:** แถบเมนูด้านบน และ เมนูด้านข้างแบบพับเก็บได้ (`src/components/shared/NavMenuComponent.tsx`, `src/components/shared/SlideMenuComponent.tsx`)
* [x] **2.8 Dynamic CSS Theme Provider & Design Tokens (Bootstrap 5 CSS Variables Integration):** (`src/components/shared/ThemeEngine.tsx`)
  * ผูก CSS Variables ของระบบเข้ากับ Bootstrap 5 Variables (`--bs-primary`, `--bs-border-radius`, `--bs-body-bg`, `--bs-body-color`, ฯลฯ)
  * สร้าง Preset Themes สำเร็จรูป (เช่น Modern Indigo, Corporate Emerald, Dark Glassmorphism, Sunset Orange, Cyberpunk, Minimal Slate)
  * รองรับการแก้ไข Custom CSS Overrides และ Tailwind Utility Classes ทับบน Bootstrap 5 ได้อย่างอิสระ

---

### 🔹 Phase 3: Engine แปลง JSON เป็น UI (Dynamic Component Renderer)
**เป้าหมาย:** สร้าง Engine กลางคอยแปลง JSON Tree ใน DB ให้กลายเป็น UI หน้าจอจริง พร้อมพ่น CSS Variables

* [x] **3.1 Component Registry Engine:** สร้าง `ComponentRegistry.ts` แมปชื่อชนิด Component ใน DB เข้ากับ UI Component จริง (`src/lib/engine/ComponentRegistry.ts`)
* [x] **3.2 Dynamic Layout Parser:** เขียน `DynamicPageRenderer.tsx` รับ JSON Tree (Layout + Props) แล้ว Recursive render ออกมาเป็นหน้าเว็บ (`src/components/engine/DynamicPageRenderer.tsx`)
* [x] **3.3 Props & State Binding:** รองรับการส่ง Data Binding จาก State/DB เข้าสู่ Props และ Action Triggers ของแต่ละ Component (`src/app/renderer-demo/page.tsx`)

---

### 🔹 Phase 4: DesignMode Studio (App แม่ - Visual Designer & Theme Customizer)
**เป้าหมาย:** สร้างระบบหน้าจอสตูดิโอสำหรับออกแบบหน้าเว็บและปรับแต่งธีม (App แม่)

* [x] **4.1 Canvas & Palette Layout:** สร้าง UI แบ่ง 3 โซน (Palette ซ้าย, Canvas ตรงกลาง, Property Inspector ขวา - `src/app/studio/page.tsx`)
* [x] **4.2 Drag & Drop Engine:** ลาก/กดวาง Shared Component จาก Palette มาวางและสลับตำแหน่งบน Canvas (`src/components/studio/PalettePanel.tsx`)
* [x] **4.3 Property Inspector Panel:** แบบฟอร์มขวาสำหรับปรับแต่ง Label, Field Name, Data Source, สี, ขนาด ของ Component ที่เลือก (`src/components/studio/PropertyInspector.tsx`)
* [x] **4.4 Visual Theme Editor (Theme Customizer):** (`src/components/studio/ThemeCustomizerPanel.tsx`)
  * สวิตช์เลือก Theme Presets สำเร็จรูป
  * Color Picker ปรับโทนสีหลัก (Primary, Accent, Background), ปรับความมนของมุม (Border Radius) และฟอนต์
  * พรีวิวการเปลี่ยนธีมแบบ Live Preview บน Canvas ได้ทันที
* [x] **4.5 Page & Theme Composition Saver:** ปุ่ม เซฟบันทึก JSON AST และ `theme_config` ลง Supabase DB และ Export JSON (`src/app/studio/page.tsx`)

---

### 🔹 Phase 5: Visual Flow Engine & Logic Interpreter (ระบบ Flow การทำงาน)
**เป้าหมาย:** สร้างตัวสร้างและรัน Flow Logic ของแอปพลิเคชัน

* [x] **5.1 Visual Flow Editor (App แม่):** (`src/app/flow-studio/page.tsx`, `src/components/flow/FlowCanvas.tsx`)
  * ติดตั้ง **React Flow (@xyflow/react)** ใน DesignMode Studio
  * สร้าง Custom Nodes (`TriggerNode`, `ActionNode`, `ConditionNode` - `src/components/flow/CustomNodes.tsx`)
  * แปลงสายเชื่อมและ Node ออกมาเป็น `WorkflowJSON` แล้วเซฟลง Supabase DB
* [x] **5.2 Workflow Interpreter (App ลูก & แม่):** (`src/lib/engine/WorkflowInterpreter.ts`)
  * เขียน JS Evaluator ตัวเบาๆ รันคำสั่งตาม `WorkflowJSON` เมื่อเกิด Event จาก UI Components

---

### 🔹 Phase 6: App ลูก Dynamic Runtime Player, Theme Injector & Tenant DB (Child App Engine)
**เป้าหมาย:** สร้างระบบรัน App ลูกแบบ Thin Dynamic Player พร้อมระบบฉีด CSS Theme, แยก Database และ Port Mapping

* [x] **6.1 Dynamic CSS Theme Injector:** (`src/app/app/[appSlug]/page.tsx`, `src/components/shared/ThemeEngine.tsx`)
  * เมื่อเปิด App ลูก ตัวระบบจะอ่าน `theme_config` จาก DB แล้วฉีด CSS Variables เข้าสู่ `:root` หรือ `html[data-theme]` อัตโนมัติ ทำให้ App ลูกเปลี่ยนโฉมเป็นธีมนั้นๆ ทันที
* [x] **6.2 Isolated Tenant Database Connection:** (`src/lib/supabase/tenantClient.ts`)
  * App ลูกรันบน **PostgreSQL Server เดียวกับ App แม่**
  * แต่ละ App ลูกมี **Database Name ส่วนตัว** (เช่น `app_db_client_a`, `app_db_client_b`) สำหรับเก็บข้อมูล Business Data / Form Submissions
* [x] **6.3 Dynamic Runtime Config Fetcher:** (`src/lib/engine/AppRuntimeFetcher.ts`)
  * ดึง Config + JSON Page + Flow Logic + Theme จาก Core DB ของ App แม่ผ่าน `APP_ID`
* [x] **6.4 Port Binding Engine & Dynamic Child App Routes:** (`src/app/app/[appSlug]/page.tsx`)
  * กำหนดค่า Port ประจำตัวของ Container App ลูก (`3001`, `3002`) ปล่อยออกมาหา Nginx Reverse Proxy บน Host

---

### 🔹 Phase 7: Docker Containerization, Nginx & Audit Logging (การ Deploy & ติดตาม Log)
**เป้าหมาย:** ทำระบบ Docker Container ของ App ลูก, การสร้าง Nginx Reverse Proxy Config และระบบ Audit Log

* [x] **7.1 Dockerfile & Image Packaging:** Multi-stage Dockerfile & `docker-compose.yml` รองรับ Host Port App แม่ (`:33000`) และ App ลูก (`:33001`, `:33002`) (`Dockerfile`, `docker-compose.yml`)
* [x] **7.2 Nginx Subdomain Reverse Proxy Helper:** สคริปต์อัตโนมัติสร้าง Nginx Config สำหรับผูก Subdomain Name เข้ากับ Host Ports (`src/lib/engine/NginxConfigGenerator.ts`, `docker/nginx/nginx.conf`)
* [x] **7.3 Audit Trail Logging System:** บันทึกประวัติทุกครั้งที่มีการแก้ไข Config/Page/Flow/Theme ของ App ลูกลงตาราง `audit_logs` (`src/lib/engine/AuditLogService.ts`)
* [x] **7.4 Revision Rollback Viewer:** หน้าแสดงประวัติการแก้ไขย้อนหลังและดู Snapshot Diff เปรียบเทียบเวอร์ชัน (`src/app/audit-logs/page.tsx`)

---

## 🎯 สรุปผลลัพธ์ที่จะได้ในแต่ละ Milestone

| Phase | ผลลัพธ์ที่ทดสอบได้จริง |
|---|---|
| **Phase 1-2** | ได้คลัง UI Components 9 ตัวที่ใช้ **Bootstrap 5 UI** + ระบบ CSS Design Tokens สลับธีมปุ่ม/การ์ด/ฟอร์มได้ |
| **Phase 3** | สามารถใส่ JSON ดิบใน DB แล้วหน้าเว็บวาด UI + ธีมสีตรงตาม JSON ทันที |
| **Phase 4** | สามารถลากวาง UI และสลับเลือก/ปรับแต่งสี CSS Theme บนหน้าจอ DesignMode แล้วกด Save ลง DB ได้ |
| **Phase 5** | สามารถลากสาย Flow Logic เช่น "กดปุ่มแล้วแจ้ง Alert / ยิง API" ได้สำเร็จ |
| **Phase 6** | ได้ App ลูกที่แสดงผลตาม CSS Theme ประจำตัว ต่อกับ Tenant DB ส่วนตัวบน Postgres เดียวกับแม่ |
| **Phase 7** | ได้ Docker Image + Nginx Configuration พร้อมระบบ Audit Log บันทึกประวัติสมบูรณ์ |

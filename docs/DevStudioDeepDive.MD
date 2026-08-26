# 🚀 คู่มือสถาปัตยกรรมฉบับเจาะลึก DevStudio Low-Code IDE (DevStudioDeepDive.MD)

> **เป้าหมาย:** สถาปัตยกรรมระบบออกแบบหน้าเว็บและชุดเครื่องมือระดับการผลิต (Production-Grade Low-Code IDE Suite) สำหรับ **App แม่ (Platform Control Studio)**  
> **รูปแบบดีไซน์:** ออกแบบและจัดเลย์เอาต์ตาม **Microsoft Visual Studio 2022 Low-Code IDE**  
> **เอกสารประกอบ:** ใช้ควบคู่กับ [DesignStudio.MD](file:///c:/code/lowcode/DesignStudio.MD), [AppWorkFlow.MD](file:///c:/code/lowcode/AppWorkFlow.MD) และ [PlanOverView.MD](file:///c:/code/lowcode/PlanOverView.MD)

---

## 📌 1. ภาพรวมสถาปัตยกรรมฉบับเจาะลึก (Deep Dive Overview)

**DevStudio (`/studio`)** ได้รับการพัฒนายกระดับขึ้นสู่ระบบ Low-Code IDE สมบูรณ์แบบด้วย 6 ขีดความสามารถหลัก:

1. **State History Stack (Undo / Redo Manager):**
   - รองรับการย้อนกลับ `Undo (Ctrl+Z)` และการทำซ้ำ `Redo (Ctrl+Y)` สูงสุด 30 ลำดับสถานะแบบเรียลไทม์ ผ่าน `HistoryStackManager`

2. **Expanded Shared Components Registry:**
   - 📊 `ChartComponent`: แสดงผลกราฟสถิติแบบ Bar/Line/Pie บนแดชบอร์ด
   - 🃏 `CardComponent`: แสดงผลการ์ดสรุปตัวเลข KPI, เมตริก และป้ายการเติบโต
   - 📂 `TabsContainerComponent` / 🔽 `AccordionComponent`: กล่องสลับแท็บและพับเก็บเนื้อหา

3. **Multi-Page Layout Manager (Solution Page CRUD):**
   - รองรับการสร้างหน้าใหม่ (Create Page), การก๊อปปี้หน้า (Clone Page), การลบหน้า (Delete Page) และการเลือกหน้าเริ่มต้น (Set Start Page)

4. **Tenant DB Schema Browser & Auto-Generator:**
   - อ่านและแสดงผลตารางฐานข้อมูล Tenant DB (`app_db_client_a`)
   - ปุ่มกด **Auto Table** และ **Auto Form** ปั้น UI `TableDataComponent` หรือ `FormComponent` จากโครงสร้าง DB Table อัตโนมัติด้วยคลิกเดียว!

5. **Master App WorkFlow & Navigation Router:**
   - ตัวควบคุมระดับบนสุดของ App ลูก (App Manifest) จัดการ Bootstrapping Services, สิทธิ์เข้าถึง และการกดเมนู (`OPEN_PAGE`, `RUN_SERVICE`, `TRIGGER_WORKFLOW`)

6. **Flexible Canvas Viewport & Zoom Scaling:**
   - จำลองการแสดงผลบน Desktop, Tablet (768px), Mobile (375px) พร้อมการขยาย/ย่อ Zoom (50%, 75%, 100%, 125%, 150%)

---

## 📐 2. สรุปความเชื่อมโยงของส่วนประกอบ (Component Map)

```
DevStudio Suite (/studio)
 ├── StudioMenuBar (Top Dropdown Menus: File, Edit, View, Project, Tools)
 ├── StudioToolBar (Quick Action Toolbar: Save, Undo/Redo, Live Run, Viewport, Zoom, Page Switcher)
 ├── StudioTreeviewOutline (Left Panel: App WorkFlow, Solution Explorer, Site Map, Basic/App Controls, Service Assign)
 ├── Form Designer Canvas (Center Stage: Visual Dotted Designer Grid + Zoom Scaler)
 ├── ComponentPropertyModal (Floating Modal Popup for Inspecting & Editing Selected Components)
 ├── PageManagerModal (Modal Popup for Multi-Page CRUD & Start Page Selection)
 └── BottomDock (Bottom Panel: Output Logs, Live AST JSON, DB Status, Audit Trail)
```

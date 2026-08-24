# 🖥️ รายละเอียดการออกแบบระบบ DesignMode Studio - MS Visual Studio 2022 IDE Style (DesignStudio.MD)

> **เป้าหมาย:** สถาปัตยกรรมระบบออกแบบหน้าเว็บ Drag & Drop UI Builder และระบบบริหารจัดการ Layout JSON AST สำหรับ **App แม่ (Platform Control Studio)**  
> **รูปแบบดีไซน์:** ออกแบบและจัดเลย์เอาต์ตาม **Microsoft Visual Studio 2022 IDE Environment** (ปรับแต่งสำหรับระบบ Low-Code Web App ไม่เน้นพิมพ์โค้ด)  
> **เอกสารประกอบ:** ใช้ควบคู่กับ [PlanOverView.MD](file:///c:/code/lowcode/PlanOverView.MD), [DeveloperAdminPage.MD](file:///c:/code/lowcode/DeveloperAdminPage.MD) และ [PlatformModule.MD](file:///c:/code/lowcode/PlatformModule.MD)

---

## 📌 1. วัตถุประสงค์และขอบเขต (Objectives & Scope)

**DesignStudio (`/studio`)** คือเครื่องมือหลักสำหรับ Low-Code Developers และ Designers ในการสร้าง พรีวิว และบริหารจัดการส่วนประกอบของแอปพลิเคชันลูกแบบ Visual IDE สไตล์ Microsoft Visual Studio 2022:

1. **Collapsible Admin Sidebar (ย่อ/ขยายได้):**
   - แถบเมนูด้านซ้ายสุดของ App แม่ (`AdminSidebar`) สามารถกดปุ่ม **ย่อ/ขยาย (Collapse/Expand)** เปลี่ยนระหว่างโหมดเต็ม (`240px`) และโหมดไอคอนย่อ (`64px`) พร้อมระบบ Tooltip เมื่อชี้เมาส์

2. **Top IDE Command Bar (Menu Bar & Toolbar):**
   - **Menu Bar:** `File`, `Edit`, `View`, `Project`, `Tools`, `Help`
   - **Quick Toolbar:** ปุ่ม `Save Layout`, `Undo/Redo`, `Live Run Preview`, `Viewport Device Selectors` (Desktop/Tablet/Mobile), `Grid Guide Toggle`

3. **DevStudio Left Panel - 5-Section Treeview Outline:**
   - โครงสร้างเมนูด้านซ้ายแบ่งออกเป็น Treeview 5 หัวข้อหลัก:
     - 📁 **Solution Explorer:** การจัดโครงสร้างไฟล์ Layout Pages (`index.page`, `about.page`), Tenant Database schemas (`app_db_client_a.users`), และธีมประจำ App
     - 🗺️ **Site Map & Flow:** ผังเส้นทางหน้าจอ (Routes Hierarchy) และลิงก์เชื่อมต่อกับ Visual Flow Studio
     - 🧩 **BasicComponents:** ชุด UI Building blocks พื้นฐาน (Input, Button, Label, Checkbox, Image)
     - 📦 **AppComponents:** ชุดมอดูลสำเร็จรูปความสามารถสูง (FormComponent, TableDataComponent, GalleryComponent, FileManagerComponent, NavMenuComponent)
     - 🔌 **Service Assign:** จุดเชื่อมต่อ Tenant DB APIs, Webhooks, และ Data Action Bindings

4. **Center Stage - Form Designer Canvas:**
   - **Tabbed Editor Dock:** แถบแท็บหน้าจอที่เปิดใช้งาน (เช่น `[🎨 Form1.page (Index)]`)
   - **Visual Dotted Grid Stage:** พื้นที่วาด UI ลายตารางจุดนำสายตา (Visual Dotted Guide Canvas) ขยายเต็มพื้นที่ความกว้าง (Full Width) เพื่อเพิ่มความสะดวกในการออกแบบ

5. **Floating Component Property Modal Popup:**
   - เมื่อผู้ใช้กดคลิกเลือก Component ชิ้นใดบน Canvas ตัวระบบจะเปิด **Modal Popup ลอย** ขึ้นมาบนหน้าจออัตโนมัติ:
     - แถบควบคุมย่อย: ขยับตำแหน่งขึ้น/ลง (Move Up/Down), ทำซ้ำ (Duplicate), ลบชิ้นส่วน (Delete)
     - แถบตั้งค่า Props: Label, Title, Placeholders, Switches, JSON Array Structure
     - แถบตั้งค่า Events & Logic: `onClick`, `onSubmit`

6. **Bottom Dock - Diagnostic & Output Window:**
   - แถบพับเก็บได้ด้านล่างรวมสถานะระบบ: `Output Logs`, `Live AST JSON Schema`, `Tenant DB Status`, `Audit Trail Events`

---

## 📐 2. สถาปัตยกรรม Visual Layout Diagram

```
+---------------------------------------------------------------------------------------------------+
| 🛠️ Studio Menu Bar:  File  Edit  View  Project  Tools  Help                       (App: Client A) |
+---------------------------------------------------------------------------------------------------+
| 🧰 IDE Toolbar: [💾 Save] [↺ Undo] [↻ Redo] | [▶️ Live Run] [💻 📱 📲 Viewport] | 🔳 Grid Guide    |
+-------------------+-------------------------------------------------------------------------------+
| 🌲 Treeview       | 🎨 Form Designer Canvas (Expanded Center Stage)                               |
|   Outline Panel   | +---------------------------------------------------------------------------+ |
|   (5 Sections)    | | [Tab: 🎨 Form1.page [Design]]                                             | |
|   ├ 📁 Solution   | +---------------------------------------------------------------------------+ |
|   ├ 🗺️ Site Map    | |                                                                           | |
|   ├ 🧩 Basic      | |  [Dotted Visual Grid Canvas Stage (Full Width)]                           | |
|   ├ 📦 App        | |  - NavMenuComponent                                                       | |
|   └ 🔌 Service    | |  - FormComponent (Click to open Property Modal)                           | |
|                   | +---------------------------------------------------------------------------+ |
+-------------------+-------------------------------------------------------------------------------+
| 📟 Bottom Output Dock: [📋 Output Logs] [⚙️ JSON AST View] [🔌 DB Bindings] [📜 Audit Trail]      |
+---------------------------------------------------------------------------------------------------+

                    +---------------------------------------------------------+
                    | ⚙️ Floating Component Property Modal Popup              |
                    | [NavMenuComponent (ID: nav_header_01)]            [X]   |
                    | +-----------------------------------------------------+ |
                    | | [Properties Tab] [Events Tab]  [⬆️] [⬇️] [📋] [🗑️]   | |
                    | | - Brand Name: Siam Enterprise Portal                | |
                    | | - Menu Items: JSON Structure Array                  | |
                    | +-----------------------------------------------------+ |
                    | |                                    [Apply & Close]  | |
                    +---------------------------------------------------------+
```

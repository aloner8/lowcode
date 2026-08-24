# ⚡ สถาปัตยกรรมตัวควบคุมแอปพลิเคชันระดับองค์กร (EnterpriseFlow.MD)

> **เป้าหมาย:** สถาปัตยกรรมสายการทำงานระดับบนสุด (Enterprise Master Flow Engine) สำหรับควบคุมวงจรชีวิตแอปพลิเคชัน (Application Lifecycle) ทั้งหมดตั้งแต่จุดเริ่มต้นจนถึงการปิดการทำงาน  
> **หลักการสำคัญ:** หน้านี้คือตัวควบคุมหลัก (Supreme Orchestrator Engine) ของแอปพลิเคชัน ทำหน้าที่ตรวจสอบ Authenticated Session, แยกประเภทหน้าจอ Private Page และ Public Page, รับฟัง Event Loop (Menu, Route, Action, Timer) และรองรับการสอดแทรก **Sub-Flows ย่อย** ที่สามารถ **เพิ่ม/แก้ไข (Add / Edit Sub-Flows)** ได้อย่างอิสระ  
> **เอกสารประกอบ:** ใช้ควบคู่กับ [AppWorkFlow.MD](file:///c:/code/lowcode/AppWorkFlow.MD), [DesignStudio.MD](file:///c:/code/lowcode/DesignStudio.MD) และ [PlanOverView.MD](file:///c:/code/lowcode/PlanOverView.MD)

---

## 🏗️ 1. สายการทำงานหลักของระบบ (Enterprise Master Lifecycle Flow)

```
[🚀 Start Entry] ──> [🛡️ Auth Check?] ──(Yes/No)──> [🔐 Private / Public Page Router]
                                                               │
                                                               ▼
[🛑 Close / Terminate] <── [🎧 Listening Event Loop (Menu + Route + Action + Timer)]
```

### 1.1 ลำดับขั้นการประมวลผล (Execution Pipeline):

1. **`Start Entry Node` (จุดเริ่มต้นการรัน App):**  
   จุดเริ่มต้นสุดเมื่อผู้ใช้เรียก URL ของ App ลูก
2. **`Auth Check Node` (ตรวจสอบการยืนยันตัวตน):**  
   ยิงตรวจสอบ Session Cookie หรือ JWT Token ว่าได้รับอนุญาตหรือไม่ (`Is Authenticated?`)
   - หาก **Yes** ──> ส่งต่อเข้ากระบวนการตรวจสอบ Login Role และไปยัง **Private Page Container**
   - หาก **No** ──> ส่งต่อไปยัง **Public Page Container** (เช่น หน้า `/login` หรือหน้าต้อนรับสาธารณะ)
3. **`Private / Public Page Router Node` (ตัวแยกประเภทพื้นที่หน้าจอ):**  
   โหลดกรอบเลย์เอาต์ตามระดับสิทธิ์ความปลอดภัยของผู้ใช้
4. **`Listening Event Loop Node` (ตัวรับฟังเหตุการณ์ระบบแบบต่อเนื่อง):**  
   คอยวนรอบฟังเหตุการณ์ที่เกิดขึ้นในแอปพลิเคชันตลอดเวลาการใช้งาน:
   - 🗺️ **Menu Event:** การกดเลือกเมนูนำทาง
   - 🧭 **Route Event:** การเปลี่ยนเส้นทาง URL/Slug
   - 🔌 **Action Event:** การกดปุ่ม Submit ฟอร์ม หรือการยิง API
   - ⏱️ **Timer Event:** การตั้งเวลาถอยหลังหรือรอบการซิงค์ข้อมูล
5. **`Close / Terminate Node` (จุดปิดการทำงาน):**  
   เคลียร์ Session Memory, บันทึก Audit Log และปิดการเชื่อมต่อเมื่อผู้ใช้งาน Logout หรือปิดแท็บเบราว์เซอร์

---

## 🧩 2. ระบบ Sub-Flows ย่อย (Add & Edit Sub-Flow Architecture)

เพื่อรองรับความยุ่งยากซับซ้อนในระดับปฏิบัติการ Enterprise Flow เปิดโอกาสให้ Low-Code Developers สามารถ **เพิ่ม (Add)** และ **แก้ไข (Edit)** Sub-Flows ย่อยผูกติดเข้ากับจุดต่างๆ ในวงจรชีวิตได้ 5 หมวดหลัก:

```mermaid
flowchart TD
    subgraph Master Enterprise Flow
        A[🚀 Start Entry] --> B{🛡️ Auth Check?}
        B -- Yes --> C[🔐 Private Page Router]
        B -- No --> D[🌐 Public Page Router]
        C --> E[🎧 Listening Event Loop]
        D --> E
        E --> F[🛑 Close Terminate]
    end

    subgraph Sub-Flows Suite (Add & Edit Sub-Flows)
        E --> S1[📄 Page Sub-Flows<br/>onPageLoad / onFormSubmit]
        E --> S2[🗺️ Menu Sub-Flows<br/>onMenuClick / checkPermission]
        E --> S3[🧭 Route Sub-Flows<br/>onBeforeNavigate / routeGuard]
        E --> S4[🔌 Action Sub-Flows<br/>onApiSuccess / onApiError]
        E --> S5[⏱️ Timer Sub-Flows<br/>onInterval / onTimeout]
    end
```

### 2.1 รายละเอียดหมวดหมู่อย่อยของ Sub-Flows:

| หมวด Sub-Flow | Event Triggers ที่รองรับ | ตัวอย่างคำสั่งที่ทำได้ใน Sub-Flow |
|---|---|---|
| 📄 **Page Sub-Flows** | `onPageLoad`, `onPageUnload`, `onFormSubmit`, `onTabChange` | เช็กค่าฟอร์มก่อนเซฟ, ฉีดข้อมูลเริ่มต้นเข้า UI Table, แจ้งเตือน Toast |
| 🗺️ **Menu Sub-Flows** | `onMenuClick`, `checkMenuPermission`, `onMenuHover` | ตรวจสิทธิ์ User Role ก่อนเปิดเมนู, นับสถิติการใช้งานเมนู |
| 🧭 **Route Sub-Flows** | `onBeforeNavigate`, `onRouteGuarded`, `onRouteNotFound` | Intercept URL ป้องกันการเข้าผิดหน้า, Redirect ไปยังหน้า Default |
| 🔌 **Action Sub-Flows** | `onApiSuccess`, `onApiError`, `onStateMutated` | ส่ง Webhook, บันทึก Log เมื่อ API พัง, สั่งรีโหลดตารางข้อมูลสด |
| ⏱️ **Timer Sub-Flows** | `onInterval`, `onTimeout`, `onIdleSessionTimeout` | ซิงค์ข้อมูลทุก 30 วินาที, ตัด Auth Session อัตโนมัติเมื่อผู้ใช้หยุดเคลื่อนไหว |

---

## 💾 3. โครงสร้างข้อมูล JSON AST ของ Enterprise Flow (`EnterpriseWorkflowAST`)

แผนผัง Visual Flow ทั้งหมดใน Visual Flow Engine Studio (`/flow-studio`) ถูกแปลงเป็นโครงสร้าง JSON AST เพื่อนำไปรันสดบน App ลูก ดังนี้:

```json
{
  "app_id": "a0000000-0000-0000-0000-000000000001",
  "flow_name": "Enterprise Master Control Flow",
  "version": "2.0.0",
  "nodes": [
    {
      "id": "node_start",
      "type": "startNode",
      "position": { "x": 100, "y": 200 },
      "data": { "label": "Start Application Entry", "nodeType": "start" }
    },
    {
      "id": "node_auth_check",
      "type": "authCheckNode",
      "position": { "x": 350, "y": 200 },
      "data": { "label": "Auth Check?", "nodeType": "auth_check", "sessionTimeoutSec": 3600 }
    },
    {
      "id": "node_route_guard",
      "type": "routeGuardNode",
      "position": { "x": 600, "y": 200 },
      "data": { "label": "Private / Public Router", "nodeType": "route_guard" }
    },
    {
      "id": "node_event_loop",
      "type": "eventListenerNode",
      "position": { "x": 850, "y": 200 },
      "data": {
        "label": "Listening Event Loop",
        "nodeType": "event_listener",
        "listeners": ["menu", "route", "action", "timer"]
      }
    },
    {
      "id": "subflow_page_submit",
      "type": "subFlowNode",
      "position": { "x": 850, "y": 400 },
      "data": {
        "label": "Page Sub-Flow (onFormSubmit)",
        "nodeType": "sub_flow",
        "category": "page",
        "triggerEvent": "onFormSubmit",
        "actionTarget": "SaveToTenantDB"
      }
    },
    {
      "id": "node_close",
      "type": "closeNode",
      "position": { "x": 1100, "y": 200 },
      "data": { "label": "Close Application Session", "nodeType": "close" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "node_start", "target": "node_auth_check" },
    { "id": "e2", "source": "node_auth_check", "target": "node_route_guard", "label": "Yes (Authenticated)" },
    { "id": "e3", "source": "node_route_guard", "target": "node_event_loop" },
    { "id": "e4", "source": "node_event_loop", "target": "subflow_page_submit", "label": "Sub-Flow Binding" },
    { "id": "e5", "source": "node_event_loop", "target": "node_close", "label": "Terminate" }
  ]
}
```

---

## 🛠️ 4. การแสดงผลและการใช้งานใน Flow Studio (`/flow-studio`)

ใน **Flow Studio (`/flow-studio`)**:
1. **Default Graph Loading:** หน้าจอจะดึงผัง Enterprise Master Flow ขึ้นมาแสดงเป็นโครงสร้างหลักทันที (`Start` -> `Auth Check` -> `Route Guard` -> `Event Loop` -> `Close`)
2. **Sub-Flow Addition Toolbar:** มีปุ่มกดเพิ่ม Sub-Flows ย่อย 5 แบบ (`+ Page Sub-Flow`, `+ Menu Sub-Flow`, `+ Route Sub-Flow`, `+ Action Sub-Flow`, `+ Timer Sub-Flow`)
3. **Interactive Sub-Flow Configurator:** คลิกที่ Node Sub-Flow เพื่อปรับแต่ง Event Name, Trigger Actions, และการเชื่อมต่อสายเคเบิล
4. **Live Test Evaluator & AST Exporter:** กดทดลองรัน Flow จำลองสถานะ และส่งออกไฟล์ JSON AST

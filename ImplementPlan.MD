# Implement Plan — จากข้อกำหนดสู่ระบบที่ใช้งานได้

วันที่: 12 กันยายน 2026

สถานะ: อยู่ระหว่าง implementation; สถานะและหลักฐานรายระยะอยู่ในส่วน 7 โดย P7 ยังไม่ผ่าน acceptance

## 1. เป้าหมายและวิธีอ่านแผน

เป้าหมายคือให้ Customer **สร้างแม่แบบด้วยการตั้งค่าและลากวาง แล้วสร้าง App ที่รันจริงและมี Database ของตัวเองได้** โดย Admin Server ดูแลผู้ใช้และสถานะระบบ ส่วนของเดิมที่ทำไว้ดีแล้ว โดยเฉพาะ Component, HTML Editor และ PropertyPage ให้นำมาต่อยอด

ข้อเสนอหลักคือเริ่มจากเส้นทางเล็กที่ทำงานครบ: **แม่แบบเดียว → สอง App → หน้าจอเดียวกัน → บันทึกคนละ Database** แล้วจึงเพิ่มความครบของเครื่องมือและการบริหารระบบ ทุกระยะต้องมีสิ่งที่เปิดดูและตรวจผลได้

แผนนี้แยกข้อมูลสามประเภท:

- **ข้อกำหนดที่ยืนยัน:** สิ่งที่ผู้ใช้ระบุไว้โดยตรงในบทสนทนาและเอกสาร
- **ข้อเสนอ:** รายละเอียดที่เติมเพื่อให้พัฒนาได้ต่อเนื่อง ยังไม่ถือว่าผู้ใช้ยืนยันนโยบายทุกข้อ
- **หลักฐานของเดิม:** สิ่งที่อ่านพบในโค้ดหรือรายงานเดิม ไม่เท่ากับการทดสอบระบบใหม่ผ่านแล้ว

เอกสารต้นทาง: [CONTEXT.MD](CONTEXT.MD), [User.MD](User.MD), [Screen.MD](Screen.MD), [Pages.MD](Pages.MD), [Components.MD](Components.MD), [ShareModule.MD](ShareModule.MD)

รายละเอียดตารางในเอกสารย่อยเป็นแบบเชิงตรรกะ ต้องตรวจ schema ที่ใช้งานจริงก่อนทำ migration; ข้อเสนอเพิ่มเติมในแผนนี้ยังไม่ย้อนเปลี่ยนข้อกำหนดเดิมโดยอัตโนมัติ

## 2. ข้อกำหนดรวมที่ต้องส่งมอบ

| ส่วน | สิ่งที่ต้องได้ |
|---|---|
| โครงสร้างระบบ | Dev Server/DB_main เก็บแบบและทะเบียน; App ลูกมี config, path, port, domain และ DB ของตัวเอง; อ่านแบบผ่าน api/form และใช้งานข้อมูลผ่าน api/db |
| Admin Server | หลัง Login ไม่มีเมนูซ้าย; สถานะ Server, จำนวน Customer/App; ตารางชื่อ Customer, โดเมนหลัก, จำนวนแม่แบบ/App; Detail, สวมสิทธิ์ และ Suspend; ดู Server/Docker/Nginx และจัดการบัญชี |
| Customer | หลัง Login ไม่มีเมนูซ้าย; จำนวนแม่แบบ/App/Database และทรัพยากร; แถวแม่แบบมี Detail; ตารางย่อย App มี Detail, Start, Stop; รันตามโควต้าและตั้ง subdomain |
| หน้าจัดการแม่แบบ | เมนูบนค้น Object ภายในแม่แบบ และดู/แก้สถานะ Public |
| เมนูซ้ายของแม่แบบ | On Start Up, Module Setting, Site Map View, Collection Set, Screens, Pages, Components ตามลำดับ |
| On Start Up | ค่าเริ่มต้น, ConnectionString และ Main CSS UI เมื่อเริ่ม App |
| Module Setting | เลือกโมดูล ตั้งค่าและขอบเขตตาม ShareModule; ใช้งานด้วย property ที่จำเป็น ไม่ต้องประกอบกลไกภายในเอง |
| Site Map | Route → Screen → Page → AppComponent แบบ Tree view |
| Collection Set | จัดการ Database/Collection และสร้าง Form อัตโนมัติจาก Collection |
| Screen | เริ่ม Memory ใหม่เมื่อ Navigate Route หรือ Reload; Layout ห้าส่วน, Menu, Popup, CSS; Onload → SetLayout → ChangePage พร้อม Complete/After ตามที่กำหนด |
| Page | เลือก Layout ที่ responsive, ลาก Component ลง Panel, PropertyPage ราย Component; OnloadPage โหลดหลาย Collection แล้ว OnloadPageComplete; กำหนดลำดับโหลด Component |
| Component | ใช้ของเดิมต่อ รองรับ HTML และ Standard ที่ประกอบกัน วางใน Page ได้หลาย instance |
| การใช้ของเดิม | เก็บโค้ด/เอกสาร/ข้อมูลไว้ตรวจและเลือกใช้ ไม่ล้างเริ่มใหม่ทั้งระบบ |

การไม่มีเมนูซ้ายใช้กับ Dashboard หลัง Login ส่วนหน้าจัดการแม่แบบมีเมนูซ้าย และ Layout ของ App ที่สร้างขึ้นขึ้นอยู่กับ Screen ที่ออกแบบ

## 3. โครงสร้างเป้าหมาย

```text
Admin Server                         Customer
     │                                   │
ดูแลบัญชี/สถานะ                    จัดการแม่แบบ
     └───────────── Dev Server ───────────┘
                         │
                      DB_main
     User / Customer / Template / Object / Revision / App registry
                         │
       แม่แบบ revision หนึ่งสร้าง App ได้หลายตัว
                  ┌──────┴──────┐
                App A          App B
                │   │          │   │
     api/form ──┘   │          │   └── api/form → แบบจาก DB_main
                  api/db     api/db
                    │          │
                  DB_A        DB_B
```

### 3.1 ความหมายของ Object

| Object | ความรับผิดชอบ |
|---|---|
| Customer | เจ้าของแม่แบบและ App; มีสถานะบัญชีและโควต้า |
| Template | ชุดแบบที่ Customer ออกแบบ รวม Startup, Module, Route, Screen, Page, Component และ Collection definition |
| App | หน่วยที่รันจริง อ้าง Template/revision พร้อม DB, domain และ runtime configuration ของตัวเอง |
| Screen | วงจรเมื่อเข้า Route; เป็นเจ้าของกรอบห้าส่วนและ Screen Memory |
| Page | เนื้อหาที่เปลี่ยนใน Content; เป็นเจ้าของ Panel, Collection load และ Page Memory |
| Component definition | แบบที่ใช้ซ้ำได้ |
| AppComponent instance | จุดที่วาง Component ใน Page พร้อม property/binding ของตัวเอง |

ชื่อ `Platform` เดิมยังไม่ควรถูกแทนเป็น Customer หรือ Template ทั้งหมดด้วยการเปลี่ยนชื่อ ต้องทำ mapping จากข้อมูลจริง เพราะเดิมมีทั้งบทบาทแม่พิมพ์และขอบเขต tenant อยู่ในกลไกเดียวกัน

### 3.2 ข้อเสนอ Draft / Publish / App revision

1. การแก้ใน Studio บันทึกเป็น Draft พร้อม edit_version
2. Preview ใช้ Draft กับข้อมูลทดสอบ โดยใช้ Renderer/ตัวควบคุม Event ชุดเดียวกับ Runtime
3. Publish ตรวจ reference, binding, event order, module compatibility และ Collection schema แล้วสร้าง revision ที่แก้ย้อนหลังไม่ได้ใน DB_main
4. App ระบุ revision ที่ใช้อย่างชัดเจน สร้าง App แล้วไม่เปลี่ยนตาม Draft อัตโนมัติ
5. อัปเดต App ด้วยการเลือกรุ่นใหม่ ตรวจผลต่างแบบ/DB ก่อนสลับ; ย้อนแบบได้เฉพาะเมื่อเข้ากับ DB schema ปัจจุบัน การย้อนแบบไม่ใช่การย้อนข้อมูลธุรกิจ

ข้อเสนอนี้ช่วยป้องกันการแก้แม่แบบระหว่างออกแบบแล้วกระทบ App ที่กำลังใช้งาน ใช้ revision รวม dependencies ทั้ง Menu/Page/Component/Module; version ของ Screen ตัวเดียวไม่พอ

ข้อเสนอ Clone รอบแรก: คัดลอกโครงสร้าง DB และ seed ที่ระบุไว้ สร้าง config ของ App ใหม่ และอ้าง revision ของแม่แบบ ไม่คัดลอกข้อมูลธุรกิจหรือ credential ของเจ้าของแม่แบบ หากเปิด Public ให้ผู้ใช้อื่นนำไปแก้ เสนอให้ทำสำเนาชุดแบบเข้าแม่แบบของผู้รับพร้อม remap ID ก่อนสร้าง App

## 4. วิเคราะห์ของเดิมและช่องว่าง

| ส่วนที่ตรวจ | หลักฐานและแนวทาง |
|---|---|
| [AdminShell](src/components/admin/AdminShell.tsx) | ปัจจุบันประกอบ Sidebar ใน shell; ต้องแยก Dashboard shell ออกจาก Template editor shell ให้ตรงบทบาท |
| [Auth types](src/types/index.ts), [auth](src/lib/auth/session.ts) | มี GOD และสิทธิ์ราย Site แบบ ADMIN/STAFF/VIEWER; ต้องทำ mapping บทบาทเว็บแม่ใหม่ และคง realm ผู้ใช้ App ลูกแยกกัน |
| [PageDesigner](src/components/page-designer/PageDesigner.tsx) | มีงานแก้ Page/Component และ responsive style แต่มีกรอบห้าส่วนด้วย; แยกกรอบ Screen ออกจาก Panel ของ Page |
| [Registry](src/lib/engine/ComponentRegistry.ts), [PropertyPage](src/components/studio/SharedComponentPropertyPage.tsx), [HTML Studio](src/components/html-studio/HtmlStudioShell.tsx) | ใช้ต่อ เพิ่ม Page data context และ instance binding; ไม่สร้าง editor ทดแทนทุกตัว |
| [platformPageComponents](src/lib/engine/platformPageComponents.ts) | มี definition + override + request/response binding และการบันทึก instance กลับ; ปรับจาก layout_region เป็น Panel และรองรับต้นไม้/HTML อย่างชัดเจน |
| [DynamicPageRenderer](src/components/engine/DynamicPageRenderer.tsx) | ใช้ต่อผ่าน adapter; ต้องเพิ่ม readiness และการยกเลิกงานของ Screen/Page ไม่ถือว่าลำดับ render เท่ากับลำดับโหลดเสร็จ |
| [WorkflowInterpreter](src/lib/engine/WorkflowInterpreter.ts) | ใช้พิจารณา reuse Action แต่ไม่ใช้แทน lifecycle ทั้งหมดโดยไม่ตรวจ; context ปัจจุบันยังไม่ใช่ s ตามแบบใหม่ |
| [tenantDb](src/lib/db/tenantDb.ts) | มีทั้ง DB ตาม Platform และ DB ตาม App รวมถึง bootstrap design config/snapshot ฝั่ง tenant; ต้องจัดแหล่งแบบใหม่และเลือก DB จาก App จริง |
| [publishTenantStructure](src/lib/db/publishTenantStructure.ts) | มีฐานการสร้าง schema จากแบบ; ตรวจการผูก Platform DB ก่อนปรับเป็น migration ของแต่ละ App |
| [siteRegistry](src/lib/runtime/siteRegistry.ts), [run-sites](scripts/run-sites.mjs) | มีทะเบียน domain/port/DB และเปิด process ราย App; ต้องเพิ่มงาน provisioning และ Start/Stop ที่ติดตามผลราย App ได้ |
| [ShareModule](ShareModule.MD) และ [package](packages/sharemodule/package.json) | มี package/facade บางส่วนแล้ว แต่รายงานเดิมระบุว่า Connections, tenant end-user Files, provider Auth, SMTP และ Google/Media ยังไม่ครบ |

จุดที่ควรแก้ก่อนเปิดใช้จริง: getTenantDbByName เดิมสร้าง DB เมื่อไม่พบ จึงควรแยก “provision” ออกจาก “เปิด connection เพื่อใช้งาน” เพื่อไม่ให้การอ่านข้อมูลธรรมดาสร้าง DB โดยไม่ตั้งใจ ส่วน addSiteDomain เดิมมี upsert ที่เปลี่ยน app_id เมื่อชื่อชน ต้องเปลี่ยนเป็นตรวจเจ้าของและปฏิเสธการแย่งชื่อในการจัดสรร domain ใหม่

การตรวจครั้งนี้เป็นการอ่านโค้ดและเอกสาร ไม่ได้เชื่อม Database จริง ทดสอบ Runtime หรือยืนยันผลชุดทดสอบเก่าว่ายังผ่าน ณ ปัจจุบัน

## 5. ข้อเสนอเพิ่มเติมที่ควรกำหนด

### 5.1 ทำ lifecycle ให้มีสัญญาเดียว

```text
เข้า App / Reload → App startup ที่อนุญาตให้ทำฝั่ง browser
  → สร้าง Screen context ใหม่
  → Onload → loadcomplete → AfterLoad
  → SetLayout → SetLayoutcomplete → AfterSetLayout
  → ChangePage → สร้าง context ของ Page เป้าหมาย
      → OnloadPage → โหลด Collection ตามลำดับ
      → OnloadPageComplete → Component พร้อมตาม load_order
      → สลับ Content เป็น Page ใหม่
  → AfterChangePage

Change Page ภายใน Screen → เริ่มจาก ChangePage
Navigate Route → เริ่ม Screen ใหม่ แม้อ้าง Screen definition เดิม
```

ข้อเสนอ On Start Up แยกเป็นการตั้งค่า server เช่น Connection reference และการเริ่ม browser App context; ค่า server โหลดตอน Runtime เริ่มหรือเปลี่ยน config ส่วนงาน browser เริ่มเมื่อเข้า App/Reload ไม่ทำซ้ำเพียงเพราะเปลี่ยน Page ภายใน Screen กติกานี้ต้องปิดรายละเอียดก่อนพัฒนา lifecycle

ข้อเสนอที่ต้องรักษาให้ตรงทุกเอกสาร:

- OnloadPageComplete หมายถึง Collection พร้อม ส่วน Page พร้อมทั้งหน้าหลัง Component พร้อม เป็นคนละจุด
- ทุก Complete ส่งโดย Runtime ครั้งเดียวต่อ invocation; After… รอ async จบก่อนเดินต่อ
- `s.page` ภายในงานโหลดหมายถึง Page เป้าหมายที่กำลังเตรียม โดย context ของ Page เดิมยังแยกอยู่จนสลับสำเร็จ เพิ่มชนิดข้อมูล `data`, `params`, `requestId`, `memory` ให้ตรงกันทั้ง Screen/Page
- แยก desired target ออกจาก current Page; มี instance/request token ตรวจผลเก่า ไม่ให้คลิกรัวแล้วข้อมูลเก่าทับหน้าใหม่
- การยกเลิก request ไม่ได้ย้อนผลข้างเคียงฝั่ง server; งาน load เริ่มต้นควรเป็นการอ่าน ส่วน Action เขียนข้อมูลต้องมีการป้องกันทำซ้ำของตัวเอง
- Timeout และ error ระบุ phase, step และ Object ให้ผู้ใช้เข้าใจ ไม่ยิง Complete ปลอมเพื่อข้ามปัญหา
- การเตรียม Component ล่วงหน้าต้องทดสอบตัวที่วัดขนาด DOM และตัวที่มี side effect; ห้ามถือว่าทุก Component จะพร้อมได้ขณะซ่อนด้วย display:none

### 5.2 เติมความสัมพันธ์ Screen → Page และ Menu

เอกสารเดิมมี default_page_id แต่ยังไม่มีรายการ Page ทั้งหมดของ Screen จึงเสนอ `screen_pages(screen_id, page_id, sort_order)` โดย Page หนึ่งใช้ได้หลาย Screen; default_page_id และเมนู ChangePage ต้องอยู่ในรายการนี้

Site Map อ่านความสัมพันธ์ที่บันทึกจริง ไม่สร้าง tree อีกชุดให้แก้แยกจนข้อมูลไม่ตรงกัน การลาก Page ไปอยู่ใต้ Screen เพิ่มความสัมพันธ์; เลือก default Page ในรายการเดียวกัน

เมนูแต่ละรายการต้องมีชนิดคำสั่งชัดเจน `change_page`, `navigate_route` หรือ `open_popup` พร้อม target และ parameter; การกดสองแบบแรกมีผลต่อ Memory ต่างกัน External URL ค่อยเพิ่มเป็นชนิดแยกเมื่อจำเป็น

Popup รอบแรกลงทะเบียนแบบใน Onload และเปิดตามคำสั่ง โดยไม่เปิดหรือโหลดข้อมูลทุก Popup ตอนเข้า Screen ให้กำหนดข้อมูล/วงจรเมื่อเปิดในงานรายละเอียด Popup ก่อนส่งมอบส่วนนี้

### 5.3 ลดความซับซ้อนของ Studio

- ใช้ PropertyPage ทางเข้าหลักเดียว เชื่อม editor พิเศษ เช่น HTML Studio จากตรงนั้น และระบุ “ต้นฉบับ” / “ตัวที่วาง” ให้เห็นชัด
- ใช้แหล่ง Registry เดียวสำหรับ palette, default props, schema, binding และ renderer validation
- Screen จัดกรอบและวงจร; Page จัด Panel/ข้อมูล; Component จัดส่วนประกอบภายใน ไม่ให้ทั้งสาม editor ตั้งเรื่องเดียวกันซ้ำ
- เริ่มด้วย Grid preset, Panel ชั้นเดียว และ Action list ตามลำดับ; ไม่เพิ่ม Flow graph, Panel tree และระบบ layout หลายชุดพร้อมกัน
- เปลี่ยน Layout/ย้าย Panel ต้องรักษา ID และ binding; แสดง reference ที่ขาดในแผงปัญหาและคลิกไปแก้ได้
- CSS เสนอให้เรียง Main UI → Screen → Page → ค่าเฉพาะ instance พร้อม scope ตามเจ้าของ และกำหนดกติกา specificity ที่ทดสอบได้
- Preview ใช้ engine เดียวกับ Runtime ต่างเฉพาะแหล่ง definition และข้อมูลทดสอบ จึงไม่ต้องแก้พฤติกรรมสองชุด

### 5.4 Collection Set และ Auto Form

ข้อเสนอรอบแรกคือ Collection definition เก็บชื่อ, field, type, required, default, key/relationship, validation และสิทธิ์การอ่าน/เขียน ส่วน physical schema อยู่ใน DB ของ App หลัง provision/migrate

Auto Form อ่าน metadata แล้วสร้าง Component definition ที่แก้ต่อได้ โดยเก็บต้นทาง Collection และ revision ที่ใช้สร้าง การกดสร้างใหม่ต้องแสดงผลต่างและให้เลือกอัปเดต ไม่เขียนทับ Form ที่ปรับแล้วเงียบ ๆ

เพิ่ม filter/sort/pagination แบบมีโครงสร้าง และ binding จาก Collection ก่อนหน้าได้ จำกัดจำนวนแถวเริ่มต้นตามงานจริง การเปลี่ยนชนิด field/ลบ field ต้องมี migration plan ไม่ตีความว่าแก้แบบแล้วลบข้อมูลในทุก App ทันที

### 5.5 การบริหาร App และบัญชี

| เรื่อง | ข้อเสนอสำหรับเริ่มพัฒนา |
|---|---|
| App Detail | แสดงแม่แบบ/revision, domain, DB, runtime state, quota usage, งาน Start/Stop ล่าสุด และข้อผิดพลาด; มีทางไป logs ที่เกี่ยวข้อง |
| Start/Stop | แยก desired state กับสถานะที่ตรวจพบจริง; เริ่มแล้วต้องผ่าน health check จึงแสดง Running; Stop ไม่ลบ DB |
| Provision | งานหลายขั้น: จองชื่อ/port → สร้าง DB → schema/seed → config → runtime → ตรวจพร้อม; เก็บ checkpoint และ retry เฉพาะขั้นที่จำเป็น |
| งานซ้ำ | ใช้ operation ID และการล็อกต่อ App/Customer เพื่อไม่สร้าง DB ซ้ำหรือเริ่ม App เกินโควต้าจากคำขอพร้อมกัน |
| Suspend | เสนอให้ระงับสิทธิ์เข้าเว็บแม่และเพิกถอน session รวม session สวมสิทธิ์ของ Customer นั้น; การหยุด App ที่ให้บริการอยู่เป็นนโยบายแยกและแสดงผลให้ชัดก่อนใช้ |
| สวมสิทธิ์ | เก็บตัวตน Admin ผู้ทำจริงและ Customer ที่ใช้งานแทน; มีแถบแสดงสถานะ/ปุ่มกลับ Admin และบันทึกการกระทำโดยไม่ขยายสิทธิ์ของ Customer |
| โควต้า | เสนอแยกจำนวน App ที่สร้างได้กับจำนวนที่รันพร้อมกัน; ให้ Admin กำหนดค่าและตรวจฝั่ง server ทั้ง Create/Start |
| Domain | จองชื่อไม่ซ้ำ ตรวจเจ้าของและความพร้อมของ DNS/proxy; ถ้า DNS ยังไม่พร้อมแสดง Pending ไม่แสดง URL ว่าพร้อมแล้ว |
| Dashboard | แสดงข้อมูลจริงพร้อมเวลาที่วัด; ถ้าอ่าน metrics ไม่ได้แสดง Unknown/Unavailable ไม่แทนด้วย 0 หรือ Healthy |
| ทรัพยากร Customer | เสนอ CPU, Memory, DB/ไฟล์ storage พร้อมหน่วยและช่วงเวลา; เก็บ metrics background ไม่สแกนทุก DB ตอนเปิด Dashboard |

### 5.6 Public และ Connection

เสนอให้ Public หมายถึงเผยแพร่ชุดแบบที่เลือกให้ผู้อื่นค้นพบ/นำไปใช้ ไม่หมายถึงเปิด DB หรือสิทธิ์แก้แม่แบบ สถานะ Public ของแม่แบบแยกจากสถานะ Publish revision และแยกจาก App ที่เปิดเว็บสาธารณะ

ConnectionString ตั้งผ่าน server-side connection profile; แบบเก็บ reference และชนิดการเชื่อมต่อ ไม่เก็บค่าลับไว้ในชุดที่ส่งให้ Browser หรือชุด Public ผู้รับแม่แบบต้องเลือก Connection ของตนเอง

Module Setting ใช้ลำดับ library default → Platform policy → Template config → App override ที่อนุญาต; property ของ Component ขยายสิทธิ์เกิน policy ไม่ได้ คงเป้าหมายตั้งค่าน้อยจาก ShareModule.MD

## 6. แผนข้อมูลและขอบเขตบริการ

### 6.1 กลุ่มตาราง

| กลุ่ม | แบบข้อมูลที่ใช้/เสนอ |
|---|---|
| Identity | บัญชีและ session เดิมที่ map ใหม่, Customer owner, status, quota และข้อมูลสวมสิทธิ์ |
| Template | templates, template_objects, Startup/Module config, revision และ reference dependencies |
| Route/Screen | template_routes, screens, screen_regions, screen_region_items, screen_popups, screen_event_steps และ screen_pages ที่เสนอเพิ่ม |
| Page | pages, page_panels, page_components, page_collections ตาม Pages.MD |
| Component | definition/property schema ตาม Components.MD โดยปรับใช้ platform_components เดิมเมื่อเหมาะสม |
| Collection/Menu/Popup | definition ของแต่ละชนิด อ้างทะเบียน Object กลาง; ต้องปิด schema ในระยะ foundation โดยไม่เพิ่มแบบซ้ำใน Screen |
| App | app registry, owner, template/revision, connection reference, domain/port/path, desired/observed state, operations และ schema revision |
| Operational data | audit/operation log/metrics มีอายุเก็บและ index ตาม query; แยกจาก definition JSON |
| App DB | business tables และ migration tracking ของ App; แบบหลักยังอยู่ DB_main |

ไม่เพิ่มตารางจริงทุกชื่อทันที ต้อง map กับ schema ปัจจุบันและใช้ migration แบบเพิ่มก่อนย้าย ชื่อ `id` อย่างเดียวไม่รับประกันว่าอ้าง Object ถูกแม่แบบ ต้องตรวจทั้งชนิดและเจ้าของใน service และข้อกำหนด DB

### 6.2 สัญญาบริการที่ต้องมี

| กลุ่ม | Input สำคัญ | Output / ผลลัพธ์ |
|---|---|---|
| Studio save | Object ID, expected edit_version, ข้อมูลที่แก้ | version ใหม่ หรือ conflict พร้อมจุดที่ต้องทบทวน |
| Validate/Publish | Template และ draft version | รายการปัญหาที่ชี้ Object ได้ หรือ revision ใหม่ |
| api/form | App context ที่ server ตรวจแล้ว, revision, Route/Screen/Page target | definition รวมที่อนุญาต พร้อม version/compatibility metadata |
| api/db | App/user context, Collection, operation, query/data | ข้อมูลหรือ error ตาม contract; server เลือก DB และตรวจสิทธิ์ |
| Lifecycle | s/context, event, cancellation token | พร้อม/ผิดพลาด/ยกเลิก พร้อม phase/step |
| App operations | App/Customer, คำสั่ง, operation ID | งานที่ติดตามสถานะได้ ไม่อ้างว่าสำเร็จแค่รับคำขอ |
| Shared Module | module config + context + business input | typed result/error ตาม package กลาง |

ชื่อ api/form และ api/db ยังคงเป็นบทบาทตาม CONTEXT; URL จริงให้เลือกหลังสำรวจ routes เดิม เพื่อไม่สร้าง API สองชุดที่ทำงานซ้ำกัน

### 6.3 ประสิทธิภาพและความสอดคล้อง

- เก็บ reference/order เป็นคอลัมน์; ใช้ JSON สำหรับค่าที่ต่างกันตามชนิด Object และมี schema ตรวจ ไม่ใช้ JSON ก้อนใหญ่ทั้งแม่แบบเป็นแหล่งแก้ไขเพียงจุดเดียว
- เวลา Runtime ใช้งานให้ประกอบ revision เป็นชุดอ่านได้เร็วและ cache ได้ใน DB_main/ชั้น cache โดยไม่ทำ definition อีกแหล่งที่แก้แยกได้
- cache key รวม App ที่จำเป็น, revision และ module compatibility; Memory, token และข้อมูลผู้ใช้แยกออก
- การโหลด Collection/Component เริ่มแบบ sequential ตามข้อกำหนด วัดเวลาจริงก่อนเพิ่ม parallel group ในอนาคต
- กำหนดเพดาน connection pools ต่อ host และการคืน pool ของ App ที่หยุด ไม่สะสม pool ต่อ App โดยไม่มีขีดจำกัด
- หาก DB_main ติดต่อไม่ได้ เสนอให้ App ที่มี revision cache ใช้ revision เดิมตามนโยบายอายุ cache แต่ App ที่ไม่มีแบบพร้อมต้องแสดง unavailable; ไม่ fallback เป็นแบบจาก App อื่น

## 7. ลำดับ Implement และเกณฑ์ผ่าน

สถานะล่าสุดวันที่ 13 กันยายน 2026: P0–P6 มี checkpoint ที่ implement และ commit แล้วตามลำดับ dependency; P7 เริ่ม inventory tooling แต่ยังไม่มี staging/restore evidence ส่วน P8 ยังไม่เริ่ม การผ่านระยะต้องยึดทั้งโค้ดและผลทดสอบ ไม่ใช่ข้อความสถานะเพียงอย่างเดียว

### P0 — ตรวจ baseline และปิด contract ที่กระทบทั้งระบบ

งาน: สำรวจ schema/ข้อมูล/เส้นทางที่ใช้จริง, บันทึกบทบาทและ Platform mapping, ทำตัวอย่างแม่แบบเล็กหนึ่งชุด และกำหนด context/lifecycle/schema version เป็น typed contract

ปิดรายละเอียดก่อนทำส่วนที่เกี่ยวข้อง: Customer–Template–App ownership, On Start Up, OnloadPageComplete, screen_pages, Collection definition และการอ้าง revision; ใช้ข้อเสนอในแผนนี้เป็นร่างเริ่มต้น

เกณฑ์ผ่าน: มี mapping เดิม→ใหม่, ตัวอย่าง definition ที่ validate ได้, baseline typecheck/lint/test/build พร้อมแยกปัญหาเดิม และแผนสำรอง/คืนข้อมูลก่อน migration

### P1 — Identity, Object registry และการบันทึกแบบ

ขึ้นกับ P0 งาน: ownership guard ฝั่ง server, ทะเบียน Template/Object, ตาราง Screen/Page/Component ที่จำเป็น, transaction/edit_version, reference validation, screen_pages และ adapter แปลงแบบเดิมตัวอย่าง

เกณฑ์ผ่าน: Customer A อ่าน/แก้แบบของ B ไม่ได้; บันทึกแล้วเปิดกลับได้โดย ID/reference ไม่หาย; การแก้พร้อมกันไม่ทับกันเงียบ ๆ; กรณี Standard กับ reusable Component ถูกชนิด

### P2 — วงจร Screen/Page และ Component เดิม

ขึ้นกับ P1 งาน: lifecycle runner, Memory scope, Complete/After, sequential Collection/component load, ready/error/cancel adapter และ renderer ที่แยก Screen frame ออกจาก Page panels

ใช้ definition ตัวอย่างก่อนเพื่อแยกปัญหา Runtime ออกจากปัญหา editor การต่อ api/db ขั้นแรกใช้ข้อมูลทดสอบและ adapter ที่มี contract เดียวกับของจริง

เกณฑ์ผ่าน: Route/Reload เริ่ม Memory ใหม่; ChangePage คง Screen Memory; Complete เรียงถูก; โหลดหลาย Collection; ลำดับโหลดไม่ขึ้นกับตำแหน่ง; คลิกรัวและ failure ไม่ทำให้หน้าเก่าทับใหม่

### P3 — เส้นทางจริงแม่แบบเดียวสร้างสอง App

ขึ้นกับ P1–P2 งาน: revision ขั้นพื้นฐาน, provision DB/registry/config, runtime App context, api/form จาก DB_main, api/db ไป DB ราย App และ schema/seed ที่เลือกไว้

เกณฑ์ผ่าน: App A และ B ใช้แม่แบบ revision เดียวกัน เปิดหน้าได้ และสร้าง/แก้รายการแล้วข้อมูลแยกจริง; restart แล้วข้อมูลอยู่; ดัดแปลง App/Collection ID ในคำขอข้ามขอบเขตไม่ได้; provision retry ไม่สร้างทรัพยากรซ้ำ

นี่คือจุดพิสูจน์สถาปัตยกรรมหลัก ก่อนขยายหน้าจัดการให้ครบ หากไม่ผ่านต้องแก้ข้อนี้ก่อนเพิ่มความสามารถอื่น

### P4 — Template Studio ที่ผู้ใช้ทำงานได้เอง

ขึ้นกับ P2–P3 งาน: เมนูเจ็ดรายการ, Object search, Site Map จาก reference จริง, Screen drag/drop และ Event list, Page Panel/PropertyPage/Collection load order, Component library/HTML เดิม, Collection Set และ Auto Form ขั้นพื้นฐาน

เกณฑ์ผ่าน: ผู้ใช้สร้าง Screen/Page ใหม่และ Form จาก Collection ได้ผ่าน UI โดยไม่แก้ JSON; ย้าย Component ไม่สูญเสียค่า; Page responsive ใน Desktop/Tablet/Mobile; Preview กับ Runtime พฤติกรรมตรงกัน; ไม่มีปุ่มบันทึกที่ทำงานแค่บนหน้าจอ

### P5 — Publish, Connection และ Module Setting

**สถานะ: ผ่านเกณฑ์ในขอบเขต P5 แล้ว** — checkpoint `33a8c7b` ถึง `d2a89ed` ครอบคลุม publish review/diff, App revision isolation, Connection Profile/policy/UI, Module Setting local Auth/Files, runtime permission, Files working path และ Public export แบบตัดข้อมูลลับออก ชุด acceptance รวมของ P5 ผ่าน 15 test files / 59 tests พร้อม typecheck และ lint เฉพาะไฟล์ที่แก้; provider ภายนอกและ Mail/Google/Media ยังคงอยู่ P8 ตามขอบเขตเดิม

ขึ้นกับ P3–P4 งาน: dependency validation ครบ, publish preview/diff, App revision update, connection profiles, config policy, Module Setting และ local Auth/Files ที่เชื่อม realm ของ App จริง

เกณฑ์ผ่าน: แก้ Draft ไม่กระทบ App เดิม; อัปเดต App A ไม่เปลี่ยน B; ทดสอบ module ผ่าน App ที่มีสิทธิ์จริง; revision/config ที่ image ไม่รองรับถูกปฏิเสธพร้อมเหตุผล; Public export ไม่มี credential/ข้อมูลธุรกิจ

Auth/Files ในระยะนี้คือส่วนแรกของ ShareModule ไม่ถือว่าทุก provider เสร็จ หากเปิด registration ที่ต้องส่ง verification/reset ต้องทำ Mail ที่จำเป็นให้พร้อมก่อน

### P6 — Dashboard และการบริหารระบบครบตามบทบาท

**สถานะ: ผ่านเกณฑ์ในขอบเขต P6 แล้ว** — checkpoint `21c8996` ถึง `dfa69fb` และ checkpoint ปิดระยะครอบคลุม Dashboard ตามบทบาท, Customer/App detail, impersonation ที่ตรวจย้อนหลังได้, Suspend policy, quota แบบ atomic, domain readiness, Start/Stop ที่รอ health จริง และ resource metrics แบบ background รวมถึงจำกัด Audit Log ของ Tenant ตาม App/ผู้กระทำ ชุด acceptance รวมของ P6 ผ่าน 17 test files / 62 tests พร้อม typecheck, lint เฉพาะไฟล์ที่แก้ และ production build; การ apply migration/restart service และ rehearsal บน staging เป็นงาน P7 โดยยังไม่มีการเปลี่ยน gateway/Nginx/systemd ในระยะนี้

ขึ้นกับ P1/P3 และใช้ข้อมูลจาก P5 งาน: Dashboard ไม่มีเมนูซ้ายของทั้งสองบทบาท, ตารางแม่แบบ/App, Admin Customer detail, impersonation, Suspend ตามนโยบายที่ปิดแล้ว, quota, domain และ Start/Stop jobs พร้อม health/metrics

โครง Dashboard ทำไว้ตั้งแต่ P1 ได้ แต่ระยะนี้ต้องต่อข้อมูลและคำสั่งจริงครบ

เกณฑ์ผ่าน: แสดงจำนวนถูกตามนิยาม, Start/Stop เปลี่ยน process/state จริง, ชื่อชนถูกปฏิเสธ, คำขอพร้อมกันไม่เกินโควต้า, สวมสิทธิ์กลับ Admin ได้และตรวจย้อนหลังได้, Suspend มีผลตรงนโยบายและไม่เผลอลบข้อมูล

### P7 — ย้ายแอปเดิม ทดลองใช้งาน และเปิดใช้ทีละกลุ่ม

**สถานะ: เริ่ม checkpoint inventory แล้ว ยังไม่ผ่าน P7** — เพิ่ม `npm run migration:inventory` สำหรับ Core DB snapshot แบบ read-only พร้อม metadata checksum, mapping counts และ reference checks; focused tests ผ่าน 5 tests, typecheck และ targeted lint ผ่าน เครื่องมือยังไม่ถูกรันกับ DB จริง และไม่อนุมัติ apply แม้รายงานว่าง ขั้นถัดไปคือ inventory สำเนา staging, asset/binding/style mapping และ backup/restore rehearsal ตาม [คู่มือ inventory](docs/P7_MIGRATION_INVENTORY.md)

Checkpoint เปรียบเทียบ offline: `npm run migration:compare -- before.json after.json` ตรวจรายงานครบ/ไม่ซ้ำ, count/checksum drift, mapping และ reference โดยไม่เชื่อ summary และไม่อนุมัติ apply ชุด inventory/comparison รวมผ่าน 14 tests พร้อม typecheck, targeted lint และ CLI smoke (exit 0/2/1); ยังไม่มีรายงาน staging จริงหรือหลักฐาน preservation ของ payload/asset/style

Checkpoint filesystem asset inventory: `npm run migration:assets -- /path/to/offline-asset-copy` สร้าง manifest relative path/size/SHA-256 และ empty directories จากสำเนาที่หยุดเขียนแล้ว ปฏิเสธ symlink/special file และไม่อนุมัติ apply; ชุด inventory/comparison/assets รวมผ่าน 26 tests ยังไม่รันกับข้อมูล App จริง ไม่ครอบคลุม DB asset/binding/style หรือ restore

Checkpoint asset comparison: `npm run migration:assets:compare -- before-assets.json after-assets.json` ตรวจ schema/path/parent/duplicates/totals/checksum แล้วรายงาน added/removed/content/type changes รวม empty directories; ชุด migration tooling รวมผ่าน 4 files / 38 tests พร้อม typecheck, targeted lint และ scanner-to-comparator CLI smoke (exit 0/2/1) ผลตรงกันไม่อนุมัติ apply และไม่ใช่หลักฐาน staging/restore จริง

Checkpoint legacy semantic diagnostics: adapter รายงาน route ที่ target Page ไม่ตรง default Page ของ Screen และ children/style/templateRef/htmlId/label/actionTriggerId ที่ยังไม่ถูก map พร้อม sourcePath โดยไม่คัดลอก payload ลง diagnostics; ชุด adapter/contract/migration ผ่าน 6 files / 52 tests, typecheck และ targeted lint ยังไม่ได้แก้ semantic mapping หรือย้ายข้อมูลจริง ต้อง review ต้นฉบับก่อน staging conversion

ขึ้นกับ P4–P6 งาน: migration dry-run, mapping ID/binding/style, เปรียบเทียบหน้าจอ/ข้อมูล, stage app ตัวอย่าง, backup/restore rehearsal และเลือก App ใช้ renderer ใหม่ทีละตัว

เกณฑ์ผ่าน: แอปตัวอย่างเดิมผ่านงานจริง, รายงานจำนวน Object และ reference ตรง, ไม่มีข้อมูลหาย, ย้อนกลับ renderer/config ได้เมื่อ schema รองรับ และมีขั้นคืนข้อมูลสำหรับกรณีที่ต้อง restore

### P8 — ขยาย Shared Module และความสามารถขั้นถัดไป

ขึ้นกับความพร้อม P5/P7 งาน: Mail SMTP/CC/attachment/template, social/directory Auth, Google/Media, worker/release/version ตาม ShareModule.MD โดยจัดลำดับตามงานที่ผู้ใช้จะใช้จริง

เกณฑ์ผ่านรายโมดูล: UI + service + typed contract + ตัวอย่าง + integration กับระบบทดสอบจริง + package/image/version และแนวทาง rollback ครบ; mock หรือ facade อย่างเดียวไม่ถือว่าเสร็จ

## 8. การย้ายระบบโดยรักษาของเดิม

1. ทำ inventory และ mapping ของบัญชี, Platform, App, Page, Component, Collection, domain, asset และ binding พร้อมจำนวนก่อนย้าย
2. เพิ่ม schema/adapter ที่เข้ากันได้ และแยก legacy/new renderer ด้วยค่าของ App; หลีกเลี่ยงการเขียนข้อมูลเดียวพร้อมกันสอง schema โดยไม่มีเจ้าของที่ชัดเจน
3. ทดลองแปลงสำเนาข้อมูลใน staging เก็บ mapping ID ถาวร ตรวจ reference และ checksum ของข้อมูลที่ต้องคงเดิม
4. เปรียบเทียบ Preview/Runtime และทดสอบ CRUD บนสำเนา DB แล้วจึงเลือกย้าย App ตัวอย่าง
5. ก่อนสลับจริง กำหนดช่วงหยุดเขียนสั้น ๆ หรือกลไกตาม delta ที่พิสูจน์แล้ว; สำรอง DB/config และตรวจว่า restore ใช้ได้
6. สลับ App registry ไปยังแบบใหม่ เก็บ read-only snapshot เดิมพร้อม version; เฝ้าดู error และ operation queue
7. เลิกทางเดิมเมื่อไม่มี App/งานเบื้องหลังอ้างอยู่และมี migration note เท่านั้น

งานสร้าง DB, process และ proxy ไม่อยู่ใน DB transaction เดียว ต้องมี operation journal และวิธีชดเชยแต่ละขั้น การ cleanup ต้องระบุทรัพยากรที่งานนั้นสร้างเอง และไม่ลบ DB เดิมของผู้ใช้

## 9. แผนตรวจสอบและเกณฑ์จบ

| ระดับ | สิ่งที่ต้องพิสูจน์ |
|---|---|
| Contract/unit | schema validation, ownership reference, memory lifecycle, event order, binding, cancellation, readiness และ quota race |
| Database integration | DB แยกตาม App, transaction/conflict, migrations, duplicate provision, domain uniqueness และ persistence หลัง restart |
| UI | ทั้งสอง Dashboard, เมนูแม่แบบ, drag/drop, PropertyPage, responsive, Event trace, Auto Form และบันทึก/เปิดใหม่ |
| Runtime | template revision เดียวสอง App, CRUD แยกข้อมูล, ChangePage/Route/Reload, failure/timeout และ stale result |
| Operations | Start/Stop/health, worker/process restart, Suspend/impersonation, unavailable metrics, publish/update และ restore |
| Regression | Component/HTML/ไฟล์/สิทธิ์ของแอปตัวอย่างเดิมยังใช้ได้ตาม mapping |

ใช้คำสั่งที่มีใน [package.json](package.json): `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ตามส่วนที่เปลี่ยน พร้อม integration/UI checks ของพฤติกรรมใหม่ บันทึกความผิดพลาด baseline แยกจาก regression และไม่ถือว่ารายงานผลตรวจเก่าแทนผลปัจจุบันได้

**งานหลักจบเมื่อ** Customer ทำผ่าน UI ได้ตั้งแต่สร้างแม่แบบ → ออกแบบ → Publish → สร้างสอง App → Start → ใช้งานข้อมูลแยกกัน และ Admin ตรวจสถานะ/จัดการ Customer ได้ โดยมีหลักฐานทดสอบ การย้ายข้อมูล และการคืนระบบที่ใช้ได้จริง ส่วน P8 ปิดเป็นรายโมดูลตามขอบเขตที่เลือก

## 10. เรื่องที่ยังต้องปิดก่อนระยะที่เกี่ยวข้อง

รายการนี้ไม่ขวางการเริ่ม inventory และทำตัวอย่าง แต่ต้องได้ข้อสรุปก่อนใช้เป็นนโยบายจริง

| เรื่อง | ค่าเริ่มต้นที่เสนอ | ต้องปิดก่อน |
|---|---|---|
| On Start Up / Memory | server config แยกจาก browser startup; Screen reset ทุก Route/Reload | P2 |
| OnloadPageComplete | Collection พร้อม ก่อนโหลด Component | P2 |
| Template → App | App อ้าง immutable revision; สร้าง DB ใหม่พร้อม schema/seed ที่เลือก | P3 |
| Database เพิ่มเติม | เริ่มหนึ่ง DB ต่อ App ตาม CONTEXT; Connection ภายนอกเป็นทางเลือกที่ค่อยกำหนด | P3 |
| Collection/Form | schema metadata, permission และกติกา regenerate ที่รักษาการแก้ของผู้ใช้ | P4 |
| Public | แชร์แบบที่ publish; ผู้รับทำสำเนาและตั้ง Connection เอง | P5 |
| Suspend | ระงับบัญชีเว็บแม่และ session; หยุด App เป็นนโยบายแยก | P6 |
| Quota | แยก created/running App; Admin เป็นผู้กำหนด | P6 |
| Domain | primary domain ต่อ Customer; App subdomain จองไม่ซ้ำและตรวจ DNS/proxy | P6 |
| ทรัพยากร | CPU/Memory ล่าสุด และ DB/file storage พร้อมเวลาวัด; ระบุวิธีรวมต่อ Customer | P6 |
| การลบ | archive บัญชี/แบบก่อน; purge DB/ไฟล์เป็นงานแยกที่ระบุผลกระทบ | P6/P7 |

ยังไม่เสนอระยะเวลาเป็นจำนวนวันจนกว่า P0 จะระบุขนาดข้อมูล แอปตัวอย่าง และสภาพ baseline ได้ งานแรกที่ควรลงมือคือ P0 แล้วต่อ P1–P3 ให้เส้นทางหลักทำงานจริงก่อนขยายเครื่องมือ

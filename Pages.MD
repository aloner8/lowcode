# Pages — การจัดการ Page ของ App

สถานะ: ข้อกำหนด Page Designer และข้อเสนอการโหลด/จัดเก็บข้อมูล • 12 กันยายน 2026

เข้าจากเมนู **Pages** ใน [หน้าจัดการแม่แบบ](User.MD#22-หน้าจัดการแม่แบบที่เลือก) เพื่อจัดการ Page ของ App ภายในแม่แบบที่เลือก

## ข้อกำหนดที่ยืนยันแล้ว

- เพิ่ม ลบ และแก้ไข Page ได้
- นำ Component มาประกอบเป็น Page ตามความต้องการ
- Page หนึ่งหน้า Load Collection ได้มากกว่าหนึ่งชุด
- ใน Site Map View แสดง Page ภายใต้ Screen และแสดง AppComponent ภายใต้ Page

อ้างอิงส่วนที่เกี่ยวข้อง: [Screen.MD](Screen.MD) และ [Components.MD](Components.MD)

## 1. แนวทางหน้าออกแบบ

**ข้อกำหนดจากผู้ใช้:** เริ่มจากเลือก Style/Layout เช่น Grid หรือ Table ที่รองรับการแสดงผลตามอุปกรณ์และ UI framework จากนั้นลาก Component ลง Panel ที่ต้องการ แต่ละ Component มี PropertyPage และต้องจัดลำดับการโหลดได้ โดยนำของเดิมมาประยุกต์

Page เป็นเนื้อหาที่ Screen นำมาใส่ใน Content จึงออกแบบ Panel ภายใน Page ส่วน Top, Left, Right, Footer และกรอบ Content หลักยังตั้งที่ Screen ตาม [Screen.MD](Screen.MD)

### 1.1 Layout ที่เสนอ

| ตัวเลือก | การใช้งาน | การปรับตามอุปกรณ์ |
|---|---|---|
| Grid — ค่าเริ่มต้น | แบ่ง Panel เป็นหนึ่ง/สอง/สามคอลัมน์ หรือกำหนดสัดส่วน | Desktop ใช้คอลัมน์ตามที่เลือก; จอแคบลดคอลัมน์และเรียงลง |
| Stack / Flex | แบบฟอร์มหรือเนื้อหาเรียงแนวตั้ง/แนวนอน | ห่อบรรทัดหรือเปลี่ยนเป็นแนวตั้งเมื่อพื้นที่ไม่พอ |
| Table layout | จัด Panel เป็นช่องแถว/คอลัมน์ที่สัมพันธ์กัน | เสนอให้ Editor แสดงช่องแบบตาราง แต่เรนเดอร์ด้วย Grid เพื่อยุบเป็นแนวตั้งได้ |

Table layout ในที่นี้ใช้จัดช่องวางเนื้อหา ส่วนตารางข้อมูลจริงให้ลาก TableDataComponent ลง Panel และตั้งพฤติกรรมจอแคบ เช่น เลื่อนแนวนอนภายในตาราง

ใช้ชื่อ Layout ที่ผู้ใช้เข้าใจและให้ Renderer แปลงเป็น CSS/class ตาม UI framework ของโครงการ ไม่ต้องเลือก framework ต่อ Page ค่า responsive อ้าง breakpoint ชุดเดียวกับระบบเดิม และเพิ่ม property เฉพาะขนาดจอเมื่อจำเป็น ไม่แยกบันทึก Page สามชุด

การรองรับอุปกรณ์ต้องตรวจทั้ง Panel และ Component ภายใน เช่น รูปภาพย่อได้ ข้อความตัดบรรทัดได้ และตารางไม่ดันทั้งหน้าให้ล้นจอ

### 1.2 หน้าจอใช้งาน

```text
ชื่อ Page   Layout [Grid ▾]   [Desktop / Tablet / Mobile]   [บันทึก]
┌────────────────┬───────────────────────────┬─────────────────┐
│ ค้น Component  │ Panel 1                   │ PropertyPage    │
│ Standard       │ [ลาก Component ลงที่นี่]  │ ของ Component   │
│ ของแม่แบบนี้   ├─────────────┬─────────────┤ ที่เลือก         │
│                │ Panel 2     │ Panel 3     │ ข้อมูล / Style  │
│                │             │             │ Binding / Event │
│                ├─────────────┴─────────────┤                 │
│                │ [+ เพิ่ม Panel]           │                 │
└────────────────┴───────────────────────────┴─────────────────┘
แท็บ: ออกแบบ | Collection & Load | Preview
```

- เริ่มจาก preset แล้วเพิ่ม Panel ได้ ลากเส้นแบ่งปรับสัดส่วนโดยเก็บเป็นสัดส่วน/ช่วงคอลัมน์แทนพิกัดตายตัว
- ลาก Component จากคลังลง Panel มีเส้นบอกตำแหน่งแทรก ลากย้ายข้าม Panel และเรียงก่อน/หลังได้
- คลิก Component เปิด PropertyPage ตามชนิด มีค่าเริ่มต้นพร้อมใช้ และเลือก Collection/field จากรายการได้
- PropertyPage แก้ค่าเฉพาะ instance ที่วางใน Page; การแก้ Component ต้นฉบับให้เป็นคำสั่งแยกที่ระบุชัด
- มีปุ่มเพิ่มลง Panel, ย้ายขึ้น/ลง และ Undo/Redo เพื่อใช้งานได้โดยไม่ต้องลากอย่างเดียว
- การเปลี่ยน Layout เก็บ Component, ID, property และ binding เดิมไว้ โดยย้ายเข้า Panel ที่ยังมีอยู่; ถ้าต้องรวม/ลบ Panel ให้แสดงตำแหน่งปลายทางก่อนยืนยัน
- ลำดับอ่านบนจอแคบอิงลำดับ Panel และ Component ที่จัดไว้ ไม่ใช้ลำดับโหลดเป็นลำดับแสดงผล

## 2. Event และลำดับโหลด

**ข้อกำหนดจากผู้ใช้:** `OnloadPage` โหลด Collection ได้หลายชุด แล้วส่ง `OnloadPageComplete` และมีการกำหนดลำดับโหลด Component

**ข้อเสนอเรื่องจุด Complete:** ให้ `OnloadPageComplete` หมายถึง Collection ที่ตั้งไว้โหลดเสร็จและพร้อมให้ Component ใช้ จากนั้นจึงเริ่ม Component ตามลำดับ เมื่อ Component พร้อมและ Page แสดงใน Content แล้วจึงเข้าสู่ `AfterChangePage(s)` ของ Screen

```text
Screen.ChangePage → เตรียม Page instance / Page Memory ใหม่
  → OnloadPage
      โหลด Collection ตามลำดับ → เก็บผลตาม alias
  → OnloadPageComplete(s)
  → เริ่ม Component ตาม load_order และรอความพร้อมทีละตัว
  → แสดง Page ที่พร้อมใน Content
  → Screen.AfterChangePage(s)
```

### 2.1 Collection & Load

ตารางใน Editor มีช่อง: **ลำดับ / Collection / ชื่อข้อมูล (alias) / เงื่อนไขและ parameter** ผู้ใช้เพิ่มได้หลายแถวและลากเรียง เช่น โหลด `customer` ก่อน แล้วใช้ `customer.id` โหลด `orders`

- โหลดตามลำดับและรอแต่ละแถวเสร็จในรอบแรก เพื่อรองรับการใช้ผลจากแถวก่อนหน้า ยังไม่เพิ่มตัวจัดการโหลดขนาน
- Collection เดียวกันโหลดหลายเงื่อนไขได้โดยใช้ alias ต่างกัน ผลเก็บใน `s.page.data[alias]` ของ Page ครั้งนี้
- Component ที่ใช้ alias เดียวกันอ่านผลร่วมกัน ไม่เรียก Collection ซ้ำเพียงเพราะมีหลาย Component
- เมื่อไม่มี Collection ให้ผ่าน OnloadPage และส่ง OnloadPageComplete ได้ทันที
- ถ้าโหลดล้มเหลว ให้หยุดและแสดงแถวที่ผิด ไม่ส่ง OnloadPageComplete; กรณีได้รายการว่างถือว่าโหลดสำเร็จ
- Parameter เลือกจาก Route, Page parameter, Screen Memory หรือ Collection แถวก่อนหน้าได้ ไม่อนุญาตให้อ้างผลจากแถวที่ยังไม่โหลด

### 2.2 ลำดับโหลด Component

แสดงรายการ Component ของ Page พร้อมชื่อ Panel และเลขลำดับโหลด ลากเรียงได้โดยตำแหน่งบน Canvas ไม่เปลี่ยน

- `sort_order` = ตำแหน่งแสดงภายใน Panel; `load_order` = ลำดับเริ่มทำงานทั้ง Page เป็นคนละค่า
- เมื่อเพิ่ม Component ให้ต่อท้ายลำดับโหลดโดยอัตโนมัติ ผู้ใช้ปรับเฉพาะกรณีที่มีงานต้องมาก่อน
- โหลดแบบตามลำดับและรอความพร้อมของแต่ละ Component ค่าเริ่มต้นของ Component ที่ไม่มีงาน async คือพร้อมเมื่อ mount และผูก property/data แล้ว
- Component ที่มีงาน async ต้องมีสัญญาณพร้อมจากตัวครอบ Runtime; การเรียง JSX หรือเรียก render ก่อนอย่างเดียวไม่ถือว่ารองรับลำดับโหลด
- ถ้า Component หนึ่งใช้ผลเริ่มต้นของอีกตัว ต้องจัดตัวที่ให้ผลไว้ก่อนและตรวจ dependency ตอนบันทึก; รอบนี้ยังไม่เพิ่มกราฟ dependency แยก
- Component ที่ประกอบซ้อนจากหลายส่วนให้จัดเป็นหนึ่งหน่วยระดับ Page ลำดับภายในไปกำหนดต่อใน [Components.MD](Components.MD)
- Component ที่โหลดผิดพลาดทำให้ Page ยังไม่พร้อม และไม่เรียก AfterChangePage; มีเวลารอสูงสุดจาก Runtime กลางเพื่อไม่ค้างไม่สิ้นสุด รายละเอียดเวลาจะกำหนดตอนพัฒนา
- เมื่อเปลี่ยน Page/Route ระหว่างโหลด ให้ยกเลิกงานและไม่รับผลจาก Page request เก่า ตามกติกาใน Screen.MD

Runtime เตรียม context ของ Page เป้าหมายแยกจาก Page เดิม สามารถ mount ในพื้นที่เตรียมที่ยังไม่ให้โต้ตอบเพื่อรอ Component พร้อม แล้วค่อยแทน Content; ถ้าล้มเหลวให้คง Page เดิม การเตรียมต้องไม่ใช้วิธีซ่อนที่ทำให้ Component วัดขนาดไม่ได้ และต้องถอด instance ที่ยกเลิกออก

## 3. Data Table แบบกระชับ — ข้อเสนอ

ใช้ **4 ตาราง** ใน DB_main โดยชื่อ Page และแม่แบบเจ้าของใช้ `template_objects` ร่วมกับ Screen ตามข้อเสนอใน Screen.MD ชนิดข้อมูลด้านล่างเป็นแนวทาง ยังไม่ได้สร้าง migration

### 3.1 `pages` — ค่าหลักของหน้า

| Field | Type | หน้าที่ |
|---|---|---|
| `id` | uuid, PK/FK template_objects | Object ชนิด page; ใช้ชื่อจากทะเบียนกลาง |
| `layout_kind` | text, default `grid` | grid / stack / table |
| `layout_config` | jsonb, `{}` | จำนวนคอลัมน์, gap, padding และ responsive ของหน้า |
| `style_sheet` | jsonb, `{}` | Style ของ Page/Component ตามรูปแบบเดิมที่ปรับใช้ |
| `edit_version` | integer, default 1 | ตรวจการบันทึกชนกัน |

Page ไม่เก็บ Route และห้าส่วนของ Screen ซ้ำ และยังไม่เพิ่มตาราง Event เพราะรอบนี้ OnloadPage มีงานหลักคือโหลด Collection ตามรายการ

### 3.2 `page_panels` — ช่องวาง Component

| Field | Type | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | Panel ที่ Component อ้างอิง |
| `page_id` | uuid, FK pages | Page เจ้าของ |
| `name` | text | ชื่อ Panel ที่ผู้ใช้เห็น |
| `sort_order` | integer | ลำดับแสดง Panel |
| `layout_props` | jsonb, `{}` | สัดส่วน, span, gap และค่าตามขนาดจอ |

เริ่มจาก Panel ชั้นเดียวเพื่อให้ใช้ง่าย หากต้องจัดซ้อนให้นำ Container/Component ที่ประกอบไว้มาใส่ ไม่เพิ่ม parent tree ของ Panel ในรอบนี้

### 3.3 `page_components` — instance ที่ลากลง Panel

| Field | Type | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | ID คงที่ของ instance; ย้าย Panel แล้วยังใช้ ID เดิม |
| `panel_id` | uuid, FK page_panels | ตำแหน่งและ Page เจ้าของผ่าน Panel |
| `component_id` | uuid, nullable, FK template_objects | อ้าง Component ที่สร้างในแม่แบบ |
| `standard_key` | text, nullable | ชนิด Component Standard จาก Registry |
| `label` | text | ชื่อ instance สำหรับเลือกและจัดลำดับโหลด |
| `sort_order` | integer | ลำดับแสดงภายใน Panel |
| `load_order` | integer | ลำดับโหลดเมื่อรวม Component ทุก Panel ของ Page |
| `props` | jsonb, `{}` | ค่าเฉพาะ instance จาก PropertyPage |
| `bindings` | jsonb, `{}` | การผูก property กับ alias/field, parameter หรือ Memory |

ต้องมี component_id หรือ standard_key **อย่างใดอย่างหนึ่ง** โดยชนิดแรกอ้างแบบร่วม ไม่คัดลอก implementation ส่วน Standard อ้าง Registry ที่มีอยู่ การวาง Component เดิมหลายครั้งสร้างคนละ instance id

### 3.4 `page_collections` — รายการที่ OnloadPage ต้องโหลด

| Field | Type | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | ตัวระบุรายการโหลด |
| `page_id` | uuid, FK pages | Page เจ้าของ |
| `collection_id` | uuid, FK template_objects | Object ชนิด collection |
| `alias` | text | ชื่อผลลัพธ์ที่ Component เลือกใช้ |
| `load_order` | integer | ลำดับโหลด Collection |
| `query_config` | jsonb, `{}` | field ที่ต้องการ, filter, sort, limit/pagination และ parameter binding |

ผลลัพธ์ Collection และสถานะ OnloadPageComplete อยู่ใน Memory ไม่บันทึกกลับตารางแบบหน้า ส่วน query_config เป็นการตั้งค่าแบบมีโครงสร้าง ไม่ใช่ SQL อิสระที่ Browser ส่งไปรัน

### 3.5 กติกาและประสิทธิภาพ

- UNIQUE `(page_id, alias)` ใน page_collections; FK ของ Component/Collection ต้องอยู่ในแม่แบบเดียวกับ Page และถูกชนิด ตรวจผ่าน service และ constraint/trigger ตามแนวทาง Screen.MD
- Index: page_panels `(page_id, sort_order, id)`; page_components `(panel_id, sort_order, id)` และ `(component_id)`; page_collections `(page_id, load_order, id)` และ `(collection_id)`
- อ่าน Panel และ Component ของ Page เป็นชุด รวม Component แล้วเรียง `(load_order, id)` ใน Runtime เพื่อให้ลำดับแน่นอนแม้เลขเท่ากัน ไม่มี request แยกเพื่ออ่านแบบทุก Component
- ตรวจ binding ของ Collection alias และลำดับ dependency ก่อนบันทึก โดยเฉพาะหลังลากเรียง Collection หรือ Component ใหม่
- บันทึกตารางทั้งชุดที่เปลี่ยนใน transaction เดียว พร้อมตรวจและเพิ่ม pages.edit_version; ใช้ sort/load order แบบเว้นช่วง 10, 20, 30 แล้วจัดเลขใหม่เฉพาะกลุ่มเมื่อจำเป็น
- เก็บค่าที่ยืดหยุ่นใน JSON และเก็บความสัมพันธ์หลักเป็น FK; ไม่สร้างคอลัมน์ตาม property ของ Component แต่ละชนิด
- โหลดเฉพาะ field และจำนวนแถวที่ต้องใช้ ตารางข้อมูลขนาดใหญ่ใช้ pagination ไม่โหลดทั้ง Collection ทุกครั้งที่เปลี่ยน Page
- Data query ผ่าน server ที่ตรวจสิทธิ์และเลือก DB ของ App; Memory เริ่มใหม่ต่อ Page และแยกจาก definition cache
- การลบ Page ลบ Panel, instance และรายการโหลดที่เป็นลูกได้ โดยไม่ลบ Component/Collection ต้นฉบับ; หาก Screen หรือ Menu ยังอ้าง Page ต้องแก้ reference ก่อน

## 4. ของเดิมที่นำมาประยุกต์

ตรวจโค้ดใน repository วันที่ 12 กันยายน 2026 พบฐานที่นำมาใช้ต่อได้ดังนี้ รายการนี้ไม่ได้หมายความว่าระบบเดิมรองรับข้อเสนอใหม่ครบแล้ว

| ส่วนเดิม | สิ่งที่ใช้ต่อ / สิ่งที่ต้องปรับ |
|---|---|
| [PageDesigner.tsx](src/components/page-designer/PageDesigner.tsx) | มี Page/Component editing และ Style ตาม breakpoint; ปรับ Canvas จากกรอบห้าส่วนเป็น Panel ของ Page |
| [StudioTreeviewOutline.tsx](src/components/studio/StudioTreeviewOutline.tsx) | มีรายการ Component และ drag payload ของ Standard, Form และ instance; นำมาต่อกับจุดวาง Panel และการย้าย instance |
| [ComponentRegistry.ts](src/lib/engine/ComponentRegistry.ts) | มี Registry และ Palette พร้อม default props; ใช้เป็นแหล่ง Standard Component |
| [SharedComponentPropertyPage.tsx](src/components/studio/SharedComponentPropertyPage.tsx) และ [sharedComponentPropertyRegistry.ts](src/lib/studio/sharedComponentPropertyRegistry.ts) | มี PropertyPage ตามชนิดและกลุ่ม property; ปรับช่องข้อมูลให้เลือก alias/field ของ Page ได้ |
| [ComponentPropertyModal.tsx](src/components/studio/ComponentPropertyModal.tsx) | มี property, data source, งานแก้ HTML และคำสั่งย้าย/ทำสำเนา; รวมประสบการณ์กับ PropertyPage ให้ผู้ใช้เข้าทางเดียว |
| [pageStyleSheet.ts](src/lib/engine/pageStyleSheet.ts) | มี scoped CSS และ tablet/mobile rules; ปรับการอ้าง region เป็น Panel และใช้กับ Preview/Runtime ชุดเดียวกัน |
| [ComponentNode](src/types/index.ts) และ [DynamicPageRenderer.tsx](src/components/engine/DynamicPageRenderer.tsx) | มี instance id, props, children และ renderer; เพิ่มตัวแปลงจากตารางใหม่และตัวควบคุม readiness ตาม load_order |

ของเดิมใช้ children tree ได้ ส่วน Page ใหม่อ้าง Component ที่ประกอบไว้ผ่าน component_id จึงต้องทำ adapter อย่างชัดเจน ไม่ย้ายต้นไม้เดิมทั้งก้อนไปลง props แล้วเกิดแบบซ้ำสองแหล่ง

## 5. ขอบเขตการทำงานรอบแรก

เริ่มจากเลือก Layout → ลาก Component ลง Panel → ตั้ง PropertyPage → เลือก Collection → เรียงลำดับโหลด → Preview โดยยังไม่เพิ่ม Flow editor เต็มรูปแบบหรือ Event อื่นนอก OnloadPage / OnloadPageComplete

เกณฑ์ตรวจเมื่อลงมือพัฒนา: เปลี่ยนขนาดจอแล้ว Panel จัดใหม่ได้, ย้าย Component แล้ว ID/property ไม่หาย, ใช้ Collection มากกว่าหนึ่งชุดได้, Component ใช้ข้อมูลหลัง Complete และเริ่มตามลำดับที่กำหนด, เปลี่ยน Page ระหว่างโหลดแล้วผลเก่าไม่ทับ Page ใหม่

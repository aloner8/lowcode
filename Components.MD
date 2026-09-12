# Components — การจัดการ Component ของ App

สถานะ: ใช้ Component เดิมเป็นฐาน และเสนอส่วนเชื่อมเข้ากับ Pages • 12 กันยายน 2026

เข้าจากเมนู **Components** ใน [หน้าจัดการแม่แบบ](User.MD#22-หน้าจัดการแม่แบบที่เลือก) เพื่อจัดการ Component ของ App ภายในแม่แบบที่เลือก

## ข้อกำหนดที่ยืนยันแล้ว

- เพิ่ม ลบ และแก้ไข Component ได้
- ใช้ HTML ในการสร้าง Component ได้
- นำ Component Standard มาประกอบได้
- นำ Component ไปประกอบเป็น [Page](Pages.MD) ตามความต้องการ
- ใน Site Map View แสดง AppComponent เป็น Level 4 ภายใต้ Page

## 1. แนวทางที่ยืนยัน

**ใช้ของเดิมที่ทำไว้เป็นฐาน แล้วปรับให้วางลงใน Pages ได้** คงเครื่องมือสร้าง/แก้ Component, HTML และ PropertyPage ที่มีอยู่ โดยเชื่อมกับ Panel, instance, binding และลำดับโหลดตาม [Pages.MD](Pages.MD)

Component ต้นฉบับเป็นแบบที่ใช้ซ้ำได้ ส่วน AppComponent ที่แสดงภายใต้ Page ใน Site Map คือ instance ที่วางจริงใน Page นั้น แบบเดียววางได้หลายครั้งและหลาย Page แต่แต่ละ instance มี ID, property และสถานะของตัวเอง

## 2. การนำ Component ไปวางใน Page

1. สร้างหรือแก้ Component ผ่านเมนู Components ด้วยเครื่องมือเดิม แล้วบันทึกเป็น Object ของแม่แบบ
2. ใน Page Designer แสดงคลังสองกลุ่ม: **Standard Component** และ **Component ของแม่แบบนี้** พร้อมค้นหาตามชื่อ
3. ลาก Component ลง Panel เพื่อสร้างแถว `page_components` ตาม Pages.MD โดยเก็บ reference ของต้นฉบับ พร้อมค่าเฉพาะ instance
4. คลิก instance เพื่อเปิด PropertyPage เดิมที่ปรับให้รับข้อมูลของ Page ปัจจุบัน
5. เลือก Collection alias/field สำหรับ binding และจัดลำดับโหลดจากแท็บ Collection & Load ของ Page

| การกระทำ | ผลที่ต้องได้ |
|---|---|
| วาง Standard Component | เก็บ `standard_key` จาก Registry |
| วาง Component ของแม่แบบ | เก็บ `component_id` อ้างต้นฉบับ |
| ย้ายระหว่าง Panel ใน Page เดียวกัน | เปลี่ยน Panel/ลำดับแสดง โดยคง instance ID, property, binding และลำดับโหลด |
| ทำสำเนา instance | สร้าง ID ใหม่และสำเนาค่าเฉพาะ instance โดยยังอ้าง Component ต้นฉบับเดียวกัน |
| ลบ instance ออกจาก Page | ลบเฉพาะจุดที่วาง ต้นฉบับยังอยู่ในคลัง |
| แก้ผ่าน PropertyPage ใน Page | แก้เฉพาะ instance ที่เลือก |
| เปิดแก้ Component ต้นฉบับ | แสดงว่าเป็นการแก้แบบร่วมและแสดง Page ที่ใช้งานอยู่ |

ช่วงเวลาที่การแก้ต้นฉบับมีผลต่อ App ที่รันอยู่ให้ใช้กติกา version/publish ของขา Runtime ยังไม่ถือว่าบันทึกแล้วเปลี่ยนทุก App ทันที

## 3. PropertyPage และการผูกข้อมูล

ใช้รูปแบบ PropertyPage ตามชนิด Component ที่มีอยู่ โดยเพิ่มบริบทของ Page ให้เลือกค่าได้ง่าย

| ส่วน | แนวทาง |
|---|---|
| Property | ใช้ field, กลุ่ม และค่าเริ่มต้นจาก Registry/แบบ Component เดิม |
| Style | ใช้การตั้งค่าเดิม พร้อมปรับตามขนาด Panel และ breakpoint ของ Page |
| Input / Data | เลือก alias/field ที่ OnloadPage โหลดไว้ เช่น `orders.rows` หรือเลือก Page parameter / Memory |
| Output / Event | ใช้ความสามารถ event เดิม โดยผูกผลลัพธ์กับปลายทางใน Page; ไม่เพิ่มวงจร Event ใหม่ในรอบนี้ |

ข้อเสนอรูปแบบ binding ของ instance คือ `bindings.inputs` สำหรับ property ขาเข้า และ `bindings.outputs` สำหรับผลลัพธ์/event ขาออก โดยทำ adapter ให้เข้ากับ request_bindings/response_bindings เดิม ไม่เก็บข้อมูลชุดเดียวกันซ้ำทั้งใน props และ bindings

ลำดับค่าที่ใช้คือค่าเริ่มต้น Standard → ค่าเริ่มต้นของ Component ต้นฉบับ → props ของ instance → ค่า input binding สำหรับ field ที่ผูกไว้ เมื่อ binding มีค่า null ให้ใช้ null ตามชนิด field ไม่ย้อนกลับค่าเดิมเงียบ ๆ; หาก reference ไม่ถูกต้องให้แจ้ง field ที่ต้องแก้

Component แบบประกอบกำหนด public property ที่เปิดให้ Page ตั้งได้ และผูก property นั้นกับส่วนภายใน เช่น `title` ไปยังหัวข้อ หรือ `rows` ไปยัง Table ภายใน โดยไม่ต้องเปิดแก้ต้นไม้ภายในทุกครั้งที่นำไปวาง

เมื่อใช้ Collection alias จาก Page ให้ใช้ผลที่ Page โหลดมา ไม่โหลดซ้ำจาก dataSource เดิมโดยอัตโนมัติ ส่วน Component ที่มีการค้นหา/แบ่งหน้า/บันทึกข้อมูลภายหลังยังใช้ความสามารถเดิมผ่าน service ที่เหมาะสม

## 4. การเชื่อม Renderer และลำดับโหลด

เพิ่มตัวแปลงจาก `page_components` เป็น ComponentNode ที่ Renderer เดิมเข้าใจ แล้วครอบการเริ่มทำงานตาม `load_order` ของ Page

```text
Component definition + instance props / bindings
  → ComponentNode สำหรับ instance นี้
  → รอ Page.OnloadPageComplete
  → เริ่มตาม load_order → แจ้งพร้อม / ผิดพลาด
  → เมื่อทุกตัวพร้อม Page จึงเข้าสู่ Screen.AfterChangePage
```

- รักษา `id`, `type`, `props`, `style`, `children` และ action binding ที่จำเป็นของโครงสร้างเดิมผ่าน adapter
- Component แบบ HTML ใช้ HTML Studio เดิมและเอกสารต้นฉบับเดิม; Component แบบประกอบใช้ต้นไม้ภายในจาก definition
- Component ที่ไม่มีงาน async พร้อมเมื่อ mount และผูกข้อมูลแล้ว ส่วนที่มีงาน async ต้องเชื่อมสัญญาณ ready/error เข้ากับตัวควบคุมของ Page การเรียง render อย่างเดียวไม่เพียงพอ
- Component แบบประกอบเป็นหนึ่งหน่วยโหลดของ Page และพร้อมเมื่อส่วนภายในที่จำเป็นพร้อม รายละเอียดลำดับภายในจะกำหนดเพิ่มภายหลัง
- สถานะภายใน instance เริ่มใหม่ตาม Page instance และไม่ใช้ร่วมกับการวางต้นฉบับเดียวกันที่อื่น
- เมื่อ Page ถูกยกเลิกหรือถอดออก ให้ยกเลิกงานค้างและถอด listener/timer ของ instance ตามที่ Component ใช้งาน
- HTML ID, CSS scope และ ID ของ node ภายในต้องแยกตาม instance เพื่อให้วางต้นฉบับเดียวกันสองครั้งแล้วไม่ชนกัน รักษา reference ภายในให้ตรงกับ ID ที่แปลงแล้ว
- ให้ความกว้างตาม Panel และใช้ style responsive เดิมร่วมกับ Page; ตรวจ Component ที่มีขนาดตายตัวหรือวัดขนาดตอน mount เป็นรายชนิด

## 5. การจัดเก็บข้อมูล

คงแนวคิดเดิมที่แยก **definition** ออกจาก **instance override** โดยชื่อ/เจ้าของใช้ทะเบียน `template_objects` ตาม Screen.MD และใช้ตาราง `page_components` ตาม Pages.MD สำหรับจุดที่วาง

ข้อเสนอข้อมูลต้นฉบับ `components` มีเพียง:

| Field | หน้าที่ |
|---|---|
| `id` — uuid, PK/FK template_objects | Object ชนิด component |
| `component_type` — text | ชนิดรากที่ adapter/Registry รองรับ |
| `definition` — jsonb | แบบ HTML หรือต้นไม้ Component, style, ค่าเริ่มต้น และ public property mapping |
| `property_schema` — jsonb | field ที่ PropertyPage ของ Component นี้เปิดให้ตั้ง; ใช้ Registry เดิมเป็นค่าเริ่มต้น |
| `edit_version` — integer | version สำหรับการแก้ไขแบบร่วม |

นี่เป็นแบบเชิงตรรกะสำหรับปรับใช้ ยังไม่ใช่คำสั่งสร้างตารางซ้ำกับ `platform_components` เดิม ต้องเลือกวิธีย้าย/ปรับทะเบียนเมื่อทำขา database จริง โดยเก็บ implementation ของ Standard ไว้ในโค้ดตามเดิม

โหลด definition ที่อ้างอิงเป็นชุดและใช้ร่วมกันในระดับแบบ แต่ props, bindings และ Memory แยกตาม instance; ตรวจว่า Object อยู่ในแม่แบบเดียวกับ Page และปฏิเสธการลบต้นฉบับที่ยังมีการอ้างอิง

## 6. ของเดิมที่ใช้ต่อและส่วนที่ต้องปรับ

ตรวจโค้ดใน repository วันที่ 12 กันยายน 2026 พบส่วนต่อไปนี้ โดยยังไม่ได้ทดสอบว่ารองรับวงจรใหม่ครบแล้ว

| ส่วนเดิม | การนำมาใช้ |
|---|---|
| [ComponentRegistry.ts](src/lib/engine/ComponentRegistry.ts) | ใช้ Standard Component, Palette และค่าเริ่มต้นเดิม |
| [ComponentNode](src/types/index.ts) | ใช้โครงสร้าง instance และ children เป็นฐานของ adapter |
| [SharedComponentPropertyPage.tsx](src/components/studio/SharedComponentPropertyPage.tsx) และ [sharedComponentPropertyRegistry.ts](src/lib/studio/sharedComponentPropertyRegistry.ts) | ใช้ PropertyPage เดิม เพิ่มตัวเลือกข้อมูลจาก Page และ schema ของ Component ที่ประกอบเอง |
| [ComponentPropertyModal.tsx](src/components/studio/ComponentPropertyModal.tsx) และ [HtmlStudioShell.tsx](src/components/html-studio/HtmlStudioShell.tsx) | คงเครื่องมือแก้ property และ HTML เดิม |
| [platformPageComponents.ts](src/lib/engine/platformPageComponents.ts) | มีการรวม definition กับ props_overrides, request/response bindings และบันทึก instance กลับอยู่แล้ว; ปรับการอ้าง layout_region เป็น Panel และเชื่อมลำดับโหลด |
| [DynamicPageRenderer.tsx](src/components/engine/DynamicPageRenderer.tsx) | ใช้ Renderer เดิม พร้อมตัวครอบ readiness และ scope ของแต่ละ instance |

ก่อนนำ HTML หรือต้นไม้ Component แบบซ้อนเข้าทาง hydrate เดิม ต้องทำ adapter ให้รองรับรูปแบบนั้นจริง เพราะโค้ด hydrate ที่ตรวจอยู่รวม definition เป็น props ของ node ราก ยังไม่ควรถือว่าขยายต้นไม้ทุกชนิดได้อัตโนมัติ

## 7. เกณฑ์ตรวจเมื่อลงมือพัฒนา

- วาง Standard, HTML และ Component แบบประกอบลง Panel แล้ว Preview และ Runtime แสดงตรงกัน
- วาง Component เดียวสองครั้งแล้วแก้ property/ข้อมูลของตัวหนึ่งไม่กระทบอีกตัว
- ย้าย Panel และบันทึก/เปิดใหม่แล้ว ID, property, binding และลำดับโหลดไม่หาย
- ใช้ Collection ที่ Page โหลดไว้ได้โดยไม่เรียกโหลดซ้ำ และรอความพร้อมตาม load_order จริง
- ถอด Page ระหว่างโหลดแล้วงานเก่าไม่อัปเดต instance ใหม่

รอบนี้ปรับข้อกำหนดเพื่อเชื่อมของเดิมเข้ากับ Pages ยังไม่ได้แก้โค้ดหรือย้ายข้อมูลเดิม

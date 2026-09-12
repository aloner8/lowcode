# Screens — การจัดการ Screen ของ App

สถานะ: ยืนยันแนวคิด Screen และเสนอแบบ Event, ตารางข้อมูล และหน้าจอออกแบบ • 12 กันยายน 2026

เข้าจากเมนู **Screens** ใน [หน้าจัดการแม่แบบ](User.MD#22-หน้าจัดการแม่แบบที่เลือก) เพื่อเพิ่ม ลบ และแก้ไข Screen ของ App ภายในแม่แบบที่เลือก

## ข้อกำหนดที่ยืนยันแล้ว

| ส่วนของ Screen | การตั้งค่า |
|---|---|
| Top | แสดงส่วนบนอย่างไร |
| Left side | แสดงด้านซ้ายอย่างไร |
| Right side | แสดงด้านขวาอย่างไร |
| Content | แสดง Page ใด |
| Footer | แสดงส่วนท้ายอย่างไร |
| Popup | มี Popup ใดเตรียมไว้สำหรับเปิดใช้งานบ้าง |
| CSS หลัก | กำหนด CSS หลักของ Screen |

ใน Site Map View แต่ละ Route ระบุ Screen ที่ใช้ และภายใต้ Screen แสดง Page ต่าง ๆ ตามลำดับ Route → Screen → Page → AppComponent

## 1. ความหมายของ Screen และ Memory

**ข้อกำหนดจากผู้ใช้:** Screen คือการทำงานหลัง Navigate Route หรือ Browser Reload โดยเริ่ม Memory ใหม่ ส่วนการเปลี่ยนเฉพาะ Page ใน Content ใช้เหตุการณ์ ChangePage ภายใน Screen เดิม

| การกระทำ | วงจรที่ทำงาน | Memory |
|---|---|---|
| เข้า Route / Navigate ไป Route ใหม่ | Onload → SetLayout → ChangePage ครั้งแรก | เริ่ม Screen ใหม่ แม้ Route ใหม่จะอ้าง Screen แบบเดียวกัน |
| Browser Reload | Onload → SetLayout → ChangePage ครั้งแรก | เริ่ม Screen ใหม่ |
| เลือกเมนูเปลี่ยนเฉพาะ Page | ChangePage | คง Screen เดิม |

**ข้อเสนอในการแบ่ง Memory:** `s.memory` เก็บค่าระหว่างใช้งาน Screen และ `s.page.memory` เก็บค่าเฉพาะ Page โดยเริ่ม Page Memory ใหม่ทุกครั้งที่ ChangePage สำเร็จ การเริ่ม Memory ใหม่ไม่ใช่คำสั่งลบข้อมูลใน Database หรือออกจากระบบ

Screen definition คือแบบที่บันทึกไว้ ส่วน Screen instance คือการเปิดใช้งานจริงแต่ละครั้ง โดยมี `instanceId` ใหม่เมื่อเข้า Route หรือ Reload ทั้งชื่อ field และรายละเอียดต่อจากนี้เป็นข้อเสนอสำหรับพัฒนา ยังไม่ได้สร้างตารางหรือแก้ Runtime

## 2. ลำดับ Event และจุดแทรกการทำงาน

ใช้ลำดับหลักคงที่ เพื่อให้ผู้ใช้แทรกงานได้โดยไม่ต้องสร้างวงจรโหลดเอง

```text
Navigate Route / Reload → สร้าง s และ Memory ใหม่
  → Onload: เตรียม Layout, Menu, Popup, CSS
  → loadcomplete(s) → AfterLoad(s)
  → SetLayout: ใส่ Menu / Component ลง Layout รอบนอก
  → SetLayoutcomplete(s) → AfterSetLayout(s)
  → ChangePage: ใส่ Page หลักลง Content
  → AfterChangePage(s) → พร้อมใช้งาน

เมนู ChangePage → ChangePage → AfterChangePage(s)
เมนู Navigate Route → เริ่มวงจร Screen ใหม่ที่ Onload
```

### 2.1 Onload

1. อ่านแบบ Screen และค่าเริ่มต้น สร้างแผน Layout ทั้งห้าส่วน
2. ทำรายการงานที่ผู้ใช้แทรกใน `Onload` ตามลำดับ เช่น ตั้งค่า Memory, โหลดข้อมูลเพื่อตัดสินใจเปิด/ปิดส่วนต่าง ๆ หรือเลือก Menu
3. สรุปว่า Top, Left, Right, Footer, Content เปิดหรือปิด และแต่ละส่วนจะใช้ Object ใด
4. เตรียม Menu, Popup และ CSS ตามแผน รวมถึงอ้างอิง Page หลัก โดยยังไม่โหลดข้อมูลหรือแสดง Page ใน Content
5. เมื่อเตรียมครบ ส่ง `loadcomplete(s)` แล้วเรียกและรอ `AfterLoad(s)` ก่อนเข้าสู่ SetLayout

คำว่าเตรียม Popup ในรอบนี้เสนอให้หมายถึงโหลดแบบและลงทะเบียนไว้ ยังไม่เปิด Popup และยังไม่โหลดข้อมูลภายในจนกว่าจะสั่งเปิด

### 2.2 SetLayout

1. ทำรายการงานที่แทรกใน `SetLayout` ตามลำดับ
2. จัดวาง Menu / Component ใน Top, Left, Right และ Footer ตามแผน ส่วน Content เตรียมเป็นพื้นที่ว่างไว้
3. เมื่อส่วนที่เปิดใช้งานจัดวางและพร้อมแล้ว ส่ง `SetLayoutcomplete(s)`
4. เรียกและรอ `AfterSetLayout(s)` จากนั้นจึง ChangePage ครั้งแรกด้วย Page หลัก

### 2.3 ChangePage

1. รับ Page เป้าหมายและค่าที่ส่งมา ครั้งแรกใช้ Page หลักจากแผน Screen
2. ทำรายการงานที่แทรกใน `ChangePage` ตามลำดับ เช่น เตรียม parameter ให้ Page
3. เตรียม Page และข้อมูลที่ Page กำหนดว่าจำเป็นต่อการแสดงครั้งแรก
4. แทนที่ Content ด้วย Page ใหม่และ Page Memory ใหม่ โดยคง Layout รอบนอกและ Screen Memory
5. เมื่อ Page พร้อม เรียก `AfterChangePage(s)`

ChangePage เกิดซ้ำได้โดยไม่เรียก Onload หรือ SetLayout ใหม่ หากผู้ใช้เลือกคำสั่ง Navigate Route ให้เริ่มวงจร Screen ใหม่แทน รายละเอียดการ Load Collection ภายใน Page จะขยายใน [Pages.MD](Pages.MD)

### 2.4 กติกาของงานที่แทรก — ข้อเสนอ

- `Onload`, `AfterLoad`, `SetLayout`, `AfterSetLayout`, `ChangePage`, `AfterChangePage` เป็นช่องที่เพิ่มและลากเรียงงานได้ แต่ลำดับวงจรหลักด้านบนย้ายไม่ได้
- `loadcomplete` และ `SetLayoutcomplete` เป็นสัญญาณจากระบบแบบอ่านอย่างเดียว ไม่ใช่ HTTP response และไม่ใช่งานที่ผู้ใช้ต้องเรียกเอง ชื่อคงตามข้อกำหนดรอบนี้
- งานแต่ละช่องทำตามลำดับและรอ async ให้เสร็จก่อนทำงานถัดไป รวมถึงงานใน After…
- งานเปลี่ยนการเปิด/ปิด Layout หรือ Object ที่จะใช้ให้ทำใน Onload; AfterLoad ใช้ข้อมูลที่เตรียมแล้ว ส่วน AfterSetLayout ใช้อ้างอิงส่วนที่จัดวางแล้ว การเปลี่ยนโครงสร้างหลังจุดนั้นยังไม่อยู่ในรอบนี้
- ค่าเริ่มต้นเมื่อเกิดข้อผิดพลาดคือหยุดวงจร แสดงงานที่ผิด และไม่ส่งสัญญาณสำเร็จของขั้นที่ยังไม่สำเร็จ งานเสริมเลือกให้ข้ามเมื่อผิดพลาดได้
- หาก After… ผิดพลาด สัญญาณ Complete ที่ส่งไปแล้วไม่ถูกย้อนกลับ แต่ไม่เดินต่อไปขั้นถัดไปจนแก้ไขหรือลองใหม่
- เมื่อเปลี่ยน Route ให้ยกเลิกงานที่ยังค้างของ instance เก่า และไม่รับผลลัพธ์เก่ามาแก้ Screen ใหม่
- หากคลิกเปลี่ยน Page ต่อเนื่อง ให้คำขอล่าสุดมีสิทธิ์แทน Content เท่านั้น ผลลัพธ์เก่าห้ามทับ Page ใหม่ และไม่เรียก AfterChangePage สำหรับคำขอที่ถูกยกเลิก
- หลังมี Page แสดงแล้ว หากโหลด Page ถัดไปไม่สำเร็จ ให้คง Page และ Page Memory เดิมไว้ ส่วนการโหลดครั้งแรกที่ล้มเหลวให้แสดงข้อผิดพลาดใน Content
- หากปิด Content ให้ข้าม ChangePage ครั้งแรกและไม่ส่ง AfterChangePage; ปุ่มที่สั่ง ChangePage ต้องแจ้งว่า Content ไม่เปิดใช้งาน หากเปิด Content ต้องระบุ Page หลัก

### 2.5 ข้อมูล `s` ที่ Event ใช้ร่วมกัน

`s` เป็น context ขณะรัน ไม่บันทึกทั้งก้อนลงตาราง Screen และไม่ใช่ข้อมูลที่ส่งออกให้ Browser ได้ทุก field โดยอัตโนมัติ

| Field | ความหมาย |
|---|---|
| `instanceId` | ตัวระบุการเปิด Screen ครั้งนี้ ใช้แยกงานเก่า/ใหม่ |
| `appId`, `templateId`, `screenId`, `definitionVersion` | อ้างอิง App และแบบที่กำลังใช้ |
| `route` | Route, path parameters และ query ที่เข้า Screen |
| `memory` | Memory ของ Screen เริ่มจากค่าเริ่มต้นทุกครั้งที่สร้าง instance |
| `layout` | แผนทั้งห้าส่วน ได้แก่การเปิด/ปิด ขนาด และรายการ Object |
| `menus`, `popups`, `css` | แบบหรือ reference ที่เตรียมไว้ |
| `page` | `currentPageId`, `targetPageId`, `params`, `memory`, `requestId` |
| `event` | ชื่อ Event, งานปัจจุบัน และผลลัพธ์จากงานใน Event รอบนี้ |
| `status`, `error` | ขั้นที่กำลังทำและข้อผิดพลาดล่าสุด |

Editor ให้เลือก field จากรายการแทนการพิมพ์ path เอง ค่า identity และสถานะวงจรเป็นของ Runtime ส่วนงานของผู้ใช้แก้ Memory, parameter และแผนในช่วงที่อนุญาตผ่าน Action ที่กำหนดไว้

## 3. โครงสร้าง Data Table ที่เสนอ

เก็บแบบทั้งหมดใน **DB_main** ตาม [CONTEXT.MD](CONTEXT.MD) ส่วนข้อมูลธุรกิจที่ Page โหลดอยู่ใน DB ของ App แต่ละตัว ข้อเสนอนี้ใช้ชนิดข้อมูลแบบ PostgreSQL เพื่ออธิบายโครงสร้าง ยังไม่ใช่ migration

หลักการคือแยกสิ่งที่ต้องอ้างอิง ค้นหา และจัดลำดับเป็นแถว ใช้ `jsonb` สำหรับ property ที่เปลี่ยนตามชนิด Component/Action ไม่คัดลอกแบบ Page หรือ Component มาซ้ำทุก Screen

### 3.1 ตาราง Object กลางและ Route

ตารางเหล่านี้เป็นฐานร่วมกับเมนูอื่น หากมีทะเบียนที่เทียบเท่าอยู่แล้วให้ปรับใช้แทนการสร้างซ้ำ

| ตาราง | Field ที่เสนอ | Key / ความสัมพันธ์ |
|---|---|---|
| `template_objects` | `id uuid`, `template_id uuid`, `kind text`, `key text`, `name text`, `created_at timestamptz`, `updated_at timestamptz` | PK `id`; UNIQUE `(template_id, kind, key)`; kind เช่น screen, page, component, menu, popup, collection |
| `template_routes` | `id uuid`, `template_id uuid`, `path text`, `screen_id uuid` | PK `id`; UNIQUE `(template_id, path)`; screen_id อ้าง Screen |

`template_objects` รองรับการค้นหา Object ในแม่แบบจากแถบด้านบน ส่วนข้อมูลเฉพาะ Page, Component, Menu และ Popup อยู่ในตารางของแต่ละประเภทและอ้าง `template_objects.id` รายละเอียดประเภทเหล่านั้นยังไม่ขยายในรอบนี้

### 3.2 `screens` — ค่าหลักของ Screen

| Field | Type / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `id` | uuid, PK และ FK ไป template_objects | Object ชนิด screen |
| `default_page_id` | uuid, nullable, FK ไป Object ชนิด page | Page หลัก; ต้องมีเมื่อ Content เปิด |
| `memory_defaults` | jsonb, `{}` | ค่าเริ่มต้น Screen Memory ที่ serialize ได้ |
| `layout_config` | jsonb, `{}` | เช่น gap, padding และรูปแบบ responsive ของกรอบรวม |
| `css_text` | text, `''` | CSS หลักของ Screen |
| `edit_version` | integer, `1` | เพิ่มทุกครั้งที่บันทึก ใช้ตรวจการแก้ไขชนกัน |

ชื่อและเจ้าของแม่แบบอ่านผ่าน template_objects ไม่เก็บชื่อซ้ำใน screens; สถานะ Public เป็นของแม่แบบตาม User.MD ไม่เพิ่มสำเนาสถานะ Public ต่อ Screen

### 3.3 `screen_regions` — ห้าส่วนของ Layout

| Field | Type / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | ตัวระบุส่วน |
| `screen_id` | uuid, FK screens | Screen เจ้าของ |
| `region_key` | text | `top`, `left`, `right`, `footer`, `content` |
| `enabled` | boolean, true | แสดงส่วนนี้โดยค่าเริ่มต้น |
| `visible_when` | jsonb, nullable | เงื่อนไขจากตัวสร้างเงื่อนไข; ว่างหมายถึงใช้ enabled |
| `layout_props` | jsonb, `{}` | ขนาด, min/max, padding, alignment และ overflow |
| `css_class` | text, `''` | class ที่ใช้กับส่วนนี้ |

สร้างให้ครบห้าแถวตั้งแต่สร้าง Screen และ UNIQUE `(screen_id, region_key)` โดย UI ใช้เปิด/ปิดแทนลบแถว เงื่อนไขจริงคำนวณตอน Onload; ผลการคำนวณอยู่ใน s.layout ไม่เขียนทับแบบที่บันทึกไว้

### 3.4 `screen_region_items` — สิ่งที่วางใน Layout

| Field | Type / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | instance ของ Object ที่วาง; Object เดียววางซ้ำได้ |
| `region_id` | uuid, FK screen_regions | ส่วนที่จะวาง |
| `object_id` | uuid, FK template_objects | Menu หรือ Component ที่เลือก |
| `sort_order` | integer | ลำดับภายในส่วน |
| `props` | jsonb, `{}` | ค่าเฉพาะ instance นี้ |
| `bindings` | jsonb, `{}` | การผูก property กับ Memory หรือผลลัพธ์ที่เตรียมไว้ |

Content สงวนไว้สำหรับ Page จาก ChangePage จึงไม่รับรายการในตารางนี้ ในรอบนี้แต่ละส่วนวางรายการแบบเรียงลำดับ หากต้องประกอบซ้อนให้สร้าง Component แล้วนำมาวาง เพื่อไม่สร้างโครงสร้างซ้อนอีกชุดใน Screen

### 3.5 `screen_popups` — Popup ที่เตรียมไว้

| Field | Type / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | ตัวระบุการใช้งาน Popup |
| `screen_id` | uuid, FK screens | Screen เจ้าของ |
| `popup_key` | text | ชื่อสำหรับ Action เปิด Popup |
| `object_id` | uuid, FK Object ชนิด popup | แบบ Popup ที่เตรียมไว้ |
| `props` | jsonb, `{}` | ค่าเฉพาะ Screen นี้ |
| `sort_order` | integer | ลำดับในรายการ Editor |

UNIQUE `(screen_id, popup_key)`; สถานะเปิด/ปิดขณะใช้งานอยู่ใน Memory ไม่อยู่ในตารางนี้

### 3.6 `screen_event_steps` — งานที่แทรกใน Event

| Field | Type / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `id` | uuid, PK | ตัวระบุงานสำหรับแก้ไขและแสดงผล Preview |
| `screen_id` | uuid, FK screens | Screen เจ้าของ |
| `event_name` | text | หนึ่งในหกช่องที่ระบุในหัวข้อ 2.4 |
| `sort_order` | integer | ลำดับทำงานใน Event |
| `label` | text | ชื่อที่ผู้ใช้ตั้ง เช่น “โหลดเมนูตามสิทธิ์” |
| `action_key` | text | Action มาตรฐาน เช่น set_memory, load_collection, set_region, select_menu |
| `target_object_id` | uuid, nullable, FK template_objects | Object เป้าหมายเมื่อ Action ต้องใช้ เช่น Collection หรือ Menu |
| `config` | jsonb, `{}` | parameter และ binding ตาม schema ของ Action |
| `run_when` | jsonb, nullable | เงื่อนไขก่อนรัน; ว่างหมายถึงรันเสมอ |
| `result_key` | text, nullable | ชื่อผลลัพธ์ใน s.event.results ให้ขั้นถัดไปเลือกใช้ |
| `on_error` | text, `stop` | `stop` หรือ `continue` |
| `enabled` | boolean, true | เปิด/ปิดงานชั่วคราว |

ไม่มีตาราง Event header ในรอบนี้ เพราะชื่อช่องเป็นชุดคงที่ Event ที่ไม่มีงานไม่ต้องสร้างแถว เก็บ target สำคัญเป็น FK ส่วน config เก็บค่าแปรผันของ Action; ถ้า config มี reference เพิ่มเติมให้ตรวจการอ้างอิงตอนบันทึกด้วย

ผลลัพธ์ใน s.event.results เริ่มใหม่แต่ละ Event invocation หากต้องใช้ข้าม Event ให้เพิ่ม Action เก็บค่าลง s.memory; result_key ต้องไม่ซ้ำภายใน `(screen_id, event_name)` เมื่อมีค่า

### 3.7 ความสัมพันธ์และข้อกำหนดข้อมูล

```text
Template → Object registry → Screen ← Route
                              ├─ Regions (5) → Region items → Menu / Component
                              ├─ Default Page → Page → AppComponent
                              ├─ Popup registrations → Popup
                              └─ Event steps → Action + Object เป้าหมาย
```

- FK ที่อ้าง Object ต้องอยู่ในแม่แบบเดียวกันและถูกประเภท บังคับผ่าน constraint/trigger ที่ตรวจแม่แบบและ kind พร้อมตรวจใน service; FK ไป id อย่างเดียวตรวจสองเงื่อนไขนี้ไม่ครบ
- การลบ Screen ลบ Regions, Region items, Popup registrations และ Event steps ที่เป็นลูกได้ แต่ห้ามลบ Page/Menu/Component ที่ถูกอ้างอิงตามไปด้วย
- หาก Route ยังอ้าง Screen หรือมีการใช้ Object อยู่ ให้ปฏิเสธการลบและแสดงรายการที่ต้องแก้ reference ก่อน
- บันทึกการแก้ Screen และตารางลูกใน transaction เดียว ตรวจ edit_version ก่อนบันทึกและเพิ่ม version เมื่อสำเร็จ การแก้ชนกันต้องให้ผู้ใช้ทบทวน ไม่ทับเงียบ ๆ
- ตรวจความครบห้า Regions, ชนิด Object, Page หลัก และ field ตาม Action schema ก่อนยอมรับแบบ
- CSS ของ Screen ใช้ขอบเขต container ของ Screen และถอดออกเมื่อออก Route; ค่า ConnectionString จริงยังเป็นการตั้งค่าฝั่ง server ตาม On Start Up ไม่เก็บไว้ใน Screen Memory หรือชุดแบบที่ส่งให้ Browser

### 3.8 Index และการโหลดให้มีประสิทธิภาพ

| ตาราง | Index เพิ่มจาก PK / UNIQUE | ใช้ทำอะไร |
|---|---|---|
| template_objects | `(template_id, name)` | รายการและการค้นหาตามชื่อแบบตรงตัว/เรียงชื่อ; ไม่ถือว่ารองรับค้นหาบางส่วนทุกแบบ |
| template_routes | `(screen_id)` | หา Route ที่ใช้ Screen ก่อนแก้/ลบ |
| screens | `(default_page_id)` | ตรวจ Page ที่ถูกใช้เป็นหน้าหลัก |
| screen_region_items | `(region_id, sort_order, id)`, `(object_id)` | โหลดตามส่วนและลำดับ; ตรวจการใช้งาน Object |
| screen_popups | `(screen_id, sort_order, id)`, `(object_id)` | โหลด Popup ของ Screen; ตรวจการใช้งาน |
| screen_event_steps | `(screen_id, event_name, sort_order, id)`, `(target_object_id)` | โหลดลำดับงานและตรวจ Object เป้าหมาย |

UNIQUE ของ screen_regions มี screen_id นำหน้าอยู่แล้วจึงไม่เพิ่ม index ซ้ำ จัด sort_order เป็น 10, 20, 30 เพื่อแทรกระหว่างแถวได้ง่าย เมื่อช่องว่างหมดค่อยจัดเลขใหม่เฉพาะกลุ่มใน transaction และใช้ id เป็นลำดับรองให้ผลแน่นอน

Runtime โหลดชุดแบบ Screen ด้วยการอ่านตารางลูกเป็นชุด แล้วรวมเป็น definition เดียวผ่าน api/form ไม่ยิง request แยกทุก item และไม่ JOIN ทุกตารางลูกพร้อมกันจนแถวคูณกัน โหลดแบบ Menu/Component/Popup ที่อ้างถึงครั้งเดียวต่อ Object; ข้อมูลของ Page โหลดใน ChangePage

แคช definition ตาม App, Screen และ version ของชุดแบบที่ Runtime เลือกใช้ โดย version ชุดแบบต้องเปลี่ยนเมื่อ dependency เช่น Menu/Component เปลี่ยนด้วย; edit_version ของ Screen อย่างเดียวไม่พอสำหรับแคชชุดรวม รายละเอียด draft/publish อยู่ในขา Runtime ห้ามแคช Memory หรือข้อมูลเฉพาะผู้ใช้รวมกับแบบร่วม

ยังไม่เพิ่ม JSON index ทุก field ให้เพิ่มเมื่อมี query ใช้จริง การค้นหาชื่อแบบบางส่วนหรือภาษาไทยจะเลือกดัชนีจากพฤติกรรมค้นหาและข้อมูลตัวอย่างในขั้นพัฒนา

## 4. หน้าจอสำหรับลากวาง — ข้อเสนอ

ภายในหน้าจัดการแม่แบบ เมื่อเลือก Screens แล้วเปิด Screen ให้พื้นที่หลักมีแท็บ **Layout / Events / Preview** ส่วนแถบด้านบนของแม่แบบยังคงช่องค้นหา Object และสถานะ Public ของแม่แบบ

### 4.1 แท็บ Layout

```text
ชื่อ Screen   Page หลัก [เลือก…]   [Undo] [Redo] [บันทึก] [Preview]
┌──────────────┬────────────────────────────┬─────────────────┐
│ Object       │ Top                        │ Properties      │
│ ค้นหา…       ├───────┬────────────┬───────┤ ของสิ่งที่เลือก │
│ Menus        │ Left  │ Content    │ Right │ เปิด/ปิด        │
│ Components   │       │ Page หลัก  │       │ ขนาด / ระยะห่าง │
│ Pages        ├───────┴────────────┴───────┤ Data binding    │
│ Popups       │ Footer                     │                 │
│              ├────────────────────────────┤                 │
│              │ Popup ที่เตรียมไว้ [+]     │                 │
└──────────────┴────────────────────────────┴─────────────────┘
```

- เริ่มจากกรอบห้าส่วนสำเร็จรูป ผู้ใช้เปิด/ปิดแต่ละส่วนและลากเส้นแบ่งปรับขนาดได้ ส่วนที่ปิดแสดงเป็นพื้นที่จางเฉพาะใน Editor เพื่อเปิดกลับง่าย
- ลาก Menu/Component จากคลังลง Top, Left, Right หรือ Footer; มีเส้นบอกตำแหน่งแทรกและลากเรียงใหม่ได้
- ลาก Page ลง Content เพื่อกำหนด Page หลัก ไม่คัดลอก Component ภายใน Page ลง Screen
- ลาก Popup ลงแถบ “Popup ที่เตรียมไว้” เพื่อเพิ่มการลงทะเบียน
- ไฮไลต์เฉพาะจุดที่รับ Object ชนิดนั้นได้ ป้องกันวางผิดประเภท พร้อมมีปุ่ม “เพิ่มลงส่วน…” และ “ขึ้น/ลง” ให้ทำงานได้โดยไม่ต้องลาก
- คลิก Object เพื่อแก้ property ด้านขวา ดับเบิลคลิกเพื่อเปิดตัวจัดการ Object ต้นฉบับ โดยแสดงให้ชัดว่าการแก้ต้นฉบับมีผลต่อจุดที่ใช้งานร่วมกัน
- CSS หลักและ Memory เริ่มต้นอยู่ในแผงตั้งค่า Screen; การปิด Region เก็บรายการเดิมไว้เพื่อเปิดกลับได้

### 4.2 แท็บ Events

แสดงวงจรสามช่วงเรียงลงมา และแสดง Complete เป็นหมุดระบบที่ย้ายไม่ได้

```text
Onload             [+ เพิ่มงาน]   ← ลาก Action มาเรียง
  โหลดสิทธิ์ → ตั้ง Left ให้แสดง → เลือก Menu
  ● loadcomplete(s)
AfterLoad          [+ เพิ่มงาน]

SetLayout          [+ เพิ่มงาน]
  ● SetLayoutcomplete(s)
AfterSetLayout     [+ เพิ่มงาน]

ChangePage         [+ เพิ่มงาน]
AfterChangePage    [+ เพิ่มงาน]
```

คลัง Action แสดงเฉพาะงานที่ใช้ได้ในช่องนั้น การตั้งค่าด้านขวาเป็นฟอร์มตาม Action พร้อมตัวเลือก Object, field, parameter และผลจากงานก่อนหน้า ไม่บังคับกรอก JSON ผู้ใช้ลากเรียง เปิด/ปิด และตั้งเงื่อนไขงานได้ รอบนี้ใช้รายการเรียงลำดับก่อน ยังไม่เพิ่มเส้นเชื่อม Flow อิสระ

รายการเมนูต้องเลือกชนิดคำสั่งให้ชัด: **Change Page** เลือก Page และ parameter หรือ **Navigate Route** เลือก Route โดย Editor แสดงผลว่าจะคง Screen Memory หรือเริ่มใหม่ ข้อมูลคำสั่งนี้อยู่กับแบบ Menu ไม่ทำสำเนาลงทุก Screen

### 4.3 แท็บ Preview

- จำลองเข้า Route / Reload และเปลี่ยน Page ภายใน Content แยกเป็นปุ่มทดสอบ
- แสดง Event ปัจจุบัน ลำดับงาน ผลสำเร็จ/ผิดพลาด และ Memory ก่อน/หลัง เพื่อให้เห็นการเริ่มใหม่จริง
- ใช้ข้อมูลตัวอย่างหรือสภาพแวดล้อมทดสอบสำหรับ Action ที่เขียนข้อมูล ไม่รันงานธุรกิจจริงเพียงเพราะเปิด Editor
- ทดสอบขั้นต่ำ: โหลดครั้งแรกครบวงจร, ChangePage คง Screen Memory, เปลี่ยน Route เริ่ม Memory ใหม่, คลิกรัวไม่แสดงผลเก่า และงานล้มเหลวไม่ส่ง Complete ผิดขั้น

## 5. ขอบเขตของรอบนี้

ออกแบบเฉพาะ Onload, SetLayout, ChangePage และจุดตอบกลับ/After ที่ผู้ใช้ระบุ รายละเอียดวงจรภายใน Page/Component, การเปิด Popup, นิยาม Menu, ชุด Action เต็ม และการเผยแพร่แบบจะคุยต่อในส่วนที่เกี่ยวข้อง

ตำแหน่งของ On Start Up ระดับ App เทียบกับ Onload ระดับ Screen ยังต้องกำหนดเพิ่มในขั้นถัดไป รอบนี้ยังไม่ถือว่า On Start Up ต้องรันซ้ำทุกครั้งที่เปลี่ยน Route

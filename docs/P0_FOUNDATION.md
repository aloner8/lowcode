# P0 Foundation — Baseline, Mapping และ Contract

วันที่ตรวจ: 12 กันยายน 2026  
Commit ตั้งต้น: `617615e` (`dev`)  
ขอบเขต: P0 ตาม [ImplementPlan.MD](../ImplementPlan.MD)

## 1. ผล baseline

| Gate | ผล | หลักฐานย่อ |
|---|---|---|
| Install | ผ่าน | `npm ci` ติดตั้ง 521 packages; npm รายงาน 39 vulnerabilities (37 moderate, 2 high) |
| TypeScript | ผ่าน | `npm run typecheck` exit 0 |
| Unit tests | ผ่าน | 16 files, 134 passed, 1 skipped ก่อนเพิ่ม contract test |
| ESLint | ผ่านแบบมีหนี้เดิม | exit 0, 0 errors, 81 warnings |
| Production build | ผ่านแบบมี warning | Next.js 16.3.3 build สำเร็จ; Turbopack เตือน dynamic filesystem tracing ที่ `src/lib/storage/tenantStorage.ts:86` |
| Migration integration | ผ่านหลังแก้ baseline | migrations 001–027 รันสำเร็จบน PostgreSQL 17 disposable container |
| Full Compose integration | ยังไม่รัน | Docker Compose หยุดก่อนเริ่มเพราะไม่มี host-owned `AUTH_SECRET`; ไม่สร้าง secret ชั่วคราวเพื่อให้ผลทดสอบดูผ่าน |

ปัญหา baseline ต้องแยกออกจาก regression ของ P1 เป็นต้นไป:

1. React lint warnings กลุ่ม set-state-in-effect, purity, refs, static-components และ exhaustive-deps รวม 81 จุด
2. Build trace ของ tenant storage อาจดึง source/public ทั้งโปรเจกต์เข้า server output
3. Integration test ของ collection procedure ถูก skip เมื่อไม่มี `COLLECTION_PROCEDURE_TEST_DATABASE_URL`
4. Dependency audit มี 2 high และ 37 moderate; ต้อง triage แยก ไม่ใช้ `npm audit fix` แบบเปลี่ยน dependency อัตโนมัติ
5. Fresh database init เดิมล้มที่ migration 012 เพราะอ้าง `apps.seo_settings` ก่อน migration 014; แก้ให้ view ชั่วคราวใน 012 ไม่อ้างคอลัมน์ล่วงหน้า แล้ว 015 สร้าง view ฉบับเต็มตามเดิม

## 2. Inventory ที่ยืนยันจาก repository

- Next.js App Router + TypeScript strict; source 287 files
- PostgreSQL migrations 26 ไฟล์ รวมประมาณ 1,945 บรรทัด
- Core DB เก็บ Platform, App registry, user/membership, normalized Page/Component, Collection Set, route, service และ audit
- Tenant DB bootstrap ปัจจุบันเก็บ runtime snapshot, structure revision, design config และ asset
- `scripts/run-sites.mjs` เปิดหนึ่ง process ต่อ App จาก `site_registry`
- API เดิมใช้ namespace `/api/platforms/...`, `/api/apps/...` และ `/api/runtime/[slug]/...`

รายการนี้เป็น inventory จากโค้ด ไม่ใช่จำนวน row ของระบบจริง เพราะยังไม่ได้เชื่อม DB ในรอบ P0 นี้

## 3. Mapping ของเดิมไปโมเดลเป้าหมาย

| ของเดิม | ความหมายที่ใช้อยู่ | เป้าหมาย | กติกาย้ายรอบแรก |
|---|---|---|---|
| `platform_users` | บัญชี GOD/TENANT_USER | Identity + Customer owner/member | คง ID เดิม; เพิ่ม Customer relation ภายหลัง ไม่เปลี่ยน role ด้วยการ rename ตรง ๆ |
| `platforms` | ทั้ง blueprint และ runtime ทดสอบ | Template draft | คง row เดิมเป็น legacy source; adapter อ่านเป็น Template ก่อนแตก revision |
| runtime columns ใน `platforms` | process/image/snapshot ของการทดสอบ Platform | App operation/runtime state | หยุดเพิ่ม dependency ใหม่; ย้ายแบบ additive เมื่อ P3 พร้อม |
| `platform_modules` | module ต่อ Platform | Template modules | map `platform_id -> template_id`; validate config ตาม module contract |
| `platform_routes` | route ไป page/form/object | Template routes | เพิ่ม `screen_id` ผ่าน mapping; ห้ามเดาจาก `target_id` เมื่อไม่ชัด |
| `platform_pages` | normalized master Page | Page | คง ID; แยก Screen frame ออกจาก `component_tree/page_config` ผ่าน adapter |
| `platform_app_pages` | App override ของ master Page | App revision/override | freeze base revision ก่อนแปลง; ไม่ตาม Draft แบบ implicit |
| `platform_components` | reusable component definition ต่อ owner | Component definition | คง owner/version; map type เป็น `html` หรือ `standard` |
| `platform_pages_components` | instance บน Page | AppComponent instance | `layout_region` map ไป Panel หลังตรวจ; คง instance key และ binding |
| `collection_sets` | collection definition ต่อ owner | Collection definition | คง owner/version; normalize field metadata ก่อนสร้าง physical schema |
| `apps` | tenant app + port/domain/DB | App registry | คง app/DB/domain ID; เพิ่ม template revision, desired/observed state และ operation journal |
| `app_memberships` | สิทธิ์ ADMIN/STAFF/VIEWER ต่อ App | App end-user realm | ไม่ใช้แทน Customer membership; คง realm แยก |
| `runtime_snapshot` ใน Core/Tenant | definition cache/snapshot | compiled immutable revision cache | ระบุ revision/schemaVersion ทุก snapshot; เลิก snapshot ที่ไม่มี provenance ทีละขั้น |
| `site_registry` view | runtime lookup | App runtime lookup | ใช้ต่อผ่าน adapter จน registry ใหม่ผ่าน health/provision test |

ช่องว่างที่ P1/P2 ต้องปิด: Customer entity, Template/Object registry, immutable revision, Screen, `screen_pages`, Panel, Popup, operation journal และ lifecycle runner

## 4. Contract ที่ปิดใน P0

ไฟล์หลัก:

- `src/lib/template/contracts.ts` — typed contract รุ่น `1.0.0`
- `src/lib/template/validateTemplateDefinition.ts` — ตรวจ identity/revision และ reference graph
- `src/lib/template/examples/minimalTemplate.ts` — แม่แบบขั้นต่ำที่ validate ได้
- `tests/templateDefinition.test.ts` — acceptance test ของ contract

กติกาที่ใช้เป็นฐาน:

1. Template ทุกตัวมี `customerId`; App ใน P3 ต้องอ้าง immutable template revision
2. Draft ใช้ `editVersion` และไม่มี revision; Published ต้องมี revision
3. Connection เก็บเป็น server-side profile reference เท่านั้น ไม่มี credential ใน definition
4. Route ชี้ Screen และ `screenPages` เป็นความสัมพันธ์จริงของ Screen → Page
5. Screen มี region ห้าส่วนครบ: header, left, content, right, footer
6. Standard component instance กับ reusable component instance เป็น discriminated union คนละชนิด
7. Page ระบุ Panel, Collection load order และ Component load order แยกจากตำแหน่ง render
8. Runtime context แยก current/desired Page พร้อม request, screen instance และ page instance token
9. Screen memory อยู่ตลอดการ ChangePage แต่เปลี่ยนใหม่เมื่อ Navigate Route/Reload; Page memory เปลี่ยนตาม page instance
10. Complete phase เป็น event ของ Runtime; After phase เดินต่อเมื่อ async action ก่อนหน้าจบเท่านั้น

## 5. ตัวอย่างเส้นทางเล็กสำหรับ P1–P3

`MINIMAL_TEMPLATE_DEFINITION` มี:

- Customer หนึ่งรายและ Template `Contacts` หนึ่งตัว
- Route `/` → Screen `screen.main`
- Screen หนึ่งตัวที่มี region ครบห้าส่วนและ Page `page.contacts`
- Page หนึ่งตัว, Panel หนึ่งตัว, Collection `contacts` หนึ่งชุด
- Standard `DataTableComponent` instance หนึ่งตัว

P3 จะใช้ definition เดียวกันสร้าง App A และ App B โดย provision DB แยกกัน แล้วพิสูจน์ CRUD isolation และ persistence หลัง restart

## 6. แผนสำรองและคืนข้อมูลก่อน migration

1. เก็บ commit SHA, migration revision, schema-only dump, Core DB dump และรายการ App/DB/domain ก่อนเปลี่ยนข้อมูล
2. ใช้ migration แบบ additive: เพิ่ม table/column/index ก่อน, backfill ด้วย operation ID, ตรวจ count/reference แล้วจึงสลับ read path
3. ทุก backfill เก็บ source ID → target ID และ checksum; rerun ต้อง idempotent
4. ใช้ feature flag ต่อ App เพื่อเลือกระหว่าง legacy/new adapter; rollback renderer/config ได้โดยไม่ลบ schema ใหม่
5. ห้าม cleanup DB/domain/file ใน transaction ชดเชย; operation journal ต้องบันทึกทรัพยากรที่งานนั้นสร้างเอง
6. ก่อน cutover จริงต้องพิสูจน์ restore บนสำเนาและบันทึกเวลาที่ใช้ ไม่ถือว่ามีไฟล์ backup เท่ากับ restore ได้
7. การลบ legacy path ทำหลังไม่มี App หรือ background job อ้างอยู่ และหลังผ่านช่วงเฝ้าดูที่ตกลงกัน

คำสั่ง backup จริงต้องรันผ่าน environment/secret injection ของ host และห้ามใส่ credential ใน command line หรือเอกสารนี้

## 7. Gate ก่อนเข้า P1

- [x] mapping เดิม → ใหม่
- [x] typed contract และ schema version
- [x] ตัวอย่าง definition ที่ validate ได้
- [x] baseline typecheck/lint/test/build พร้อมแยกหนี้เดิม
- [x] แผน backup/rollback ก่อน migration
- [x] migration chain และ P1 acceptance SQL บน PostgreSQL 17 ชั่วคราว
- [ ] inventory จำนวน row/reference จาก DB จริง (รอ host-owned runtime secret และ DB พร้อม)

P1 เริ่มงาน additive schema/ownership guard ได้จาก contract นี้ แต่ยังห้าม migration/cutover ข้อมูลจริงจนข้อสุดท้ายผ่าน

# P1 — Customer, Template Registry และ Ownership Guard

วันที่: 12 กันยายน 2026
ขึ้นกับ: [P0_FOUNDATION.md](P0_FOUNDATION.md)

## สิ่งที่เพิ่ม

### Schema แบบ additive

Migration `027_create_customer_template_registry.sql` เพิ่ม:

- `customers` และ `customer_memberships` สำหรับ owner/editor/viewer ของเว็บแม่
- `templates` พร้อม `edit_version`, Public state และช่องเชื่อม legacy Platform
- `template_objects` เป็นทะเบียน Object กลางสำหรับ Startup, Module, Route, Screen, Page, Component, Collection, Menu และ Popup
- `template_screen_pages` เป็นความสัมพันธ์ Screen → Page ที่ตรวจทั้ง Template และชนิด Object
- `template_object_dependencies` สำหรับ reference graph ที่ validate/trace ได้
- `template_revisions` เป็น immutable snapshot พร้อม schema version/digest
- `apps.template_id` + `apps.template_revision_id` แบบ pair เดียวกัน
- view เฉพาะชนิด `template_screens`, `template_pages`, `template_components`

ไม่มีการ rewrite/delete legacy Platform, App, Page, Component หรือ Collection ใน migration นี้

### Ownership และ optimistic edit

- `template_role_of(user, template)` คืน GOD/OWNER/EDITOR/VIEWER จากบัญชีที่ active และ Customer ที่ active
- `save_template_object(...)` ตรวจสิทธิ์ EDITOR ซ้ำใน DB, lock Template, บันทึก Object และเพิ่ม edit version
- update ใช้ `expected_edit_version`; stale writer ได้ SQLSTATE `40001`
- revision มี trigger ปฏิเสธ UPDATE/DELETE
- API guard แยก Customer membership ออกจาก App membership ชัดเจน

### API ขั้นพื้นฐาน

- `GET/POST /api/templates`
- `GET/PATCH /api/templates/:id`
- `GET/POST /api/templates/:id/objects`

การแก้ Template และ Object ต้องส่ง `expectedEditVersion`; conflict ตอบ `409 EDIT_CONFLICT`

### Legacy adapter

`adaptLegacyPlatform()` รักษา Page/instance ID และแยก Standard กับ reusable Component ถ้าหลักฐานชัด Legacy ไม่มี Screen registry จึงสร้าง Screen เดียวและคืน diagnostic `screen_boundary_inferred` แทนการเดาเงียบ ๆ

## หลักฐานทดสอบ

1. migrations 001–027 รันสำเร็จบน clean PostgreSQL 17
2. SQL acceptance ยืนยัน:
   - Customer A มี OWNER บน Template A
   - Customer A ไม่มี role และเขียน Template B ไม่ได้
   - stale edit ถูกปฏิเสธ
   - Screen/Page type สลับกันไม่ได้
   - published revision แก้ย้อนหลังไม่ได้
3. API unit tests ยืนยัน list query ถูก scope ด้วย membership, denied request ไม่อ่าน Template และ conflict คืน 409
4. Legacy adapter test ยืนยัน ID/reference ไม่หายและ Standard/reusable ยังแยกชนิด

ไฟล์ integration: `tests/sql/p1_template_registry_acceptance.sql`

## ข้อจำกัดที่ยังตั้งใจคงไว้

- ยังไม่ backfill Platform จริงเป็น Customer/Template เพราะต้อง inventory owner และ Screen boundary จาก DB จริงก่อน
- ยังไม่มี Publish endpoint; P1 สร้างฐาน revision แต่การ compile/validate/publish อยู่ P3/P5
- ยังไม่มี Template UI ใหม่; P4 จะต่อ API นี้เข้ากับ editor
- ยังไม่ใช้ schema ใหม่กับ runtime App; P2/P3 ต้องผ่าน lifecycle และ App isolation ก่อนสลับ
- Full Docker Compose ยังต้องใช้ host-owned runtime secrets ตาม deployment policy

## เกณฑ์ P1

- [x] Customer A อ่าน/แก้ Template ของ B ไม่ได้ใน API และ DB write path
- [x] Object บันทึก/เปิดกลับด้วย ID เดิม และ reference graph มี FK/validator
- [x] concurrent edit ไม่ทับกันเงียบ ๆ
- [x] Standard/reusable Component แยกชนิดใน contract/adapter
- [x] migration เป็น additive และ clean PostgreSQL init ผ่าน
- [ ] backfill/inventory production-like DB (ต้องมี environment ที่ได้รับอนุญาต)

# Backend Yang — Menu / Collection / Form parity map

เอกสารนี้เป็น canonical mapping ระหว่างระบบ YII ต้นฉบับใน `public/YII/yang-main` กับ Dynamic Player ฝั่ง React โดยอ้างอิง route จากเมนู, `_form.php`, `index.php`, model และ `public/YII/yang.sql` ไม่ได้อนุมานจากชื่อหน้าจอเพียงอย่างเดียว

## CMS

| เมนู / route | Table | Collection | Form | หน้าหลักที่ตรวจ |
|---|---|---|---|---|
| รายการข่าวสาร `/cms/post/index` | `cms_post` | `cms.post.collection` | `cms.post.form` | เรื่อง, หมวดหมู่, วันเผยแพร่, สถานะ, tags, CKEditor, files, gallery |
| หมวดหมู่ข่าว `/cms/category/index` | `cms_category` | `cms.category.collection` | `cms.category.form` | ชื่อหมวดหมู่ |
| หน้าเว็บไซต์ `/cms/page/index` | `cms_page` | `cms.page.collection` | `cms.page.form` | ชื่อหน้า, CKEditor |
| บุคลากร `/cms/personnel/index` | `cms_personnel` | `cms.personnel.collection` | `cms.personnel.form` | ชื่อ, ตำแหน่ง, รูป, กลุ่ม, tier, ลำดับ |
| กลุ่มบุคลากร | `cms_personnel_group` | `cms.personnel-group.collection` | `cms.personnel-group.form` | ชื่อกลุ่ม |
| ภาพสไลด์ `/cms/slide/index` | `cms_slide` | `cms.slide.collection` | `cms.slide.form` | ชื่อ, รายละเอียด, รูป, ลำดับ, show from/to |
| Banner Slideshow | `banner_slide` | `cms.banner-slide.collection` | `cms.banner-slide.form` | หัวข้อ, รายละเอียด, รูป, ลำดับ, show from/to |
| ไฟล์ดาวน์โหลด | `cms_file` | `cms.file.collection` | `cms.file.form` | หมวดหมู่, ชื่อ, multi-file |
| หมวดหมู่ไฟล์ | `cms_file_category` | `cms.file-category.collection` | `cms.file-category.form` | ชื่อ |
| กลุ่มเมนูเว็บไซต์ | `menu_group` | `cms.menu-group.collection` | `cms.menu-group.form` | ชื่อ, สถานะ |
| เมนูเว็บไซต์ | `menu` | `cms.menu.collection` | `cms.menu.form` | กลุ่ม, ชื่อ, content type, link, display, parent, status |
| E-Book | `ebook` | `cms.ebook.collection` | `cms.ebook.form` | หมวดหมู่, ชื่อ, รายละเอียด, cover, ebook file |
| หมวดหมู่ E-Book | `ebook_category` | `cms.ebook-category.collection` | `cms.ebook-category.form` | ชื่อ |
| ร้องเรียน/ร้องทุกข์ | `complaint` | `cms.complaint.collection` | `cms.complaint.form` | ผู้แจ้ง, บัตรประชาชน, ที่อยู่/ติดต่อ, เรื่อง, รายละเอียด, ไฟล์, workflow status |
| ร้องเรียนทุจริต | `corrupt` | `cms.corrupt.collection` | `cms.corrupt.form` | contact + complaint workflow |
| ร้องเรียนบุคลากร | `personalreport` | `cms.personalreport.collection` | `cms.personalreport.form` | ผู้แจ้ง, ผู้ถูกร้อง, สาเหตุ, ความประสงค์ + workflow |
| ขอความช่วยเหลือ | `generalhelp` | `cms.generalhelp.collection` | `cms.generalhelp.form` | contact, เอกสารหลักฐาน, รายละเอียด + workflow |
| เบี้ยยังชีพผู้สูงอายุ | `oldage` | `cms.oldage.collection` | `cms.oldage.form` | วันเกิด, สัญชาติ, สำเนาเอกสาร, ธนาคาร + workflow |
| ขอน้ำเพื่อบริโภค | `usewater` | `cms.usewater.collection` | `cms.usewater.form` | contact, ที่อยู่, สำเนาบัตร + workflow |
| ซ่อมไฟฟ้า | `electric` | `cms.electric.collection` | `cms.electric.form` | contact, lamp id, map + workflow |
| ขอถังขยะ | `getbin` | `cms.getbin.collection` | `cms.getbin.form` | contact, map + workflow |
| เบี้ยพิการ | `handicapped` | `cms.handicapped.collection` | `cms.handicapped.form` | ข้อมูลส่วนตัว/สวัสดิการ/อาชีพ/รายได้/ธนาคาร + workflow |
| คิวออนไลน์ | `onlinequeue` | `cms.onlinequeue.collection` | `cms.onlinequeue.form` | contact, วันที่, หัวข้อ + workflow |

## Smart report / Booking / Forum / Administrator

| กลุ่ม | Table | Collection | Form |
|---|---|---|---|
| แจ้งเหตุ | `report_ticket` | `smartreport.ticket.collection` | `smartreport.ticket-workflow.form` |
| หมวดหมู่แจ้งเหตุ | `report_category` | `smartreport.category.collection` | `smartreport.category.form` |
| ความเร่งด่วน | `report_urgency` | `smartreport.urgency.collection` | `smartreport.urgency.form` |
| สถานะงาน | `report_status` | `smartreport.status.collection` | `smartreport.status.form` |
| บริการจองคิว | `booking_service` | `booking.service.collection` | `booking.service.form` |
| รายการคิว | `booking_queue` | `booking.queue.collection` | `booking.queue.form` |
| กระดาน | `forum_category` | `forum.category.collection` | `forum.category.form` |
| กระทู้ | `forum_thread` | `forum.thread.collection` | `forum.thread.form` |
| ความคิดเห็น | `forum_comment` | `forum.comment.collection` | `forum.comment.form` |
| เมนูหลังบ้าน | `cms_menu` | `administrator.cms-menu.collection` | `administrator.cms-menu.form` |
| ผู้ใช้ | `user` | `administrator.user.collection` | `administrator.user.form` |
| RBAC | `auth_assignment`, `auth_item` | `administrator.rbac-*.collection` | `administrator.rbac-*.form` |

## Runtime rules

- เมนู list เลือก component view ตาม Collection (`datatable`, `list`, `gallery`)
- เมนู create เปิด canonical Form ด้วย `mode=insert`; edit ใช้ standard flow และ `mode=update`
- runtime เก่าที่มีเมนูแต่ไม่มี `resource` จะ reconcile ด้วย `id`, `href`, แล้วจึง `label`
- `html-editor`, `collection-select`, `switch`, `datetime`, `file`, `multi-file`, `tags` และ `color` ต้อง render เป็น control จริง ไม่ fallback เป็น text input
- Source of truth สำหรับ field คือ `_form.php`; required/length/validation ให้ตรวจซ้ำจาก `common/models/*::rules()` ก่อน publish schema

## Visual parity

- Sidebar กว้าง 234px สีเขียวเข้ม, section label ขนาดเล็ก, active มีเส้นทองและพื้นเขียว
- Content ใช้พื้นเทาอมเขียว, breadcrumb และ card border สีเขียวอ่อน
- Form control radius 8px, card radius 16px, primary action สีเขียวเทศบาล
- Responsive ต่ำกว่า 768px ให้ sidebar และ content เรียงแนวตั้ง


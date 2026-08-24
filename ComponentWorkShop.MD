# Component Workshop

## เป้าหมาย

Component Workshop คือพื้นที่แก้ไข Component ภายใน Page โดยตรงจาก DevStudio Explorer เพื่อแยกขอบเขตการทำงานให้ชัดเจนเป็น:

```text
Site Route
└─ Page
   ├─ Page Settings (ปุ่มเฟือง)
   └─ Section Layout
      └─ Component → Component Workshop
```

## Component Template กับ Component Instance

- `templateRef` อ้างถึงแม่แบบที่นำกลับมาใช้ซ้ำ เช่น `component://SlideMenuComponent`
- `id` คือ Instance ID ถาวรของ Component ที่ถูกวางลงใน Page แต่ละตัว แม้ใช้แม่แบบเดียวกันก็ต้องมี ID คนละค่า
- `htmlId` คือ HTML `id` สำหรับ DOM, CSS selector, anchor, event และ automated test ต้องไม่ซ้ำภายใน Page
- `props`, `style`, `actionTriggerId` และ `props.events` เป็นค่าของ instance ไม่แก้แม่แบบกลาง

HTML Source แสดง identity ครบและ parse กลับโดยรักษา Instance ID เดิม:

```html
<Shared:Component
  ref="component://SlideMenuComponent"
  instance-id="admin_sidebar_01"
  id="admin-sidebar"
  data-component-instance-id="admin_sidebar_01"
/>
```

## DevStudio Explorer

เมนู `Pages` ใต้แต่ละ Site Route แสดงข้อมูลสามระดับ:

1. **Page** — ชื่อ Page และปุ่มเฟืองสำหรับเปิด Page Settings
2. **Section Layout** — จัดกลุ่มด้วย `props.__sectionId` และแสดงชื่อจาก `props.__sectionName`
3. **Component** — แสดงชื่อจาก `props.title`, `props.brandName`, `label` หรือ `type` ตามลำดับ

เมื่อคลิก Component ระบบเปิด Component Workshop ในพื้นที่ Detail กลางแทน property popup เดิม

## Component Workshop

### HTML IDE

- ใช้ HTML Studio IDE เดิมในโหมด embedded
- Document มีชนิด `section` และ CSS scope ระดับ `component`
- การ Save เก็บ document ไว้ที่ `component.props.workshopDocument`

### Collection

- เลือก Collection ที่ Component ใช้เป็น data source
- เก็บ Collection ID ที่ `component.props.collectionId`
- เก็บรายละเอียด query/source ที่ `component.props.dataSource`

### Set Style

- กำหนด style เฉพาะ Component ในรูปแบบ JSON
- เก็บที่ `component.style`
- HTML Studio stylesheet ยังคงแยก scope ด้วย `component-{componentId}`

### Events

- กำหนด Workflow trigger ผ่าน `component.actionTriggerId`
- กำหนด event bindings เพิ่มเติมที่ `component.props.events`

## Page Settings

เปิดด้วยปุ่มเฟืองข้างชื่อ Page และรองรับ:

- เลือกโครงสร้าง Layout
- เพิ่ม Section ใหม่
- กำหนด CSS หลักของ Page
- เลือก Collection Sources ที่ Page ใช้งาน
- กำหนด Page Events

ค่าถูกเก็บใน `page.settings`:

```ts
interface PageSettingsValue {
  layoutType?: string;
  globalCss?: string;
  collectionSources?: string[];
  events?: Array<Record<string, unknown>>;
}
```

Section ใหม่เริ่มต้นด้วย `DynamicHtmlComponent` และ metadata:

```ts
{
  __sectionId: "section-name",
  __sectionName: "Section Name"
}
```

## การบันทึก

- Component Workshop แก้ไข `nodes` ผ่าน History Stack จึงรองรับ Undo/Redo และใช้ปุ่ม Save หลักของ Studio เพื่อบันทึก Page
- Page Settings บันทึก `studioPages`, `studioForms` และ `studioCollections` ผ่าน Studio API ทันที
- การเพิ่ม Section ทำให้ Page เป็น dirty และต้องกด Save เพื่อยืนยัน layout

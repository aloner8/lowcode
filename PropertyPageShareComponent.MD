# Property Page for Shared Components

## เป้าหมาย

Shared Component แต่ละชนิดมีวัตถุประสงค์และ properties ต่างกัน จึงต้องมี Property Page ตาม Component Template แทนการแสดง editor แบบเดียวกันทั้งหมด ขณะเดียวกันค่าที่แก้ต้องถูกบันทึกลง Component Instance ของ Page ไม่แก้แม่แบบกลาง

```text
Shared Component Template
  └─ Property Definition (schema/editor metadata)
       └─ Component Instance Property Page
            ├─ Properties เฉพาะชนิด
            ├─ HTML IDE
            ├─ Data Source
            ├─ Style
            └─ Events
```

## Model

### Template definition

Registry อยู่ที่ `src/lib/studio/sharedComponentPropertyRegistry.ts` โดยใช้ `ComponentType` เป็น key และประกาศ:

- ชื่อและคำอธิบาย Property Page
- กลุ่ม property
- field key และ label
- editor type: `text`, `textarea`, `number`, `boolean`, `select`, `json`
- options, placeholder และ default value

### Component instance

ค่าจาก Property Page เก็บใน `ComponentNode.props` ของ instance:

```ts
interface ComponentNode {
  id: string;             // immutable instance ID
  type: ComponentType;    // template type
  templateRef?: string;   // reusable template reference
  htmlId?: string;        // DOM/CSS ID
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  actionTriggerId?: string;
}
```

## Property Page ที่รองรับ

Registry เริ่มต้นครอบคลุม Shared Component ทุกชนิดในระบบ:

- Navigation: `SlideMenuComponent`, `NavMenuComponent`, `EditMenuComponent`
- Data: `TableDataComponent`, `DataTableComponent`, `ListComponent`, `GalleryComponent`, `ChartComponent`
- Form: `FormComponent`, `FieldInputComponent`, `HtmlEditorComponent`
- Content: `CardComponent`, `DynamicHtmlComponent`, `HtmlTemplateComponent`, `FileManagerComponent`
- Container: `TabsContainerComponent`, `AccordionComponent`, `ModalDialogComponent`

## Data Source

Data Source เป็น capability ร่วม แต่ editor สามารถแตกต่างตาม Component:

- Fixed JSON
- Collection
- field mapping ตามความต้องการของ Component
- fallback/sample data สำหรับ Design Preview
- runtime data ส่งผ่าน property เช่น `collectionData`

### กฎ Cardinality

```text
Component Instance 1 ตัว → Collection ได้ 0 หรือ 1 ตัวเท่านั้น
```

- ใช้ `component.props.collectionId` เป็น reference หลักเพียงค่าเดียว
- การเลือก Collection ใหม่ต้อง replace Collection เดิม
- ไม่รองรับ `collectionIds` หรือ Collection reference แบบ array ใน Component
- Collection เดียวสามารถถูก Component หลาย instance อ้างอิงได้
- กฎนี้ใช้กับ Component Instance เท่านั้น; Page Settings อาจประกาศ Collection Sources ของ Page ได้มากกว่าหนึ่งรายการ

ตัวอย่าง `SlideMenuComponent` รองรับการ map `id`, `label`, `href`, `parentId`, `type`, `badge`, `permission` และสร้าง hierarchy จาก flat Collection records

## การเพิ่ม Component ชนิดใหม่

1. เพิ่ม `ComponentType`
2. เพิ่ม renderer ใน `COMPONENT_REGISTRY`
3. เพิ่ม property definition ใน `SHARED_COMPONENT_PROPERTY_REGISTRY`
4. หาก Data Source มีพฤติกรรมเฉพาะ ให้เพิ่ม editor เฉพาะชนิดในแท็บ Collection
5. เพิ่ม validation และ runtime adapter ตาม capability

## การบันทึกและ Validation

- Property Page แก้ draft ของ Component Instance
- ปุ่ม `Save Component` ส่ง draft เข้า History Stack ของ Page
- JSON editor parse ก่อนบันทึก
- HTML ID ตรวจ unique ภายใน Page
- Instance ID เป็น readonly และต้องคงเดิมเมื่อ serialize/parse HTML Source

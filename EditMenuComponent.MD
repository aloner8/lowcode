# EditMenuComponent

Shared Component สำหรับจัดการข้อมูลที่มีโครงสร้างเมนู ใช้ได้ทั้งหน้า Menu Manager เต็มรูปแบบและ field picker ภายใน FormComponent โดยไม่ผูกกับ route หรือหน้าจอใดหน้าจอหนึ่ง

## YII source mapping

- Model: `public/YII/yang-main/common/models/CmsMenu.php`
- Controller: `public/YII/yang-main/backend/modules/administrator/controllers/CmsMenuController.php`
- Manager view: `public/YII/yang-main/backend/modules/administrator/views/cms-menu/index.php`
- Form view: `public/YII/yang-main/backend/modules/administrator/views/cms-menu/_form.php`
- Schema/data: `public/YII/yang.sql` ตาราง `cms_menu`

## Canonical data contract

```ts
interface EditableMenuItem {
  id: string | number;
  parentId?: string | number | null;
  label: string;
  url?: string;
  icon?: string;
  position?: 'top' | 'side';
  sortOrder?: number;
  status?: 0 | 1;
}
```

Mapping กับฐานข้อมูลลูก:

| Component | cms_menu |
|---|---|
| `id` | `id` |
| `parentId` | `parent_id` |
| `label` | `menu_name` |
| `url` | `url` |
| `icon` | `icon` |
| `position` | `position` |
| `sortOrder` | `sort_order` |
| `status` | `status` |

## Modes

### `manager`

หน้าเต็มสำหรับค้นหา แยก Top/Side เพิ่ม แก้ไข เปิด/ปิด ลบ เลื่อนลำดับ และเปลี่ยนระดับ parent-child

### `field`

ใช้เป็น field ภายใน FormComponent สำหรับเลือก menu โดยกำหนด `valueField="id"` หรือ `valueField="url"`; ซ่อนคำสั่ง mutation และคืนค่าผ่าน `onSelect` จึงใช้ซ้ำได้กับ parent menu, link target, menu group mapping และ field ที่อ้างถึงเมนู

## Props

```ts
interface EditMenuComponentProps {
  value?: EditableMenuItem[];
  items?: EditableMenuItem[];
  mode?: 'manager' | 'field';
  maxDepth?: number;                 // default 3 ตาม YII
  allowedPositions?: ('top'|'side')[];
  valueField?: 'id' | 'url';
  selectedValue?: string | number | null;
  onChange?: (items) => void;
  onSelect?: (value, item) => void;
  onAction?: (action, payload) => void;
}
```

## Standard events

- `insert`: เพิ่มเมนู
- `update`: แก้ไข label/url/icon/position/status
- `reorder`: เลื่อนลำดับใน sibling group
- `reparent`: indent/outdent และเปลี่ยน parent
- `toggle`: เปิดหรือปิดใช้งาน
- `delete`: ลบเมนูและ promote children ไป parent เดิม
- `select`: field mode คืนค่าที่เลือก

## Invariants

1. ความลึกไม่เกิน `maxDepth` (YII ใช้ 3)
2. parent และ child ต้องมี position เดียวกัน
3. ห้าม parent เป็นตัวเองหรือลูกหลานของตัวเอง
4. `sortOrder` เริ่มที่ 1 และต่อเนื่องภายใน `(position,parentId)`
5. การ reorder/reparent/delete ต้องบันทึกแบบ transaction ที่ Tenant Database
6. การลบใช้แนวทาง YII: promote children ขึ้น parent เดิม แล้ว normalize sibling order

## Data source และ API contract

Component ไม่เชื่อมฐานข้อมูลโดยตรง แต่ส่ง declarative event ให้ Runtime/API ทำ mutation:

```json
{
  "collectionId": "administrator.cms-menu.collection",
  "dataSource": { "kind": "query", "table": "cms_menu" },
  "events": {
    "insert": "menu.insert",
    "update": "menu.update",
    "reorder": "menu.reorder",
    "reparent": "menu.reparent",
    "toggle": "menu.toggle",
    "delete": "menu.delete"
  }
}
```

API ฝั่ง App ลูกต้องตรวจ invariants ซ้ำเสมอ ห้ามเชื่อ validation จาก browser และควรใช้ transaction สำหรับ tree mutation ทุกครั้ง

## Usage

```tsx
<EditMenuComponent
  mode="manager"
  items={menuRows}
  maxDepth={3}
  onChange={setMenuRows}
  onAction={(action, payload) => runCollectionFlow(action, payload)}
/>
```

```tsx
<EditMenuComponent
  mode="field"
  items={menuRows}
  valueField="id"
  selectedValue={form.parent_id}
  onSelect={(id) => setFieldValue('parent_id', id)}
/>
```

## Implementation status

- Shared React component: `src/components/shared/EditMenuComponent.tsx`
- Exported through shared component index
- Registered as `EditMenuComponent` in ComponentRegistry/ComponentType
- UI layerพร้อม manager/field mode และ client-side tree rules
- ขั้นถัดไป: เพิ่ม `administrator.cms-menu.collection`, Tenant API transaction และเชื่อม Flow events กับฐานข้อมูลจริง

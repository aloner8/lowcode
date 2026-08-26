# หลักการและขั้นตอนสร้าง Platform Master

> สถานะเอกสาร: ข้อกำหนดสำหรับปรับปรุงหน้า `/admin/platforms` ระยะแรก  
> ขอบเขต: การสร้าง Category, การเลือก First Public Page, การสร้าง Platform ผ่าน PostgreSQL procedure และการสร้างโครงสร้างเริ่มต้นของ Platform  
> ยังไม่รวม: การ Spawn Tenant App และรายละเอียดการแก้ไข Module ภายใน Studio

---

## 1. ปัญหาของหน้าปัจจุบัน

หน้า `src/app/admin/platforms/page.tsx` ยังเป็น UI จำลองและใช้ React state ภายในหน้า:

- รายการ Platform ถูกกำหนดคงที่ใน `useState` และไม่ได้อ่านจาก `public.platforms`
- การสร้าง Platform เพิ่มข้อมูลเฉพาะใน state และไม่ได้บันทึกฐานข้อมูล
- รายการ Category ถูกกำหนดคงที่ใน `useState`
- การเพิ่ม Category เพิ่มเฉพาะใน state จึงหายเมื่อ refresh
- ยังไม่มีตัวเลือก `First Public Page`
- ยังไม่มี transaction กลางสำหรับสร้าง Platform พร้อม Page, Module และ Flow ตั้งต้น

หลักการใหม่คือ **ฐานข้อมูลต้องเป็น Source of Truth** หน้าเว็บมีหน้าที่อ่านข้อมูล ส่งคำสั่ง และอ่านข้อมูลใหม่หลังคำสั่งสำเร็จเท่านั้น

---

## 2. ข้อมูลจากเอกสารและ schema ที่มีอยู่

จาก `PlatformModule.MD`, `AppWorkFlow.MD`, `EnterpriseFlow.MD`, `DefaultFlow.MD`, `PlanOverView.MD` และ `supabase/schema.sql` พบข้อมูลที่เกี่ยวข้องดังนี้:

| ตาราง/ข้อมูล | หน้าที่ปัจจุบัน | ใช้ตอนสร้าง Platform ได้หรือไม่ |
|---|---|---|
| `public.platforms` | เก็บ Platform Master, slug, name, category และ theme | ใช้ได้ แต่ต้องเพิ่ม Category FK และ First Public Page mode |
| `public.apps` | เก็บ Tenant App ที่เกิดจาก Platform | ยังไม่ต้อง insert ตอนสร้าง Platform Master |
| `public.page_layouts` | เก็บ Page AST ของ App ลูก โดย `app_id NOT NULL` | ใช้กับ Platform Master โดยตรงไม่ได้ |
| `public.workflow_trees` | เก็บ Flow AST ของ App ลูก โดย `app_id NOT NULL` | ใช้กับ Platform Master โดยตรงไม่ได้ |
| `public.audit_logs` | เก็บประวัติของ App ลูก โดย `app_id NOT NULL` | ใช้บันทึกการสร้าง Platform โดยตรงไม่ได้ |
| `app_workflows` / `workflow_manifest` | ถูกเสนอใน `AppWorkFlow.MD` แต่ยังไม่มีใน schema จริง | ต้องออกแบบเพิ่มก่อนใช้จริง |

ดังนั้นการสร้าง Platform Master ที่สมบูรณ์ต้องมี schema ฝั่ง Platform สำหรับ Category, Modules, Pages และ Flows ไม่ควรสร้าง `apps` ปลอมเพื่อให้ผ่าน Foreign Key

---

## 3. Category ต้องบันทึกฐานข้อมูลจริง

### 3.1 ตารางที่ต้องเพิ่ม

เสนอให้แยก Category ออกจากข้อความใน `platforms.category` เป็นตารางกลาง:

```sql
CREATE TABLE public.platform_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_code VARCHAR(100) NOT NULL UNIQUE,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

เพิ่ม `category_id` ใน `public.platforms`:

```sql
ALTER TABLE public.platforms
ADD COLUMN category_id UUID REFERENCES public.platform_categories(id);
```

คอลัมน์ `platforms.category` เดิมให้เก็บไว้ชั่วคราวระหว่าง migration แล้วค่อยยกเลิกเมื่อย้ายข้อมูลเดิมครบ เพื่อไม่ทำให้ข้อมูลเก่าเสียหาย

### 3.2 ขั้นตอนบนหน้าจอ

1. เมื่อเปิด Modal ให้ query Category ที่ `is_active = true` จากฐานข้อมูล
2. เรียงตาม `category_name`
3. เมื่อกด `Add New Category` ให้ส่งชื่อ Category ไป Server Action/API
4. Server ตรวจค่าว่าง, normalize code และตรวจชื่อ/code ซ้ำแบบ case-insensitive
5. Insert ลง `public.platform_categories`
6. เมื่อ insert สำเร็จ **ต้อง query รายการ Category ใหม่จากฐานข้อมูล**
7. นำผล query ใหม่มาแทน list เดิม และเลือก Category ที่เพิ่งสร้าง

ห้ามเพิ่ม Category เข้า list ด้วย client state เพียงอย่างเดียว เพราะหน้าจอต้องสะท้อนข้อมูลที่ฐานข้อมูลยอมรับและบันทึกแล้วจริง

### 3.3 พฤติกรรมเมื่อเกิดข้อผิดพลาด

- ชื่อว่าง: ไม่ส่งคำสั่งและแสดง validation
- ชื่อซ้ำ: ใช้ Category เดิมหรือแจ้งว่า Category มีอยู่แล้ว
- insert ไม่สำเร็จ: คงข้อความเดิมไว้ให้ผู้ใช้แก้ไข และไม่เปลี่ยน select
- query ใหม่ไม่สำเร็จ: แจ้งว่าบันทึกแล้วแต่โหลดรายการใหม่ไม่ได้ พร้อมปุ่ม Retry

---

## 4. ฟิลด์ First Public Page

เพิ่มฟิลด์แบบ select หรือ radio ชื่อ `First Public Page` ใน Create Platform Modal โดยมีค่าแน่นอน 3 ค่า:

| ค่าในฐานข้อมูล | ข้อความบนหน้าจอ | ความหมาย |
|---|---|---|
| `PUBLIC_HOME` | `Home — Non-private page` | เปิดหน้า Home สาธารณะ ไม่มี Private Page และไม่มี Auth Module |
| `PUBLIC_HOME_WITH_LOGIN` | `Home — Show Login button` | เปิดหน้า Home สาธารณะและแสดงปุ่ม Login มี Auth และพื้นที่ Private |
| `LOGIN_PAGE` | `Login Page` | เปิดหน้า Login เป็นหน้าแรก มี Auth และพื้นที่ Private |

เสนอให้เก็บค่าที่ `public.platforms.first_public_page`:

```sql
CREATE TYPE public.first_public_page_mode AS ENUM (
    'PUBLIC_HOME',
    'PUBLIC_HOME_WITH_LOGIN',
    'LOGIN_PAGE'
);

ALTER TABLE public.platforms
ADD COLUMN first_public_page public.first_public_page_mode
NOT NULL DEFAULT 'PUBLIC_HOME_WITH_LOGIN';
```

คำว่า `First` ควรใช้สะกดนี้ใน code และฐานข้อมูล ไม่ใช้ `Frist`

---

## 5. Module ตั้งต้น

เอกสาร `DesignStudio.MD` และ `AppWorkFlow.MD` อธิบาย Page, Service, Event/Action และ Flow แต่ schema ปัจจุบันยังไม่มีทะเบียน Module ของ Platform จึงต้องเพิ่มตาราง:

```sql
CREATE TABLE public.platform_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    module_code VARCHAR(100) NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    module_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform_id, module_code)
);
```

Module code มาตรฐาน:

- `PAGES`
- `AUTH`
- `FLOW`
- `STYLE`
- `FORM`
- `SERVICE`
- `EVENT`
- `REPORT`

กติกาการสร้าง:

| First Public Page | Modules ที่สร้าง |
|---|---|
| `PUBLIC_HOME` | `PAGES`, `FLOW`, `STYLE`, `FORM`, `SERVICE`, `EVENT`, `REPORT` — ไม่สร้าง `AUTH` |
| `PUBLIC_HOME_WITH_LOGIN` | สร้างครบทั้ง 8 Modules รวม `AUTH` |
| `LOGIN_PAGE` | สร้างครบทั้ง 8 Modules รวม `AUTH` |

สำหรับ `PUBLIC_HOME` ต้องไม่สร้าง Private Page, route guard, auth-check node, login page หรือ auth boot service แอบไว้ใน config

---

## 6. Page และ Flow ตั้งต้นของ Platform Master

`page_layouts` และ `workflow_trees` ปัจจุบันผูก `app_id NOT NULL` จึงเสนอให้เพิ่มตารางของ Master โดยตรง:

```sql
CREATE TABLE public.platform_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    page_slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('PUBLIC', 'PRIVATE')),
    is_entry_page BOOLEAN NOT NULL DEFAULT FALSE,
    component_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
    page_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform_id, page_slug)
);

CREATE UNIQUE INDEX one_platform_entry_page
ON public.platform_pages(platform_id)
WHERE is_entry_page = TRUE;

CREATE TABLE public.platform_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    flow_code VARCHAR(100) NOT NULL,
    flow_name VARCHAR(255) NOT NULL,
    flow_type VARCHAR(50) NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform_id, flow_code)
);
```

### 6.1 `PUBLIC_HOME`

- สร้างหน้า `home` เป็น `PUBLIC` และ `is_entry_page = true`
- หน้า Home ไม่มี Login button โดยค่าเริ่มต้น
- ไม่สร้างหน้า `login`
- ไม่สร้าง Private Page
- Flow เริ่มต้น: `Start Entry -> Public Home -> Event Loop -> Close`
- ไม่มี `Auth Check`, `Route Guard`, `Logout` หรือ Auth Service

### 6.2 `PUBLIC_HOME_WITH_LOGIN`

- สร้างหน้า `home` เป็น `PUBLIC` และ `is_entry_page = true`
- Home component tree มี Login button ที่ navigate ไป `login`
- สร้างหน้า `login` เป็น `PUBLIC`
- สร้างหน้า `dashboard` เป็น `PRIVATE` เริ่มต้น
- Flow เริ่มต้น: `Start Entry -> Public Home -> Login action -> Auth Check -> Private/Public Router -> Event Loop -> Close`
- มี Auth boot service และ route guard

### 6.3 `LOGIN_PAGE`

- สร้างหน้า `login` เป็น `PUBLIC` และ `is_entry_page = true`
- สร้างหน้า `dashboard` เป็น `PRIVATE` เริ่มต้น
- Flow เริ่มต้น: `Start Entry -> Auth Check -> Login/Private Router -> Event Loop -> Close`
- หากมี session ให้ไป `dashboard`; หากไม่มี session ให้อยู่ `login`
- มี Auth boot service และ route guard

---

## 7. Database procedure สำหรับ Create Platform

การสร้าง Platform ต้องเป็นคำสั่ง transaction เดียว เพื่อไม่ให้เกิด Platform ที่มีเพียงบาง Module หรือไม่มีหน้าเริ่มต้น

ชื่อที่เสนอ:

```sql
public.create_platform_blueprint(
    p_platform_name TEXT,
    p_platform_slug TEXT,
    p_category_id UUID,
    p_first_public_page public.first_public_page_mode,
    p_description TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT auth.uid()
) RETURNS UUID
```

ลำดับภายใน procedure:

1. ตรวจ `platform_name` และ normalize/validate `platform_slug`
2. ตรวจว่า slug ไม่ซ้ำ
3. ตรวจว่า Category มีอยู่และ `is_active = true`
4. Insert `public.platforms` และรับ `platform_id`
5. Insert `public.platform_modules` ตามกติกาของ First Public Page
6. Insert `public.platform_pages` และกำหนด entry page เพียงหนึ่งหน้า
7. Insert `public.platform_workflows` โดยเลือก AST template ตาม mode
8. Insert App Workflow/Manifest ตั้งต้นเมื่อมีตารางรองรับแล้ว
9. บันทึก Platform audit log ในตาราง audit ที่รองรับ `platform_id`
10. Return `platform_id`

ถ้าขั้นตอนใดผิดพลาด PostgreSQL ต้อง rollback ทั้ง transaction

### 7.1 Security

- ไม่ให้ Client insert หลายตารางโดยตรง
- เรียก procedure ผ่าน Server Action/API หรือ Supabase RPC
- ตรวจสิทธิ์ `SUPER_ADMIN` หรือ role ที่ได้รับสิทธิ์สร้าง Platform
- ถ้าใช้ `SECURITY DEFINER` ต้องกำหนด `search_path` แบบตายตัวและ revoke execute จาก role ที่ไม่เกี่ยวข้อง
- อย่าเชื่อ `created_by` จาก Browser; ให้ใช้ `auth.uid()` ฝั่งฐานข้อมูล

### 7.2 Idempotency และ constraint

- `platform_slug` ต้อง unique
- `(platform_id, module_code)` ต้อง unique
- `(platform_id, page_slug)` ต้อง unique
- `(platform_id, flow_code)` ต้อง unique
- Platform หนึ่งตัวมี `is_entry_page = true` ได้เพียงหน้าเดียว
- procedure ควร fail เมื่อ slug ซ้ำ ไม่ควร `ON CONFLICT DO NOTHING` เพราะ UI ต้องรู้ว่าสร้างไม่สำเร็จ

---

## 8. Audit Log ที่ต้องปรับ

`public.audit_logs.app_id` ปัจจุบันเป็น `NOT NULL` จึงบันทึกเหตุการณ์สร้าง Platform ไม่ได้ เสนอทางเลือกใดทางเลือกหนึ่ง:

1. สร้าง `public.platform_audit_logs` แยกต่างหาก (ชัดเจนและกระทบของเดิมน้อยที่สุด) หรือ
2. เปลี่ยน audit เป็น polymorphic target เช่น `entity_type`, `entity_id`

ระยะแรกแนะนำ `platform_audit_logs` และบันทึก action `CREATE_PLATFORM` พร้อม snapshot ของ input และ IDs ที่สร้างขึ้น โดยไม่บันทึก secret

---

## 9. Flow ของหน้า `/admin/platforms`

### เมื่อเปิดหน้า

1. Server อ่าน Platforms จาก `public.platforms`
2. Server อ่าน Category จาก `public.platform_categories`
3. ส่งข้อมูลให้ Client Component สำหรับแสดงผล

### เมื่อเพิ่ม Category

1. กด Add
2. Server validate และ insert Category
3. เมื่อสำเร็จ query Category ใหม่จาก DB
4. อัปเดต select ด้วยผล query ใหม่
5. เลือก Category ที่เพิ่งสร้าง

### เมื่อสร้าง Platform

1. Validate Name, Slug, Category และ First Public Page
2. เรียก RPC `create_platform_blueprint`
3. เมื่อสำเร็จปิด Modal และล้าง form
4. Query Platform list ใหม่จาก DB หรือใช้ `router.refresh()` กับ Server Component
5. แสดง Platform ที่สร้างจากข้อมูล DB จริง
6. เมื่อผิดพลาด Modal ต้องไม่ปิดและต้องแสดงข้อความจาก constraint/RPC

ห้ามใช้ `setPlatforms([...platforms, newPlatform])` เป็นผลลัพธ์สุดท้ายของการสร้าง เพราะข้อมูลในจออาจไม่ตรงกับฐานข้อมูล

---

## 10. ลำดับการพัฒนา

1. ✅ ทำ migration ตาราง `platform_categories` และ seed Category เดิม เช่น ERP, CRM, POS, HRM (`docker/postgres/migrations/001_create_platform_categories.sql`)
2. เพิ่ม `first_public_page` และ `category_id` ใน `platforms` พร้อม migrate ข้อมูลเก่า
3. เพิ่ม `platform_modules`, `platform_pages`, `platform_workflows` และ Platform audit table
4. สร้าง JSON templates ของ Page/Flow ทั้ง 3 modes และเก็บ version ของ template
5. สร้างและทดสอบ `create_platform_blueprint` procedure รวม rollback test
6. สร้าง Server queries/actions สำหรับ list/add Category, list Platform และ create Platform
7. เปลี่ยน `/admin/platforms` จาก hard-coded state เป็นข้อมูล DB
8. เพิ่ม First Public Page field และคำอธิบายผลของแต่ละ option ใน Modal
9. หลังเพิ่ม Category หรือสร้าง Platform ให้ re-fetch จากฐานข้อมูล
10. ทดสอบทั้ง 3 modes ว่า Page, Module และ Flow ที่สร้างตรงตาม matrix

---

## 11. Acceptance Criteria ระยะแรก

- Category ที่เพิ่มจากหน้าจอคงอยู่หลัง refresh และ browser/session ใหม่
- Category list หลัง Add มาจาก query ฐานข้อมูลรอบใหม่
- Create Platform Modal มี First Public Page ครบ 3 options
- Platform ถูกสร้างด้วย procedure เดียวและ rollback ได้เมื่อข้อมูลส่วนใดผิดพลาด
- `PUBLIC_HOME` ไม่มี Auth Module, Login Page, Private Page และ auth node/service
- `PUBLIC_HOME_WITH_LOGIN` เปิด Home ก่อน มีปุ่ม Login และมี Module พื้นฐานครบ
- `LOGIN_PAGE` เปิด Login ก่อนและมี Module พื้นฐานครบ
- ทุก Platform มี entry page เพียงหนึ่งหน้า
- Platform list หลัง Create อ่านใหม่จากฐานข้อมูล
- การสร้าง slug ซ้ำแสดง error และไม่ทิ้งข้อมูลบางส่วนในฐานข้อมูล

---

## 12. ข้อสรุปทางสถาปัตยกรรม

Platform Master และ Tenant App เป็นคนละระดับข้อมูลกัน ตารางที่ผูก `app_id` ไม่ควรถูกนำมาใช้เก็บ Master โดยการสร้าง App จำลอง การมี `platform_pages`, `platform_workflows` และ `platform_modules` ทำให้แม่พิมพ์มีโครงสร้างของตนเอง จากนั้นขั้น Spawn Tenant App ในอนาคตจึงค่อย copy/reference ข้อมูล Master เหล่านี้เข้าสู่ `apps`, `page_layouts`, `workflow_trees` และ App Workflow Manifest ตามหลัก inheritance ใน `PlatformModule.MD`

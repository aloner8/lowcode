# Route for React Architecture

> สถานะ: Approved design specification  
> เป้าหมาย: เปลี่ยนระบบเมนูและ Route จากการผูกกับ URL แบบ Yii (`/module/controller/action`) ไปเป็น Route Model กลางสำหรับ React โดยยังเปิด URL เดิมได้ระหว่างการย้ายระบบ

## 1. Architectural Decision

ระบบใหม่ใช้ **Route ID เป็นตัวอ้างอิงหลัก** และใช้ `path` เป็น public URL เท่านั้น เมนู, workflow และ component ต้องไม่ผูกกับ URL ของ framework โดยตรง

- React route เป็น canonical route ของระบบใหม่
- Yii route เดิมถูกเก็บเป็น `legacyPaths`
- Menu อ้าง `routeId` ไม่อ้าง `href` สำหรับ internal navigation
- External URL ยังคงเก็บ URL โดยตรง
- Route Resolver เป็นผู้ตัดสินใจว่าจะเปิด Page, Form, Collection, Legacy URL หรือ External URL
- การย้าย container เปลี่ยนเฉพาะ Route record โดยไม่ต้องแก้ Menu

## 2. ปัญหาของโครงสร้างปัจจุบัน

ปัจจุบัน `SlideMenuComponent` เก็บปลายทางใน `href` เช่น:

```json
{
  "label": "รูปนายกและปลัด",
  "href": "/cms/homepage-highlight/index"
}
```

ข้อจำกัด:

1. Menu ผูกกับ Yii module/controller/action
2. เปลี่ยน path หรือย้าย container แล้วต้องแก้ทุก Menu
3. React runtime ใช้ `window.location.assign()` ทำให้ reload ทั้งหน้า
4. Route ไม่มี stable identity สำหรับ Permission, Audit และ Workflow
5. ไม่สามารถแยก canonical path ออกจาก legacy URL ได้
6. Clone route แล้วไม่ชัดเจนว่า Menu ควรอ้าง route เดิมหรือ route สำเนา

## 3. Domain Model

### 3.1 AppRoute

```ts
export type AppRouteTargetType =
  | 'page'
  | 'form'
  | 'collection'
  | 'legacy'
  | 'external';

export interface AppRoute {
  id: string;
  platformId: string;
  containerName: string;
  path: string;
  label: string;
  targetType: AppRouteTargetType;
  targetId?: string;
  legacyPaths?: string[];
  externalUrl?: string;
  permission?: string;
  isPublic?: boolean;
  isDefault?: boolean;
  redirectToRouteId?: string;
  metadata?: Record<string, unknown>;
}
```

กฎสำคัญ:

- `id` ต้องคงที่ แม้แก้ `path` หรือย้าย container
- `path` ต้องเริ่มด้วย `/` และเป็น canonical URL
- `(platformId, containerName, path)` ต้องไม่ซ้ำ
- `targetId` อ้าง Page ID, Form ID หรือ Collection/View ID
- `legacyPaths` ใช้รับ URL เก่าเท่านั้น ห้ามใช้เป็น canonical URL
- `externalUrl` ใช้ได้เมื่อ `targetType === 'external'`

### 3.2 Menu Action

```ts
export type MenuAction =
  | { type: 'openRoute'; routeId: string; params?: Record<string, unknown> }
  | { type: 'openExternal'; url: string; newTab?: boolean }
  | { type: 'triggerAction'; actionId: string; payload?: Record<string, unknown> }
  | { type: 'none' };

export interface ReactMenuItem {
  id: string;
  label: string;
  type?: 'item' | 'section';
  iconName?: string;
  action: MenuAction;
  permission?: string;
  badge?: string;
  children?: ReactMenuItem[];

  // Compatibility ชั่วคราวระหว่าง migration
  href?: string;
}
```

ตัวอย่างข้อมูลใหม่:

```json
{
  "id": "menu.homepage-highlight",
  "label": "รูปนายกและปลัด",
  "iconName": "newspaper",
  "action": {
    "type": "openRoute",
    "routeId": "route.cms.homepage-highlight"
  }
}
```

Route ที่ถูกอ้าง:

```json
{
  "id": "route.cms.homepage-highlight",
  "containerName": "platform-obt-backend",
  "path": "/homepage-highlights",
  "label": "รูปนายกและปลัด",
  "targetType": "collection",
  "targetId": "cms.homepage-highlight.collection",
  "legacyPaths": [
    "/cms/homepage-highlight/index"
  ]
}
```

## 4. URL Convention

Canonical URL ไม่ควรเลียนแบบ controller/action ของ Yii

| Resource | Canonical path | Legacy path |
|---|---|---|
| Dashboard | `/dashboard` | `/site/index` |
| Homepage highlights | `/homepage-highlights` | `/cms/homepage-highlight/index` |
| Create highlight | `/homepage-highlights/new` | `/cms/homepage-highlight/create` |
| Edit highlight | `/homepage-highlights/:id/edit` | `/cms/homepage-highlight/update?id=:id` |
| View highlight | `/homepage-highlights/:id` | `/cms/homepage-highlight/view?id=:id` |

Parameter convention:

- Resource identity ใช้ path parameter เช่น `/:id`
- Search, filter, sort และ pagination ใช้ query string
- Action ที่เปลี่ยนข้อมูลต้องเป็น workflow/API action ไม่สร้าง URL เช่น `/delete`
- Path ใช้ kebab-case และคำนามเป็นหลัก

## 5. Route Resolution

Route Resolver รับ `routeId` หรือ URL แล้วคืนปลายทางที่ runtime เปิดได้

```ts
export interface ResolvedRoute {
  route: AppRoute;
  params: Record<string, string>;
  navigationMode: 'client' | 'redirect' | 'external';
}
```

ลำดับการ resolve:

1. ถ้ามี `routeId` ให้ค้นด้วย stable ID
2. ถ้ามี URL ให้ค้น canonical `path`
3. ถ้าไม่พบ ให้ค้นใน `legacyPaths`
4. ตรวจ container และ permission
5. โหลด target ตาม `targetType`
6. Legacy path ที่มี canonical target ให้ redirect หรือ replace URL
7. External target เปิดตาม `newTab` policy
8. ไม่พบ Route ให้แสดง Not Found โดยไม่ fallback ไปหน้าแรกเงียบ ๆ

## 6. React Runtime Routing

เพิ่ม catch-all runtime route:

```text
src/app/app/[appSlug]/[[...routePath]]/page.tsx
```

หน้าที่ของ runtime page:

1. อ่าน `appSlug` และ `routePath`
2. โหลด published route manifest
3. resolve canonical หรือ legacy path
4. โหลด Page/Form/Collection target
5. render ผ่าน `DynamicPageRenderer`
6. client navigation ใช้ Next Router (`router.push`/`router.replace`)
7. ไม่ใช้ `window.location.assign()` สำหรับ internal route

Public URL ภายใต้โครงสร้างปัจจุบัน:

```text
/app/{appSlug}/dashboard
/app/{appSlug}/homepage-highlights
/app/{appSlug}/homepage-highlights/42/edit
```

เมื่อ Nginx แยก subdomain ให้ tenant แล้ว สามารถ rewrite URL ภายนอกให้เป็น:

```text
https://backend.example.go.th/homepage-highlights
```

โดย runtime ภายในยัง resolve ด้วย manifest เดียวกัน

## 7. Route Manifest

Runtime ไม่ควรอ่าน Studio draft โดยตรง ตอน Publish ให้สร้าง immutable route manifest:

```json
{
  "version": 1,
  "publishedAt": "2026-08-26T00:00:00.000Z",
  "routes": [],
  "legacyAliases": {
    "/cms/homepage-highlight/index": "route.cms.homepage-highlight"
  }
}
```

Manifest ต้องรวม:

- Route ID และ canonical path
- Container/surface
- Target type และ target ID
- Permission
- Legacy aliases
- Redirect rules

## 8. Studio UX

### 8.1 Route Manager

ฟอร์ม Route ต้องมี:

- Route label
- Target container
- Canonical path
- Target type
- Target resource dropdown
- Permission
- Public/Private
- Default route
- Legacy paths ใน Advanced section

### 8.2 Menu Route Builder

แทนช่อง `Route ปลายทาง` แบบข้อความอิสระด้วย:

1. Action type: Open Route / External URL / Trigger Action / None
2. Container filter
3. Route dropdown
4. แสดง canonical path แบบ read-only
5. แสดง warning เมื่อเลือก legacy route
6. ช่อง URL แสดงเฉพาะ External URL
7. `href` เดิมแสดงใน Legacy/Advanced mode เท่านั้น

### 8.3 Clone และ Move

- Clone Page ต้องสร้าง Route ID ใหม่
- ผู้ใช้เลือกว่าจะ clone Menu bindings ด้วยหรือไม่
- Move container ต้องคง Route ID เดิม
- ถ้า canonical path ชนใน container ปลายทาง ต้องหยุดและให้เปลี่ยน path
- Menu ที่อ้าง Route ID เดิมต้องทำงานต่อหลัง Move

## 9. Compatibility Policy

ช่วง migration รองรับทั้ง `action.routeId` และ `href`:

```ts
function resolveMenuNavigation(item: ReactMenuItem) {
  if (item.action?.type === 'openRoute') return resolveByRouteId(item.action.routeId);
  if (item.href) return resolveCanonicalOrLegacyPath(item.href);
  return null;
}
```

นโยบาย fallback:

- Internal `href` ที่ match route หรือ legacy alias: เปิดผ่าน React Router
- Internal `href` ที่ไม่ match: แสดง validation warning ใน Studio
- `http://` และ `https://`: ถือเป็น external URL
- ห้ามลบ `href` เดิมจนกว่า migration report จะแสดงว่าไม่มี unresolved menu

## 10. Reusable Yii-to-React Route Conversion

การแปลง Route ต้องเป็น reusable conversion service ที่เรียกซ้ำได้กับ Yii ทุกโครงการ ห้ามผูก logic กับ `yang.sql`, ชื่อตาราง หรือชื่อ module ของเทศบาลใดเทศบาลหนึ่งโดยตรง

หลักการบังคับ:

- ใช้ conversion core เดียวกันสำหรับ Yii ทั้ง 90 ระบบ
- แยก source adapter ออกจาก normalization และ persistence
- เรียกซ้ำด้วย input และ rules version เดิมแล้วต้องไม่สร้างข้อมูลซ้ำ (idempotent)
- รองรับ `dry-run` ก่อนเขียนข้อมูลจริง
- ทุกครั้งต้องสร้าง conversion report
- เก็บ source fingerprint และ rules version เพื่อ audit/replay
- mapping ที่ระบบตัดสินใจไม่ได้ต้องเป็น `unresolved` ห้ามเดาปลายทางแล้ว publish อัตโนมัติ
- รองรับทั้ง SQL dump, database connection และ normalized JSON input

### 10.1 Conversion Pipeline

```text
Yii SQL/DB/JSON
  -> Source Adapter
  -> Route Extractor
  -> Normalizer
  -> Canonical Route Mapper
  -> Menu Binding Converter
  -> Validator
  -> Dry-run Report
  -> Idempotent Upsert
  -> Publish (explicit action only)
```

แต่ละขั้นต้องรับและคืนข้อมูลธรรมดา เพื่อให้ทดสอบแยกกันและนำกลับมาใช้ซ้ำได้

### 10.2 Core Function Contract

```ts
export interface YiiRouteConversionInput {
  platformId: string;
  sourceSystemId: string;
  sourceType: 'sql_dump' | 'database' | 'normalized_json';
  source: {
    sqlText?: string;
    connectionId?: string;
    normalizedData?: YiiNormalizedSource;
  };
  options: {
    mode: 'dry-run' | 'apply';
    targetContainers: {
      frontend: string;
      backend: string;
    };
    rulesVersion: string;
    preserveLegacyHref: boolean;
    overwriteManualChanges: boolean;
  };
  adapterConfig?: YiiAdapterConfig;
  mappingOverrides?: RouteMappingOverride[];
}

export interface YiiRouteConversionResult {
  conversionId: string;
  sourceFingerprint: string;
  status: 'previewed' | 'applied' | 'partial' | 'failed';
  summary: {
    discovered: number;
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    unresolved: number;
    conflicts: number;
  };
  routes: AppRoute[];
  menuPatches: MenuConversionPatch[];
  issues: ConversionIssue[];
}

export async function convertYiiRoutes(
  input: YiiRouteConversionInput,
): Promise<YiiRouteConversionResult>;
```

Core function ห้ามอ่านไฟล์, environment variable หรือ database โดยแอบซ่อนอยู่ภายใน การอ่าน source และการเขียนผลต้องผ่าน dependency/adapter ที่ระบุชัดเจน เพื่อให้ unit test ได้

### 10.3 Source Adapter

Yii แต่ละระบบอาจใช้ schema และชื่อตารางไม่เหมือนกัน จึงต้องมี adapter interface:

```ts
export interface YiiRouteSourceAdapter {
  id: string;
  canHandle(source: YiiConversionSource): Promise<boolean>;
  extract(source: YiiConversionSource, config?: YiiAdapterConfig): Promise<YiiNormalizedSource>;
}

export interface YiiNormalizedSource {
  menus: YiiSourceMenu[];
  modules: YiiSourceModule[];
  explicitRoutes: YiiSourceRoute[];
  controllerActions: YiiControllerAction[];
  metadata: Record<string, unknown>;
}
```

Adapter เริ่มต้น:

1. `yii2-sql-dump` อ่าน SQL dump เช่น `public/YII/yang.sql`
2. `yii2-mysql` อ่านจาก MySQL/MariaDB แบบ read-only
3. `yii2-normalized-json` รับข้อมูลที่ระบบภายนอก extract มาแล้ว

ความแตกต่างเฉพาะโครงการต้องอยู่ใน `adapterConfig` หรือ mapping override ไม่ fork conversion core

### 10.4 Conversion API

API เป็น orchestration layer ที่เรียก core function เดียวกัน:

```text
POST /api/platforms/{platformId}/route-conversions/preview
POST /api/platforms/{platformId}/route-conversions/apply
GET  /api/platforms/{platformId}/route-conversions/{conversionId}
GET  /api/platforms/{platformId}/route-conversions/{conversionId}/report
POST /api/platforms/{platformId}/route-conversions/{conversionId}/publish
```

ตัวอย่าง Preview request:

```json
{
  "sourceSystemId": "yang-obt-production",
  "sourceType": "sql_dump",
  "sourceArtifactId": "artifact_yang_sql_2026_08_26",
  "rulesVersion": "yii2-react-route-v1",
  "targetContainers": {
    "frontend": "platform-obt-frontend",
    "backend": "platform-obt-backend"
  },
  "preserveLegacyHref": true,
  "overwriteManualChanges": false
}
```

ห้ามส่ง path ของไฟล์บน server จาก client โดยตรง ให้ upload/register เป็น artifact ก่อน แล้ว API รับ `sourceArtifactId` เพื่อป้องกัน path traversal และทำให้ replay ได้

`preview` ห้ามแก้ route/menu จริง ส่วน `apply` ต้องอ้าง conversion preview หรือ fingerprint เดียวกัน หาก source เปลี่ยนหลัง preview ต้องปฏิเสธและให้ preview ใหม่

### 10.5 Idempotency and Ownership

Route ที่ import ต้องเก็บ metadata:

```json
{
  "migration": {
    "sourceSystemId": "yang-obt-production",
    "sourceKey": "backend:cms/homepage-highlight/index",
    "sourceFingerprint": "sha256:...",
    "rulesVersion": "yii2-react-route-v1",
    "managedFields": ["legacyPaths", "targetType", "targetId"]
  }
}
```

ใช้ unique identity:

```text
(platformId, sourceSystemId, sourceKey)
```

กติกา apply ซ้ำ:

- ไม่พบ source identity: `create`
- พบและ fingerprint เหมือนเดิม: `unchanged`
- พบและ source เปลี่ยน: update เฉพาะ `managedFields`
- field ถูกแก้ด้วยผู้ใช้และไม่อยู่ใน `managedFields`: ห้าม overwrite
- `overwriteManualChanges: false`: conflict ต้องเข้า report
- source route หายไป: mark `orphaned` ก่อน ห้าม delete อัตโนมัติ
- การลบ route ต้องเป็น explicit reviewed action

### 10.6 Batch Conversion สำหรับ 90 ระบบ

ใช้ batch API/job ครอบ conversion API ราย platform:

```text
POST /api/route-conversion-batches
GET  /api/route-conversion-batches/{batchId}
POST /api/route-conversion-batches/{batchId}/retry-failed
```

Batch manifest:

```json
{
  "rulesVersion": "yii2-react-route-v1",
  "mode": "dry-run",
  "concurrency": 3,
  "projects": [
    {
      "platformId": "...",
      "sourceSystemId": "yang-obt-production",
      "sourceArtifactId": "artifact-yang-sql",
      "adapterId": "yii2-sql-dump"
    }
  ]
}
```

Batch runner ต้องมี:

- จำกัด concurrency เพื่อไม่ทำให้ database หนักเกินไป
- แยก transaction ต่อ platform
- retry เฉพาะ transient failure
- resume ได้หลัง process restart
- cancellation แบบไม่ rollback งานที่ commit สำเร็จแล้ว
- progress ต่อ project และภาพรวม
- export report เป็น JSON/CSV
- ห้าม auto-publish ทั้ง batch หากยังมี unresolved/conflict

### 10.7 Security

- Database adapter ใช้ read-only credential
- SQL dump parser ห้าม execute SQL dump
- จำกัดขนาด artifact และตรวจ content type
- ห้ามบันทึกรหัสผ่าน database ลง conversion result/log
- Apply/Publish ต้องตรวจสิทธิ์แยกจาก Preview
- ทุก Apply, Retry, Override และ Publish ต้องบันทึก audit log

### 10.8 Suggested Implementation Files

```text
src/lib/migration/yii-routes/types.ts
src/lib/migration/yii-routes/convertYiiRoutes.ts
src/lib/migration/yii-routes/normalizeYiiRoute.ts
src/lib/migration/yii-routes/mapCanonicalRoute.ts
src/lib/migration/yii-routes/validateConversion.ts
src/lib/migration/yii-routes/adapters/YiiSqlDumpAdapter.ts
src/lib/migration/yii-routes/adapters/YiiDatabaseAdapter.ts
src/lib/migration/yii-routes/adapters/YiiNormalizedJsonAdapter.ts
src/lib/migration/yii-routes/repository/RouteConversionRepository.ts
src/app/api/platforms/[id]/route-conversions/preview/route.ts
src/app/api/platforms/[id]/route-conversions/apply/route.ts
src/app/api/platforms/[id]/route-conversions/[conversionId]/route.ts
src/app/api/route-conversion-batches/route.ts
```

CLI ต้องเรียก core function เดียวกับ API ห้ามมี conversion logic ซ้ำ:

```powershell
npm run routes:convert -- preview --manifest .\migration-manifest.json
npm run routes:convert -- apply --conversion-id <id>
npm run routes:convert -- report --conversion-id <id>
```

## 11. Migration Workflow ต่อหนึ่ง Yii Project

### Phase 1: Inventory

1. อ่าน Menu records จาก `public/YII/yang.sql`
2. Normalize path โดยตัด host และ trailing slash
3. จัดกลุ่มตาม Yii module/controller/action
4. ตรวจ query parameters ที่เป็น resource identity
5. สร้างรายงาน duplicate และ unresolved routes

### Phase 2: Generate Routes

1. สร้าง stable Route ID จาก module/controller
2. สร้าง canonical React path
3. เก็บ Yii path ใน `legacyPaths`
4. map target ไป Page/Form/Collection
5. route ที่ยังไม่มี React target ใช้ `targetType: 'legacy'`

### Phase 3: Convert Menus

1. ค้น route จาก `href`
2. เพิ่ม `action: { type: 'openRoute', routeId }`
3. คง `href` ไว้ชั่วคราว
4. ทำเครื่องหมาย Menu ที่หา route ไม่พบ

### Phase 4: Runtime Cutover

1. เพิ่ม catch-all runtime route
2. เปลี่ยน internal navigation เป็น Next Router
3. เปิด legacy alias resolution
4. เก็บ telemetry สำหรับ legacy URL usage
5. redirect legacy URL ไป canonical URL เมื่อ target พร้อม

### Phase 5: Cleanup

1. แก้ unresolved menus ให้หมด
2. หยุดสร้าง Menu ใหม่ด้วย internal `href`
3. ลบ compatibility `href` หลังพ้นระยะรองรับ
4. คง legacy aliases ตามระยะเวลาที่กำหนดเพื่อ bookmark และ SEO

## 12. Persistence Options

### ระยะสั้น

เก็บ `routes` ใน Platform Studio JSON เพื่อส่งมอบ feature ได้เร็ว:

```ts
interface PlatformStudioDefinition {
  pages: StudioPageDefinition[];
  routes: AppRoute[];
  forms: StudioFormDefinition[];
  collections: StudioCollectionDefinition[];
}
```

### ระยะ production

แนะนำตาราง `platform_routes`:

```sql
CREATE TABLE platform_routes (
  id text NOT NULL,
  platform_id uuid NOT NULL,
  container_name text NOT NULL,
  path text NOT NULL,
  label text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  legacy_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  permission text,
  is_public boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  redirect_to_route_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_id, id),
  UNIQUE (platform_id, container_name, path)
);
```

ก่อนสร้าง migration จริงต้องตรวจชนิด `platforms.id` ในฐานข้อมูลปัจจุบันให้ตรงกัน

## 13. Files to Change

ลำดับ implementation ที่แนะนำ:

1. `src/types/index.ts` — เพิ่ม `AppRoute`, `MenuAction`
2. `src/lib/engine/RouteResolver.ts` — canonical/legacy matching และ permission guard
3. `src/components/studio/SlideMenuRouteBuilder.tsx` — เปลี่ยนจาก raw href เป็น route picker
4. `src/components/shared/SlideMenuComponent.tsx` — รองรับ `action`
5. `src/components/engine/DynamicPageRenderer.tsx` — ส่ง navigation event แทน `window.location.assign`
6. `src/app/app/[appSlug]/[[...routePath]]/page.tsx` — catch-all React runtime
7. `src/lib/engine/AppRuntimeFetcher.ts` — โหลด route manifest และ target resource
8. `src/components/studio/StudioTreeviewOutline.tsx` — แสดง canonical route และ legacy aliases
9. `src/app/api/platforms/[id]/studio/route.ts` — validate/persist routes
10. Database migration — `platform_routes` และ indexes
11. Migration script — import Yii paths และ convert menu bindings

## 14. Validation Rules

- Route ID ห้ามว่างและห้ามซ้ำภายใน platform
- Canonical path ต้องขึ้นต้นด้วย `/`
- Canonical path ห้ามมี query string
- Route path ห้ามชนกันภายใน container เดียวกัน
- Legacy path ห้าม map ไปหลาย canonical routes ใน container เดียวกัน
- Internal menu ต้องมี Route ID ที่ resolve ได้
- External URL ต้องเป็น `http:` หรือ `https:`
- Page/Form/Collection target ต้องมีอยู่จริงก่อน Publish
- Private route ต้องกำหนด permission หรือ authentication policy
- Default route มีได้หนึ่งรายการต่อ container
- Conversion apply ซ้ำต้องไม่สร้าง Route/Menu ซ้ำ
- Source fingerprint ที่ apply ต้องตรงกับ preview
- Unresolved หรือ conflict ต้องไม่ถูก publish อัตโนมัติ

## 15. Acceptance Criteria

1. เปิด canonical URL โดยตรงแล้ว render target ที่ถูกต้อง
2. Refresh canonical URL แล้วไม่เกิด 404
3. Browser Back/Forward ทำงานกับ internal navigation
4. คลิก internal Menu แล้วไม่ full-page reload
5. URL Yii เดิม resolve ไป target ใหม่ได้
6. Move route ไปอีก container แล้ว Menu เดิมยังทำงานเพราะอ้าง Route ID
7. Clone route ได้ Route ID ใหม่โดยไม่เปลี่ยนต้นฉบับ
8. Route collision ถูกปฏิเสธก่อนบันทึก
9. Permission guard ทำงานทั้ง direct URL และ menu navigation
10. Publish ถูกปฏิเสธเมื่อมี unresolved internal Menu
11. External URL ยังเปิดได้ตาม new-tab setting
12. Runtime ไม่อ่าน Studio draft ที่ยังไม่ Publish
13. SQL dump เดิม preview/apply ซ้ำแล้วผลเป็น `unchanged`
14. Adapter ใหม่เพิ่มได้โดยไม่แก้ conversion core
15. Batch บาง project ล้มเหลวแล้ว retry เฉพาะรายการที่ล้มเหลวได้
16. Conversion report ระบุ created/updated/unchanged/unresolved/conflict ได้ครบ
17. Manual route fields ไม่ถูก overwrite เมื่อ policy ไม่อนุญาต

## 16. Definition of Done

- TypeScript compile ผ่าน
- Route Resolver มี unit tests สำหรับ canonical, parameter, legacy, redirect และ not-found
- Runtime catch-all ผ่าน direct-load และ refresh tests
- Menu Builder ไม่สร้าง internal raw `href` ใหม่
- Yii migration มี report ของ converted, duplicate และ unresolved routes
- Clone/Move container ผ่าน integration test
- มี rollback โดย runtime ยังอ่าน legacy `href` ได้ระหว่าง migration
- Core converter, API และ CLI ใช้ conversion function ชุดเดียวกัน
- มี contract tests สำหรับ adapter ทุกชนิด
- มี idempotency test สำหรับ preview/apply/re-apply
- Batch dry-run ผ่านอย่างน้อยหนึ่งชุดข้อมูลหลาย platform ก่อนเริ่ม apply จริง

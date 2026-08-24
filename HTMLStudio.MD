# HTML Studio — Advanced Visual HTML, SVG และ Theme Authoring

> สถานะ: Product & Technical Design Specification  
> เป้าหมาย: ยกระดับ `HtmlEditorComponent` จาก Rich Text Editor ให้เป็น **HTML Studio** ที่สร้างหน้าและ HTML Template ได้ด้วยการลากวาง/ตั้งค่าเพียงเล็กน้อย และนำไปใช้กับ Platform Runtime ปัจจุบันได้โดยไม่ต้องเขียน path หรือ glue code ซ้ำ  
> ขอบเขตเอกสาร: UX, Template Language, Shared Component, Collection, Site Map, Asset, SVG/Animation, Theme/CSS, security, persistence, runtime integration และ roadmap

---

## 1. Executive Summary

HTML Studio ไม่ควรถูกออกแบบเป็น textarea ที่เพิ่ม toolbar จำนวนมาก แต่ควรเป็น **Visual Template IDE** ซึ่งมี source code เป็นผลลัพธ์ที่ผู้ใช้ขั้นสูงแก้ได้ โดยมีแกนกลาง 4 ส่วน:

1. **HTML Template Composer** — ลาก section/element/shared component ลง canvas, แก้ visual และ source แบบ round-trip
2. **Platform Reference Resolver** — อ้าง Page, Site Map, Asset, Shared Component และ Collection ด้วย stable ID แล้ว resolve เป็น URL/ข้อมูลจริงตาม environment
3. **SVG & Motion Studio** — สร้าง/นำเข้า/แก้ SVG, วางภาพประกอบ, ทำ animation และบันทึกกลับ Asset Library เป็น template ที่นำกลับมาใช้ซ้ำได้
4. **Theme & CSS Studio** — token-first theme editor ร่วมกับ scoped CSS editor ซึ่งสร้าง CSS เฉพาะ component, template หรือทั้ง page ได้

ข้อเสนอสำคัญที่สุดคือ **ห้ามบันทึก production URL หรือ physical asset path ลงใน HTML โดยตรง** ให้บันทึก reference เช่น `asset://hero-home` และ `page://contact` หรือ helper ที่มีความหมายเทียบเท่า แล้วใช้ resolver ตัวเดียวกันใน Studio Preview, Runtime และ Publish compiler จึงจะย้ายจาก development ไป production ได้โดยไม่แก้ code

HTML Studio ต้องไม่แทน Page Builder เดิมทั้งหมด แต่เป็น authoring surface ระดับสูงที่สร้าง `HtmlTemplateComponent` หนึ่งตัวหรือหลาย section แล้วฝังอยู่ใน `ComponentNode`/`PageLayout.componentTree` เดิม ทำให้ Platform ปัจจุบันยังเป็นเจ้าของ routing, data, workflow, theme และ tenant isolation

---

## 2. วิเคราะห์ระบบปัจจุบัน

### 2.1 สิ่งที่มีแล้วและนำมาต่อยอดได้

- `StudioHtmlEditor` ใช้ Tiptap มี Visual/HTML Source และ formatting พื้นฐาน
- `DynamicHtmlComponent` render HTML และแทนค่า `{{path}}` โดย escape HTML
- `DynamicPageRenderer` render `ComponentNode` ผ่าน `COMPONENT_REGISTRY` และรองรับ child tree/action trigger
- `PageLayout` มี `pageSlug` และ `componentTree`
- `AppRuntimeData` เริ่มรวม `forms` และ `collections` พร้อม collection components/views
- `ThemeConfig` และ `ThemeEngine` มี preset, mode, color, radius, font และ custom CSS variables
- Studio tree มีโครง Assets/asset bindings และตรวจ property ที่ลงท้ายด้วย `assetId`
- Runtime ใช้ app slug และ platform runtime payload เป็นฐาน จึงสามารถเพิ่ม manifest สำหรับ routes/assets/templates ได้

### 2.2 ช่องว่างที่ต้องแก้

| หัวข้อ | ปัจจุบัน | สิ่งที่ HTML Studio ต้องเพิ่ม |
|---|---|---|
| Template | HTML string | document AST, stable node ID, slots, bindings และ version |
| Visual editing | Rich text | layout/section/element drag & drop, responsive controls, layers และ inspector |
| Shared Component | render จาก registry เฉพาะ page tree | custom tag + schema-driven properties + slots |
| Collection | runtime มี definition แต่ HTML ไม่ bind | repeat/query/field/empty/loading/error skeleton |
| Navigation | URL เป็น string | Site Map picker + stable Page ID + environment resolver |
| Asset | เห็น asset binding แต่ upload ยังไม่พร้อม | managed asset manifest, variants, upload/import, SVG templates |
| CSS | theme variable เล็กน้อย | token editor, scoped CSS, breakpoint/state, validation และ compiler |
| SVG | ยังไม่มี authoring system | vector canvas, layers, shapes, image import, animation timeline |
| Security | `dangerouslySetInnerHTML` | sanitizer, capability policy, CSP, safe expression engine |
| Publish | runtime render ตรง | validate → compile → snapshot → publish artifact |

ข้อควรระวัง: Tiptap เหมาะกับ rich-text block แต่ไม่ควรเป็น canonical model ของ page layout และ SVG ทั้งหมด เพราะ arbitrary HTML/CSS, shared tags และ responsive layout จะเกิด information loss เมื่อตัดสลับ Visual/Source จึงควรเพิ่ม document AST ของ HTML Studio และใช้ Tiptapเฉพาะ Text/Rich Text node

---

## 3. Product Principles

1. **Visual-first, code-available** — ผู้ใช้ทั่วไปทำงานได้โดยไม่เห็น code แต่ผู้ใช้ขั้นสูงเปิด HTML/CSS/SVG source ได้
2. **One canonical document** — Visual, Outline และ Source เป็น view ของ document เดียวกัน ไม่ใช่ HTML คนละสำเนา
3. **Reference by identity** — page/component/asset/collection อ้างด้วย ID; slug/path/name เป็นข้อมูลแสดงผลและแก้ภายหลังได้
4. **Preview equals production** — ใช้ compiler/resolver/sanitizer ตัวเดียวกัน ต่างกันเฉพาะ environment context
5. **Scoped by default** — style และ animation ไม่รั่วไป component หรือ page อื่น
6. **Progressive capability** — Basic, Advanced และ Expert mode ใช้ document format เดียวกัน
7. **Non-destructive source editing** — parse ได้จึง update AST; parse ไม่ได้ต้องรักษ source, แสดง diagnostic และไม่เขียนทับงานเดิม
8. **Tenant-safe** — asset, collection และ shared component ต้องตรวจ platform/app/tenant scope ทุกครั้ง
9. **Portable templates** — export/import ได้พร้อม dependency manifest และ mapping wizard
10. **Accessible output** — semantic element, alt text, contrast, keyboard focus และ reduced motion เป็นส่วนของ publish validation

---

## 4. ขอบเขตของ HTML Studio

### 4.1 รองรับในรุ่นเป้าหมาย

- HTML semantic elements และ layout primitives
- section/block/template drag & drop
- Shared Component ผ่าน custom tag
- Collection binding ระดับ schema/query mock/skeleton
- internal page/link และ asset picker
- responsive desktop/tablet/mobile
- component/page/template scoped CSS
- theme tokens และ variants
- SVG create/import/edit/save/template
- CSS/SVG animation แบบ timeline และ state
- preview ด้วย mock data และ runtime context
- validation, version history, draft/publish

### 4.2 ยังไม่ควรทำในระยะแรก

- query raw database หรือ SQL จาก template
- arbitrary JavaScript ใน HTML/SVG
- npm package/plugin execution ใน tenant runtime
- browser DOM script editor
- full Photoshop/Figma replacement
- collaborative multiplayer editing จนกว่า document/version model จะเสถียร

---

## 5. รูปแบบการใช้งานและระดับผู้ใช้

### Basic

- เลือก template/section
- ลาก component
- เปลี่ยนข้อความ รูป สี link และข้อมูลจาก picker
- responsive ใช้ค่า auto/default

### Advanced

- Outline, slots, repeat, condition, collection query builder
- class manager, scoped CSS, states และ breakpoints
- SVG editor และ animation timeline
- component/template variants

### Expert

- HTML/CSS/SVG source
- expression/binding inspector
- dependency graph, compiled output และ diagnostics
- import/export package

การเปิด Expert mode ไม่ควรเปลี่ยนชนิดข้อมูลหรือสร้าง fork ของ template

---

## 6. UX และ Workspace Layout

HTML Studio เปิดได้สองแบบ:

- **Full Studio**: เมนู `Tools > HTML Studio` สำหรับสร้าง template/asset reusable
- **Embedded Studio**: กด Edit จาก `HtmlTemplateComponent` ใน Page Designer แล้วเปิดพร้อม context ของ page/app ปัจจุบัน

โครง workspace:

```text
┌ Command bar: Save | Undo | Preview | Device | Data | Validate | Publish ┐
├ Library ────────┬ Canvas / Source / Split ──────────────┬ Inspector ────┤
│ Elements        │                                       │ Properties     │
│ Sections        │    Responsive artboard                │ Layout         │
│ Shared          │    selection + inline editing         │ Style / State  │
│ Collections     │                                       │ Bind / Action  │
│ Assets / SVG    │                                       │ Accessibility  │
├─────────────────┴───────────────────────────────────────┴───────────────┤
│ Outline/Layers | CSS | Motion Timeline | Data Preview | Diagnostics     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Library

- Elements: section, div/stack/grid, heading, text, link, image, video, button, form primitives
- Sections: hero, feature, card grid, CTA, footer
- Shared Components: ค้นจาก registry ตาม scope และ category
- Collections: collection, saved view, fields และ data skeleton
- Assets: image/SVG/icon/font และ SVG templates

### 6.2 Canvas

- drag/drop พร้อม insertion indicator
- click select, double click edit text
- breadcrumb เช่น `Page > Hero > Content > CTA`
- resize handles เฉพาะ element ที่รองรับ
- breakpoint presets และ custom width
- preview states: default, hover, focus, active, disabled, empty, loading, error
- Canvas ใช้ iframe sandbox เพื่อแยก CSS ของ Studio UI ออกจาก template

### 6.3 Inspector

แยก tab เป็น Content, Layout, Style, Data, Action, Motion, Accessibility และ Advanced ทุก field สร้างจาก schema ของ element/component จึงรองรับ Shared Component ใหม่โดยไม่ hard-code form เพิ่มทุกครั้ง

### 6.4 Source/Split Mode

- HTML, CSS, SVG แยก editor tabs
- syntax highlighting, autocomplete สำหรับ platform tags/helpers
- go-to definition ไป Shared Component, Asset, Page หรือ token
- diagnostics ระบุตำแหน่งและ quick fix
- Source change ใช้ debounce แล้ว parse เป็น AST; error จะแสดง preview จาก last valid AST พร้อมป้าย `Preview is using last valid version`

---

## 7. Canonical Document Model

ไม่ควรเก็บเพียง `html: string` เพราะ drag/drop, binding และ refactor จะเปราะ ให้เก็บทั้ง AST และ generated source โดย AST เป็น canonical ใน Visual mode

```ts
type HtmlStudioDocument = {
  id: string;
  scope: 'platform' | 'app' | 'tenant';
  kind: 'page-template' | 'section' | 'shared-template' | 'svg-template';
  name: string;
  version: number;
  schemaVersion: 1;
  root: StudioNode[];
  styleSheet: StudioStyleSheet;
  dependencies: TemplateDependency[];
  settings: {
    cssScope: 'component' | 'page' | 'global';
    dataPolicy: 'mock-only' | 'collection-read';
    scriptPolicy: 'none';
  };
  sourceCache?: { html: string; css: string; svg?: string };
  createdAt: string;
  updatedAt: string;
};

type StudioNode = {
  id: string;                 // stable ID สำหรับ selection/style/migration
  kind: 'element' | 'text' | 'component' | 'repeat' | 'condition' | 'slot' | 'svg';
  tag?: string;
  componentRef?: StableRef;
  attributes?: Record<string, StudioValue>;
  bindings?: Record<string, BindingExpression>;
  classList?: string[];
  children?: StudioNode[];
};

type StableRef = {
  id: string;
  scope: 'platform' | 'app' | 'tenant';
  version?: string;
  displayName?: string;
};
```

ทุก node ต้องมี `data-studio-id` ระหว่าง edit แต่ compiler ถอดออกใน production ได้ ยกเว้นเปิด debug mode

### 7.1 Integration กับ PageLayout เดิม

เพิ่ม component type:

```ts
type HtmlTemplateComponentProps = {
  templateId: string;
  templateVersion?: number | 'published';
  inputs?: Record<string, unknown>;
  slots?: Record<string, ComponentNode[]>;
  dataContext?: Record<string, unknown>;
  cssScopeId?: string;
};
```

Page Designer จึงวาง `HtmlTemplateComponent` ใน `componentTree` ได้เหมือน component อื่น และ runtime renderer ส่ง app/page/theme/data context เข้า template runtime

---

## 8. Template Syntax และ Custom Tags

เพื่อให้ source อ่านง่าย ควรมี **Studio Markup** ที่คล้าย HTML แต่ compiler เป็นผู้แปลง ไม่ส่ง unknown tag ให้ browser ตรง ๆ

### 8.1 Shared Component

รูปแบบที่แนะนำ:

```html
<Shared:Card
  ref="component://cmp_customer_card"
  variant="compact"
  title="{{ item.full_name }}"
>
  <Studio:Slot name="actions">
    <Shared:Button label="ดูรายละเอียด" page-ref="page://customer-detail" />
  </Studio:Slot>
</Shared:Card>
```

ผู้ใช้สามารถเห็นชื่อ tag ที่เป็นมิตร แต่ `ref` คือ identity จริง การ rename `Card` จึงไม่ทำให้ template พัง Tag names ต้อง unique ภายใน namespace และ compiler ต้องตรวจ props กับ component manifest

Manifest ของ Shared Component:

```ts
type SharedComponentManifest = {
  id: string;
  tagName: string;
  displayName: string;
  version: string;
  scope: 'platform' | 'app' | 'tenant';
  rendererType: ComponentType;
  propsSchema: JsonSchema;
  slots: Array<{ name: string; accepts: string[]; required?: boolean }>;
  events: Array<{ name: string; payloadSchema?: JsonSchema }>;
  capabilities: Array<'collection-read' | 'navigate' | 'asset-read' | 'workflow-trigger'>;
};
```

### 8.2 Collection skeleton

ระยะแรกไม่ query raw table ให้เลือก Collection และ saved view ผ่าน picker:

```html
<Studio:Collection
  ref="collection://customers"
  view="published-list"
  as="customer"
  limit="12"
>
  <Studio:Loading>
    <Shared:CardSkeleton repeat="6" />
  </Studio:Loading>

  <Studio:Empty>
    <p>ยังไม่มีข้อมูลลูกค้า</p>
  </Studio:Empty>

  <Studio:Repeat>
    <Shared:CustomerCard
      name="{{ customer.full_name }}"
      image-ref="{{ customer.avatar_asset_ref }}"
    />
  </Studio:Repeat>

  <Studio:Error>
    <p role="alert">ไม่สามารถโหลดข้อมูลได้</p>
  </Studio:Error>
</Studio:Collection>
```

Studio อ่าน collection schema เพื่อสร้าง field autocomplete และ mock records; เมื่อยังไม่มี schema ให้สร้าง placeholder:

```html
<Studio:Collection ref="collection://pending-products" status="skeleton">
  <Studio:Repeat>
    <article class="product-card">
      <Studio:Field name="title" placeholder="Product title" />
      <Studio:Field name="image" type="asset" placeholder="Product image" />
    </article>
  </Studio:Repeat>
</Studio:Collection>
```

เมื่อ Collection จริงพร้อมแล้ว ผู้ใช้เปิด Mapping Wizard เพื่อ map placeholder field โดยไม่ต้องสร้าง layout ใหม่

### 8.3 Expression language

รองรับเฉพาะ safe expressions เช่น field access, fallback, comparison และ formatter:

```text
{{ customer.name }}
{{ customer.price | number:'th-TH' }}
{{ customer.image_ref ?? asset('default-avatar') }}
{{ route.param.id }}
{{ theme.primaryColor }}
```

ห้าม `eval`, function constructor, property traversal ไป prototype และ arbitrary function call ใช้ parser/interpreter ที่ whitelist operator/formatter เท่านั้น HTML output escape โดย default; raw HTML ต้องเป็น typed `TrustedHtml` จาก sanitizer และ permission ชัดเจน

---

## 9. Reference Resolver: Site Map, URL และ Asset Path

### 9.1 Stable reference schemes

```text
page://pg_customer_detail
route://customer-detail
asset://ast_home_hero
component://cmp_customer_card
collection://col_customers
template://tpl_marketing_hero
theme://color.primary
```

source อาจใช้ helper เพื่ออ่านง่าย:

```html
<a href="{{ pageUrl('page://pg_customer_detail', { id: customer.id }) }}">ดูข้อมูล</a>
<img src="{{ assetUrl('asset://ast_home_hero', { variant: 'web-1600' }) }}" alt="ภาพหน้าหลัก">
```

### 9.2 Runtime Context

```ts
type ResolveContext = {
  environment: 'studio' | 'preview' | 'staging' | 'production';
  platformId: string;
  appId: string;
  tenantId?: string;
  basePath: string;       // เช่น /app/acme ไม่ hard-code ใน template
  assetBaseUrl: string;   // CDN หรือ same-origin
  locale: string;
  routeParams: Record<string, string>;
};
```

Resolver contract:

```ts
interface PlatformReferenceResolver {
  page(ref: string, params?: Record<string, unknown>): string;
  asset(ref: string, options?: { variant?: string; revision?: string }): string;
  component(ref: string): SharedComponentManifest;
  collection(ref: string): CollectionManifest;
}
```

### 9.3 Site Map Manifest

```ts
type SiteMapEntry = {
  id: string;                   // immutable
  pageId: string;
  slug: string;
  pathPattern: string;          // /customers/:id
  parentId?: string;
  localePaths?: Record<string, string>;
  requiredParams: string[];
  status: 'draft' | 'published' | 'disabled';
};
```

Link Picker แสดง tree ของ Site Map, ตรวจ required params และ preview URL ตาม context เมื่อเปลี่ยน slug ให้ update manifest เท่านั้น references ยังใช้ page ID จึงไม่แตก

### 9.4 Asset Manifest และ production-safe path

```ts
type AssetManifestEntry = {
  id: string;
  scope: 'platform' | 'app' | 'tenant';
  kind: 'image' | 'svg' | 'icon' | 'font' | 'video' | 'document';
  logicalName: string;
  mimeType: string;
  revision: string;
  storageKey: string;           // server-only, ไม่ฝังใน template
  variants: Record<string, { storageKey: string; width?: number; height?: number }>;
  metadata: { width?: number; height?: number; alt?: string; tags?: string[] };
};
```

Production URL ตัวอย่างอาจเป็น `/assets/{assetId}/{revision}/{variant}` หรือ CDN signed/public URL แต่เป็นหน้าที่ resolver เท่านั้น ห้าม template รู้ bucket, filesystem, hostname หรือ `public/...`

### 9.5 Validation ตอน Publish

- unresolved reference = error
- draft page ที่ถูกอ้างจาก published template = error หรือ explicit warning ตาม policy
- missing route param = error
- asset ไม่มี published revision = error
- cross-tenant reference = error
- external URL = warning + protocol allowlist
- broken fragment/anchor = warning

---

## 10. SVG Design Studio

SVG Studio เป็น workspace ย่อยของ HTML Studio และ Asset Library ใช้ document model แบบ vector ไม่ใช่เก็บ screenshot

### 10.1 ความสามารถหลัก

- artboard presets: background, icon, image/illustration, button decoration, form decoration, animated icon
- shape: rect, ellipse, line, polygon, path, text, group, mask, clip path, gradient
- pen/node editing ระดับพื้นฐาน
- align, distribute, group, lock, hide, reorder layers
- fill/stroke/opacity/filter/shadow/blur
- viewBox และ responsive sizing
- import SVG/PNG/JPEG/WebP เพื่อวางเป็น layer หรือ trace ภายหลัง
- crop/fit/mask image; ไม่แก้ bitmap pixel แบบเต็มรูปแบบ
- bind color กับ theme token เช่น `var(--color-primary)`
- optimize SVG ก่อน publish โดยรักษา IDs ที่ timeline/binding ใช้อยู่

### 10.2 การนำรูปภายนอกมาออกแบบ

Flow ที่ควรเป็น:

1. Upload/import เข้า quarantine
2. ตรวจ MIME จาก bytes, ขนาด, malware policy และลบ metadata ที่ไม่ต้องการ
3. Raster image ถูกสร้าง preview/variants และอ้างด้วย Asset ID
4. SVG ถูก sanitize ก่อน parse; ปิด script, foreignObject, event attributes และ external resource โดย default
5. ผู้ใช้เพิ่ม layout, shape, text, mask และ animation
6. Save เป็น draft SVG asset หรือ `Save as Template`
7. Publish สร้าง immutable revision และ optimized derivative

### 10.3 SVG template categories

ใช้ enum ภายในที่สะกดแน่นอน:

```ts
type SvgTemplateCategory =
  | 'background'
  | 'icon'
  | 'image'
  | 'button'
  | 'form'
  | 'icon-animation';
```

แต่ละ template มี `editableParameters` เช่น colors, text, duration, size, stroke width และ image slot เพื่อให้คนใช้ template ปรับจาก Inspector ได้โดยไม่เปิด layer ทั้งหมด

### 10.4 Motion Model

รองรับ 3 ระดับ:

- Preset: fade, slide, scale, rotate, pulse, draw path
- State transition: default → hover/focus/active/disabled
- Timeline: keyframes ของ transform, opacity, fill, stroke, path progress

```ts
type MotionTrack = {
  targetNodeId: string;
  trigger: 'load' | 'in-view' | 'hover' | 'focus' | 'click' | 'manual';
  property: 'opacity' | 'transform' | 'fill' | 'stroke' | 'strokeDashoffset';
  keyframes: Array<{ offset: number; value: string; easing?: string }>;
  durationMs: number;
  delayMs?: number;
  iterations?: number | 'infinite';
  reducedMotion: 'disable' | 'shorten' | 'keep';
};
```

Compiler เลือก CSS keyframes เป็น default; Web Animations API ใช้เฉพาะ interaction ที่ต้องควบคุม runtime ห้ามสร้าง inline JavaScript จากผู้ใช้

### 10.5 SVG output modes

- `inline`: ต้องการ theme binding/animation/control ภายใน
- `img`: isolation และ cache ดี เหมาะ static graphic
- `mask`: icon monochrome ที่เปลี่ยนสีด้วย CSS
- `background`: decoration ที่ไม่ใช่ content

Studio แนะนำ output mode อัตโนมัติ และบังคับ alt/aria ตามบทบาทภาพ

---

## 11. Theme Editor และ CSS Editor

ข้อเสนอคือรวมเป็น **Theme Studio** แต่มี CSS workspace อยู่ภายใน เพราะผู้ใช้คิดเรื่องสี/spacing/typography/component state ร่วมกัน

### 11.1 Theme Layers

ลำดับ cascade ที่ชัดเจน:

```text
Platform Base Theme
  → App Theme Override
    → Tenant Theme Override
      → Page Styles
        → Template Scoped Styles
          → Component Variant
            → Instance Overrides
```

ต้องแสดง source ของค่าทุกตัว เช่น `primary = Tenant override` และ reset กลับ layer ก่อนหน้าได้

### 11.2 Design Tokens

- colors: semantic (`primary`, `surface`, `text`, `danger`) ไม่ผูกชื่อกับสี
- typography: family, size scale, weight, line-height
- spacing scale
- radius, border, shadow
- breakpoints/container widths
- motion duration/easing
- z-index layers

Token ถูก compile เป็น CSS variables และรองรับ light/dark/high-contrast mode

```css
:root {
  --color-primary: #4f46e5;
  --color-surface: #ffffff;
  --space-4: 1rem;
  --radius-md: 0.5rem;
  --motion-fast: 160ms;
}
```

### 11.3 Scoped CSS

เอกสารทุกฉบับมี immutable scope ID เช่น `hs-tpl-a83f`; compiler prefix selector หรือใช้ CSS scoping strategy ที่รองรับ browser เป้าหมาย:

```css
/* authored */
.hero .cta:hover { transform: translateY(-2px); }

/* compiled */
[data-hs-scope="tpl-a83f"] .hero .cta:hover { transform: translateY(-2px); }
```

`@keyframes` ต้อง rename เช่น `tpl-a83f__pulse` เพื่อไม่ชนกัน CSS global อนุญาตเฉพาะผู้มีสิทธิ์และต้องมี impact preview

### 11.4 CSS generation options

- Selected class: export rule ของ class/state/breakpoint ที่เลือก
- Selected component: รวม rules และ keyframes ที่ component ใช้
- Template/Page: tree-shaken CSS ของ document
- Theme package: tokens + component variants

Generated CSS ต้อง deterministic เพื่อ diff/version ได้ ไม่ควร generate utility class แบบสุ่มทุก save

### 11.5 Style Inspector

- visual controls เขียน structured declarations
- class manager แยก class ที่ reuse กับ instance override
- state tabs: base/hover/focus/active/disabled
- breakpoint tabs: base/tablet/mobile และแสดง inheritance
- computed style แสดง authored value, token และ source layer
- lint: invalid property, duplicate/conflict, inaccessible focus, expensive filter, unsupported browser

---

## 12. Data Binding และ Collection Integration

### 12.1 Data Context

```ts
type TemplateDataContext = {
  input: Record<string, unknown>;
  page: { id: string; slug: string };
  route: { params: Record<string, string>; query: Record<string, string> };
  user: { id?: string; roles: string[] }; // expose เท่าที่ policy อนุญาต
  tenant: { id: string };
  locale: string;
  theme: Record<string, string>;
  collections: Record<string, CollectionState>;
};
```

### 12.2 Query Builder ระยะแรก

ผู้ใช้เลือก:

- Collection
- published view
- visible fields
- sort
- filter จากค่าคงที่/input/route/user ที่ allowlist
- pagination/limit

Studio บันทึก declarative query ไม่บันทึก SQL:

```json
{
  "collectionRef": "collection://col_customers",
  "view": "published-list",
  "select": ["id", "full_name", "avatar_asset_ref"],
  "filter": [{ "field": "status", "op": "eq", "value": "active" }],
  "sort": [{ "field": "created_at", "direction": "desc" }],
  "limit": 12
}
```

Server/runtime data service ตรวจ manifest, field permission, tenant scope และ row-level policy อีกครั้ง Template ไม่ได้รับ credential และไม่เรียก DB โดยตรง

### 12.3 Preview Data

- Schema-generated mock
- user-defined sample set ที่ไม่มีข้อมูลจริงสำคัญ
- authorized preview จาก staging/runtime
- state simulation: loading, empty, 1 item, many items, error

ต้องแสดงชัดว่า preview ใช้ Mock หรือ Live และห้าม cache live sensitive data ลง template document

---

## 13. Actions, Forms และ Workflow

HTML Studio ไม่ควรสร้าง JavaScript handler ให้ bind event กับ Action/Workflow registry:

```html
<button studio:on-click="workflow://wf_open_customer" studio:payload="{ id: customer.id }">
  เปิดข้อมูล
</button>
```

หรือเลือกจาก Inspector:

- Navigate to Page
- Open external URL
- Trigger Workflow
- Submit Form
- Open Modal
- Download Asset

Compiler ตรวจ payload schema และ permission Action runtime ส่ง event กลับ `onActionTrigger` ของ `DynamicPageRenderer` ที่มีอยู่ แล้ว Workflow Interpreter รับช่วงต่อ

Form template ต้องใช้ shared form/input component หรือ declarative form binding เพื่อให้ validation, CSRF, permission และ accessibility เป็นมาตรฐานเดียวกัน ห้าม arbitrary `<form action>` ไป endpoint ภายในโดยตรง

---

## 14. Compiler และ Runtime Architecture

```text
HTML Studio Document
   │
   ├─ Parse / Normalize AST
   ├─ Resolve dependency manifests
   ├─ Validate schema, refs, policy, accessibility
   ├─ Compile shared tags / repeat / condition / bindings
   ├─ Scope + optimize CSS and SVG
   └─ Produce immutable Publish Artifact
                  │
          Platform Runtime Loader
                  │
        HtmlTemplateRuntime Component
                  │
      Reference Resolver + Data Service
```

### 14.1 Publish Artifact

```ts
type HtmlTemplateArtifact = {
  templateId: string;
  revision: string;
  schemaVersion: number;
  renderAst: RuntimeNode[];
  cssText: string;
  dependencies: {
    components: Array<{ id: string; version: string }>;
    assets: Array<{ id: string; revision: string }>;
    collections: Array<{ id: string; view: string }>;
    pages: Array<{ id: string }>;
  };
  integrity: string;
  compiledAt: string;
};
```

แนะนำ runtime interpreter จาก `renderAst` มากกว่าการต่อ HTML string แล้ว `dangerouslySetInnerHTML` เพราะ shared React components, collection states, action และ slots ต้องมี lifecycle อย่างไรก็ตาม static subtree ที่ผ่าน sanitizer แล้วสามารถ render เป็น sanitized HTML เพื่อ performance ได้

### 14.2 Preview/Production parity

- compiler package เดียวกัน
- resolver interface เดียวกัน
- manifest snapshot ชุดเดียวกัน
- Preview เปลี่ยนเพียง context/base URL/mock adapter
- Publish test ต้อง compile template แล้ว render smoke test อย่างน้อย desktop/mobile และ loading/empty/data states

### 14.3 Caching

- cache artifact ด้วย `templateId + revision`
- asset immutable revision cache ระยะยาว
- resolver manifest cache ตาม app publish revision
- collection response cache ตาม data policy ไม่รวมข้าม tenant
- invalidation เป็น revision-based ไม่ไล่ลบ URL เดิม

---

## 15. Persistence และ API ที่เสนอ

### 15.1 ตารางหลัก

```text
html_templates
- id, platform_id, app_id, tenant_id, scope, kind, name
- draft_document_json, published_revision_id
- schema_version, created_by, updated_by, created_at, updated_at

html_template_revisions
- id, template_id, revision_no, source_document_json
- compiled_artifact_json, dependency_manifest_json, integrity
- status, published_by, published_at

shared_component_manifests
- id, scope, tag_name, version, renderer_type
- props_schema_json, slots_json, events_json, capabilities_json

site_map_entries
- id, app_id, page_id, slug, path_pattern, parent_id
- locale_paths_json, required_params_json, status

assets
- id, scope, kind, logical_name, mime_type, current_revision_id, metadata_json

asset_revisions
- id, asset_id, revision, storage_key, variants_json, integrity, status

svg_template_metadata
- asset_id, category, editable_parameters_json, motion_tracks_json
```

ใช้ RLS/authorization ตาม platform/app/tenant scope และแยก draft/published permission

### 15.2 API surface

```text
GET/POST   /api/studio/templates
GET/PATCH  /api/studio/templates/:id
POST       /api/studio/templates/:id/validate
POST       /api/studio/templates/:id/compile
POST       /api/studio/templates/:id/publish
GET        /api/studio/templates/:id/revisions

GET        /api/studio/manifests/components
GET        /api/studio/manifests/site-map
GET        /api/studio/manifests/collections

GET/POST   /api/studio/assets
POST       /api/studio/assets/import
POST       /api/studio/assets/:id/publish
GET        /api/runtime/assets/:id/:revision/:variant

GET        /api/runtime/templates/:id/:revision
POST       /api/runtime/collections/:id/query
```

ทุก write endpoint ใช้ optimistic concurrency (`version`/ETag) เพื่อป้องกัน tab หนึ่งเขียนทับอีก tab

---

## 16. Security Model

HTML Studio เป็นจุดเสี่ยงสูงเพราะรับ HTML/CSS/SVG จึงต้องออกแบบ policy ก่อนเปิด production

### 16.1 HTML

- allowlist tags/attributes ตาม role และ template kind
- ลบ `script`, inline event เช่น `onclick`, iframe/object/embed โดย default
- URL protocol allowlist (`https`, internal reference, อาจอนุญาต `mailto`, `tel`)
- `style` inline แปลงเข้า structured/scoped stylesheet เท่าที่ทำได้
- sanitize ทั้งตอน import, save/compile และ defense-in-depth ตอน runtime

### 16.2 CSS

- block/inspect `@import`, remote font URL, behavior, expression และ data URL ตาม policy
- จำกัด global selector, `:root`, `html`, `body` ใน component scope
- rebase/rewrite URL ผ่าน asset resolver
- resource/performance budget สำหรับ filter, animation และ CSS size

### 16.3 SVG

- remove script/event handler/foreignObject/external href
- normalize IDs และ rewrite references
- จำกัด embedded raster size, path count และ filter complexity
- SVG ที่มาจากภายนอกต้องไม่ถูก trusted เพียงเพราะนามสกุล `.svg`

### 16.4 Data และ permission

- Collection query server-side เท่านั้น
- field-level allowlist และ tenant enforcement
- template capability manifest เป็น deny-by-default
- preview live data ต้อง audit
- secrets/API tokens ห้ามอยู่ใน document/artifact

### 16.5 CSP

Runtime ควรใช้ CSP ที่ไม่อนุญาต unsafe script; style ใช้ stylesheet artifact หรือ nonce/hash ตาม deployment model ห้ามแก้ปัญหาด้วย `unsafe-eval`

---

## 17. Versioning, Dependency และ Portability

### 17.1 Draft/Publish

- autosave draft
- explicit publish
- published revision immutable
- rollback คือชี้ current revision ไป artifact เก่า ไม่แก้ของเก่า
- compare visual + AST/CSS diff

### 17.2 Component version policy

- `locked`: template pin exact version เหมาะ production critical
- `compatible`: รับ minor/patch ตาม manifest compatibility
- `latest`: ใช้เฉพาะ draft/prototyping

Publish ต้อง snapshot resolved dependency versions เพื่อ reproducible build

### 17.3 Export package

```text
template.json
styles.json
preview.png
dependencies.json
assets/ (เฉพาะที่อนุญาตให้ bundle)
README.md
```

Import Wizard map missing Shared Component/Collection/Page/Asset และห้ามเดา mapping จากชื่อโดยอัตโนมัติหากมีความกำกวม

---

## 18. Accessibility และ Quality Gates

ก่อน publish ตรวจอย่างน้อย:

- image content มี alt; decorative image ใช้ empty alt/aria-hidden
- heading order
- form label/error association
- keyboard focus และ visible focus
- link/button semantic
- color contrast ตาม theme/mode
- duplicate DOM/SVG IDs
- animation รองรับ `prefers-reduced-motion`
- responsive overflow ที่ viewport เป้าหมาย
- missing/invalid refs
- template/CSS/SVG size budget
- collection มี loading/empty/error state

แบ่งผลเป็น Error (publish ไม่ได้), Warning (publish ได้ตาม permission) และ Info

---

## 19. แนวทางเชื่อมกับโค้ดปัจจุบัน

### 19.1 สิ่งที่ควรเพิ่ม

```text
src/components/html-studio/
  HtmlStudioShell.tsx
  StudioCanvas.tsx
  ElementLibrary.tsx
  StudioInspector.tsx
  StudioOutline.tsx
  StudioSourceEditor.tsx
  StudioDiagnostics.tsx

src/components/svg-studio/
  SvgCanvas.tsx
  SvgLayers.tsx
  SvgInspector.tsx
  MotionTimeline.tsx

src/components/theme-studio/
  ThemeStudio.tsx
  TokenEditor.tsx
  ScopedCssEditor.tsx

src/lib/html-studio/
  ast.ts
  parser.ts
  serializer.ts
  compiler.ts
  validator.ts
  sanitizer.ts
  referenceResolver.ts
  expressionEngine.ts
  dependencyGraph.ts

src/components/shared/HtmlTemplateComponent.tsx
```

### 19.2 สิ่งที่ต้องแก้

- เพิ่ม `HtmlTemplateComponent` ใน `ComponentType`, `COMPONENT_REGISTRY` และ palette
- เปลี่ยน `StudioHtmlEditor` ให้เป็น rich-text sub-editor หรือ compatibility editor ไม่ใช้เป็น page canonical editor
- เพิ่ม template/siteMap/assets/shared component manifests ใน runtime payload หรือ lazy runtime endpoints
- ให้ `DynamicPageRenderer` ส่ง `runtimeContext` เข้า `HtmlTemplateComponent`
- ขยาย `ThemeConfig` เป็น token groups/modes โดยมี migration จาก fields เดิม
- เชื่อม Assets section ที่ปัจจุบัน upload disabled กับ managed asset APIs
- เพิ่ม route/page stable ID; `pageSlug` ยังคงเป็น display/routing fieldแต่ไม่ใช่ reference identity

### 19.3 Backward compatibility

`DynamicHtmlComponent` เดิมยังใช้ได้ แต่กำหนดเป็น Legacy HTML Block:

1. เปิด legacy content ใน import mode
2. sanitize/parse เป็น Studio AST
3. แสดง unsupported constructs
4. บันทึกเป็น template ใหม่เมื่อผู้ใช้ยืนยัน
5. ไม่ migrate อัตโนมัติหาก source มีสิ่งที่อาจสูญหาย

แก้ prop inconsistency ปัจจุบันด้วย: palette ใช้ `initialHtml` แต่ `HtmlEditorComponent` รับ `initialContent`; migration/adapter ต้องรองรับทั้งสองชื่อชั่วคราวแล้วกำหนด canonical prop เดียว

---

## 20. Roadmap ที่แนะนำ

### Phase 0 — Contracts/Foundation (2–3 สัปดาห์)

- stable IDs และ manifests: page, asset, component, collection
- Studio document schema + migrations
- reference resolver interface
- sanitizer/security policy
- `HtmlTemplateComponent` runtime skeleton

**Exit criteria:** template static หนึ่งชิ้น render ใน Studio/Runtime ด้วย artifact เดียวกัน และ internal page/asset refs resolve ได้ทั้ง preview/production

### Phase 1 — HTML Composer MVP (4–6 สัปดาห์)

- element/section drag drop, outline, inspector
- visual/source round-trip สำหรับ supported HTML
- responsive preview
- shared component tag + props/slots
- scoped CSS basic
- save/version/validate/publish

**Exit criteria:** สร้าง landing page โดยไม่เขียน code, ฝังใน PageLayout เดิม และเปลี่ยน page slug/asset storage โดย template ไม่เสีย

### Phase 2 — Collection & Actions (3–5 สัปดาห์)

- collection picker/schema/skeleton
- repeat, field, condition, states
- mock/live preview policy
- navigate/workflow/form bindings

**Exit criteria:** สร้าง collection card grid พร้อม loading/empty/error และ detail link โดยไม่ query raw table

### Phase 3 — Theme Studio (3–4 สัปดาห์)

- token groups/modes/layers
- class/state/breakpoint inspector
- scoped CSS editor/generator
- contrast/style diagnostics

**Exit criteria:** เปลี่ยน theme platform/app/tenant โดย template ใช้ token และไม่มี style leakage

### Phase 4 — SVG & Motion Studio (5–8 สัปดาห์)

- SVG import/sanitize/vector editing
- asset revisions/templates/categories
- preset/state/timeline motion
- CSS keyframe compilation + reduced motion

**Exit criteria:** สร้าง animated icon/background, บันทึก Asset Library และใช้ซ้ำในสอง template ได้

### Phase 5 — Hardening (ต่อเนื่อง)

- dependency/version UI, export/import mapping
- accessibility and performance gates
- visual regression/render tests
- audit/permission/RLS
- caching/CDN/large-document performance

---

## 21. ลำดับความสำคัญและการตัดสินใจเชิงผลิตภัณฑ์

### Must Have

1. Reference Resolver + manifests
2. Document AST + compiler + sanitizer
3. Shared Component tag/props/slots
4. Site Map และ Asset picker แบบ stable ID
5. Collection skeleton/repeat/field
6. scoped CSS + theme token
7. publish artifact/version

### Should Have

- split source editor, diagnostics, responsive/state preview
- mock/live data switch
- SVG import/edit/basic presets
- CSS animation presets

### Could Have หลังระบบหลักเสถียร

- advanced path morphing
- bitmap tracing
- AI-assisted section/SVG generation
- real-time multi-user collaboration
- marketplace ของ templates

เหตุผลที่ SVG Studio ไม่ควรมาก่อน resolver/compiler คือ ต่อให้สร้าง graphic ได้ดี หาก asset path, scoping และ publish artifact ยังไม่เสถียร งานจะใช้ใน production ไม่ได้อย่างน่าเชื่อถือ

---

## 22. Acceptance Scenarios

### Scenario A — Shared Component

ผู้ใช้ลาก `CustomerCard` เข้า HTML Studio, Inspector สร้าง fields ตาม manifest, bind `name` กับ collection field และใส่ Button ใน actions slot เมื่อ component เปลี่ยน display name template ยัง render ได้เพราะอ้างด้วย component ID

### Scenario B — Production-safe navigation

ผู้ใช้เลือกหน้า Customer Detail จาก Site Map และ map parameter `id`; หลัง deploy ภายใต้ `/app/acme` และเปลี่ยน slug จาก `/customer/:id` เป็น `/customers/:id` link ยังถูกต้องโดยไม่แก้ template

### Scenario C — Asset

ผู้ใช้เลือก hero image ด้วย Asset ID; preview ใช้ preview adapter ส่วน production ใช้ CDN variant `web-1600` โดย HTML document เดิมไม่เปลี่ยน

### Scenario D — Collection skeleton

Designer สร้าง Product Card จาก placeholder fields ก่อน backend พร้อม ภายหลัง developer publish `products` Collection แล้ว map `title/image/price`; layout และ CSS เดิมยังอยู่ครบ

### Scenario E — SVG animation

ผู้ใช้นำ SVG icon เข้า Studio, sanitize, bind fill กับ `--color-primary`, เพิ่ม draw-path on load, กำหนด reduced-motion เป็น disable และ save เป็น category `icon-animation`; template อื่นลากมาใช้ได้ทันที

### Scenario F — CSS isolation

สอง templates มี class `.card` ต่างกัน เมื่อวางหน้าเดียวกัน compiled scope ทำให้ style ไม่ชนกัน และ global impact analyzer ไม่พบ selector รั่ว

---

## 23. ความเสี่ยงและแนวทางลดความเสี่ยง

| ความเสี่ยง | ผลกระทบ | แนวทาง |
|---|---|---|
| Visual/Source round-trip สูญเสียข้อมูล | งานผู้ใช้พัง | supported syntax contract, AST canonical, last-valid preview, source preservation |
| XSS ผ่าน HTML/SVG/CSS | ร้ายแรง | allowlist sanitizer, CSP, no script, multi-stage validation |
| component/version เปลี่ยนแล้ว template พัง | production regression | manifests, semver policy, dependency snapshot, compatibility test |
| path ต่างกันทุก environment | link/asset เสีย | stable refs + context resolver เท่านั้น |
| CSS รั่ว | หน้าอื่นเสีย | scoped by default, keyframe rename, global permission |
| Studio ใหญ่และช้า | UX แย่ | lazy panels, iframe canvas, incremental compile, worker, AST patch |
| Collection เปิดข้อมูลเกินสิทธิ์ | data leak | server-side declarative query, field/RLS/tenant policy |
| SVG ซับซ้อนเกินขอบเขต | roadmap ล่าช้า | เริ่ม presets/basic vector, ไม่ทำ full illustration suite ใน MVP |

---

## 24. KPI หลังเปิดใช้

- เวลาเฉลี่ยจาก blank ถึง publish หน้าแรก
- สัดส่วนหน้าที่สร้างโดยไม่แก้ source code
- จำนวน reusable templates/shared components/assets ต่อ app
- unresolved reference และ publish failure rate
- production incidents จาก broken link/path/style collision/XSS
- เวลาในการเปลี่ยน theme ต่อ app/tenant
- อัตรา reuse ของ SVG templates
- accessibility warning ต่อ published page
- parity defects ระหว่าง preview กับ production

---

## 25. ข้อสรุป

HTML Studio ที่เหมาะกับระบบนี้ควรเป็น **Template Compiler + Visual IDE ที่เกาะอยู่บน Platform Runtime เดิม** ไม่ใช่ HTML editor แยกอีกตัวหนึ่ง หัวใจไม่ใช่จำนวน toolbar แต่คือ stable reference, manifests, AST, scoped styling, safe data binding และ reproducible publish artifact

ลำดับการสร้างที่ให้ผลดีที่สุดคือ:

1. วาง Reference Resolver และ manifest contracts
2. เพิ่ม `HtmlTemplateComponent` และ document/compiler pipeline
3. ทำ Visual HTML + Shared Component + Collection skeleton
4. รวม Theme/CSS เป็น Theme Studio
5. เพิ่ม SVG/Motion Studio บน Asset pipeline เดียวกัน

เมื่อทำตามโครงนี้ ผู้ใช้จะลากวางหรือป้อนข้อมูลเพียงเล็กน้อยเพื่อสร้างหน้าได้ ขณะเดียวกัน developer ยังตรวจ source/debug/version ได้ และ template เดียวกันจะทำงานตั้งแต่ Studio Preview ถึง Production โดยไม่ต้องไล่แก้ URL หรือ asset path ภายหลัง

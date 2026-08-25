# Gen Page From Image

> สถานะ: Product & Technical Design Specification  
> เป้าหมาย: สร้าง Page Layout, Fixed-data Collections และ Component variants จากภาพอ้างอิง ก่อนส่ง schema ที่ผ่านการยืนยันไปสร้าง Query/Raw Table binding  
> ตัวอย่างหลัก: Dashboard ระบบหลังบ้าน อบต.ยาง

---

## 1. Outcome

`Gen Page From Image` ไม่ใช่เครื่องมือแปลงภาพเป็น HTML แบบ pixel dump แต่เป็น pipeline สำหรับสร้างโครงสร้าง Low-code ที่แก้ไขและผูกข้อมูลต่อได้:

```text
Reference Image
  → Visual Segmentation
  → Bootstrap Grid Layout
  → Semantic Section Analysis
  → Shared Component Matching
  → Fixed-data Collection Inference
  → Six Component Groups + Variants
  → Visual Scoring / Best Match
  → Editable Page Draft
  → Query Requirement Contract
  → Query Builder / Raw Table Binding
```

ผลลัพธ์รอบแรกต้องประกอบด้วย:

1. `GeneratedPageDraft` ซึ่งมี Bootstrap container/row/col และ responsive layout
2. `GeneratedSection[]` พร้อม bounding box, component role และ confidence
3. `GeneratedCollection[]` พร้อม fields, inferred types และ fixed records จากภาพ
4. Component candidates 6 กลุ่มพร้อมคะแนนความเหมือน
5. Component tree ที่เลือก variant เหมาะสมที่สุดแล้ว
6. Style tokens และ scoped CSS ที่ได้จากภาพ
7. `QueryRequirement[]` สำหรับสร้าง Query ในขั้นถัดไป
8. Diagnostics และรายการที่ผู้ใช้ต้องยืนยัน

ระบบต้องไม่สร้าง SQL ในรอบวิเคราะห์ภาพ การสร้าง Query เริ่มหลัง Collection contract ถูกยืนยันแล้วเท่านั้น

---

## 2. Entry Point และ UX

เพิ่มคำสั่งใน Studio:

```text
File > Generate Page From Image…
Page Manager > New > From Image
Canvas Empty State > Generate from Screenshot
```

Wizard มี 5 ขั้น:

1. **Reference** — upload/paste image, ระบุชื่อหน้า, viewport และประเภทหน้า
2. **Sections** — ตรวจ section, row, column และ responsive assumption
3. **Data & Components** — ตรวจ fields, fixed records, Collection และ candidate components
4. **Compare** — preview variants, overlay ภาพต้นฉบับ, เลือก/ล็อก variant
5. **Generate** — สร้าง Page Draft, Collections และ Query Requirements

ทุกขั้นบันทึก draft ได้และย้อนกลับได้ การ Generate ต้องสร้าง revision ใหม่ ห้ามเขียนทับ Page ที่ publish แล้วโดยไม่มี confirmation

---

## 3. Phase 1 — Scope และ Bootstrap Grid Segmentation

### 3.1 Image normalization

ก่อนวิเคราะห์ให้เก็บ:

```ts
interface ImageReference {
  assetId: string;
  url: string;
  width: number;
  height: number;
  viewport: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  deviceScale?: number;
  crop?: { x: number; y: number; width: number; height: number };
  backgroundColor?: string;
}
```

- ตัด browser chrome ออกจากภาพ หากตรวจพบ
- แก้ perspective/scale เฉพาะเมื่อภาพไม่ตรงแนว
- เก็บภาพต้นฉบับเสมอ; normalized image เป็น derivative
- ใช้ coordinate แบบ normalized `0..1` เพื่อรองรับหลาย resolution

### 3.2 Section detection

ใช้ข้อมูลหลายชั้นร่วมกัน:

- whitespace และเส้นขอบ
- background/color region
- alignment ของขอบซ้าย/ขวา
- repeated card geometry
- OCR text hierarchy
- icon/image clusters
- visual density

ผลลัพธ์:

```ts
interface GeneratedSection {
  id: string;
  name: string;
  role: 'topbar' | 'breadcrumb' | 'summary' | 'content' | 'sidebar' | 'toolbar' | 'footer' | 'unknown';
  bounds: { x: number; y: number; width: number; height: number };
  bootstrap: {
    container: 'container' | 'container-fluid';
    rows: GeneratedRow[];
  };
  confidence: number;
  evidence: string[];
}

interface GeneratedRow {
  id: string;
  gap: number;
  columns: Array<{
    id: string;
    xs: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}
```

### 3.3 Bootstrap classification rules

- column width ใกล้ `1/12` ให้ snap เป็น Bootstrap span
- ถ้าสี่ card กว้างเท่ากัน → `col-12 col-md-6 col-xl-3`
- ถ้าสอง card กว้างเท่ากัน → `col-12 col-md-6`
- content/sidebar สัดส่วนประมาณ `9:3` → `col-12 col-xl-9` + `col-12 col-xl-3`
- element ที่สูงไม่เท่ากันแต่เริ่มแนวเดียวกันให้อยู่ row เดียวกัน
- element ที่กินเต็มความกว้างและมี background/spacing แยกเป็น section
- desktop screenshot ต้องสร้าง responsive assumption ไม่ใช่ fixed pixel width

### 3.4 Worked example: Dashboard image

ภาพตัวอย่างจำแนกได้ 5 logical sections:

| # | Section | Bootstrap structure | Evidence |
|---|---|---|---|
| 1 | Header / Account | `container-fluid > row > col-6 + col-6` | ชื่อหน้าอยู่ซ้าย, notification/account อยู่ขวา, border ทองเต็มแนว |
| 2 | Breadcrumb | `container-fluid > row > col-12` | Home icon และลำดับ navigation |
| 3 | KPI Summary | `container-fluid > row g-3 > 8 × col-12 col-md-6 col-xl-3` | card ขนาดซ้ำ 4 ใบต่อแถว รวม 2 แถว |
| 4 | Main Dashboard | `row g-3 > col-12 col-xl-9 + col-12 col-xl-3` | ข่าวล่าสุดด้านซ้าย, sidebar ด้านขวา |
| 5 | Right Sidebar Stack | ภายใน `col-xl-3`: `row > col-12 + col-12` | สถิติผู้เข้าชมและทางลัดวางซ้อนแนวตั้ง |

Draft layout:

```html
<main class="container-fluid dashboard-page py-3">
  <section class="row"><div class="col-12">Breadcrumb</div></section>
  <section class="row g-3 mt-1">
    <div class="col-12 col-md-6 col-xl-3">KPI × 8</div>
  </section>
  <section class="row g-3 mt-1 align-items-stretch">
    <div class="col-12 col-xl-9">Latest news</div>
    <aside class="col-12 col-xl-3">
      <div class="row g-3"><div class="col-12">Visitor stats</div><div class="col-12">Quick actions</div></div>
    </aside>
  </section>
</main>
```

---

## 4. Phase 2 — Deep Section Analysis และ Shared Component Matching

### 4.1 Semantic element contract

แต่ละ visual cluster ถูกแปลงเป็น semantic requirement ก่อนเลือก Component:

```ts
interface ComponentRequirement {
  id: string;
  sectionId: string;
  role: string;
  repeated: boolean;
  interaction: Array<'navigate' | 'create' | 'edit' | 'select' | 'filter' | 'view-all'>;
  visual: {
    orientation: 'horizontal' | 'vertical' | 'grid';
    icon: boolean;
    image: boolean;
    title: boolean;
    subtitle: boolean;
    badge: boolean;
    status: boolean;
    chart: boolean;
  };
  fieldHints: InferredField[];
  candidateComponentTypes: string[];
  confidence: number;
}
```

### 4.2 Shared Components ของภาพตัวอย่าง

| Section | Visual role | Shared Component ที่เหมาะสม | Data shape |
|---|---|---|---|
| Header | page title/account actions | `NavMenuComponent` หรือ `DynamicHtmlComponent` variant `admin-topbar` | title, account, notification |
| Breadcrumb | navigation trail | `NavMenuComponent` variant `breadcrumb` | label, href, active |
| KPI Summary | repeated metrics | `CardComponent` variant `metric-icon` ภายใน `ListComponent`/repeat | value, label, subtitle, icon, color, route |
| Latest news | dense status list | `ListComponent` variant `compact-status-list` | title, publishAt, category, status, url |
| Visitor Stats | counters + sparkline | `ChartComponent` variant `visitor-mini-chart` | today, sevenDays, date series |
| Quick Actions | button grid | `NavMenuComponent` variant `quick-action-grid` | label, icon, actionId, route, permission |

### 4.3 Matching algorithm

คะแนน candidate รวมจาก:

```text
componentScore =
  0.25 × structureMatch
  + 0.20 × fieldCoverage
  + 0.15 × interactionMatch
  + 0.15 × repetitionMatch
  + 0.15 × visualSimilarity
  + 0.10 × existingDesignSystemReuse
```

- candidate ที่ field coverage ต่ำกว่า 70% ห้าม auto-select
- candidate ที่ confidence ต่ำกว่า 0.65 ต้องให้ผู้ใช้ยืนยัน
- Shared Component ที่มีอยู่ได้คะแนน reuse สูงกว่า generated raw HTML
- `DynamicHtmlComponent` เป็น fallback ไม่ใช่ตัวเลือกแรก
- ห้ามเลือก Component เพียงเพราะรูปร่างคล้าย หาก event/data contract ไม่ตรง

---

## 5. Phase 3 — Fixed-data Collection Inference

### 5.1 Principle

รอบแรกสร้าง Collection จากสิ่งที่มองเห็นจริงในภาพ:

- OCR text → string/date/number candidate
- repeated geometry → records
- icon/color → presentation fields
- link/button → action fields
- ไม่อ้าง raw table
- ไม่สร้าง foreign key ที่ภาพไม่ให้หลักฐาน
- เก็บ `source: image-fixed-data` และ confidence ทุก field

### 5.2 Collection contract

```ts
interface GeneratedCollection {
  id: string;
  name: string;
  source: 'image-fixed-data';
  sourceImageAssetId: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'url' | 'icon' | 'color' | 'enum' | 'json';
    required: boolean;
    semanticRole?: string;
    confidence: number;
    sampleValues: unknown[];
  }>;
  records: Array<Record<string, unknown>>;
  queryRequirement?: QueryRequirement;
}
```

### 5.3 Collections จากภาพ Dashboard

#### `generated.dashboard.metrics`

Fields:

| Field | Type | ตัวอย่าง |
|---|---|---|
| `id` | string | `news` |
| `label` | string | `ข่าวสาร / เนื้อหา` |
| `value` | number | `728` |
| `subtitle` | string | `เผยแพร่แล้ว 716 รายการ` |
| `icon` | icon | `newspaper` |
| `color` | color | `green` |
| `route` | url | inference pending |
| `sortOrder` | number | `1` |

Fixed records: ข่าว 728, หน้าเว็บ 38, ไฟล์ดาวน์โหลด 5, E-Book 0, บุคลากร 49, ภาพสไลด์ 10, ร้องเรียน 0, ผู้ใช้ 11

#### `generated.dashboard.latest-news`

Fields: `id`, `title`, `publishAt`, `categoryLabel`, `status`, `statusLabel`, `url`, `sortOrder`

Fixed records จากภาพ 7 แถว โดยใช้ข้อความ/วันที่/หมวดหมู่/สถานะที่มองเห็น OCR ได้ ห้ามสร้างเนื้อหารายละเอียดที่ไม่ปรากฏในภาพ

#### `generated.dashboard.visitor-summary`

Fields: `today`, `lastSevenDays`, `periodDays`, `updatedAt`

#### `generated.dashboard.visitor-series`

Fields: `date`, `count`, `highlight`

#### `generated.dashboard.quick-actions`

Fields: `id`, `label`, `icon`, `actionId`, `route`, `permission`, `sortOrder`

Fixed records: เพิ่มข่าวสาร, เพิ่มหน้าเว็บ, จัดการเมนู, ภาพสไลด์, อัปโหลดไฟล์, บุคลากร, ร้องเรียน, ผู้ใช้งาน

#### `generated.dashboard.breadcrumbs`

Fields: `label`, `href`, `active`, `sortOrder`

### 5.4 Field normalization

- ชื่อ field ใช้ `camelCase` ใน design contract
- ก่อนสร้าง Query ให้ mapping กับ physical column แยกต่างหาก
- วันที่ไทย/พุทธศักราชเก็บ raw OCR และ normalized ISO คู่กันเมื่อไม่มั่นใจ
- ตัวเลขที่มี separator แปลงเป็น number แต่เก็บ display format ใน component props
- icon ที่ระบุไม่ได้ใช้ semantic role เช่น `news` ไม่ผูกกับ library icon โดยทันที

---

## 6. Phase 4 — Component 6 Groups และ Variant Selection

ระบบใช้ 6 กลุ่มเดียวกับ Collection menu ใน Studio:

1. **Data Tables** — ตารางข้อมูลหนาแน่น, sortable/searchable
2. **Lists** — รายการแนวตั้ง, status list, activity feed
3. **Galleries** — image/card grid และ media collection
4. **View Details** — record detail/read-only presentation
5. **Documents** — file/document list, download card, attachment viewer
6. **Forms** — insert/update/read-only input layout

### 6.1 Generation rule

ทุก Generated Collection ต้องมี component candidate อย่างน้อยหนึ่งตัวต่อกลุ่ม แต่ candidate ที่ไม่เหมาะสมต้องระบุ `applicable: false` และเหตุผล ไม่ควรสร้าง UI ที่ไร้ความหมายเพียงให้ครบจำนวน

```ts
interface GeneratedComponentCandidate {
  id: string;
  collectionId: string;
  group: 'datatable' | 'list' | 'gallery' | 'view-detail' | 'document' | 'form';
  type: ComponentType;
  variant: string;
  applicable: boolean;
  score: number;
  scoreBreakdown: Record<string, number>;
  fieldMapping: Record<string, string>;
  props: Record<string, unknown>;
  componentTree: ComponentNode[];
  scopedStyle: string;
}
```

### 6.2 Candidate example

`generated.dashboard.latest-news`:

| Group | Candidate | Score | Result |
|---|---|---:|---|
| Data Tables | compact news table | 0.71 | available, not selected |
| Lists | compact status list | 0.94 | selected |
| Galleries | news card gallery | 0.43 | not applicable for reference image |
| View Details | news detail | 0.62 | generated for downstream navigation |
| Documents | attachment list | 0.20 | not applicable |
| Forms | news editor | 0.55 | generated only as quick-action target |

`generated.dashboard.metrics`:

- selected: `ListComponent` + repeated `CardComponent(metric-icon)`
- DataTable candidate ยังเก็บไว้แต่ไม่ใช้บนหน้า
- Gallery candidate ใช้ไม่ได้เพราะไม่มี image field

### 6.3 Visual comparison

Render candidate ด้วย viewport เดียวกับภาพ แล้วคำนวณ:

- bounding-box alignment
- layout shift
- color distance
- typography scale
- border/radius/shadow similarity
- whitespace distribution
- OCR text placement
- perceptual image difference

ผู้ใช้ต้องเห็น overlay slider:

```text
[Reference 50% | Generated 50%]
Difference heatmap
Section confidence
Candidate switcher
Lock section
Regenerate selected section
```

การ regenerate section ที่ไม่ถูก lock ห้ามเปลี่ยน Collection ID หรือ field identity ของ section อื่น

---

## 7. Style Extraction

สร้าง token ก่อน scoped CSS:

```ts
interface GeneratedStyleTokens {
  colors: {
    pageBackground: string;
    surface: string;
    surfaceMuted: string;
    primary: string;
    accent: string;
    border: string;
    text: string;
    textMuted: string;
    success: string;
  };
  radius: { card: string; control: string; badge: string };
  spacing: Record<string, string>;
  typography: { family: string; base: string; headingWeight: number; bodyWeight: number };
  shadow: Record<string, string>;
}
```

ค่าประมาณจากภาพตัวอย่าง:

- background: เทาอมเขียวอ่อน
- surface: ขาว
- border: เขียวอ่อน
- primary/success: เขียวเทศบาล
- accent: ทอง/ส้มบริเวณ top border
- card radius: ประมาณ 14–16px
- compact body typography: 12–14px
- shadow เบามากหรือไม่มี

Style ต้อง scope ด้วย Page/Component scope ID ห้ามสร้าง global `.card`, `.row`, `.btn` override

---

## 8. Query Handoff

หลังผู้ใช้ยืนยัน Collection แล้ว จึงสร้าง `QueryRequirement`:

```ts
interface QueryRequirement {
  collectionId: string;
  purpose: string;
  requiredFields: Array<{
    logicalField: string;
    type: string;
    required: boolean;
    aggregation?: 'count' | 'sum' | 'max' | 'min' | 'none';
    filterHints?: Array<{ field: string; operator: string; value: unknown }>;
    sortHint?: { direction: 'asc' | 'desc' };
  }>;
  pagination?: { mode: 'offset' | 'cursor' | 'none'; pageSize?: number };
  freshness?: 'realtime' | 'minute' | 'hour' | 'daily';
  security: { tenantScoped: true; permission?: string };
}
```

ตัวอย่าง:

```json
{
  "collectionId": "generated.dashboard.latest-news",
  "purpose": "ข่าวล่าสุดบน Dashboard",
  "requiredFields": [
    { "logicalField": "id", "type": "number", "required": true },
    { "logicalField": "title", "type": "string", "required": true },
    { "logicalField": "publishAt", "type": "datetime", "required": true, "sortHint": { "direction": "desc" } },
    { "logicalField": "categoryLabel", "type": "string", "required": false },
    { "logicalField": "status", "type": "number", "required": true, "filterHints": [{ "field": "status", "operator": "=", "value": 1 }] }
  ],
  "pagination": { "mode": "offset", "pageSize": 7 },
  "freshness": "minute",
  "security": { "tenantScoped": true, "permission": "cms" }
}
```

Query Builder ทำงานต่อโดย:

1. ค้นหา table/collection candidates จาก schema
2. ให้คะแนน column mapping กับ logical fields
3. แสดง join ที่จำเป็น
4. preview records เทียบ fixed data
5. bind Query adapter เข้ากับ Generated Collection
6. เก็บ fixed data เป็น fallback/mock สำหรับ Studio

---

## 9. Persistence Model

```ts
interface GenPageFromImageJob {
  id: string;
  platformId: string;
  pageId?: string;
  sourceImage: ImageReference;
  status: 'uploaded' | 'analyzing' | 'review' | 'generating' | 'complete' | 'failed';
  sections: GeneratedSection[];
  collections: GeneratedCollection[];
  candidates: GeneratedComponentCandidate[];
  selectedCandidateIds: string[];
  styleTokens: GeneratedStyleTokens;
  diagnostics: Array<{ severity: 'info' | 'warning' | 'error'; scopeId?: string; message: string }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

จัดเก็บ source image ใน Asset Library และอ้างด้วย Asset ID ไม่เก็บ base64 ใน Page JSON

---

## 10. Service Boundaries

```text
GenPageFromImageService
├── ImageNormalizer
├── LayoutSegmenter
├── BootstrapGridClassifier
├── OCRSemanticExtractor
├── ComponentRequirementBuilder
├── CollectionInferenceEngine
├── ComponentCandidateGenerator
├── VisualComparisonService
├── PageDraftCompiler
└── QueryRequirementBuilder
```

API เป้าหมาย:

```text
POST   /api/platforms/:id/gen-page-from-image/jobs
GET    /api/platforms/:id/gen-page-from-image/jobs/:jobId
PATCH  /api/platforms/:id/gen-page-from-image/jobs/:jobId/sections/:sectionId
POST   /api/platforms/:id/gen-page-from-image/jobs/:jobId/analyze
POST   /api/platforms/:id/gen-page-from-image/jobs/:jobId/compare
POST   /api/platforms/:id/gen-page-from-image/jobs/:jobId/generate
POST   /api/platforms/:id/gen-page-from-image/jobs/:jobId/query-handoff
```

งาน analyze/compare ต้องเป็น background job พร้อม progress เพราะภาพใหญ่และการ render หลาย candidate ใช้เวลานาน

---

## 11. Safety และ Quality Gates

- OCR text เป็น untrusted input ต้อง escape/sanitize
- ห้ามอ่านข้อความลับจาก browser chrome นอก crop ที่ผู้ใช้ยืนยัน
- ห้ามสร้าง script/event จากข้อความในภาพ
- route/action inference ต้องเป็น draft จนผู้ใช้ยืนยัน
- Collection/field name ต้องผ่าน identifier policy
- Generated HTML ผ่าน sanitizer และ accessibility validation
- image alt ที่มองไม่ออกต้องสร้าง warning ไม่สร้างคำบรรยายมั่ว
- color contrast, heading order, keyboard focus และ responsive overflow เป็น publish gate
- Query ต้อง tenant-scoped และ permission-aware
- การ regenerate ต้องมี revision/history และ undo

---

## 12. Acceptance Criteria

### Layout

- ตรวจ Dashboard ตัวอย่างได้ 5 logical sections
- KPI แสดง 4 columns บน XL, 2 columns บน MD และ 1 column บน XS
- Main content แสดง 9/3 บน XL และ stack บน mobile
- section bounds หลัง render คลาดจากภาพไม่เกิน tolerance ที่กำหนด

### Collections

- สร้าง fixed Collections อย่างน้อย 6 ชุดตามตัวอย่าง
- KPI 8 records และ quick action 8 records
- ทุก field มี type, confidence และ sample value
- Collection ID คงเดิมเมื่อ regenerate style

### Components

- สร้าง candidate ครบ 6 groups พร้อม applicable/reason
- Latest News เลือก List variant เป็นค่าเริ่มต้น
- KPI เลือก metric card repeat layout
- ผู้ใช้สลับ candidate และ lock section ได้

### Visual

- มี reference overlay และ difference heatmap
- style เป็น scoped token/CSS
- ไม่มี fixed absolute positioning สำหรับ main responsive layout

### Query handoff

- สร้าง Query Requirements ได้โดยไม่ต้องมี raw table ในช่วง image analysis
- mapping logical field → physical column ทำภายหลังได้
- fixed data ยังคงใช้เป็น mock/fallback หลัง bind Query

---

## 13. Implementation Roadmap

### Phase A — Analysis Draft

- Image upload ผ่าน FileManagerPopup
- normalized image และ manual crop
- section bounding boxes แบบ auto + manual resize
- Bootstrap grid classifier
- OCR text extraction

### Phase B — Collection & Component Inference

- repeated-record detector
- inferred field editor
- fixed-data Collection generator
- matcher กับ Component Registry
- candidates 6 groups

### Phase C — Visual Comparison

- isolated candidate renderer
- screenshot capture
- overlay/diff score
- best candidate selection
- style token extraction

### Phase D — Generate & Query Handoff

- Page Draft compiler
- save revision/history
- Query Requirement builder
- schema/column mapping UI
- mock → live adapter switch

### Phase E — Hardening

- accessibility/responsive gates
- large-image/background jobs
- regression corpus จากหน้าจอต้นฉบับหลายรูปแบบ
- audit, permission และ tenant isolation

---

## 14. Final Design Decision

หัวใจของฟังก์ชันนี้คือ **วิเคราะห์ภาพเพื่อสร้าง semantic Low-code contract** ไม่ใช่ลอก pixel เป็น HTML กล่าวคือ:

- Bootstrap Grid เป็น layout contract
- Shared Component เป็น behavior contract
- Collection เป็น data contract
- Style Token เป็น visual contract
- Query Requirement เป็น backend contract

เมื่อสี่ contract แรกผ่านการยืนยัน Query Builder จะมี field และรูปแบบข้อมูลเป้าหมายที่ชัดเจน จึงสามารถสร้าง Query, join, filter, aggregation และ pagination ให้ตรงกับหน้าจอได้โดยไม่ต้องย้อนกลับมาเดาโครงสร้างจากภาพอีกครั้ง

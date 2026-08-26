# MATCHANU — Low-Code Multi-Site Platform

ระบบ Low-Code แบบ **Multi-Tenant / Multi-Site** แยกเป็น "App แม่" (Studio / Control Plane) และ
"Site ลูก" ที่รันแยกโปรเซส แยกพอร์ต แยกโดเมน และแยกฐานข้อมูล โดยหน้าจอ ธีม ฟอร์ม และ Flow logic
ทั้งหมดเก็บเป็น **JSON AST** ในฐานข้อมูลกลาง แล้วดึงไป render สดที่ runtime

```
┌──────────────────────────────┐  บันทึก JSON AST   ┌──────────────────┐
│  App แม่ (Control Plane)      │ ─────────────────> │  Core DB         │
│  :33000                      │                    │  (PostgreSQL)    │
│  /admin /studio /flow-studio │ <───────────────── │  blueprint, user │
└──────────────────────────────┘   อ่าน registry     └────────┬─────────┘
                                                              │ site_registry
                          scripts/run-sites.mjs ──────────────┘
                                    │ spawn 1 process ต่อ 1 site
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌────────────────┐        ┌────────────────┐          ┌────────────────┐
│ site A  :33001 │        │ site B  :33002 │          │ site C  :33003 │
│ a.go.th        │        │ b.go.th        │          │ c.go.th        │
│ theme ของตัวเอง │        │ theme ของตัวเอง │          │ theme ของตัวเอง │
│ DB: app_db_a   │        │ DB: app_db_b   │          │ DB: app_db_c   │
└────────────────┘        └────────────────┘          └────────────────┘
                                    │
                            nginx reverse proxy :80
```

---

## สารบัญ

- [Tech Stack](#tech-stack)
- [เริ่มต้นใช้งาน](#เริ่มต้นใช้งาน)
- [Multi-Site & Multi-Domain](#multi-site--multi-domain)
- [Environment Variables](#environment-variables)
- [ฐานข้อมูล](#ฐานข้อมูล)
- [ความปลอดภัย](#ความปลอดภัย)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [เส้นทาง URL](#เส้นทาง-url)
- [API Reference](#api-reference)
- [Shared Component Library](#shared-component-library)
- [Studio Workflow](#studio-workflow)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [เอกสารออกแบบ](#เอกสารออกแบบ)
- [สิ่งที่ยังไม่ได้ทำ](#สิ่งที่ยังไม่ได้ทำ)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript strict) |
| UI | Bootstrap 5 + React-Bootstrap + Tailwind CSS 3 + lucide-react |
| Visual Flow | React Flow (`@xyflow/react` 12) |
| Rich Text | Tiptap 3 |
| Database | PostgreSQL 17 (`pg` Pool) + pgcrypto |
| Auth | HMAC-signed session cookie + bcrypt ผ่าน pgcrypto |
| Test / Lint | Vitest, ESLint 9 (flat config) |
| Container | Docker Compose + Nginx |

**ต้องมี:** Node.js 22+, npm 10+, Docker, PostgreSQL 17 (มาพร้อม compose)

---

## เริ่มต้นใช้งาน

### 1. Docker Compose (แนะนำ)

```bash
cp .env.example .env          # แล้วแก้ AUTH_SECRET เป็นค่าสุ่มยาว >= 32 ตัวอักษร
docker compose up -d --build
```

| Service | Container | Host Port | หน้าที่ |
|---|---|---|---|
| `core-db` | `lowcode_core_db` | `35432` | PostgreSQL + migration อัตโนมัติ |
| `pgadmin` | `lowcode_pgadmin` | `35433` | pgAdmin 4 |
| `studio-mother` | `lowcode_studio_mother` | `33000` | Control Plane |
| `sites` | `lowcode_sites` | `33001-33020` | ตัวรัน Site ทั้งหมด (1 โปรเซส/Site) |
| `nginx-proxy` | `lowcode_nginx_proxy` | `8080` | Reverse proxy ตามโดเมน |

เปิด <http://localhost:33000>

### 2. โหมดพัฒนา (Local)

```bash
npm ci
docker compose up -d core-db pgadmin

cat > .env.local <<'EOF'
CORE_DATABASE_URL=postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core
AUTH_SECRET=dev-secret-at-least-32-characters-long-xxxx
EOF

npm run dev            # Control Plane ที่ :33000
npm run sites:dev      # Site ทั้งหมด แต่ละตัวพอร์ตของตัวเอง
```

### 3. บัญชีเริ่มต้น

migration `010_create_platform_auth.sql` จะ seed สองบัญชีนี้ **เฉพาะตอนตาราง `platform_users` ว่าง**
ทั้งคู่ถูกตั้ง `must_change_password = TRUE`

| Username | Email | Password | Role |
|---|---|---|---|
| `admin` | `admin@platform.com` | `1qaz@WSX` | `SUPER_ADMIN` |
| `aloner` | `aloner@platform.com` | `1qaz@WSX` | `DEVELOPER` |

> ⚠️ เป็นบัญชี bootstrap สำหรับ dev เท่านั้น — เปลี่ยนรหัสผ่านทันทีก่อนเปิดให้เข้าถึงจากภายนอก
> รหัสผ่านถูก hash ด้วย bcrypt ในฐานข้อมูล ไม่มีรหัสผ่านอยู่ใน source code

---

## Multi-Site & Multi-Domain

**หนึ่ง Tenant App = หนึ่ง Site** มีพอร์ต โดเมน (ได้หลายโดเมน) ธีม และฐานข้อมูลของตัวเอง

### สร้าง Site ใหม่

1. `/admin/platforms` → สร้าง Platform Master (แม่พิมพ์)
2. `/admin/apps` → **Provision Tenant App** เลือก Platform + ตั้ง slug (พอร์ตจัดให้อัตโนมัติ)
3. กด **จัดการโดเมน** เพื่อผูกโดเมนเพิ่ม (เช่น `www.example.go.th`)
4. กด **ธีม** เพื่อเลือก preset / สีหลัก / ความมนของมุม / ฟอนต์ ของ Site นั้นโดยเฉพาะ
5. รัน `npm run sites` (หรือ `docker compose restart sites`) เพื่อให้ Site ใหม่ขึ้น

### ตัวรัน Site (`scripts/run-sites.mjs`)

อ่าน `public.site_registry` แล้ว spawn Next.js หนึ่งโปรเซสต่อหนึ่ง Site พร้อมส่ง
`SITE_SLUG`, `SITE_DOMAIN_MAP`, `TENANT_DB_NAME` เข้าไปเป็น env

```bash
npm run sites                      # production (ต้อง npm run build ก่อน)
npm run sites:dev                  # development
npm run sites:list                 # ดู registry เฉย ๆ
node scripts/run-sites.mjs --only=site-a,site-b
node scripts/run-sites.mjs --port-base=34000
```

โปรเซสจะถูก restart อัตโนมัติเมื่อ exit (สูงสุด 10 ครั้ง) และปิดอย่างสุภาพเมื่อได้รับ SIGTERM

### การ route

- **ตามพอร์ต** — แต่ละ Site ผูกพอร์ตของตัวเองจาก `apps.port`
- **ตามโดเมน** — middleware อ่าน `SITE_DOMAIN_MAP` (Edge-safe ไม่แตะ DB) แล้ว rewrite
  `/` → `/app/<slug>` ให้ Site เปิดที่ root ของโดเมนตัวเองได้
- โปรเซส Site จะ **404 ทุกเส้นทางของ Control Plane** (`/admin`, `/studio`, `/flow-studio`, `/audit-logs`)

### Nginx

```bash
# สร้าง nginx.conf จาก registry จริง (ต้อง login เป็น SUPER_ADMIN)
curl -s -b cookies.txt http://localhost:33000/api/nginx-config > docker/nginx/nginx.conf
docker compose restart nginx-proxy
```

Host ที่ไม่ตรงกับ Site ใดจะได้ `404` แทนที่จะหลุดไปเว็บอื่น

---

## Environment Variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `CORE_DATABASE_URL` | ✅ | connection string ของ Core DB |
| `AUTH_SECRET` | ✅ (production) | กุญแจเซ็น session อย่างน้อย 32 ตัวอักษร — ไม่ตั้งใน production จะ throw |
| `MAX_UPLOAD_BYTES` | ⭕ | ขนาดไฟล์อัปโหลดสูงสุด (default 10 MB) |
| `SITES_HOSTNAME` | ⭕ | interface ที่ Site bind (default `0.0.0.0`) |
| `SITE_SLUG` | อัตโนมัติ | Site ที่โปรเซสนี้ให้บริการ — ตั้งโดย `run-sites.mjs` |
| `SITE_DOMAIN_MAP` | อัตโนมัติ | JSON map `hostname → slug` — ตั้งโดย `run-sites.mjs` |
| `DOCKER_SOCKET_PATH` | ⭕ | default `/var/run/docker.sock` |
| `PLATFORM_RUNTIME_BASE_IMAGE` | ⭕ | default `lowcode-app:latest` |
| `PLATFORM_RUNTIME_NETWORK` | ⭕ | default `lowcode_network` |
| `APP_SURFACE` | ⭕ | `frontend` \| `backend` |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ⭕ | ใช้เฉพาะกรณีรัน schema ฝั่ง Supabase ด้วย |

ดูตัวอย่างเต็มที่ [.env.example](.env.example)

---

## ฐานข้อมูล

### Core DB — `docker/postgres/migrations/`

รันอัตโนมัติโดย `core-db` (mount ทั้งไดเรกทอรี จึงไม่มีทางลืม mount ไฟล์ใหม่)

| ไฟล์ | สร้าง |
|---|---|
| `001` | `platform_categories` + seed 9 category |
| `002` | `platforms` (+ studio/runtime columns) + seed 3 platform |
| `003` | `platform_page_flows` |
| `004` | runtime columns |
| `005` | `platform_table_samples` |
| `006` | `platform_design_configs` |
| `007` | `platforms.runtime_surfaces` |
| `008` | `platforms.studio_forms`, `studio_collections` |
| `009` | **Blueprint** — `first_public_page` enum, `platform_modules`, `platform_pages`, `platform_workflows`, `platform_audit_logs`, `create_platform_blueprint()` |
| `010` | **Auth** — `platform_users`, `platform_memberships`, `verify_platform_credentials()`, `set_platform_user_password()` |
| `011` | **Tenant Apps** — `apps`, `app_memberships`, `provision_tenant_app()` |
| `012` | **Multi-domain** — `app_domains`, view `site_registry` |
| `013` | `platforms.public_data_access` (allow-list ของ runtime สาธารณะ) |

### Tenant DB — หนึ่งฐานต่อหนึ่ง tenant

- Platform Master → `platform_<slug>`
- Tenant App → `app_db_<slug>`

สร้างอัตโนมัติเมื่อใช้งานครั้งแรก ([tenantDb.ts](src/lib/db/tenantDb.ts)) พร้อม schema `sys`:

| ตาราง | เก็บอะไร |
|---|---|
| `sys.runtime_snapshots` | snapshot ที่ publish แล้ว |
| `sys.structure_revisions` | ประวัติ revision ของโครงสร้างตาราง |
| `sys.design_configs` | config ที่ sync มาจาก Core DB |
| `sys.assets` | **ไฟล์อัปโหลดของ tenant นั้น** (bytea) |

> ไฟล์อัปโหลดอยู่ในฐานข้อมูลของ tenant เสมอ ไม่เคยเก็บใน Core DB — ข้อมูลและไฟล์ของแต่ละ
> tenant จึงย้ายไปพร้อมกับฐานข้อมูลของตัวเอง และ container ยังคง stateless

### Supabase (ทางเลือก)

[supabase/schema.sql](supabase/schema.sql) สำหรับผู้ที่ใช้ Supabase เป็น backend
มี **Row Level Security เปิดครบทุกตาราง** พร้อม 15 policy และ helper
`is_super_admin()` / `has_app_role()`

---

## ความปลอดภัย

| มาตรการ | ที่อยู่ |
|---|---|
| Session cookie เซ็นด้วย HMAC-SHA256 ตรวจทุก request (Edge-safe ผ่าน Web Crypto) | [session.ts](src/lib/auth/session.ts) |
| รหัสผ่าน bcrypt ตรวจในฐานข้อมูล + ล็อกบัญชี 15 นาทีเมื่อผิด 10 ครั้ง | [010_create_platform_auth.sql](docker/postgres/migrations/010_create_platform_auth.sql) |
| ทุก endpoint ใต้ `/api` ตรวจสิทธิ์ก่อนทำงาน | [apiAuth.ts](src/lib/auth/apiAuth.ts) |
| RBAC สองชั้น: `GlobalRole` + `platform_memberships` | [apiAuth.ts](src/lib/auth/apiAuth.ts) |
| HTML จากฐานข้อมูลผ่าน allow-list sanitizer ก่อน render | [sanitizeHtml.ts](src/lib/security/sanitizeHtml.ts) |
| SQL Console จำกัดเป็น read-only (`BEGIN READ ONLY`, timeout 5s, statement เดียว) | [query/route.ts](src/app/api/platforms/[id]/database/query/route.ts) |
| CRUD ตรวจชื่อ table/column กับ `information_schema` ของ tenant ก่อน quote | [tenantRecords.ts](src/lib/db/tenantRecords.ts) |
| ผู้เข้าชมสาธารณะอ่าน/เขียนได้เฉพาะตารางใน allow-list และแก้/ลบไม่ได้เลย | [013](docker/postgres/migrations/013_add_public_data_access.sql) |
| ธีมถูก validate ฝั่ง server (สี HEX, หน่วย CSS, ฟอนต์) กันการฉีด CSS | [apps/[id]/route.ts](src/app/api/apps/[id]/route.ts) |
| ไฟล์ที่เสิร์ฟกลับมีทั้ง `nosniff` และ CSP `sandbox` | [assets/[assetId]/route.ts](src/app/api/platforms/[id]/assets/[assetId]/route.ts) |

หน้า `/admin/security` แสดง **สถานะจริง** ที่อ่านจากฐานข้อมูลและ config ปัจจุบัน

---

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── (auth)/login/           เข้าสู่ระบบ (Server Action)
│   ├── admin/                  Control Plane — ต่อฐานข้อมูลจริงทุกหน้า
│   │   ├── page.tsx            Dashboard (นับจาก DB จริง)
│   │   ├── platforms/          Platform Master + First Public Page
│   │   ├── apps/               Tenant Apps, โดเมน, ธีม, overrides
│   │   ├── users/              ผู้ใช้และสิทธิ์ระดับ Platform
│   │   └── security/           สถานะความปลอดภัยจริง
│   ├── api/                    REST endpoints (ทุกตัวมี auth)
│   ├── app/[appSlug]/          ตัวเล่น Site (Dynamic Player)
│   ├── studio/                 DesignStudio IDE
│   ├── flow-studio/            Sequence / Enterprise Flow
│   └── audit-logs/             Audit trail
│
├── components/
│   ├── admin/                  Sidebar, Topbar, UserTable, SiteThemeModal ฯลฯ
│   ├── engine/                 DynamicPageRenderer (JSON → React)
│   ├── flow/                   React Flow custom nodes
│   ├── html-studio/            HtmlStudioShell
│   ├── shared/                 คลัง component 15 ตัว
│   └── studio/                 Palette, Inspector, Treeview, Schema Explorer
│
├── lib/
│   ├── auth/                   session, apiAuth, authActions, platformUsers
│   ├── db/                     coreDb, tenantDb, tenantRecords, tenantAssets, publish
│   ├── docker/                 Docker Engine API client
│   ├── engine/                 ComponentRegistry, WorkflowInterpreter,
│   │                           PlatformMergeEngine, NginxConfigGenerator, Audit
│   ├── html-studio/            AST, compiler, sanitizer, validator
│   ├── runtime/                siteRegistry (multi-site / multi-domain)
│   ├── security/               sanitizeHtml
│   └── studio/                 backendFormDefinitions (43 forms / 42 collections)
│
├── types/index.ts
└── middleware.ts               route protection + site routing

docs/                           เอกสารออกแบบทั้งหมด (.MD)
docker/postgres/migrations/     SQL migrations (mount ทั้งไดเรกทอรี)
scripts/run-sites.mjs           ตัวรัน multi-site
tests/                          Vitest (27 tests)
```

---

## เส้นทาง URL

| Path | Auth | คำอธิบาย |
|---|---|---|
| `/` | – | Landing page |
| `/login` | – | เข้าสู่ระบบ |
| `/admin` | ✅ | Dashboard |
| `/admin/platforms` | ✅ | Platform Master |
| `/admin/apps` | ✅ | Tenant Apps / Sites / โดเมน / ธีม |
| `/admin/users` | SUPER_ADMIN | ผู้ใช้และสิทธิ์ |
| `/admin/security` | SUPER_ADMIN | สถานะความปลอดภัย |
| `/studio` | ✅ | DesignStudio IDE |
| `/flow-studio` | ✅ | Visual Flow Designer |
| `/audit-logs` | ✅ | Audit trail |
| `/app/[appSlug]` | – | ตัวเล่น Site (โปรเซส Site จะ map `/` มาที่นี่) |

---

## API Reference

ทุก endpoint ต้องมี session ที่ถูกต้อง ยกเว้น `/api/runtime/*` ที่เป็นข้อมูลสาธารณะของ Site ที่ publish แล้ว

### Platform

| Method | Path | สิทธิ์ |
|---|---|---|
| `GET` | `/api/platforms` | VIEWER (เห็นเฉพาะที่มีสิทธิ์) |
| `POST` | `/api/platforms` | SUPER_ADMIN — เรียก `create_platform_blueprint()` |
| `DELETE` | `/api/platforms?id=` | SUPER_ADMIN |
| `GET`/`POST` | `/api/platform-categories` | VIEWER / SUPER_ADMIN |
| `GET`/`PUT`/`PATCH` | `/api/platforms/{id}/studio` | APP_VIEWER / APP_EDITOR |
| `GET`/`PUT` | `/api/platforms/{id}/page-flows` | APP_VIEWER / APP_EDITOR |
| `GET`/`PUT` | `/api/platforms/{id}/workflows` | APP_VIEWER / APP_EDITOR |
| `GET`/`POST` | `/api/platforms/{id}/runtime` | APP_VIEWER / APP_OWNER |

### ข้อมูล Tenant

| Method | Path | คำอธิบาย |
|---|---|---|
| `POST` | `/api/platforms/{id}/database/query` | SQL read-only |
| `POST` | `/api/platforms/{id}/database/publish` | สร้างตารางใน Tenant DB |
| `GET` | `/api/platforms/{id}/database/tables` | โครงสร้างจริงจาก `information_schema` |
| `GET`/`POST` | `/api/platforms/{id}/records/{table}` | list (มี filter/search/sort) / insert |
| `GET`/`PUT`/`DELETE` | `/api/platforms/{id}/records/{table}/{recordId}` | อ่าน / แก้ / ลบ |
| `GET`/`POST` | `/api/platforms/{id}/assets` | รายการไฟล์ / อัปโหลด (multipart) |
| `GET`/`DELETE` | `/api/platforms/{id}/assets/{assetId}` | ดาวน์โหลด / ลบ |

### Sites & Users

| Method | Path | คำอธิบาย |
|---|---|---|
| `GET`/`POST` | `/api/apps` | รายการ Site / provision ใหม่ |
| `GET`/`PATCH`/`DELETE` | `/api/apps/{id}` | รายละเอียด / แก้ธีม-overrides / ลบ |
| `GET`/`POST`/`DELETE` | `/api/apps/{id}/domains` | จัดการโดเมนของ Site |
| `GET` | `/api/sites` | registry + domain map |
| `GET` | `/api/nginx-config` | สร้าง nginx.conf (SUPER_ADMIN) |
| `GET`/`POST` | `/api/users` | ผู้ใช้ (SUPER_ADMIN) |
| `PATCH`/`DELETE` | `/api/users/{id}` | แก้ไข / ลบ |
| `GET`/`PUT` | `/api/users/{id}/memberships` | สิทธิ์ระดับ Platform |
| `GET` | `/api/audit-logs` | ประวัติการเปลี่ยนแปลง |

### Runtime สาธารณะ

| Method | Path | คำอธิบาย |
|---|---|---|
| `GET` | `/api/runtime/{slug}` | payload ของ Site (merge tenant overrides + ธีมของ Site) |
| `GET` | `/api/runtime/{slug}/records/{table}` | อ่านได้เฉพาะตารางใน `public_data_access.readable` |
| `POST` | `/api/runtime/{slug}/records/{table}` | บันทึกได้เฉพาะตารางใน `public_data_access.insertable` |

---

## Shared Component Library

ลงทะเบียนใน [ComponentRegistry.ts](src/lib/engine/ComponentRegistry.ts) และ render ผ่าน `DynamicPageRenderer`

| Component | หมวด |
|---|---|
| `NavMenuComponent`, `SlideMenuComponent`, `EditMenuComponent` | Navigation |
| `FormComponent`, `FieldInputComponent` | Form |
| `TableDataComponent`, `ListComponent`, `CardComponent`, `ChartComponent` | Data |
| `DynamicHtmlComponent`, `HtmlEditorComponent`, `HtmlTemplateComponent` | Content |
| `GalleryComponent`, `FileManagerComponent` | Media |

`TabsContainerComponent` / `AccordionComponent` / `ModalDialogComponent` ยัง fallback เป็น `CardComponent`

### ธีม

[ThemeEngine.tsx](src/components/shared/ThemeEngine.tsx) ฉีด CSS Variables ทับ Bootstrap 5
preset: `modern-indigo`, `corporate-emerald`, `dark-glassmorphism`, `sunset-warm`, `cyberpunk`, `minimal-slate`

ลำดับการทับซ้อนของธีมตอน runtime:

```
master theme (Platform)  →  theme ของ Site (apps.theme_config)  →  tenantOverrides.themeOverrides
```

---

## Studio Workflow

1. `/admin/platforms` → สร้าง Platform + เลือก **First Public Page**
   (`PUBLIC_HOME` / `PUBLIC_HOME_WITH_LOGIN` / `LOGIN_PAGE`)
   → procedure เดียวสร้าง Module, Page, Flow และ audit log ใน transaction เดียว
2. `/studio` → ออกแบบหน้า / ฟอร์ม / collection
   - **Tenant Database → Schema Explorer** สร้าง Table/Form ผูกกับตารางจริงได้ในคลิกเดียว
3. **Publish Database** → สร้างตารางใน Tenant DB
4. **Build Runtime** → สร้าง container frontend/backend
5. `/admin/apps` → Provision Site, ผูกโดเมน, เลือกธีม
6. `npm run sites` → Site ขึ้นที่พอร์ตและโดเมนของตัวเอง

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ผลลัพธ์ |
|---|---|
| `npm run dev` | Control Plane ที่ :33000 |
| `npm run build` | Production build (standalone) |
| `npm run start` | รัน production build |
| `npm run sites` / `sites:dev` / `sites:list` | ตัวรัน multi-site |
| `npm run lint` / `lint:fix` | ESLint 9 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:watch` | Vitest |

CI ที่ [.github/workflows/ci.yml](.github/workflows/ci.yml) รัน migration → typecheck → lint → test → build

---

## เอกสารออกแบบ

เอกสารทั้งหมดอยู่ใน [docs/](docs/)

| ไฟล์ | เนื้อหา |
|---|---|
| [PlanOverView.MD](docs/PlanOverView.MD) | Roadmap 7 เฟส |
| [StackDiffenning.MD](docs/StackDiffenning.MD) | เปรียบเทียบ 8 tech stack |
| [DesignStudio.MD](docs/DesignStudio.MD) | UI ของ DesignStudio |
| [DevStudioDeepDive.MD](docs/DevStudioDeepDive.MD) | สถาปัตยกรรม IDE เชิงลึก |
| [DeveloperAdminPage.MD](docs/DeveloperAdminPage.MD) | Auth เว็บแม่ vs Tenant |
| [PlatformModule.MD](docs/PlatformModule.MD) | Platform Master & Inheritance |
| [CreatePlatform.MD](docs/CreatePlatform.MD) | ข้อกำหนดการสร้าง Platform |
| [AppWorkFlow.MD](docs/AppWorkFlow.MD) | `AppWorkFlowManifest` |
| [DefaultFlow.MD](docs/DefaultFlow.MD) | Sequence Diagram AST |
| [EnterpriseFlow.MD](docs/EnterpriseFlow.MD) | `EnterpriseWorkflowAST` |
| [GenFormBackend.MD](docs/GenFormBackend.MD) | Backend module/form blueprint |
| [HTMLStudio.MD](docs/HTMLStudio.MD) | HTML/SVG/Theme authoring |
| [EditMenuComponent.MD](docs/EditMenuComponent.MD) | สัญญาข้อมูล EditMenuComponent |
| [Walkthrough.MD](docs/Walkthrough.MD) | สรุปผลงานรายเฟส |

---

## สิ่งที่ยังไม่ได้ทำ

- **SVG Design Studio** ([HTMLStudio.MD §10](docs/HTMLStudio.MD)) — vector canvas, layers,
  animation timeline ยังไม่มีโค้ด เป็นฟีเจอร์ขนาดใหญ่ที่ควรแยกทำต่างหาก
- **Tenant end-user auth** — Site ที่ตั้ง `LOGIN_PAGE` / `PUBLIC_HOME_WITH_LOGIN` มี blueprint
  ของหน้า Login และ Private page แล้ว แต่ยังไม่มีระบบ session ของผู้ใช้ปลายทางฝั่ง Site
  (ปัจจุบันหน้า PRIVATE ยังไม่ถูกบังคับ guard)
- **Export / Import SQL script** ใน Studio ยังเป็นปุ่ม disabled
- **`TabsContainer` / `Accordion` / `ModalDialog`** ยัง fallback เป็น `CardComponent`
- **E2E test** ยังไม่มี (มีเฉพาะ unit test ของ sanitizer, session และ merge engine)

---

## Troubleshooting

### API ตอบ 401 ทั้งหมด

ยังไม่ได้ login หรือ cookie หมดอายุ (session อายุ 8 ชั่วโมง) — เข้าที่ `/login` ใหม่

### `AUTH_SECRET must be set to at least 32 characters in production`

ตั้ง `AUTH_SECRET` ใน `.env` — สร้างด้วย `openssl rand -base64 48`

### `CORE_DATABASE_URL is not configured`

ยังไม่ได้ตั้งใน `.env.local` (dev) หรือ `.env` (compose)

### `[sites] No active sites yet`

ยังไม่มี Tenant App — สร้างที่ `/admin/apps` แล้ว launcher จะลองใหม่ทุก 15 วินาที

### `[sites] No standalone server found`

รัน `npm run build` ก่อน หรือใช้ `npm run sites:dev`

### เพิ่มโดเมนแล้วยังเข้าไม่ได้

`SITE_DOMAIN_MAP` ถูกอ่านตอนโปรเซสเริ่มทำงาน — รัน `docker compose restart sites`
(หรือ `npm run sites` ใหม่) แล้ว regenerate `nginx.conf` จาก `/api/nginx-config`

### `Docker Engine ยังไม่พร้อมใช้งาน` ตอนกด Build Runtime

`studio-mother` ต้อง mount `/var/run/docker.sock` และรันด้วย `user: root`
ถ้ารัน `npm run dev` บนเครื่อง ต้องเปิด Docker Desktop ไว้

### migration ใหม่ไม่ถูก apply

initdb scripts รันเฉพาะตอนสร้าง volume ครั้งแรก ถ้ามี volume อยู่แล้วให้ apply เอง:

```bash
docker exec -i lowcode_core_db psql -U lowcode_admin -d lowcode_core \
  -v ON_ERROR_STOP=1 < docker/postgres/migrations/0XX_xxx.sql
```

หรือเริ่มใหม่ทั้งหมด: `docker compose down -v && docker compose up -d`

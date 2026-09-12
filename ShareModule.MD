# ShareModule — โมดูลพร้อมใช้สำหรับ App แม่และ App ลูก

> ทบทวนทิศทางวันที่ 12 กันยายน 2026: เริ่มวางภาพรวมโครงการใหม่ที่ [CONTEXT.MD](CONTEXT.MD) โดยความสามารถในเอกสารนี้ยังอยู่ในขอบเขต เก็บรายละเอียดและประวัติ implementation ด้านล่างไว้เป็นข้อมูลอ้างอิง ส่วนลำดับพัฒนาและการเชื่อมระบบจะค่อยทบทวนตาม Context ใหม่ทีละขา

สถานะ: เริ่ม implementation วันที่ 7 กันยายน 2026 — ความคืบหน้าจริงอยู่หัวข้อ 12; ข้อเสนอด้านล่างยังไม่ใช่รายการฟีเจอร์ที่ implement ครบแล้ว

เอกสารนี้กำหนดทิศทางใหม่สำหรับการใช้งาน Shared Module โดยต่อยอดโค้ดที่มี และใช้แทนแนวทางเดิมเฉพาะส่วนที่บังคับ developer ประกอบ binding, API หรือ Flow ภายในโมดูลเอง ชื่อ package, API และตัวอย่างทั้งหมดด้านล่างเป็น contract ที่เสนอสำหรับการพัฒนา

## 1. เป้าหมาย: เลือกโมดูล กำหนดไม่กี่ property แล้วรับผลลัพธ์

Developer ควรใช้เวลาไปกับกฎธุรกิจของแอป เช่น การรับเรื่องร้องเรียนหรืออนุมัติเอกสาร ส่วน login, permission, upload, SMTP, OAuth และ retry เป็นหน้าที่ของทีม Platform

- หน้าตั้งค่าปกติของแต่ละโมดูลมี property หลักไม่เกิน 3–5 ช่อง และใช้ค่าเริ่มต้นได้
- Component ใช้ได้ทันทีหลังวางลงหน้า ระบบเติม context, service binding และ event มาตรฐานให้
- งานเดี่ยวไม่ต้องสร้าง Flow เช่น login, เลือกไฟล์ หรือส่งเมลจาก template
- ทั้ง App แม่และ App ลูก import library เดียวกัน เรียก service implementation เดียวกัน
- โค้ด implementation เป็น TypeScript/React ที่ build ลง Docker image จริง มี GitHub release และตรวจสอบ version ที่รันได้
- JSON ในฐานข้อมูลเก็บเฉพาะการเปิดใช้ property, data binding และกฎธุรกิจ ไม่เก็บสำเนาโค้ดภายในโมดูล

**เกณฑ์ตัดสิน:** ถ้าเพิ่ม File Manager แล้วต้องกรอก endpoint, binding ID, operation, tenant ID หรือเขียน callback สำหรับโหลดรายการไฟล์เอง ถือว่ายังไม่ผ่านเป้าหมายนี้

## 2. สิ่งที่มีอยู่และสิ่งที่ต้องปรับ

ตรวจจาก repository ปัจจุบัน:

| ส่วนที่มี | แนวทางต่อยอด |
|---|---|
| `src/lib/services/catalog.ts`, `dispatcher.ts`, `bindings.ts` | ใช้เป็นกลไกภายใน ให้ Module Registry สร้าง default binding อัตโนมัติ |
| `src/lib/auth/*`, `src/lib/services/authSessionService.ts` | รวมผ่าน Auth contract เดียว โดยคง realm ผู้ดูแลและผู้ใช้แอปลูกแยกกัน |
| `src/components/shared/FileManagerComponent.tsx`, `FileManagerPopupComponent.tsx` | ครอบด้วย facade ที่ต้องการเพียง currentPath และส่งผลลัพธ์มาตรฐาน |
| `src/lib/storage/tenantStorage.ts`, `storageObjectService.ts`, `/api/file-manager` | รวม policy และการ resolve path ให้ใช้ service กลางชุดเดียว |
| `emailNotificationService.ts`, `outboxWorker.ts` | มี template/outbox และส่งผ่าน HTTP provider แล้ว ต้องเพิ่ม SMTP, CC และไฟล์แนบ |
| `src/lib/studio/sharedComponentPropertyRegistry.ts` | ลด property ที่ developer ต้องตั้ง และให้ registry โมดูลเป็นแหล่ง contract หลัก |
| `Dockerfile` และ `next.config.ts` | มี standalone image รองรับแม่/ลูกแล้ว เพิ่มการ build package และบันทึก version |
| `.github/workflows/ci.yml` | มี typecheck/lint/test/build เพิ่ม release package, image และ smoke test ใน container |

รายละเอียดแนวคิดเดิมอยู่ใน [SHareService.MD](docs/SHareService.MD) เอกสารนี้ไม่ได้ถือว่าสถานะ MVP ในเอกสารเดิมเท่ากับความพร้อมของโมดูลใหม่ทั้งหมด

## 3. รูปแบบการตั้งค่าที่ developer เห็น

### 3.1 ตั้งการเชื่อมต่อครั้งเดียว

App แม่มีหน้า **Settings → Connections** ให้ผู้ดูแลตั้ง Google, LINE, Facebook, LDAP/AD, SMTP และ Storage พร้อมปุ่มทดสอบ ระบบแสดงว่า connection ใดพร้อมใช้และแอปใดได้รับอนุญาต

Developer เห็นชื่อที่เข้าใจง่าย เช่น “อีเมลองค์กร” หรือ “Google หน่วยงาน” แทน secret, OAuth scope และ URL ภายใน ระบบเลือก connection เริ่มต้นให้ถ้ามีเพียงชุดเดียว ผู้ดูแลแต่ละแอปเพิ่ม connection ของตนได้ตามสิทธิ์

การใช้ provider ภายนอกยังต้องมีบัญชี, credential, callback domain และสิทธิ์ที่ provider กำหนด ผู้ดูแลตั้งสิ่งเหล่านี้ครั้งเดียวต่อ connection/domain ที่เกี่ยวข้อง โมดูลแสดงรายการค่าที่ต้องเตรียมให้อัตโนมัติ

### 3.2 เปิดโมดูลในแอป

```ts
// ตัวอย่างค่าที่ Studio สร้างให้ ไม่บังคับให้ developer เขียนไฟล์นี้
const modules = {
  auth: { providers: ['local', 'google'], allowRegister: true },
  files: { workingPath: '/documents' },
  mail: { connection: 'default' },
  google: { connection: 'default', features: ['maps', 'calendar', 'drive'] },
};
```

การ resolve config: ค่าเริ่มต้นของ library → ค่าเริ่มต้น Platform → ค่า App → property ของ component/action ที่อนุญาตให้เปลี่ยนเท่านั้น โดย policy ผู้ดูแลเป็นเพดานที่ property ระดับล่างขยายเกินไม่ได้

การสืบทอด profile ไม่ใช่การคัดลอก credential: เก็บ connection reference และตรวจสิทธิ์ฝั่ง server ทุกครั้ง แม่เผยแพร่ config revision; ลูกใช้ revision ที่ publish ไว้เพื่อให้ตรวจสอบและย้อนกลับได้ ส่วนการหมุน secret และเพิกถอนสิทธิ์มีผลโดยไม่ต้องเผยแพร่หน้าใหม่

### 3.3 ใช้ได้สามทาง ผ่าน contract เดียวกัน

| ผู้ใช้ | วิธีเรียก |
|---|---|
| ผู้สร้างหน้า | วาง Component → ตั้ง property → เลือกช่องเก็บผลลัพธ์ |
| ผู้สร้างงานธุรกิจ | เลือก Action เช่น “ส่งอีเมล” → ผูกข้อมูลเข้าและผลลัพธ์ออก |
| Developer ที่เขียนโค้ด | import typed library แล้วเรียก method หรือ React component |

Studio ซ่อน binding ID, operation key, API URL และ idempotency key โดยสร้างให้เอง ข้อมูลเหล่านี้ยังตรวจสอบได้ในหน้ารายละเอียดสำหรับทีม Platform

## 4. โครงสร้าง library และ runtime

เริ่มด้วย npm workspace ใน repository นี้ โดยมี package เดียวชื่อเสนอ `@matchanu/sharemodule` และ version เดียวต่อ release เพื่อลดงานดูแล dependency ของแอป

```text
packages/sharemodule/
  src/
    contracts/           types, input/output schemas, errors
    registry/            module definitions และ property defaults
    client/              typed API client สำหรับ browser
    react/               Login, FileManager, Map, Calendar, QRCode
    server/              context, permission, service facade
    modules/
      auth/
      files/
      mail/
      google/
      media/             local image processing และ QR Code
    adapters/            database, storage, provider connections
    worker/              mail และงานเบื้องหลัง
```

กำหนด exports แยก `/client`, `/react`, `/server`, `/contracts`, `/worker` เพื่อไม่ให้ SMTP, database driver หรือ secret resolver เข้า browser bundle ส่วน Next.js routes และ middleware เป็น adapter บาง ๆ ในแอปหลัก

```text
หน้าใน App แม่ / App ลูก
  → Shared React Component หรือ typed client
  → API adapter ของ runtime นั้น
  → ShareModule service + server context + permission
  → DB / Storage / Provider

Server-side action → ShareModule service โดยตรง
Worker → ShareModule service จาก package version เดียวกัน
```

ใช้ library ร่วมกันไม่ได้หมายความว่าทุก request ต้องวิ่งผ่าน process ของ App แม่ แต่ละ runtime มีโค้ดเดียวกันใน image ของตน การใช้ Core DB/connection registry ยังเป็น dependency ตามสถาปัตยกรรมเดิม จึงต้องกำหนด health check และแจ้งข้อผิดพลาดเมื่อ dependency ใช้งานไม่ได้

Server เป็นผู้หา app, realm, actor, permission, DB และ storage จาก runtime/session ที่ตรวจแล้ว ห้ามรับ tenant context หรือสิทธิ์ที่ browser อ้างขึ้นเอง ค่า slug ใน route ต้องตรงกับ runtime และสิทธิ์ของผู้เรียก

### Contract ร่วม

- API prefix เสนอ: `/api/share/v1` ภายใน origin ของแต่ละแอป
- Success: `{ data, meta: { requestId } }`; Error: `{ error: { code, message, fields?, retryable }, meta: { requestId } }`
- Typed client คืน `data` โดยตรง และโยน `ModuleError` ที่ UI มาตรฐานแสดงได้
- File upload ใช้ multipart; download ใช้ stream ไม่ห่อ binary ใน JSON
- List ใช้ pagination; งานใช้เวลานานคืน job ID; provider callback ใช้ route เฉพาะ
- Client สร้าง request ID และ idempotency key ให้ต่อหนึ่งการกด action และใช้ key เดิมเมื่อ retry; server-side business job ใช้ business event ID ที่เสถียร
- Permission, validation, audit, timeout และ quota อยู่ใน service เพื่อให้การเรียกตรงจาก server ไม่ข้ามการตรวจ

## 5. Auth Module

### Property หลัก

| Property | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `providers` | `['local']` | เลือก local, google, line, facebook, ldap, ad |
| `allowRegister` | `false` | เปิดสมัครสมาชิกสำหรับผู้ใช้ App ลูก |
| `afterLogin` | หน้าหลักของแอป | หน้าที่ไปหลัง login สำเร็จ ต้องอยู่ในปลายทางที่อนุญาต |

มีหน้า Login, Register, Forgot/Reset Password, Profile, User Management และ Role/Permission Management สำเร็จรูป ระบบสร้าง user schema และ session infrastructure ให้ Developer ไม่ต้องออกแบบ collection สำหรับ login เอง

```tsx
<Login providers={['google', 'line']} afterLogin="/dashboard" />
```

```ts
await modules.auth.register({ email, password, displayName });
await modules.auth.login({ provider: 'google' }); // client จัดการ redirect
const user = await modules.auth.me();
const allowed = await modules.auth.can('documents.create');
```

API หลัก: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password/reset-request`, `POST /auth/password/reset`, `GET /auth/providers/:provider/start`, `GET /auth/providers/:provider/callback` และ API จัดการ users/roles ที่ตรวจสิทธิ์ผู้ดูแล

### Provider และการให้สิทธิ์

- Local: email/password พร้อม verification/reset ผ่าน SendMail; ถ้าเปิด registration ที่ต้องยืนยันอีเมล ต้องมี mail connection พร้อมก่อน publish
- Google, LINE, Facebook: adapter จัดการ redirect/callback และเชื่อม external identity เข้ากับ local user
- LDAP และ AD ภายในองค์กร: connection profile มี directory URL, base DN, bind credential และ group mapping; server เป็นผู้เชื่อม directory ผ่านช่องทางเข้ารหัส
- AD ต้องแยก profile ชัดเจนระหว่าง AD DS ภายในองค์กรกับ Microsoft Entra ID/federation ไม่ให้ developer เดาจากชื่อ AD เพียงอย่างเดียว แนวทาง Microsoft แยกวิธี authentication ของ hybrid identity ไว้ตาม deployment ขององค์กร ([Microsoft authentication guidance](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/choose-ad-authn))
- Register สำหรับ social login หมายถึงสร้างสมาชิกในแอปตาม policy ไม่ใช่สร้าง Google/LINE/Facebook account; LDAP/AD ไม่สร้างบัญชี directory โดยอัตโนมัติ
- `allowRegister=false` ยังคงอนุญาต external login ของสมาชิกที่ provision ไว้ แต่ไม่สร้างสมาชิกใหม่เอง
- ใช้ provider subject เป็นตัวเชื่อม identity ไม่รวมบัญชีจาก email อย่างเดียว; การเชื่อมบัญชีต้องยืนยันเจ้าของ
- มี role เริ่มต้น `app-admin`, `member` และเพิ่ม permission แบบ `resource.action`; ผู้สมัครใหม่ได้ `member` เท่านั้น
- App แม่ใช้ realm ผู้ดูแลเดิม ส่วน App ลูกใช้ realm สมาชิกของแอป Cookie/token แยก audience และ app; การเปิดสมัครสมาชิกไม่สร้างผู้ดูแล Platform
- UI ซ่อนปุ่มตาม permission เพื่อความสะดวก และ server ตรวจสิทธิ์ซ้ำเสมอ
- Module รับผิดชอบ password hashing, session revocation, OAuth state/nonce/PKCE ตาม provider, CSRF, rate limit และข้อความ login ที่ไม่เปิดเผยข้อมูลบัญชี

การ login ด้วย Google ไม่เท่ากับได้รับสิทธิ์อ่าน Drive/Calendar ต้องเชื่อม Google API และขอ consent เพิ่มตามงาน โมดูลจัดการ token refresh ฝั่ง server ตาม [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)

## 6. File Upload / File Manager Module

### ใช้โดยกำหนด currentPath แล้วรับไฟล์

```ts
const file = await modules.files.pick({ currentPath: '/documents' });
// FileRef | null — null เมื่อยกเลิก

const files = await modules.files.pick({
  currentPath: '/documents', multiple: true,
});
// FileRef[] — [] เมื่อยกเลิกหรือไม่มีการเลือก
```

```tsx
<FileManager currentPath="/documents" onSelect={setFile} />
<FileManager currentPath="/documents" multiple mode="full" onSelect={setFiles} />
```

| Property | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `currentPath` | workingPath ของแอป | โฟลเดอร์ที่เปิดเริ่มต้น |
| `multiple` | `false` | รับไฟล์เดียวหรือ array |
| `mode` | `'compact'` | Popup แบบย่อ หรือ `'full'` แบบเต็ม |
| `accept` | policy ของแอป | จำกัดประเภทไฟล์เพิ่มได้ |

`onSelect` เป็น event ผลลัพธ์ Studio ให้เลือก field ปลายทางได้เลย ทั้งสอง mode ใช้ service และสิทธิ์เดียวกัน แบบย่อมี browse/upload/select ส่วนแบบเต็มเพิ่ม folder tree, search, preview, rename, move และ delete ตามสิทธิ์ รวมทั้งการเลือกไฟล์ที่มีอยู่แล้วและ upload ไฟล์ใหม่

### ความหมายของ path

| Path | ผู้กำหนด | หลักการ |
|---|---|---|
| Physical storage root | ผู้ดูแล deployment | เช่น `/app/storage/tenants` และต้อง mount persistent volume |
| `rootPath` | ผู้ดูแลแอป/Developer ที่มีสิทธิ์ตั้ง module | virtual root ภายในพื้นที่ของแอป ไม่ใช่ absolute host path |
| `workingPath` | ค่าเริ่มต้นของ module ในแอป | โฟลเดอร์เปิดเริ่มต้น เช่น `/documents` |
| `userPath` | เปิด option ใน module | ระบบหา subfolder จาก user ID ที่ยืนยันแล้ว เช่น `/users/<userId>` |
| `currentPath` | component/action ขณะ runtime | เลือกโฟลเดอร์ภายใต้ root ที่อนุญาต |
| custom path | data binding ขณะ runtime | เช่น `/cases/{record.id}` โดย resolve และตรวจสิทธิ์ record ฝั่ง server |

ถ้าเปิด user scope ให้ root ที่ใช้งานจริงอยู่ใต้ user folder; currentPath ที่ขึ้นต้น `/` หมายถึง virtual root ของ scope นี้ ส่วน relative path อิง workingPath ระบบไม่อนุญาตให้ runtime property ขยาย scope

ต้อง canonicalize path และตรวจ containment รวม symlink/encoded traversal ห้ามรับ user ID หรือ physical root จาก browser เป็นข้ออนุญาต การเปลี่ยนชื่อ/ย้ายไฟล์ต้องไม่เปลี่ยน `id` ของไฟล์และต้องตรวจทั้งโฟลเดอร์ต้นทาง/ปลายทาง

```ts
type FileRef = {
  id: string;
  name: string;
  path: string;       // virtual path
  mimeType: string;
  size: number;
  url: string;        // URL ที่ตรวจสิทธิ์ หรือ signed URL อายุจำกัด
  thumbnailUrl?: string;
};
```

FileRef คือไฟล์ที่เก็บในระบบแล้ว ไม่ใช่ browser `File` เก็บ `id` ลง collection แล้วใช้ `modules.files.download(id)` เมื่อต้องการ Blob/stream; ไม่เก็บ signed URL เป็นตัวอ้างอิงถาวร การแนบอีเมลใช้ ID ชุดเดียวกัน

Service/API: list, upload, metadata, download, mkdir, rename, move, delete; route หลัก `/files`, `/files/upload`, `/files/:id`, `/files/:id/content` และ `/folders` พร้อม pagination, progress และ error ต่อไฟล์เมื่อ upload บางไฟล์ไม่สำเร็จ

ไฟล์ใหม่เป็น private เป็นค่าเริ่มต้น การเผยแพร่ public เป็น permission แยก ระบบตรวจชนิด/ขนาด/จำนวนไฟล์และ quota ฝั่ง server; process restart หรือเปลี่ยน image ต้องไม่ทำให้ไฟล์หาย

## 7. SendMail Module

### ตั้ง SMTP ครั้งเดียว แล้วเรียกส่งได้

Connection profile มี SMTP host, port, TLS mode, credential reference และ default sender ผู้ดูแลตั้งที่ App แม่และอนุญาตให้แอปลูกใช้ ส่วนหน้าปกติของ developer มีเพียง connection, ชื่อผู้ส่ง และ template เริ่มต้น ซึ่งสืบทอดได้ทั้งหมด

SMTP อยู่เครื่องเดียวกับ runtime ได้ แต่ใน Docker ค่า `localhost` หมายถึง container ปัจจุบัน จึงให้ผู้ดูแลตั้ง service DNS เช่น `smtp` หรือ host address ที่ container เข้าถึงได้ แล้วทดสอบ connection จริง โมดูลไม่ถือว่าเครื่องที่รันเว็บมี SMTP พร้อมเสมอ

```ts
const job = await modules.mail.send({
  to: 'citizen@example.com',
  template: 'request-received',
  data: { requestNo: 'REQ-001', name: 'สมชาย' },
});

await modules.mail.send({
  to: ['citizen@example.com'],
  cc: ['officer@example.com', 'supervisor@example.com'],
  template: 'request-received',
  data: { requestNo: 'REQ-001' },
  attachments: selectedFiles.map(file => file.id),
});
```

Property หลักของ Action คือ `to`, `template`, `data`; CC และ attachments เป็นตัวเลือกเพิ่ม ผู้ดูแลใช้ HTML Template Editor ของระบบเพื่อกำหนด subject, HTML และ preview จากข้อมูลตัวอย่าง

### Template จาก collection หรือ data

- รองรับ template registry และ collection ที่กำหนดไว้เป็นแหล่ง template เช่น `mail_templates` โดย map key, subject และ html ครั้งเดียว
- รองรับข้อมูลจาก object โดยตรง หรือ record binding เช่น `dataSource: { collection: 'requests', recordId }` ซึ่ง service ตรวจสิทธิ์แล้วอ่านข้อมูลให้
- รองรับ trusted server action ส่ง `subject`, `html`, `data` โดยตรงเป็นทางเลือกแทน `template` ไม่เปิดเป็น public anonymous endpoint
- ใช้ตัวแปรแบบ `{{name}}`, `{{request.number}}` พร้อม loop/condition ที่จำกัดรูปแบบ; ไม่ execute JavaScript จาก template
- Escape ค่าข้อมูลตาม context และ sanitize HTML/URL; ไม่ให้ข้อมูลใน collection แทรก header หรือ script ในหน้า preview
- ยึด template revision และข้อมูลที่ render แล้ว ณ เวลาส่งเข้าคิว เพื่อให้ retry ได้เนื้อหาเดิม
- File attachment ตรวจสิทธิ์ผู้ส่งและขนาดรวม เก็บ reference ไปยัง immutable file revision หรือสำเนาใน job storage จนพ้นช่วง retry

API: `POST /mail/send`, `POST /mail/preview`, `GET /mail/jobs/:jobId`; การจัดการ template เป็น API ผู้ดูแลแอป

`send` คืน `{ jobId, status: 'queued' }` งานอยู่ใน durable outbox ของ tenant และมี worker จาก image/version เดียวกันทำงานต่อเนื่อง สถานะหลักคือ queued, processing, accepted, failed และ unknown; accepted หมายถึง SMTP รับงาน ไม่ยืนยันถึง inbox ผู้รับ

Worker มี lease/recovery เมื่อ process ตาย, retry แบบจำกัด, backoff, rate limit และ dead-letter/retry จากผู้ดูแล การใช้ idempotency ป้องกัน enqueue ซ้ำ แต่ SMTP ไม่รับประกัน exactly-once เมื่อขาดการเชื่อมต่อหลังส่งแล้ว ให้สถานะ unknown และ policy ตรวจสอบก่อนส่งใหม่

Outbox เดิมอยู่ Core DB: ต้องย้าย payload/template/ข้อมูลผู้รับไป tenant DB สำหรับแอปลูก ส่วน App แม่ใช้ Core DB; dashboard กลางเก็บสถานะเท่าที่จำเป็นโดยไม่ทำสำเนาเนื้อหาเมล

## 8. Google API Module และความสามารถด้านภาพ/QR

หน้า Studio แสดงหมวดเดียวที่ค้นหาได้ง่าย โดยภายในแยก adapter ตามบริการจริง เปิดใช้เฉพาะ feature ที่ต้องการและเชื่อม connection ให้โดยอัตโนมัติ

| ความสามารถ | Property/Input หลัก | ผลลัพธ์ | วิธีทำงานที่วางแผน |
|---|---|---|---|
| Map | `center`, `markers`, `zoom` | แผนที่, ตำแหน่งที่เลือก | Maps adapter และ Map component |
| Calendar | `calendarId`, ช่วงเวลา | event array / event | อ่านและสร้าง/แก้ไข/ลบ event ตาม permission |
| Image Processing | `file`, `operation`, options | FileRef หรือผลวิเคราะห์ | resize/crop/compress ใน runtime; OCR/labels ผ่าน Vision |
| QR Code | `value`, `size` | รูปภาพ/Blob หรือ FileRef | library ใน runtime ไม่ต้องมี Google credential |
| AI | `prompt`, `data`, optional output schema | text หรือ structured result ที่ validate แล้ว | Gemini adapter; model/default limit อยู่ connection profile |
| Google Forms | `formId`, operation | form, response array หรือ URL | อ่าน/สร้าง/แก้ไข form, อ่าน responses และ component เปิดแบบฟอร์ม |
| Google Drive | `folderId`, file/query | DriveFileRef / array | list/upload/download และ file picker |

Maps JavaScript API รองรับแผนที่และข้อมูลตำแหน่ง ([Maps documentation](https://developers.google.com/maps/documentation/javascript/overview)); Calendar และ Drive ใช้ adapter ของ API แยกกัน ([Calendar](https://developers.google.com/workspace/calendar/api/guides/overview), [Drive](https://developers.google.com/workspace/drive/api/guides/about-sdk))

แยกงานแปลงภาพทั่วไปออกจากงานวิเคราะห์ภาพ: Vision มีความสามารถเช่นตรวจ labels ส่วน AI ใช้ Gemini API ([Vision labels](https://docs.cloud.google.com/vision/docs/labels), [Gemini API](https://ai.google.dev/gemini-api/docs)) การใช้ local library สำหรับ QR และ resize เป็นการตัดสินใจออกแบบของระบบนี้

Forms API มี get/list responses แต่ไม่มี method สร้างคำตอบในรายการ REST ที่ตรวจสอบ ดังนั้นแผนนี้ไม่เสนอ `forms.submitResponse`; ให้ผู้ใช้ตอบผ่าน Google Form ที่เปิด/ฝัง หรือใช้ฟอร์มและ collection ของระบบเรา ([Forms API reference](https://developers.google.com/workspace/forms/api/reference/rest))

```tsx
<GoogleMap center={{ lat: 13.7563, lng: 100.5018 }} />
<GoogleCalendar calendarId="office-calendar" />
<QRCode value={record.publicUrl} />
<GoogleForm formId={settings.feedbackFormId} />
```

```ts
await modules.google.calendar.createEvent({
  calendarId: 'office-calendar',
  title: 'ประชุม',
  start: '2026-09-10T09:00:00+07:00',
  end: '2026-09-10T10:00:00+07:00',
});
await modules.media.image.resize({ file: image.id, width: 1200 });
await modules.google.vision.ocr({ file: image.id });
await modules.google.ai.generate({ prompt: 'สรุปข้อความนี้', data: record.description });
const driveFiles = await modules.google.drive.pick({ folderId: 'office-documents' });
```

ค่า calendar/folder ในตัวอย่างเป็น alias ที่ connection profile resolve ให้เป็น provider ID จริง DriveFileRef ต้องระบุ `provider: 'google-drive'` และ external ID; ถ้าจะใช้เป็นไฟล์แนบ SendMail ให้ import ผ่าน File Module เป็น FileRef ก่อน โดยตรวจสิทธิ์และขนาด

API เสนอแยก `/google/maps/*`, `/google/calendar/*`, `/google/vision/*`, `/google/ai/*`, `/google/forms/*`, `/google/drive/*` และ `/media/*` ทุก endpoint เปิดเฉพาะ operation ที่กำหนด ไม่มี generic proxy ไป arbitrary URL

### การเชื่อมต่อและงานเบื้องหลัง

- Connection ระบุเจ้าของสิทธิ์เป็นองค์กรหรือผู้ใช้; service account ใช้เฉพาะบริการและทรัพยากรที่รองรับและได้รับสิทธิ์ ไม่ถือว่าอ่าน Drive ของทุกคนได้
- Google Login และ Google API ใช้ connection infrastructure ร่วมกันได้ แต่ scope และ consent แยกตามความสามารถ
- Refresh token เก็บเข้ารหัสฝั่ง server; browser Maps key เป็น key ที่ออกแบบให้ใช้ใน browser และจำกัด API/domain โดยแยกจาก server credentials
- Calendar/Drive/Forms ต้องจัดการ pagination, quota, token หมดอายุ/ถูกเพิกถอน และการเชื่อมใหม่ พร้อม error ที่บอกผู้ใช้ว่าต้องทำอะไร
- เริ่มจาก explicit read/write และ manual import; การ sync อัตโนมัติเป็นงานต่อยอด มี cursor, deduplication, watch renewal และ conflict policy ชัดเจน
- AI/Vision มี quota ต่อแอปและขนาด input สูงสุด แสดงสถานะก่อนส่งข้อมูลไป provider; AI ไม่ execute คำสั่งหรือแก้ collection โดยอัตโนมัติ
- งานวิเคราะห์/นำเข้าขนาดใหญ่เป็น job ไม่ค้าง HTTP request; การ cache ต้องแยก app/connection/owner และเป็นไปตามข้อกำหนดบริการ

## 9. GitHub version → package → Docker image ที่รันจริง

### Release หนึ่งชุดมีตัวตนตรวจสอบได้

```text
Git commit
  → tag sharemodule-v1.0.0
  → CI ตรวจและ build @matchanu/sharemodule@1.0.0
  → GitHub Release + package artifact
  → build runtime image พร้อม package และ worker
  → container smoke test
  → push GHCR image พร้อม immutable digest
  → แม่และลูก deploy artifact ชุดเดียวกัน
```

ชื่อ registry/repository ข้างต้นเป็นแนวทางที่จะตั้งตาม GitHub repository จริงในขั้น implementation ไม่ใช่ release ที่มีอยู่แล้ว

- ใช้ SemVer: patch แก้ข้อบกพร่องโดยคง contract; minor เพิ่มความสามารถที่เข้ากันได้; major เปลี่ยน contract
- ระยะแรก workspace package และ platform runtime release พร้อมกันเพื่อลด version matrix; package artifact เผยแพร่ให้แอปที่แยก repository ใช้ด้วย exact version
- Lockfile pin dependency และ build จาก tagged commit; production deploy ด้วย image digest ไม่ใช้ `latest`
- Docker build ต้อง copy workspace manifests/source และ build package ก่อนแอป รวม compiled worker และ runtime dependencies เข้า final stage; ตรวจว่า standalone tracing ไม่ทำ package หรือ native image adapter หาย
- App แม่และ App ลูกใช้ image digest เดียวกันโดยตั้ง runtime mode/site context ต่างกัน Worker ใช้ digest เดียวกันและ entrypoint ของ worker
- เลข version ใน JSON binding เป็นข้อกำหนดความเข้ากันได้ ไม่ใช่ตัวโหลดโค้ด; เปลี่ยนตัวเลขในฐานข้อมูลไม่ทำให้ implementation เปลี่ยน
- เพิ่ม build manifest ได้แก่ `platformVersion`, `shareModuleVersion`, `gitSha`, `builtAt`, `configSchemaVersion`; deployment registry บันทึก `imageDigest` จาก artifact ที่ deploy จริง
- มีหน้า About/Diagnostics สำหรับผู้ดูแล และ authenticated `/api/share/v1/system/version` เพื่อตรวจ version ที่รัน
- Publish ตรวจว่า module/capability และ config schema รองรับโดย image เป้าหมายจริงก่อนเปิดให้ใช้ หากไม่รองรับให้แจ้งต้องอัปเกรด

### Upgrade และ rollback

ทดสอบ release ใน staging → ทดลองหนึ่งแอปลูก → ตรวจ auth/files/mail/provider → rollout แม่และลูกที่เหลือ พร้อม dashboard แสดง version ระหว่าง rollout โหมดปกติหลัง rollout ต้องตรงกัน

ห้ามดึงหรือ execute โค้ดโมดูลจาก GitHub ขณะ request การอัปเกรด implementation ต้องผ่าน build/deploy ใหม่ ส่วนการเปลี่ยน property ที่ schema รองรับเผยแพร่ config ได้โดยไม่ rebuild

Migration ใช้ expand/contract และ single migration runner พร้อม lock; หลาย runtime ไม่แข่งแก้ schema ตอนเริ่มงาน ย้อน image/config revision ได้เมื่อ schema ยังเข้ากันได้ งานทำลาย schema ต้องมี backup/restore plan และไม่อ้างว่าการย้อน image จะแก้ข้อมูลกลับเอง

## 10. แผนพัฒนาและเกณฑ์ส่งมอบ

| ระยะ | งาน | เกณฑ์ผ่าน |
|---|---|---|
| 1 — Foundation | workspace package, contract, context, connection profiles, auto-binding, version manifest | แม่/ลูกใช้ package เดียวกันใน Docker; ปฏิเสธ config ที่ image ไม่รองรับ |
| 2 — Files + Studio | File facade, popup compact/full, path scopes, file metadata | ใส่ currentPath และผูกผลลัพธ์ได้ทันที; single/multiple/cancel ถูกต้อง; restart แล้วไฟล์อยู่ |
| 3 — Auth local/social | local register/login/permission, Google/LINE/Facebook adapters | สร้างหน้า login โดยเลือก provider; callback จริงผ่าน; สมาชิกข้าม app/realm ไม่ได้ |
| 4 — Mail | SMTP, template editor/collection, CC, attachments, durable worker | ผูก to/template/data แล้วส่งผ่าน SMTP ทดสอบจริง พร้อมติดตาม job และจำลอง worker restart |
| 5 — Directory Auth | LDAP, AD DS, Entra/federation profile | เชื่อม test directory/tenant จริง, group mapping และ revoke สิทธิ์ถูกต้อง |
| 6 — Google + Media | Maps, Calendar, Drive, Forms, local image/QR, Vision, Gemini | ตัวอย่างแต่ละ feature ใช้ property หลักไม่เกิน 5 ช่องและทดสอบ provider จริงใน test account |
| 7 — Migration + Release | compatibility adapters, ย้ายข้อมูล, GitHub/GHCR pipeline, rollout | แอปเดิมยังใช้ได้ระหว่างย้าย และ release/rollback ผ่านใน staging |

ระยะ 2 และ 3 เป็นการพิสูจน์ UX ก่อนขยายทุก provider; ระยะ 4 ทำก่อนเปิด registration ที่ต้องส่ง verification/reset ใน production ไม่มีการนับ provider ที่มีเพียง mock ว่าเสร็จแล้ว

### การย้ายของเดิม

1. Inventory component, service binding, session realm, storage reference และ mail job ที่แอปเดิมใช้อยู่
2. เพิ่ม facade โดยให้ legacy route/component เรียก service ใหม่ผ่าน adapter แทนคัดลอก logic
3. สร้าง default connection/module config จากค่าเดิมโดยไม่ย้าย secret ลง blueprint และไม่เปลี่ยน scope ของไฟล์
4. ให้แอปใหม่ใช้ property แบบใหม่ทันที ส่วนแอปเดิมแสดง migration preview; เก็บ snapshot เก่าเพื่อย้อนกลับ
5. ย้าย file metadata พร้อม mapping ID/path/URL เดิม และทดสอบการเปิดไฟล์เก่า; เปลี่ยน session ให้ re-login อย่างชัดเจนถ้ารูปแบบเข้ากันไม่ได้
6. Drain outbox เดิมหรือย้าย job แบบมี checkpoint/deduplication ห้าม worker เก่าและใหม่ส่ง job เดียวกัน
7. เลิกเส้นทางเดิมเมื่อไม่มีการใช้งานแล้วใน release ที่ระบุ พร้อม migration note

### ชุดตรวจที่ต้องผ่านก่อนเรียกว่าใช้งานได้

- UX: developer ที่ไม่ได้สร้างโมดูล ทดลอง login, เลือกไฟล์และส่งเมลโดยไม่กรอก technical binding หรือสร้าง Flow ภายใน
- Contract: UI, client, API, server call และ worker มี input/output/error ที่สอดคล้องกัน
- Isolation: App A อ่านไฟล์/job/token/connection ของ App B ไม่ได้ รวมการเดา ID และแก้ request
- Auth: provider callback, registration policy, permission เปลี่ยนแล้วมีผล, logout/revoke และ realm แยกกัน
- Files: traversal/symlink, quota, partial upload, file selection, permission และ volume persistence
- Mail: SMTP จริงในระบบทดสอบ, CC หลายคน, attachment หลายไฟล์, template จาก collection และ lease recovery
- Google: consent ขาด, token ถูกเพิกถอน, pagination และ quota; QR/resize ต้องทำงานได้โดยไม่มี Google credentials
- Release: build package/image จาก tag, เปิดแม่/ลูก/worker จาก image จริง, ตรวจ version และ smoke test พร้อม rollback ที่ schema รองรับ

## 11. Definition of Done ของ ShareModule

ส่งมอบโมดูลหนึ่งตัวต้องมี **API + service + typed library + property schema/defaults + UI ที่เกี่ยวข้อง + ตัวอย่าง + การทดสอบใน Docker + release version** ครบในชุดเดียว

Developer ทำเพียงเลือกโมดูล กำหนดข้อมูลธุรกิจไม่กี่ช่อง และรับผลลัพธ์ ส่วนการเชื่อมต่อ โค้ดภายใน การตรวจสิทธิ์ และการอัปเกรด เป็นความรับผิดชอบของ Platform ที่แม่และลูกใช้ร่วมกัน

## 12. ความคืบหน้าการลงมือทำ — 7 กันยายน 2026

### ลงโค้ดแล้วในชุดแรก

- สร้าง npm workspace `@matchanu/sharemodule@0.1.0` โดย exports ชี้ไป compiled `dist` แยก contracts, registry, client, server และ React
- ย้าย service catalog, schema validator, errors, File Manager และ storage context เดิมเข้ามาอยู่ใน package เดียว จุด import เดิม re-export เพื่อรักษาความเข้ากันได้
- เพิ่ม `FileManager` แบบตั้ง currentPath/multiple/mode/accept และ `useModules().files.pick()` ที่คืนไฟล์เดียวหรือ array; ยกเลิกหรือ unmount แล้ว Promise ไม่ค้าง
- เพิ่ม `ShareFileManager` และ local `ShareLogin` ใน Studio palette/property registry พร้อมเชื่อม event ผลลัพธ์ของไฟล์
- เพิ่ม typed client สำหรับ Auth เดิมและ Mail เดิม พร้อม facade route `/api/share/v1/:module/:operation` และ `/api/runtime/:slug/modules/:module/:operation`
- Facade เลือก binding เดียวที่มีอยู่ให้อัตโนมัติ; หากมีหลายตัวใช้ `moduleDefaults` ใน snapshot โดยไม่เดา connection และไม่เปิด binding ที่ปิดอยู่เอง
- แก้การ normalize version ให้รักษาเลขที่ร้องขอไว้ และปฏิเสธ version ที่ library ไม่มีในขั้น validate/publish
- เพิ่ม build manifest, version endpoint ที่ตรวจ session และการ build/smoke test Docker ใน CI
- เพิ่ม regression tests สำหรับ version, module selection, typed client, idempotency key และ file picker lifecycle

รายละเอียดการใช้ package อยู่ที่ [packages/sharemodule/README.md](packages/sharemodule/README.md)

### ขอบเขตที่ยังต้องทำต่อ

- ยังไม่ครบระยะ Foundation: หน้า Connections, การสร้าง default binding/schema จาก module config และ config revision ยังต้องทำ
- File Manager ยังใช้ API/สิทธิ์ผู้ดูแล site เดิม; ยังไม่เปิดให้ tenant end-user ใช้ด้วย tenant session และยังไม่ใช้ immutable FileRef ID หรือ path policy ใหม่ครบทุกแบบ
- Auth ใหม่ยังครอบ local login เดิม; registration, revoke/session ใหม่ และ Google/LINE/Facebook/LDAP/AD adapters ยังต้องทำ
- Mail facade ยังใช้ HTTP provider/outbox เดิม; SMTP, CC, attachments, template collection และย้าย tenant outbox ยังต้องทำ
- Google/Media adapters ยังไม่ได้ implement; GitHub Release/GHCR publishing และ migration/rollback workflow ยังต้องทำ
- ยังไม่ได้ deploy แทน container ที่ใช้งานอยู่หรือเผยแพร่ package ขึ้น registry

ชุดแรกนี้เป็นการวางฐานและย้ายการใช้งานจริงเข้า library โดยยังไม่ถือว่าโมดูลทั้งสี่กลุ่มเสร็จครบตาม Definition of Done

ผลตรวจชุดแรก: unit tests ผ่าน 134 รายการ/ข้าม 1, TypeScript ผ่าน, lint ไม่มี error (ยังมี warning เดิม), package dry-run ผ่าน และ Docker image `lowcode-sharemodule:local` build สำเร็จ ทดสอบ import compiled exports และ HTTP server ภายใน image โดยไม่ mount โค้ดจากเครื่องผ่านแล้ว ทั้ง authentication guard และ cross-origin guard ทำงาน ส่วนการตรวจ UI ผ่าน browser ยังไม่ได้ทำเพราะไม่มี browser เชื่อมต่อ และยังไม่ได้ทดสอบ integration ของ provider ภายนอก

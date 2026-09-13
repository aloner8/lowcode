# P7 Migration Inventory Dry-run

Checkpoint แรกของ P7 เป็นการอ่าน Core DB แบบ `REPEATABLE READ READ ONLY` เพื่อสร้าง baseline ก่อนย้ายข้อมูลจริง เครื่องมือนี้ไม่สร้าง schema, ไม่แก้ row, ไม่เปิด tenant DB และไม่แตะ process/proxy/service

## วิธีรัน

ให้ host inject `CORE_DATABASE_URL` เข้า process ด้วยช่องทาง secret ของ environment แล้วรัน:

```bash
npm run migration:inventory
```

ผลลัพธ์เป็น JSON ทาง stdout และไม่แสดง connection string รายงานมี:

- จำนวนและ checksum ของบัญชี, Platform, App, Page, Component, Collection, Domain และ service binding
- จำนวน source row ที่มี mapping กับโมเดลเป้าหมาย และจำนวนที่ยัง unresolved
- orphan/reference checks ที่ต้องเป็นศูนย์ก่อน apply
- รายชื่อ App/tenant database ที่ต้อง inventory asset แยกใน checkpoint ถัดไป

Checksum คำนวณจาก identity/version/status metadata ที่กำหนดตายตัว ไม่รวม password hash, secret reference หรือ provider config จึงใช้เปรียบเทียบก่อน/หลังโดยไม่คัดลอก secret ลงรายงาน

## การตีความ

- `status: MISSING` หมายถึง schema ต้นทางไม่มี table นั้น ต้องหยุดและตรวจ migration baseline
- `unresolved > 0` เป็นงาน mapping ที่ต้องระบุให้ชัด ห้ามเดาด้วยชื่อแล้ว apply อัตโนมัติ
- `referenceViolations > 0` เป็น blocker ก่อน staging conversion
- `PER_TENANT_SCAN_REQUIRED` เป็นสถานะที่ตั้งใจไว้ เพราะ asset อยู่ใน tenant DB/managed storage ไม่ได้อยู่ Core DB
- `readyForApply` เป็น `false` เสมอในเครื่องมือ checkpoint นี้ แม้ฐานข้อมูลว่างหรือ mapping/reference ครบ เพราะ Core metadata ไม่ได้พิสูจน์ asset preservation, staging conversion หรือ restore rehearsal

รายงาน dry-run ไม่ใช่หลักฐาน backup หรือ restore งาน apply/cutover ต้องรอสำเนา staging, backup manifest และ restore rehearsal ตาม ImplementPlan

## เปรียบเทียบรายงาน offline

```bash
npm run migration:compare -- before.json after.json
```

อ่าน JSON สองไฟล์เท่านั้น ไม่เชื่อม DB และไม่เขียนไฟล์ ตรวจ schema/รายการที่ครบและไม่ซ้ำก่อนเทียบด้วย key (ลำดับรายการไม่สำคัญ) เปรียบเทียบ count และ metadata checksum พร้อม unresolved mappings และ reference violations โดยไม่เชื่อค่า summary ที่มากับไฟล์

Exit code: `0` เมื่อ metadata ตรงกัน, mapping ครบและ reference ปลายทางสะอาด; `2` เมื่อพบความต่าง/ข้อมูลไม่พร้อม; `1` เมื่ออ่านหรือ validate ไฟล์ไม่ได้ ไม่มี exit code ใดเป็นการอนุมัติ apply และ `readyForApply` คง false เสมอ

การเปลี่ยน ID/version/status/updated_at โดยตั้งใจระหว่าง conversion อาจทำให้ checksum ต่าง ต้องทบทวนกับ mapping ที่ชัดเจน ไม่ใช่สรุปว่าข้อมูลหายทันที ในทางกลับกัน checksum ตรงกันไม่ได้พิสูจน์ว่า business payload, asset หรือ style คงเดิม เพราะไม่ได้รวมข้อมูลเหล่านั้นใน fingerprint

## Missing table dependencies

The inventory checks table presence before mapping, reference, and tenant-list queries. Missing source tables remain `MISSING`; present source tables retain their row count/checksum even if mapping tables are absent. Those mappings use `mappingStatus: UNAVAILABLE`, `mapped: null`, `unresolved: null`, and explicit `missingDependencies`. Skipped reference checks similarly use `status: UNAVAILABLE`, `violations: null`, and dependency names. An absent `apps` table makes the tenant list unavailable without querying it.

Unknown mapping/reference totals are `null`, never zero. The offline comparator accepts these additive v1 fields but never treats unknown mappings or reference results as complete/clean. Existing v1 reports with measured results remain compatible. Missing columns, permissions, or unexpected SQL errors still abort and roll back; this checkpoint handles absent tables only, not schema repair.

## Offline filesystem asset manifest

```bash
npm run migration:assets -- /path/to/offline-asset-copy
```

Use only a trusted, quiescent copy containing the selected App's assets, not a repository, credential directory, or live storage root. This command streams regular files read-only and emits JSON containing relative paths, sizes, SHA-256 content hashes, empty directories, and a deterministic aggregate checksum. It does not connect to a database or include file contents or the absolute root. Keep the report private because asset names can contain business information.

Symlinks at the root or within the tree and special files are rejected. Detected file/directory mutations abort with a generic error and exit 1; no partial JSON is emitted. This is not an atomic snapshot or an adversarial-filesystem sandbox: operators must provide a stable trusted snapshot and trusted ancestor directories. Exit 0 means the scan completed, never that migration or restore is approved (`readyForApply` stays false).

This manifest covers filesystem bytes and paths only, not DB-backed assets, binding/style semantics, ownership, modes, extended attributes, or links. The metadata `migration:compare` command does not accept asset manifests. Review asset manifests separately until a dedicated asset comparator is implemented; staging mapping and backup/restore rehearsal remain outstanding.

# P2-A — Screen/Page Lifecycle Foundation

วันที่: 12 กันยายน 2026

ไฟล์หลัก: `src/lib/runtime/lifecycleRunner.ts`

## Contract ที่ทำงานแล้ว

```text
App startup
  -> Screen Onload -> LoadComplete -> AfterLoad
  -> SetLayout -> SetLayoutComplete -> AfterSetLayout
  -> ChangePage
      -> Page Onload
      -> Collection ตาม loadOrder
      -> OnloadPageComplete
      -> Component ตาม loadOrder
      -> Page ready (commit currentPage)
  -> ChangePageComplete -> AfterChangePage
```

- Navigate Route/Reload ยกเลิกงานเดิมและสร้าง Screen instance + Screen memory ใหม่
- ChangePage คง Screen instance/memory และสร้าง Page instance + Page memory ใหม่
- `desiredPageId` แยกจาก `currentPageId`; current เปลี่ยนหลัง Collection และ Component พร้อมแล้วเท่านั้น
- Collection และ Component โหลด sequential ตาม `loadOrder` ไม่อิงตำแหน่ง render
- Screen frame Component เตรียมใน SetLayout และแยกจาก Page Panel Component
- ทุก request มี request/screen/page token และ AbortSignal
- Adapter ที่ไม่รองรับ abort ก็ไม่สามารถ commit ผลเก่าทับ Page ล่าสุด เพราะ runner ตรวจ token หลัง await
- failure ระบุ phase, Object และ request ID; ไม่ยิง Complete ปลอมหลัง error

## Adapter boundary

Runtime จริงต้องส่ง adapter สำหรับ:

- lifecycle event trace
- Screen action step
- Collection loader (`api/db` ใน P3)
- Screen Component readiness
- Page Component readiness
- failure reporting

ขอบเขตนี้ทำให้ Preview และ Runtime ใช้ runner ตัวเดียวกัน และเปลี่ยนเพียง adapter/data source

## หลักฐานทดสอบ

`tests/lifecycleRunner.test.ts` ครอบคลุม:

1. ลำดับ Complete/After ทั้งเส้นทาง
2. Screen memory คงเมื่อ ChangePage และ reset เมื่อ Reload
3. Collection/Screen Component/Page Component เรียงตาม load order
4. Page ช้าที่ถูกยกเลิกไม่ทับ Page ล่าสุดเมื่อคลิกรัว
5. Page ใหม่ล้มแล้ว Page ปัจจุบันยังคงอยู่ พร้อม failure phase/Object ที่ชัดเจน

## งาน P2 ที่ยังเหลือ

- ต่อ adapter เข้ากับ `DynamicPageRenderer` และ readiness ของ Component เดิม
- เพิ่ม timeout policy และ event/action interpreter ที่อนุญาต
- ทดสอบ DOM Component ที่วัดขนาด/มี side effect ใน hidden preparation
- ต่อ collection test adapter เป็น `api/db` จริงใน P3
- เพิ่ม trace UI สำหรับ Preview/Studio

ดังนั้น checkpoint นี้คือ lifecycle foundation (P2-A) ยังไม่ถือว่า P2 integration ทั้งระยะเสร็จ

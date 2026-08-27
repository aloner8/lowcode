/**
 * Thai names for audit action codes.
 *
 * Codes are `VERB_ENTITY` (`UPDATE_APP`, `CREATE_USER`) with a handful of
 * one-word exceptions. Composing verb and entity rather than listing every
 * combination means a new entity only needs one entry, and an unrecognised code
 * still falls back to something readable instead of a bare constant.
 */

const WHOLE: Record<string, string> = {
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  CHANGE_PASSWORD: 'เปลี่ยนรหัสผ่าน',
  BUILD_RUNTIME: 'สร้างระบบสำหรับทดสอบ',
  PROVISION_MODULE: 'ติดตั้งส่วนเสริม',
  PUBLISH_DATABASE: 'เผยแพร่ฐานข้อมูล',
};

const VERBS: Record<string, string> = {
  CREATE: 'เพิ่ม',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  UPLOAD: 'อัปโหลด',
  RECORD: '',
};

const ENTITIES: Record<string, string> = {
  APP: 'เว็บไซต์',
  USER: 'ผู้ใช้',
  PLATFORM: 'แม่แบบระบบ',
  PAGE: 'หน้าเว็บ',
  FLOW: 'ลำดับงาน',
  ASSET: 'ไฟล์',
  DOMAIN: 'โดเมน',
  INSERT: 'ข้อมูล',
  UPDATE: 'ข้อมูล',
  DELETE: 'ข้อมูล',
};

export function auditActionLabel(action: string): string {
  const whole = WHOLE[action];
  if (whole) return whole;

  const [verb, ...rest] = action.split('_');
  const entity = ENTITIES[rest.join('_')];

  // RECORD_INSERT / RECORD_UPDATE / RECORD_DELETE name the verb second.
  if (verb === 'RECORD') {
    const inner = { INSERT: 'เพิ่มข้อมูล', UPDATE: 'แก้ไขข้อมูล', DELETE: 'ลบข้อมูล' }[rest[0]];
    if (inner) return inner;
  }

  const verbLabel = VERBS[verb];
  if (verbLabel && entity) return `${verbLabel}${entity}`;
  if (verbLabel) return verbLabel;

  return action;
}

/** Destructive actions should stand out; routine sign-ins should not. */
export function auditActionTone(action: string): 'is-danger' | 'is-ok' | 'is-info' | 'is-off' {
  if (action.startsWith('DELETE')) return 'is-danger';
  if (action.startsWith('CREATE')) return 'is-ok';
  if (action.startsWith('UPDATE') || action.startsWith('UPLOAD')) return 'is-info';
  return 'is-off';
}

import { describe, expect, it } from 'vitest';
import { auditActionLabel, auditActionTone } from '@/lib/admin/auditLabels';

describe('auditActionLabel', () => {
  it('names the one-word actions', () => {
    expect(auditActionLabel('LOGIN')).toBe('เข้าสู่ระบบ');
    expect(auditActionLabel('CHANGE_PASSWORD')).toBe('เปลี่ยนรหัสผ่าน');
  });

  it('composes verb and entity for VERB_ENTITY codes', () => {
    expect(auditActionLabel('CREATE_APP')).toBe('เพิ่มเว็บไซต์');
    expect(auditActionLabel('UPDATE_USER')).toBe('แก้ไขผู้ใช้');
    expect(auditActionLabel('DELETE_PLATFORM')).toBe('ลบแม่แบบระบบ');
  });

  it('reads RECORD_* codes, where the verb comes second', () => {
    expect(auditActionLabel('RECORD_INSERT')).toBe('เพิ่มข้อมูล');
    expect(auditActionLabel('RECORD_DELETE')).toBe('ลบข้อมูล');
  });

  it('returns the code itself rather than an empty label when unknown', () => {
    expect(auditActionLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('marks deletions as destructive and sign-ins as routine', () => {
    expect(auditActionTone('DELETE_APP')).toBe('is-danger');
    expect(auditActionTone('CREATE_USER')).toBe('is-ok');
    expect(auditActionTone('UPDATE_APP')).toBe('is-info');
    expect(auditActionTone('LOGIN')).toBe('is-off');
  });
});

import { describe, expect, it } from 'vitest';
import { clientIdentity, validateRateLimitUpdate } from '@/lib/security/rateLimit';

const request = (headers: Record<string, string>) =>
  new Request('http://localhost/api/x', { headers });

describe('clientIdentity', () => {
  it('uses the first hop of x-forwarded-for', () => {
    expect(clientIdentity(request({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' })))
      .toBe('203.0.113.9');
  });

  it('falls back to x-real-ip, then to a placeholder', () => {
    expect(clientIdentity(request({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(clientIdentity(request({}))).toBe('unknown');
  });

  it('appends a lowercased suffix so one IP cannot spray many accounts', () => {
    expect(clientIdentity(request({ 'x-real-ip': '1.2.3.4' }), 'Site:User@Example.COM'))
      .toBe('1.2.3.4|site:user@example.com');
  });

  it('caps an over-long suffix rather than letting it bloat the key', () => {
    const identity = clientIdentity(request({ 'x-real-ip': '1.2.3.4' }), 'a'.repeat(500));
    expect(identity.length).toBeLessThanOrEqual(64 + 1 + 160);
  });
});

describe('validateRateLimitUpdate', () => {
  it('accepts values inside the allowed bounds', () => {
    const { value, error } = validateRateLimitUpdate({
      maxAttempts: 5, windowSeconds: 600, lockoutSeconds: 300, isEnabled: false,
    });
    expect(error).toBeUndefined();
    expect(value).toEqual({ maxAttempts: 5, windowSeconds: 600, lockoutSeconds: 300, isEnabled: false });
  });

  it('allows a zero lockout, meaning "count but never lock"', () => {
    expect(validateRateLimitUpdate({ lockoutSeconds: 0 }).value).toEqual({ lockoutSeconds: 0 });
  });

  it('refuses values outside the database CHECK constraints', () => {
    expect(validateRateLimitUpdate({ maxAttempts: 0 }).error).toBeTruthy();
    expect(validateRateLimitUpdate({ maxAttempts: 20000 }).error).toBeTruthy();
    expect(validateRateLimitUpdate({ windowSeconds: 5 }).error).toBeTruthy();
    expect(validateRateLimitUpdate({ lockoutSeconds: 100000 }).error).toBeTruthy();
  });

  it('refuses non-integers and wrong types', () => {
    expect(validateRateLimitUpdate({ maxAttempts: 1.5 }).error).toBeTruthy();
    expect(validateRateLimitUpdate({ maxAttempts: 'ten' }).error).toBeTruthy();
    expect(validateRateLimitUpdate({ isEnabled: 'yes' }).error).toBeTruthy();
  });

  it('refuses an empty or non-object payload', () => {
    expect(validateRateLimitUpdate({}).error).toBeTruthy();
    expect(validateRateLimitUpdate(null).error).toBeTruthy();
  });
});

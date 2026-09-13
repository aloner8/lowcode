import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/runtime/[slug]/health/route';

describe('P6 site process health endpoint', () => {
  const original = process.env.SITE_SLUG;
  afterEach(() => {
    if (original === undefined) delete process.env.SITE_SLUG;
    else process.env.SITE_SLUG = original;
  });

  it('reports real process metrics only for its assigned Site', async () => {
    process.env.SITE_SLUG = 'agency';
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ slug: 'agency' }) });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'healthy', appSlug: 'agency',
      metrics: expect.objectContaining({ memoryRssBytes: expect.any(Number), uptimeSeconds: expect.any(Number) }),
    }));
  });

  it('does not expose health for another Site slug', async () => {
    process.env.SITE_SLUG = 'agency';
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ slug: 'other' }) })).status).toBe(404);
  });
});

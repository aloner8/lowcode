/**
 * Validation for author-supplied SEO payloads.
 *
 * These values end up in <meta> tags, JSON-LD and robots directives, so they
 * are length-bounded and stripped of characters that could break out of an
 * attribute or inject markup.
 */

const MAX_LENGTHS = {
  siteName: 120,
  description: 320,
  keyword: 60,
  ogImage: 2048,
  twitterHandle: 40,
  verification: 200,
} as const;

const LOCALE = /^[a-z]{2}(_[A-Z]{2})?$/;
const LANGUAGE = /^[a-z]{2}(-[A-Za-z]{2,8})?$/;
const ROBOTS = /^(index|noindex)(\s*,\s*(follow|nofollow))?$/i;
const TWITTER = /^@[A-Za-z0-9_]{1,15}$/;
const SAFE_IMAGE = /^(https?:\/\/|\/)[^\s"'<>]*$/i;

const ORGANIZATION_TYPES = new Set([
  'Organization', 'GovernmentOrganization', 'LocalBusiness', 'Corporation',
  'EducationalOrganization', 'NGO', 'MedicalOrganization',
]);

export interface SeoValidationResult<T> {
  value?: T;
  error?: string;
}

const clean = (value: string) => value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

function optionalText(
  raw: unknown,
  max: number,
  label: string,
): SeoValidationResult<string | null> {
  if (raw === null || raw === undefined || raw === '') return { value: null };
  if (typeof raw !== 'string') return { error: `${label} ต้องเป็นข้อความ` };
  const text = clean(raw);
  if (text.length > max) return { error: `${label} ต้องไม่เกิน ${max} ตัวอักษร` };
  return { value: text || null };
}

function keywordList(raw: unknown): SeoValidationResult<string[]> {
  if (raw === undefined || raw === null) return { value: [] };
  const source = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : null;
  if (!source) return { error: 'keywords ต้องเป็น array หรือข้อความคั่นด้วยจุลภาค' };

  const keywords = source
    .map((item) => (typeof item === 'string' ? clean(item) : ''))
    .filter(Boolean);

  if (keywords.some((keyword) => keyword.length > MAX_LENGTHS.keyword)) {
    return { error: `แต่ละ keyword ต้องไม่เกิน ${MAX_LENGTHS.keyword} ตัวอักษร` };
  }
  if (keywords.length > 30) return { error: 'keywords ต้องไม่เกิน 30 รายการ' };
  return { value: [...new Set(keywords)] };
}

export interface SeoPayload {
  siteName: string | null;
  description: string | null;
  keywords: string[];
  locale: string | null;
  language: string | null;
  ogImage: string | null;
  twitterHandle: string | null;
  organizationType: string | null;
  robots: string | null;
  googleSiteVerification?: string | null;
  bingSiteVerification?: string | null;
  sitemapEnabled?: boolean;
  contact?: Record<string, string>;
}

/** Validates a site- or platform-level SEO object. */
export function validateSeoPayload(input: unknown): SeoValidationResult<SeoPayload> {
  if (!input || typeof input !== 'object') return { error: 'SEO payload ไม่ถูกต้อง' };
  const raw = input as Record<string, unknown>;

  const siteName = optionalText(raw.siteName, MAX_LENGTHS.siteName, 'ชื่อเว็บไซต์');
  if (siteName.error) return { error: siteName.error };

  const description = optionalText(raw.description, MAX_LENGTHS.description, 'คำอธิบาย');
  if (description.error) return { error: description.error };

  const keywords = keywordList(raw.keywords);
  if (keywords.error) return { error: keywords.error };

  if (raw.locale != null && raw.locale !== '' && !LOCALE.test(String(raw.locale))) {
    return { error: 'locale ต้องอยู่ในรูปแบบ th_TH หรือ en' };
  }
  if (raw.language != null && raw.language !== '' && !LANGUAGE.test(String(raw.language))) {
    return { error: 'language ต้องอยู่ในรูปแบบ th หรือ en-US' };
  }
  if (raw.ogImage != null && raw.ogImage !== '') {
    const image = String(raw.ogImage);
    if (image.length > MAX_LENGTHS.ogImage || !SAFE_IMAGE.test(image)) {
      return { error: 'ogImage ต้องเป็น URL ที่ขึ้นต้นด้วย https:// หรือ /' };
    }
  }
  if (raw.twitterHandle != null && raw.twitterHandle !== '' && !TWITTER.test(String(raw.twitterHandle))) {
    return { error: 'twitterHandle ต้องขึ้นต้นด้วย @ และยาวไม่เกิน 15 ตัวอักษร' };
  }
  if (raw.organizationType != null && raw.organizationType !== '' && !ORGANIZATION_TYPES.has(String(raw.organizationType))) {
    return { error: `organizationType ต้องเป็น ${[...ORGANIZATION_TYPES].join(' | ')}` };
  }
  if (raw.robots != null && raw.robots !== '' && !ROBOTS.test(String(raw.robots))) {
    return { error: 'robots ต้องเป็น index,follow / noindex,nofollow เป็นต้น' };
  }

  const google = optionalText(raw.googleSiteVerification, MAX_LENGTHS.verification, 'Google verification');
  if (google.error) return { error: google.error };
  const bing = optionalText(raw.bingSiteVerification, MAX_LENGTHS.verification, 'Bing verification');
  if (bing.error) return { error: bing.error };

  const contact: Record<string, string> = {};
  if (raw.contact && typeof raw.contact === 'object') {
    for (const [key, value] of Object.entries(raw.contact as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) contact[key] = clean(value).slice(0, 200);
    }
  }

  return {
    value: {
      siteName: siteName.value ?? null,
      description: description.value ?? null,
      keywords: keywords.value ?? [],
      locale: raw.locale ? String(raw.locale) : null,
      language: raw.language ? String(raw.language) : null,
      ogImage: raw.ogImage ? String(raw.ogImage) : null,
      twitterHandle: raw.twitterHandle ? String(raw.twitterHandle) : null,
      organizationType: raw.organizationType ? String(raw.organizationType) : null,
      robots: raw.robots ? String(raw.robots) : null,
      googleSiteVerification: google.value ?? null,
      bingSiteVerification: bing.value ?? null,
      sitemapEnabled: raw.sitemapEnabled !== false,
      contact,
    },
  };
}

export interface PageSeoPayload {
  title: string | null;
  description: string | null;
  keywords: string[];
  ogImage: string | null;
  noindex: boolean;
  changeFrequency: string;
  priority: number;
}

const CHANGE_FREQUENCIES = new Set([
  'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never',
]);

/** Validates the per-page SEO object stored inside studio_pages[].seo */
export function validatePageSeo(input: unknown): SeoValidationResult<PageSeoPayload> {
  if (!input || typeof input !== 'object') return { error: 'Page SEO ไม่ถูกต้อง' };
  const raw = input as Record<string, unknown>;

  const title = optionalText(raw.title, MAX_LENGTHS.siteName, 'Title');
  if (title.error) return { error: title.error };

  const description = optionalText(raw.description, MAX_LENGTHS.description, 'Description');
  if (description.error) return { error: description.error };

  const keywords = keywordList(raw.keywords);
  if (keywords.error) return { error: keywords.error };

  if (raw.ogImage != null && raw.ogImage !== '' && !SAFE_IMAGE.test(String(raw.ogImage))) {
    return { error: 'ogImage ต้องเป็น URL ที่ขึ้นต้นด้วย https:// หรือ /' };
  }

  const frequency = String(raw.changeFrequency ?? 'weekly');
  if (!CHANGE_FREQUENCIES.has(frequency)) {
    return { error: `changeFrequency ต้องเป็น ${[...CHANGE_FREQUENCIES].join(' | ')}` };
  }

  const priority = Number(raw.priority ?? 0.5);
  if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
    return { error: 'priority ต้องอยู่ระหว่าง 0 ถึง 1' };
  }

  return {
    value: {
      title: title.value ?? null,
      description: description.value ?? null,
      keywords: keywords.value ?? [],
      ogImage: raw.ogImage ? String(raw.ogImage) : null,
      noindex: raw.noindex === true,
      changeFrequency: frequency,
      priority,
    },
  };
}

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';
import { findCustomerAccessBlock } from '@/lib/auth/customerAccess';

/*
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 * The behaviour is unchanged: this runs before every matched request.
 */

/** Routes that require a valid Web แม่ (Platform) session. */
const PROTECTED_PREFIXES = [
  '/admin', '/studio', '/page-designer', '/form-designer', '/flow-studio', '/process-studio', '/svg-studio', '/module-studio', '/audit-logs', '/site', '/account',
  // Developer demos render arbitrary components; they are internal tools.
  '/renderer-demo', '/shared-demo', '/suspended',
];

/** Where an account with a seeded password is sent until it sets its own. */
const CHANGE_PASSWORD_PATH = '/account/password';

/** Routes only the service provider (GOD) may open. */
const GOD_ONLY_PREFIXES = ['/admin/customers', '/admin/platforms', '/admin/security', '/page-designer', '/flow-studio', '/process-studio', '/svg-studio'];

/** Control-plane surfaces that a public site process must never expose. */
const CONTROL_PLANE_PREFIXES = [...PROTECTED_PREFIXES];

/**
 * When the process was started by `scripts/run-sites.mjs` it serves exactly one
 * site (`SITE_SLUG`), optionally answering several domains (`SITE_DOMAIN_MAP`).
 * Both are plain environment variables so this stays Edge-safe — no database
 * call happens on the request path.
 */
const SITE_SLUG = process.env.SITE_SLUG?.trim() ?? '';

let cachedDomainMap: Record<string, string> | null = null;
function getDomainMap(): Record<string, string> {
  if (cachedDomainMap) return cachedDomainMap;
  try {
    cachedDomainMap = JSON.parse(process.env.SITE_DOMAIN_MAP || '{}') as Record<string, string>;
  } catch {
    console.warn('[sites] SITE_DOMAIN_MAP is not valid JSON — falling back to SITE_SLUG only.');
    cachedDomainMap = {};
  }
  return cachedDomainMap;
}

function resolveSiteSlug(request: NextRequest): string {
  const hostname = (request.headers.get('host') ?? '').split(':')[0].trim().toLowerCase();
  return getDomainMap()[hostname] ?? SITE_SLUG;
}

const isSiteProcess = () => Boolean(SITE_SLUG) || Object.keys(getDomainMap()).length > 0;

/** Site process: serve exactly one tenant site, never the control plane. */
function handleSiteRequest(request: NextRequest, path: string): NextResponse {
  const slug = resolveSiteSlug(request);

  if (!slug) {
    return new NextResponse('Site not configured for this host', { status: 404 });
  }
  if (CONTROL_PLANE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return new NextResponse('Not found', { status: 404 });
  }
  // `/app/<slug>` and API routes are already canonical; everything else is
  // rewritten so each site can be reached at the root of its own domain.
  if (!path.startsWith('/app/') && !path.startsWith('/api/')) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = path === '/' ? `/app/${slug}` : `/app/${slug}${path}`;
    return NextResponse.rewrite(rewritten);
  }
  return NextResponse.next({ request: { headers: request.headers } });
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isSiteProcess()) return handleSiteRequest(request, path);

  // ---- Control plane (App แม่) ----
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    const response = NextResponse.redirect(loginUrl);
    // Clear a stale or forged cookie so the browser stops resending it.
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (session && isProtected) {
    const blocked = await findCustomerAccessBlock(session.sub, session.role);
    if (blocked && path !== '/suspended') {
      return NextResponse.redirect(new URL('/suspended', request.url));
    }
    if (!blocked && path === '/suspended') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // An account still using the password it was created with cannot reach
  // anything except the change-password screen. API callers are left alone
  // here so the route guard can answer with JSON instead of an HTML redirect.
  if (session?.mustChangePassword && path !== CHANGE_PASSWORD_PATH && !path.startsWith('/api/')) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  if (session && GOD_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix)) && session.role !== 'GOD') {
    return NextResponse.redirect(new URL('/admin?error=forbidden', request.url));
  }

  if (path === '/login' && session) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  // Everything except Next internals and static files, so site processes can
  // rewrite arbitrary public paths onto their own /app/<slug> subtree.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};

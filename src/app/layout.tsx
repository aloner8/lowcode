import type { Metadata } from 'next';
import { Anuphan } from 'next/font/google';
import { headers } from 'next/headers';
import { loadSiteRuntimeByHost } from '@/lib/seo/siteSeo';
import './globals.css';
import './municipal-theme.css';

/**
 * Anuphan is the product typeface. It is self-hosted by next/font, so there is
 * no render-blocking request to Google and no layout shift while it loads.
 */
const anuphan = Anuphan({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-anuphan',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Low-Code Builder & Control Studio',
  description: 'Dynamic Web Application Builder & DesignMode Studio',
  // The control plane must never be indexed; public sites override this in
  // their own generateMetadata.
  robots: { index: false, follow: false },
};

/**
 * The `lang` attribute is resolved per request from the host, so a Thai tenant
 * site is served as `lang="th"` rather than inheriting the studio's default.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers();
  const site = await loadSiteRuntimeByHost(headerList.get('host') ?? '').catch(() => null);
  const language = site?.seo.language || 'th';

  return (
    <html lang={language} className={anuphan.variable}>
      <body>{children}</body>
    </html>
  );
}

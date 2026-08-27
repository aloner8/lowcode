import React from 'react';
import { CalendarDays, ChevronLeft } from 'lucide-react';
import { sanitizeHtml } from '@/lib/security/sanitizeHtml';
import type { SitePost } from '@/lib/seo/sitePost';

const thaiDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * A single article.
 *
 * Rendered on the server so the body text is in the HTML a crawler receives.
 * The stored body is author-supplied markup, so it goes through the allow-list
 * sanitizer before it reaches `dangerouslySetInnerHTML`.
 */
export function PostArticleView({ post, basePath }: { readonly post: SitePost; readonly basePath: string }) {
  const published = thaiDate(post.publishedAt);

  return (
    <div className="gov-article container py-4">
      <nav aria-label="เส้นทางหน้า" className="mb-3">
        <ol className="breadcrumb mb-0 small">
          <li className="breadcrumb-item"><a href={`${basePath}/`}>หน้าหลัก</a></li>
          <li className="breadcrumb-item">
            <a href={`${basePath}/${post.parent.id}`}>{post.parent.title}</a>
          </li>
          <li className="breadcrumb-item active" aria-current="page">{post.title}</li>
        </ol>
      </nav>

      <article className="gov-article-body">
        <header className="mb-4">
          {post.categoryName && (
            <p className="gov-article-category mb-2">{post.categoryName}</p>
          )}
          <h1 className="gov-article-title h2 fw-bold mb-2">{post.title}</h1>
          {published && (
            <p className="text-secondary small mb-0 d-flex align-items-center gap-1">
              <CalendarDays size={14} aria-hidden="true" />
              <time dateTime={post.publishedAt ?? ''}>เผยแพร่เมื่อ {published}</time>
            </p>
          )}
        </header>

        {post.image && (
          // Tenant images come from arbitrary URLs, so next/image cannot optimise them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image}
            alt={post.title}
            className="img-fluid rounded-3 mb-4 w-100"
            style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
          />
        )}

        <div
          className="gov-article-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
        />
      </article>

      <div className="mt-4 pt-3 border-top">
        <a href={`${basePath}/${post.parent.id}`} className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
          <ChevronLeft size={15} aria-hidden="true" /> กลับไปยัง{post.parent.title}
        </a>
      </div>
    </div>
  );
}

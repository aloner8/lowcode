'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu, Palette, KeyRound } from 'lucide-react';
import { navItemFor } from '@/lib/admin/navigation';
import { UserProfile } from '@/types';

interface AdminTopbarProps {
  readonly user: UserProfile;
  readonly onOpenMenu: () => void;
}

export default function AdminTopbar({ user, onOpenMenu }: AdminTopbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = navItemFor(pathname);
  const [studioPlatformName, setStudioPlatformName] = useState<string | null>(null);
  const [platformPageTitle, setPlatformPageTitle] = useState<string | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);
  const selectedPlatformId = searchParams.get('platformId');
  const selectedCollectionId = searchParams.get('collectionId');

  useEffect(() => {
    if (pathname !== '/studio' || !selectedPlatformId) { setStudioPlatformName(null); return; }
    let active = true;
    fetch('/api/platforms', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load platforms')))
      .then((data: { platforms?: Array<{ id: string; platformName: string }> }) => {
        if (active) setStudioPlatformName(data.platforms?.find((item) => item.id === selectedPlatformId)?.platformName ?? null);
      })
      .catch(() => { if (active) setStudioPlatformName(null); });
    return () => { active = false; };
  }, [pathname, selectedPlatformId]);

  useEffect(() => {
    const match = pathname.match(/^\/page-designer\/platform\/([^/]+)\/([^/]+)$/);
    if (!match) { setPlatformPageTitle(null); return; }
    let active = true;
    fetch(`/api/platforms/${encodeURIComponent(decodeURIComponent(match[1]))}/pages/${encodeURIComponent(decodeURIComponent(match[2]))}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load page')))
      .then((data: { platform?: { platformName?: string }; page?: { title?: string; name?: string; id?: string } }) => {
        if (active) setPlatformPageTitle(`${data.platform?.platformName || 'Platform'} · ${data.page?.title || data.page?.name || data.page?.id || 'Page'}`);
      })
      .catch(() => { if (active) setPlatformPageTitle(null); });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/collection-designer') return;
    const handleCaptionChange = (event: Event) => setCollectionTitle((event as CustomEvent<string>).detail || 'Collection Set');
    window.addEventListener('collection-caption-change', handleCaptionChange);
    if (!selectedCollectionId || selectedCollectionId === 'new') {
      return () => window.removeEventListener('collection-caption-change', handleCaptionChange);
    }
    let active = true;
    fetch(`/api/collection-sets?collectionId=${encodeURIComponent(selectedCollectionId)}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load Collection Set')))
      .then((data: { collection?: { name?: string } }) => { if (active) setCollectionTitle(data.collection?.name || 'Collection Set'); })
      .catch(() => { if (active) setCollectionTitle('Collection Set'); });
    return () => { active = false; window.removeEventListener('collection-caption-change', handleCaptionChange); };
  }, [pathname, selectedCollectionId]);

  const activeCollectionTitle = pathname === '/collection-designer' && selectedCollectionId
    ? selectedCollectionId === 'new' ? 'Collection Set ใหม่' : collectionTitle
    : null;
  const pageTitle = activeCollectionTitle || platformPageTitle || (pathname === '/studio'
    ? studioPlatformName ? `${studioPlatformName} (แม่แบบระบบ)` : 'แม่แบบระบบ'
    : current?.label ?? 'ภาพรวม');

  return (
    <header className="adm-topbar d-flex align-items-center justify-content-between gap-3 px-3 px-md-4">
      <div className="d-flex align-items-center gap-2 gap-md-3 min-w-0">
        <button
          type="button"
          className="btn btn-link p-2 d-lg-none text-decoration-none"
          style={{ color: 'var(--gov-ink)' }}
          onClick={onOpenMenu}
          aria-label="เปิดเมนู"
          aria-controls="admin-sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="adm-page-title text-truncate">{pageTitle}</h1>
          {current?.description && (
            <p className="adm-page-sub d-none d-sm-block text-truncate">{current.description}</p>
          )}
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 gap-md-3 flex-shrink-0">
        <Link href="/page-designer/public-home" className="adm-topbar-btn d-none d-md-inline-flex">
          <Palette size={15} aria-hidden="true" />
          <span>ออกแบบหน้าเว็บ</span>
        </Link>

        <Link
          href="/account/password"
          className="adm-topbar-btn"
          title="เปลี่ยนรหัสผ่าน"
          aria-label="เปลี่ยนรหัสผ่าน"
        >
          <KeyRound size={15} aria-hidden="true" />
          <span className="d-none d-lg-inline">เปลี่ยนรหัสผ่าน</span>
        </Link>

        <span className="d-flex align-items-center gap-2">
          <span className="adm-avatar" aria-hidden="true">
            {(user.username ?? user.email)[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="d-none d-md-block lh-sm">
            <span className="d-block" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {user.fullName || user.username}
            </span>
            <span className="d-block" style={{ fontSize: '0.72rem', color: 'var(--gov-muted)' }}>
              {user.globalRole === 'GOD' ? 'ผู้ดูแลระบบส่วนกลาง' : 'ผู้ใช้ของหน่วยงาน'}
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}

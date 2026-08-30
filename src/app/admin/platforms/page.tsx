'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Box, Palette, Check, X, Info, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { PlatformConfig } from '@/types';
import AdminModal from '@/components/admin/AdminModal';

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [platformError, setPlatformError] = useState('');
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true);
  const [isCreatingPlatform, setIsCreatingPlatform] = useState(false);

  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('ERP');

  // Custom Category State
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const loadCategories = useCallback(async (selectedCategory?: string) => {
    setIsLoadingCategories(true);
    setCategoryError('');

    try {
      const response = await fetch('/api/platform-categories', { cache: 'no-store' });
      const data = (await response.json()) as {
        categories?: Array<{ categoryName: string }>;
        error?: string;
      };

      if (!response.ok || !data.categories) {
        throw new Error(data.error || 'ไม่สามารถโหลด Category ได้');
      }

      const names = data.categories.map((item) => item.categoryName);
      setCategoriesList(names);
      setCategory((current) => {
        if (selectedCategory && names.includes(selectedCategory)) return selectedCategory;
        if (names.includes(current)) return current;
        return names[0] || '';
      });
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'ไม่สามารถโหลด Category ได้');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadPlatforms = useCallback(async () => {
    setIsLoadingPlatforms(true);
    setPlatformError('');
    try {
      const response = await fetch('/api/platforms', { cache: 'no-store' });
      const data = (await response.json()) as { platforms?: PlatformConfig[]; error?: string };
      if (!response.ok || !data.platforms) throw new Error(data.error || 'ไม่สามารถโหลด Platform ได้');
      setPlatforms(data.platforms);
    } catch (error) {
      setPlatformError(error instanceof Error ? error.message : 'ไม่สามารถโหลด Platform ได้');
    } finally {
      setIsLoadingPlatforms(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  const handleSaveCustomCategory = async () => {
    const formatted = newCategoryInput.trim();
    if (!formatted || isSavingCategory) return;

    setIsSavingCategory(true);
    setCategoryError('');

    try {
      const response = await fetch('/api/platform-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName: formatted }),
      });
      const data = (await response.json()) as {
        category?: { categoryName: string };
        error?: string;
      };

      if (!response.ok || !data.category) {
        throw new Error(data.error || 'ไม่สามารถบันทึก Category ได้');
      }

      await loadCategories(data.category.categoryName);
      setNewCategoryInput('');
      setIsAddingCustomCategory(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'ไม่สามารถบันทึก Category ได้');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleCreatePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingPlatform) return;
    setIsCreatingPlatform(true);
    setPlatformError('');
    try {
      const response = await fetch('/api/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformName: name, platformSlug: slug, category }),
      });
      const data = (await response.json()) as { platform?: PlatformConfig; error?: string };
      if (!response.ok || !data.platform) throw new Error(data.error || 'ไม่สามารถสร้าง Platform ได้');
      await loadPlatforms();
      setIsModalOpen(false);
      setName('');
      setSlug('');
    } catch (error) {
      setPlatformError(error instanceof Error ? error.message : 'ไม่สามารถสร้าง Platform ได้');
    } finally {
      setIsCreatingPlatform(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="adm-toolbar">
        <p className="adm-toolbar-note">
          แม่แบบคือโครงสร้างตั้งต้นที่ใช้สร้างเว็บไซต์ใหม่ — แก้ที่แม่แบบแล้วเว็บที่สร้างจากแม่แบบนั้นจะได้รับการอัปเดตตาม
        </p>
        <button type="button" className="adm-btn is-sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} aria-hidden="true" /> เพิ่มแม่แบบ
        </button>
      </div>

      {platformError && (
        <div className="adm-alert is-danger" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>{platformError}</span>
        </div>
      )}

      <div className="adm-alert is-info">
        <Info size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
        <span>
          การแก้ไขแม่แบบมีผลกับทุกเว็บไซต์ที่สร้างจากแม่แบบนั้น
          หากต้องการเปลี่ยนเฉพาะเว็บใดเว็บหนึ่ง ให้ใช้ &ldquo;ปรับแต่ง&rdquo; ในหน้าเว็บไซต์ของฉันแทน
        </span>
      </div>

      {isLoadingPlatforms ? (
        <div className="adm-card adm-empty">
          <RefreshCw size={22} className="adm-spin mb-2" aria-hidden="true" />
          <p className="adm-empty-text">กำลังโหลด…</p>
        </div>
      ) : platforms.length === 0 ? (
        <div className="adm-card adm-empty">
          <span className="adm-empty-icon"><Inbox size={22} aria-hidden="true" /></span>
          <p className="adm-empty-title">ยังไม่มีแม่แบบระบบ</p>
          <p className="adm-empty-text">กด &ldquo;เพิ่มแม่แบบ&rdquo; เพื่อสร้างโครงสร้างตั้งต้นชุดแรก</p>
        </div>
      ) : (
        <div className="row g-3">
          {platforms.map((platform) => (
            <div key={platform.id} className="col-12 col-xl-6 d-flex">
              <section className="adm-card h-100 d-flex flex-column">
                <div className="adm-card-head">
                  <div className="min-w-0 d-flex align-items-center gap-2">
                    <span className="adm-stat-icon" style={{ width: '2.4rem', height: '2.4rem' }} aria-hidden="true">
                      <Layers size={18} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="adm-card-title">{platform.platformName}</h2>
                      <p className="adm-cell-sub mb-0 font-monospace">{platform.platformSlug}</p>
                    </div>
                  </div>
                  <span className="adm-chip is-info">{platform.category}</span>
                </div>

                <div className="p-3 flex-grow-1 d-flex flex-column gap-3">
                  <p className="adm-toolbar-note mb-0">
                    {platform.description || 'ยังไม่มีคำอธิบายสำหรับแม่แบบนี้'}
                  </p>

                  <div className="d-flex flex-wrap gap-2 mt-auto">
                    <Link href={`/studio?platformId=${platform.id}`} className="adm-btn is-quiet is-sm">
                      <Palette size={14} aria-hidden="true" /> แก้ไขโครงสร้าง
                    </Link>
                    <Link href={`/admin/apps?spawnPlatformId=${platform.id}`} className="adm-btn is-sm">
                      <Box size={14} aria-hidden="true" /> สร้างเว็บไซต์จากแม่แบบนี้
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          ))}
        </div>
      )}

      <AdminModal
        isOpen={isModalOpen}
        title="เพิ่มแม่แบบระบบ"
        subtitle="โครงสร้างตั้งต้นชุดใหม่สำหรับสร้างเว็บไซต์"
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePlatform}
        footer={
          <>
            <button type="button" className="adm-btn is-quiet" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="adm-btn" disabled={!category || isCreatingPlatform}>
              {isCreatingPlatform ? 'กำลังสร้าง…' : 'สร้างแม่แบบ'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label htmlFor="pf-name" className="adm-label d-block">ชื่อแม่แบบ</label>
          <input
            id="pf-name"
            className="adm-input"
            placeholder="เว็บไซต์เทศบาล"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pf-slug" className="adm-label d-block">ชื่อย่อสำหรับระบบ (slug)</label>
          <input
            id="pf-slug"
            className="adm-input is-mono"
            placeholder="web-thesaban"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
          />
          <p className="adm-help">ใช้อ้างอิงภายในระบบ เปลี่ยนภายหลังไม่ได้</p>
        </div>

        <div className="mb-1">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
            <label htmlFor="pf-category" className="adm-label mb-0">หมวดหมู่</label>
            {!isAddingCustomCategory && (
              <button
                type="button"
                className="adm-link"
                onClick={() => setIsAddingCustomCategory(true)}
              >
                <Plus size={13} aria-hidden="true" /> เพิ่มหมวดหมู่ใหม่
              </button>
            )}
          </div>

          {isAddingCustomCategory ? (
            <div className="d-flex gap-2">
              <input
                className="adm-input"
                placeholder="ชื่อหมวดหมู่ใหม่"
                value={newCategoryInput}
                onChange={(event) => setNewCategoryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSaveCustomCategory();
                  }
                }}
                disabled={isSavingCategory}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                aria-label="ชื่อหมวดหมู่ใหม่"
              />
              <button
                type="button"
                className="adm-btn is-sm"
                onClick={() => void handleSaveCustomCategory()}
                disabled={!newCategoryInput.trim() || isSavingCategory}
              >
                <Check size={14} aria-hidden="true" /> {isSavingCategory ? 'กำลังบันทึก…' : 'เพิ่ม'}
              </button>
              <button
                type="button"
                className="adm-btn is-quiet is-sm"
                onClick={() => setIsAddingCustomCategory(false)}
                disabled={isSavingCategory}
                aria-label="ยกเลิกการเพิ่มหมวดหมู่"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <select
              id="pf-category"
              className="adm-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={isLoadingCategories || categoriesList.length === 0}
            >
              {isLoadingCategories && <option value="">กำลังโหลดหมวดหมู่…</option>}
              {!isLoadingCategories && categoriesList.length === 0 && (
                <option value="">ยังไม่มีหมวดหมู่</option>
              )}
              {categoriesList.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          )}

          {categoryError && (
            <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
              <span className="adm-help" style={{ color: 'var(--gov-danger)' }}>{categoryError}</span>
              <button type="button" className="adm-link" onClick={() => void loadCategories()}>
                ลองใหม่
              </button>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}

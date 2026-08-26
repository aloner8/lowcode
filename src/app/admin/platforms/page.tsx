'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Box, Palette, ArrowRight, Sparkles, Check, X } from 'lucide-react';
import Link from 'next/link';
import { PlatformConfig } from '@/types';

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
    <div className="container-fluid p-0 select-none">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-0.5 text-dark d-flex align-items-center gap-2 text-nowrap">
            <Layers className="text-primary" size={20} />
            Platform Master Solutions (Blueprints)
          </h4>
          <p className="text-secondary small mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
            Master system templates (e.g. PlatformERP) that spawn multiple Tenant Child Apps with cascading live updates
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-medium text-nowrap"
          style={{ fontSize: '0.8rem' }}
        >
          <Plus size={16} />
          <span>+ Create New Platform Blueprint</span>
        </button>
      </div>

      {/* Feature Banner */}
      <div className="alert alert-primary border-0 bg-primary bg-opacity-10 text-primary-emphasis rounded-3 d-flex align-items-center gap-2 mb-3 p-2.5 small">
        <Sparkles size={16} className="text-primary flex-shrink-0" />
        <div className="extra-small text-nowrap">
          <strong>Cascading Updates:</strong> Modifying a Platform Master (e.g., PlatformERP) automatically updates all child Tenant Apps spawned from it!
        </div>
      </div>

      {/* Platforms Grid */}
      {platformError && <div className="alert alert-danger py-2 small">{platformError}</div>}
      {isLoadingPlatforms && <div className="text-secondary small mb-3">Loading platforms...</div>}
      <div className="row g-3">
        {platforms.map((p) => (
          <div key={p.id} className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
              <div className="card-body p-3.5">
                <div className="d-flex align-items-start justify-content-between mb-2.5">
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
                      style={{
                        width: '42px',
                        height: '42px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                      }}
                    >
                      <Layers size={22} />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0 text-dark small text-nowrap">{p.platformName}</h5>
                      <span className="badge bg-light text-secondary border extra-small text-nowrap">{p.platformSlug}</span>
                    </div>
                  </div>
                  <span className="badge bg-primary bg-opacity-15 text-primary border border-primary border-opacity-25 px-2 py-0.5 extra-small text-nowrap">
                    🏷️ {p.category} Master
                  </span>
                </div>

                <p className="text-secondary extra-small mb-3" style={{ fontSize: '0.78rem' }}>
                  {p.description}
                </p>

                <div className="d-flex align-items-center gap-2">
                  <Link
                    href={`/studio?platformId=${p.id}`}
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center py-1.5 text-nowrap"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <Palette size={14} />
                    <span>Edit in Studio</span>
                  </Link>
                  <Link
                    href={`/admin/apps?spawnPlatformId=${p.id}`}
                    className="btn btn-sm btn-primary text-white d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center py-1.5 text-nowrap"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <Box size={14} />
                    <span>Spawn Tenant App</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold fs-6">Create Platform Master Solution</h5>
                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
              </div>
              <form onSubmit={handleCreatePlatform}>
                <div className="modal-body px-4 py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">Platform Solution Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. PlatformERP, PlatformCRM"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">Platform Slug</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. platform-erp"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      required
                    />
                  </div>

                  {/* Category Field with Inline + Add Category Support */}
                  <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <label className="form-label small fw-medium text-secondary mb-0">Category</label>
                      {!isAddingCustomCategory && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none extra-small text-primary fw-semibold d-flex align-items-center gap-1"
                          onClick={() => setIsAddingCustomCategory(true)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <Plus size={13} /> Add New Category
                        </button>
                      )}
                    </div>

                    {isAddingCustomCategory ? (
                      <div className="input-group input-group-sm">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Type new category name..."
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSaveCustomCategory();
                            }
                          }}
                          disabled={isSavingCategory}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-success d-flex align-items-center gap-1"
                          onClick={() => void handleSaveCustomCategory()}
                          disabled={!newCategoryInput.trim() || isSavingCategory}
                        >
                          <Check size={14} /> {isSavingCategory ? 'Saving...' : 'Add'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => setIsAddingCustomCategory(false)}
                          disabled={isSavingCategory}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={isLoadingCategories || categoriesList.length === 0}
                      >
                        {isLoadingCategories && <option value="">Loading categories...</option>}
                        {!isLoadingCategories && categoriesList.length === 0 && (
                          <option value="">No categories found</option>
                        )}
                        {categoriesList.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}
                    {categoryError && (
                      <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
                        <div className="text-danger small">{categoryError}</div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-nowrap"
                          onClick={() => void loadCategories()}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer border-top px-4 py-3">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!category || isCreatingPlatform}>
                    {isCreatingPlatform ? 'Saving...' : 'Create Master Platform'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

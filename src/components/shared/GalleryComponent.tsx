'use client';

import React, { useState } from 'react';
import { Eye, ExternalLink } from 'lucide-react';

export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  description?: string;
  category?: string;
  link?: string;
}

export interface GalleryProps {
  title?: string;
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
  showFilters?: boolean;
  className?: string;
}

export const GalleryComponent: React.FC<GalleryProps> = ({
  title,
  items = [],
  columns = 3,
  showFilters = true,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);

  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[]];

  const filteredItems = activeCategory === 'All'
    ? items
    : items.filter((i) => i.category === activeCategory);

  const colClass = columns === 2 ? 'col-md-6' : columns === 4 ? 'col-md-3' : 'col-md-4';

  return (
    <div className={`card shadow-sm border-0 bg-white p-4 ${className}`}>
      {title && <h4 className="fw-bold mb-3">{title}</h4>}

      {/* Category Filters */}
      {showFilters && categories.length > 1 && (
        <div className="d-flex gap-2 mb-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="row g-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <div key={item.id} className={`col-12 ${colClass}`}>
              <div className="card h-100 border overflow-hidden shadow-sm hover-shadow transition">
                <div className="position-relative overflow-hidden" style={{ height: '180px' }}>
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-100 h-100 object-fit-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/400/250?random=' + item.id;
                    }}
                  />
                  <div className="position-absolute top-0 end-0 p-2 d-flex gap-1">
                    <button
                      className="btn btn-sm btn-light rounded-circle shadow-sm"
                      onClick={() => setSelectedImage(item)}
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-light rounded-circle shadow-sm"
                        title="Open Link"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="card-body p-3">
                  <h6 className="fw-bold card-title mb-1">{item.title}</h6>
                  {item.description && (
                    <p className="card-text small text-muted text-truncate">{item.description}</p>
                  )}
                  {item.category && (
                    <span className="badge bg-light text-dark border">{item.category}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-12 text-center py-5 text-muted">No items to display</div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedImage.title}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedImage(null)}
                ></button>
              </div>
              <div className="modal-body p-0 text-center bg-black">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.title}
                  className="img-fluid max-h-75vh"
                />
              </div>
              {selectedImage.description && (
                <div className="modal-footer justify-content-start">
                  <p className="mb-0 text-muted">{selectedImage.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

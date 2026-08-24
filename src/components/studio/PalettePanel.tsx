'use client';

import React, { useState } from 'react';
import { COMPONENT_PALETTE, ComponentPaletteItem } from '@/lib/engine/ComponentRegistry';
import { Plus, Search, Layers, Sparkles } from 'lucide-react';

interface PalettePanelProps {
  onAddComponent: (item: ComponentPaletteItem) => void;
}

export const PalettePanel: React.FC<PalettePanelProps> = ({ onAddComponent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Navigation', 'Form Controls', 'Data Display', 'Media & Files'];

  const filteredItems = COMPONENT_PALETTE.filter((item) => {
    const matchesSearch =
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100">
      <div className="card-header bg-white border-bottom py-2.5 px-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <Layers className="text-primary" size={18} />
            <h6 className="fw-bold mb-0 text-dark small">Component Palette</h6>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.65rem' }}>
            {filteredItems.length} Items
          </span>
        </div>

        {/* Search */}
        <div className="position-relative mb-2">
          <Search size={13} className="position-absolute text-muted" style={{ left: '10px', top: '9px' }} />
          <input
            type="text"
            className="form-control form-control-sm bg-light ps-4 text-dark border-0 rounded-2"
            placeholder="Search UI components..."
            style={{ fontSize: '0.78rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Pills */}
        <div className="d-flex gap-1 overflow-auto pb-1 no-scrollbar" style={{ fontSize: '11px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm py-0.5 px-2 rounded-pill text-nowrap extra-small ${
                selectedCategory === cat
                  ? 'btn-primary text-white font-medium shadow-sm'
                  : 'btn-outline-secondary text-secondary border-0 bg-light'
              }`}
              onClick={() => setSelectedCategory(cat)}
              style={{ fontSize: '0.68rem' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="card-body p-2 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="d-flex flex-column gap-2">
          {filteredItems.map((item) => (
            <div
              key={item.type}
              className="card border border-light p-2.5 bg-white hover-shadow transition rounded-2 cursor-pointer border-hover-primary"
              onClick={() => onAddComponent(item)}
              style={{ transition: 'all 0.15s ease' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="fw-semibold small text-dark d-flex align-items-center gap-1.5">
                  <Sparkles size={12} className="text-primary" />
                  {item.label}
                </span>
                <button className="btn btn-sm btn-outline-primary py-0.5 px-2 rounded-2 extra-small d-flex align-items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              <p className="card-text text-muted extra-small mb-0 lh-sm" style={{ fontSize: '0.7rem' }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

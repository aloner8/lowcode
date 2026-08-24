'use client';

import React, { useState } from 'react';
import { COMPONENT_PALETTE, ComponentPaletteItem } from '@/lib/engine/ComponentRegistry';
import { Plus, Search, ChevronDown, ChevronRight, Sparkles, Box, Layout, MousePointer } from 'lucide-react';

interface ToolboxPanelProps {
  onAddComponent: (item: ComponentPaletteItem) => void;
}

export const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ onAddComponent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'Navigation': true,
    'Form Controls': true,
    'Data Display': true,
    'Media & Files': true,
  });

  const categories = ['Navigation', 'Form Controls', 'Data Display', 'Media & Files'];

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredItems = COMPONENT_PALETTE.filter((item) => {
    return (
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100 d-flex flex-column">
      {/* VS Toolbox Header */}
      <div className="card-header bg-light border-bottom py-2 px-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-1.5">
          <Box size={16} className="text-primary" />
          <h6 className="fw-bold mb-0 text-dark extra-small text-uppercase" style={{ letterSpacing: '0.04em' }}>
            Toolbox (Controls)
          </h6>
        </div>
        <span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.62rem' }}>
          {filteredItems.length} Controls
        </span>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-bottom bg-white">
        <div className="position-relative">
          <Search size={12} className="position-absolute text-muted" style={{ left: '9px', top: '8px' }} />
          <input
            type="text"
            className="form-control form-control-sm bg-light ps-4 text-dark border-0 rounded-2 extra-small"
            placeholder="Search toolbox controls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Pointer Selection Mode Indicator */}
      <div className="px-2 py-1 bg-light border-bottom text-muted extra-small d-flex align-items-center gap-1.5 cursor-pointer hover-bg-white" style={{ fontSize: '0.72rem' }}>
        <MousePointer size={12} className="text-primary" />
        <span className="fw-medium text-dark">Pointer (Select Canvas Component)</span>
      </div>

      {/* Accordion Categories */}
      <div className="card-body p-1 overflow-auto flex-grow-1 select-none" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {categories.map((cat) => {
          const itemsInCat = filteredItems.filter((i) => i.category === cat);
          if (itemsInCat.length === 0 && searchTerm) return null;
          const isOpen = openCategories[cat] ?? true;

          return (
            <div key={cat} className="mb-1">
              <div
                className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
                onClick={() => toggleCategory(cat)}
                style={{ fontSize: '0.76rem' }}
              >
                <div className="d-flex align-items-center gap-1 text-dark fw-bold">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>{cat}</span>
                </div>
                <span className="badge bg-secondary bg-opacity-20 text-secondary extra-small" style={{ fontSize: '0.58rem' }}>
                  {itemsInCat.length}
                </span>
              </div>

              {isOpen && (
                <div className="ps-2 pe-1 pt-1 d-flex flex-column gap-1">
                  {itemsInCat.map((item) => (
                    <div
                      key={item.type}
                      className="d-flex align-items-center justify-content-between p-1.5 px-2 rounded-1 bg-white border border-light hover-border-primary cursor-pointer hover-shadow transition"
                      onClick={() => onAddComponent(item)}
                      style={{ transition: 'all 0.15s ease' }}
                    >
                      <div className="d-flex align-items-center gap-1.5 text-nowrap overflow-hidden">
                        <Sparkles size={12} className="text-primary flex-shrink-0" />
                        <span className="fw-medium extra-small text-dark text-truncate">{item.label}</span>
                      </div>
                      <button className="btn btn-sm btn-outline-primary py-0 px-1.5 rounded-1 extra-small ms-1 flex-shrink-0" style={{ fontSize: '0.62rem' }}>
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

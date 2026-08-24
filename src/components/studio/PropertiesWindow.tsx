'use client';

import React, { useState } from 'react';
import { ComponentNode } from '@/types';
import { Sliders, Trash2, ArrowUp, ArrowDown, Copy, Search, Zap, ListFilter, SortAsc } from 'lucide-react';

interface PropertiesWindowProps {
  selectedNode: ComponentNode | null;
  onUpdateNodeProps: (nodeId: string, updatedProps: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
  onDuplicateNode: (nodeId: string) => void;
}

export const PropertiesWindow: React.FC<PropertiesWindowProps> = ({
  selectedNode,
  onUpdateNodeProps,
  onDeleteNode,
  onMoveNode,
  onDuplicateNode,
}) => {
  const [viewMode, setViewMode] = useState<'categorized' | 'alphabetic'>('categorized');
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const [searchFilter, setSearchFilter] = useState('');

  if (!selectedNode) {
    return (
      <div className="card shadow-sm border-0 rounded-3 bg-white h-100 p-3 text-center text-muted d-flex flex-column align-items-center justify-content-center">
        <div
          className="rounded-circle bg-light d-flex align-items-center justify-content-center text-secondary mb-2"
          style={{ width: '42px', height: '42px' }}
        >
          <Sliders size={20} />
        </div>
        <h6 className="fw-bold text-dark extra-small mb-1">Properties Window</h6>
        <p className="extra-small text-muted mb-0" style={{ fontSize: '0.72rem', maxWidth: '220px' }}>
          Select any visual component on the Form Designer stage to inspect & edit its properties.
        </p>
      </div>
    );
  }

  const handlePropChange = (key: string, value: any) => {
    onUpdateNodeProps(selectedNode.id, {
      ...selectedNode.props,
      [key]: value,
    });
  };

  const propEntries = Object.entries(selectedNode.props).filter(([k]) =>
    k.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (viewMode === 'alphabetic') {
    propEntries.sort(([a], [b]) => a.localeCompare(b));
  }

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100 d-flex flex-column">
      {/* VS Properties Header Bar */}
      <div className="card-header bg-light border-bottom py-2 px-3">
        <div className="d-flex align-items-center justify-content-between mb-1.5">
          <div className="d-flex align-items-center gap-1.5 overflow-hidden">
            <Sliders size={14} className="text-primary flex-shrink-0" />
            <div className="overflow-hidden">
              <h6 className="fw-bold mb-0 text-dark extra-small text-truncate">{selectedNode.type}</h6>
              <div className="text-muted extra-small font-monospace" style={{ fontSize: '0.62rem' }}>
                ID: {selectedNode.id}
              </div>
            </div>
          </div>

          {/* Component Quick Action Toolbar */}
          <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
            <button className="btn btn-sm btn-light p-1 border-0" onClick={() => onMoveNode(selectedNode.id, 'up')} title="Move Up">
              <ArrowUp size={12} />
            </button>
            <button className="btn btn-sm btn-light p-1 border-0" onClick={() => onMoveNode(selectedNode.id, 'down')} title="Move Down">
              <ArrowDown size={12} />
            </button>
            <button className="btn btn-sm btn-light p-1 border-0" onClick={() => onDuplicateNode(selectedNode.id)} title="Duplicate">
              <Copy size={12} />
            </button>
            <button className="btn btn-sm btn-light text-danger p-1 border-0" onClick={() => onDeleteNode(selectedNode.id)} title="Delete Component">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Categorized / Alphabetic / Events Switcher Toolbar */}
        <div className="d-flex align-items-center justify-content-between pt-1">
          <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
            <button
              className={`btn btn-sm py-0.5 px-2 extra-small border-0 ${activeTab === 'properties' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary'}`}
              onClick={() => setActiveTab('properties')}
            >
              Props
            </button>
            <button
              className={`btn btn-sm py-0.5 px-2 extra-small border-0 ${activeTab === 'events' ? 'bg-warning text-dark fw-bold shadow-sm' : 'text-secondary'}`}
              onClick={() => setActiveTab('events')}
            >
              <Zap size={11} className="me-1" /> Events
            </button>
          </div>

          <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
            <button
              className={`btn btn-sm p-1 border-0 ${viewMode === 'categorized' ? 'text-primary fw-bold' : 'text-secondary'}`}
              onClick={() => setViewMode('categorized')}
              title="Categorized View 📑"
            >
              <ListFilter size={13} />
            </button>
            <button
              className={`btn btn-sm p-1 border-0 ${viewMode === 'alphabetic' ? 'text-primary fw-bold' : 'text-secondary'}`}
              onClick={() => setViewMode('alphabetic')}
              title="Alphabetic View (A-Z) 🔤"
            >
              <SortAsc size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Property Search Filter */}
      <div className="p-1.5 border-bottom bg-white">
        <div className="position-relative">
          <Search size={11} className="position-absolute text-muted" style={{ left: '8px', top: '7px' }} />
          <input
            type="text"
            className="form-control form-control-sm bg-light ps-4 text-dark border-0 rounded-2 extra-small"
            placeholder="Search properties..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ fontSize: '0.72rem' }}
          />
        </div>
      </div>

      {/* Properties List */}
      <div className="card-body p-2 overflow-auto flex-grow-1" style={{ maxHeight: 'calc(100vh - 350px)' }}>
        {activeTab === 'properties' ? (
          <div className="d-flex flex-column gap-2">
            {propEntries.map(([propKey, propVal]) => {
              if (typeof propVal === 'boolean') {
                return (
                  <div className="d-flex align-items-center justify-content-between bg-light p-1.5 px-2 rounded-2 border border-light" key={propKey}>
                    <label className="form-check-label extra-small fw-semibold text-dark mb-0 cursor-pointer" htmlFor={`prop_${propKey}`}>
                      {propKey}
                    </label>
                    <input
                      className="form-check-input ms-2 cursor-pointer"
                      type="checkbox"
                      id={`prop_${propKey}`}
                      checked={Boolean(propVal)}
                      onChange={(e) => handlePropChange(propKey, e.target.checked)}
                    />
                  </div>
                );
              }

              if (typeof propVal === 'string' || typeof propVal === 'number') {
                const isLongText = String(propVal).length > 35 || propKey.toLowerCase().includes('content');
                return (
                  <div key={propKey} className="bg-light p-1.5 rounded-2 border border-light">
                    <label className="form-label extra-small fw-semibold text-secondary mb-1 d-block">{propKey}</label>
                    {isLongText ? (
                      <textarea
                        className="form-control form-control-sm extra-small bg-white text-dark border rounded-2"
                        rows={3}
                        value={propVal}
                        onChange={(e) => handlePropChange(propKey, e.target.value)}
                        style={{ fontSize: '0.75rem' }}
                      />
                    ) : (
                      <input
                        type={typeof propVal === 'number' ? 'number' : 'text'}
                        className="form-control form-control-sm extra-small bg-white text-dark border rounded-2"
                        value={propVal}
                        onChange={(e) =>
                          handlePropChange(
                            propKey,
                            typeof propVal === 'number' ? Number(e.target.value) : e.target.value
                          )
                        }
                        style={{ fontSize: '0.75rem' }}
                      />
                    )}
                  </div>
                );
              }

              if (Array.isArray(propVal) || typeof propVal === 'object') {
                return (
                  <div key={propKey} className="bg-light p-1.5 rounded-2 border border-light">
                    <label className="form-label extra-small fw-semibold text-secondary mb-1 d-block">
                      {propKey} (JSON Structure)
                    </label>
                    <textarea
                      className="form-control form-control-sm extra-small font-monospace bg-white text-dark border rounded-2"
                      rows={4}
                      value={JSON.stringify(propVal, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handlePropChange(propKey, parsed);
                        } catch (err) {
                          // ignore syntax error while typing
                        }
                      }}
                      style={{ fontSize: '0.7rem' }}
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>
        ) : (
          /* Events Tab */
          <div className="d-flex flex-column gap-2 extra-small">
            <div className="bg-light p-2 rounded-2 border">
              <span className="fw-bold text-dark d-block mb-1">onClick Trigger</span>
              <select className="form-select form-select-sm extra-small bg-white">
                <option>(None)</option>
                <option>Trigger Flow: SubmitForm</option>
                <option>Navigate Route: /services</option>
              </select>
            </div>
            <div className="bg-light p-2 rounded-2 border">
              <span className="fw-bold text-dark d-block mb-1">onSubmit Event</span>
              <select className="form-select form-select-sm extra-small bg-white">
                <option>Save To Tenant DB ({selectedNode.id})</option>
                <option>Send Webhook Notification</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

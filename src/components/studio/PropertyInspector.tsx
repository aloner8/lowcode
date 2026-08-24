'use client';

import React from 'react';
import { ComponentNode } from '@/types';
import { Settings, Trash2, ArrowUp, ArrowDown, Copy, Sliders } from 'lucide-react';

interface PropertyInspectorProps {
  selectedNode: ComponentNode | null;
  onUpdateNodeProps: (nodeId: string, updatedProps: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
  onDuplicateNode: (nodeId: string) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedNode,
  onUpdateNodeProps,
  onDeleteNode,
  onMoveNode,
  onDuplicateNode,
}) => {
  if (!selectedNode) {
    return (
      <div className="card shadow-sm border-0 rounded-3 bg-white h-100 p-4 text-center text-muted d-flex flex-column align-items-center justify-content-center">
        <div
          className="rounded-circle bg-light d-flex align-items-center justify-content-center text-secondary mb-3"
          style={{ width: '48px', height: '48px' }}
        >
          <Sliders size={22} />
        </div>
        <h6 className="fw-bold text-dark mb-1">Property Inspector</h6>
        <p className="extra-small text-muted mb-0" style={{ maxWidth: '240px' }}>
          Select any component on the canvas to configure properties, labels, and actions.
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

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100">
      <div className="card-header bg-white border-bottom py-2.5 px-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div>
            <span className="badge bg-primary bg-opacity-10 text-primary extra-small mb-1" style={{ fontSize: '0.62rem' }}>
              Selected Component
            </span>
            <h6 className="fw-bold mb-0 text-dark small">{selectedNode.type}</h6>
            <div className="text-muted extra-small font-monospace" style={{ fontSize: '0.65rem' }}>
              ID: {selectedNode.id}
            </div>
          </div>
          <div className="btn-group btn-group-sm bg-light p-1 rounded-2 border">
            <button
              className="btn btn-sm btn-light border-0 p-1 text-secondary hover-primary"
              onClick={() => onMoveNode(selectedNode.id, 'up')}
              title="Move Up"
            >
              <ArrowUp size={13} />
            </button>
            <button
              className="btn btn-sm btn-light border-0 p-1 text-secondary hover-primary"
              onClick={() => onMoveNode(selectedNode.id, 'down')}
              title="Move Down"
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="btn btn-sm btn-light border-0 p-1 text-secondary hover-primary"
              onClick={() => onDuplicateNode(selectedNode.id)}
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              className="btn btn-sm btn-light border-0 p-1 text-danger hover-danger"
              onClick={() => onDeleteNode(selectedNode.id)}
              title="Delete Component"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body p-3 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="text-uppercase fw-bold text-muted extra-small mb-2.5" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
          PROPERTIES & CONFIGURATION
        </div>

        {/* Dynamic Property Form Fields based on Props */}
        <div className="d-flex flex-column gap-2.5">
          {Object.entries(selectedNode.props).map(([propKey, propVal]) => {
            if (typeof propVal === 'boolean') {
              return (
                <div className="form-check form-switch bg-light p-2 rounded-2 border border-light" key={propKey}>
                  <input
                    className="form-check-input ms-0 me-2"
                    type="checkbox"
                    id={`prop_${propKey}`}
                    checked={Boolean(propVal)}
                    onChange={(e) => handlePropChange(propKey, e.target.checked)}
                  />
                  <label className="form-check-label fw-medium extra-small text-dark cursor-pointer" htmlFor={`prop_${propKey}`}>
                    {propKey}
                  </label>
                </div>
              );
            }

            if (typeof propVal === 'string' || typeof propVal === 'number') {
              const isLongText = String(propVal).length > 40 || propKey.toLowerCase().includes('content');
              return (
                <div key={propKey}>
                  <label className="form-label extra-small fw-semibold text-secondary mb-1">{propKey}</label>
                  {isLongText ? (
                    <textarea
                      className="form-control form-control-sm extra-small bg-light border-0 text-dark rounded-2"
                      rows={3}
                      value={propVal}
                      onChange={(e) => handlePropChange(propKey, e.target.value)}
                      style={{ fontSize: '0.78rem' }}
                    />
                  ) : (
                    <input
                      type={typeof propVal === 'number' ? 'number' : 'text'}
                      className="form-control form-control-sm extra-small bg-light border-0 text-dark rounded-2"
                      value={propVal}
                      onChange={(e) =>
                        handlePropChange(
                          propKey,
                          typeof propVal === 'number' ? Number(e.target.value) : e.target.value
                        )
                      }
                      style={{ fontSize: '0.78rem' }}
                    />
                  )}
                </div>
              );
            }

            if (Array.isArray(propVal) || typeof propVal === 'object') {
              return (
                <div key={propKey}>
                  <label className="form-label extra-small fw-semibold text-secondary mb-1">
                    {propKey} (JSON Structure)
                  </label>
                  <textarea
                    className="form-control form-control-sm extra-small font-monospace bg-light border-0 text-dark rounded-2"
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
                    style={{ fontSize: '0.72rem' }}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};

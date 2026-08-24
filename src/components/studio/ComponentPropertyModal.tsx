'use client';

import React, { useState } from 'react';
import { ComponentNode } from '@/types';
import { Sliders, Trash2, ArrowUp, ArrowDown, Copy, X, Check, Zap, Settings, Sparkles } from 'lucide-react';
import { ComponentDataSource, DataSourcePropertyEditor } from './DataSourcePropertyEditor';
import { StudioHtmlEditor } from './StudioHtmlEditor';
import { HtmlStudioShell } from '@/components/html-studio';
import type { HtmlStudioDocument } from '@/lib/html-studio';

interface ComponentPropertyModalProps {
  selectedNode: ComponentNode | null;
  onClose: () => void;
  onUpdateNodeProps: (nodeId: string, updatedProps: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
  onDuplicateNode: (nodeId: string) => void;
}

export const ComponentPropertyModal: React.FC<ComponentPropertyModalProps> = ({
  selectedNode,
  onClose,
  onUpdateNodeProps,
  onDeleteNode,
  onMoveNode,
  onDuplicateNode,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHtmlStudio, setShowHtmlStudio] = useState(false);

  if (!selectedNode) return null;

  if (showHtmlStudio && selectedNode.type === 'HtmlTemplateComponent' && selectedNode.props.document) return <HtmlStudioShell document={selectedNode.props.document as HtmlStudioDocument} onClose={() => setShowHtmlStudio(false)} onSave={(document) => { handlePropChange('document', document); setShowHtmlStudio(false); }} />;

  const handlePropChange = (key: string, value: any) => {
    onUpdateNodeProps(selectedNode.id, {
      ...selectedNode.props,
      [key]: value,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };
  const handleDataSourceChange = (dataSource: ComponentDataSource, data: unknown[], sampleKey: 'data' | 'items') => {
    onUpdateNodeProps(selectedNode.id, { ...selectedNode.props, dataSource, [sampleKey]: data });
    setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 1500);
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center z-3 select-none"
      style={{
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="card shadow-lg border-0 rounded-3 bg-white overflow-hidden w-100 animate-fadeIn"
        style={{ maxWidth: '560px', maxHeight: '85vh' }}
      >
        {/* Modal Header */}
        <div
          className="card-header border-bottom py-3 px-4 text-white d-flex align-items-center justify-content-between"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #31104b 50%, #4c1d95 100%)',
          }}
        >
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-2 bg-white bg-opacity-20 d-flex align-items-center justify-content-center text-white"
              style={{ width: '34px', height: '34px' }}
            >
              <Sliders size={18} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white bg-opacity-20 text-white extra-small">
                  Component Inspector
                </span>
                {saveSuccess && (
                  <span className="badge bg-success text-white extra-small d-flex align-items-center gap-1">
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
              <h6 className="fw-bold mb-0 text-white mt-0.5">{selectedNode.type}</h6>
              <div className="text-white-50 extra-small font-monospace" style={{ fontSize: '0.68rem' }}>
                ID: {selectedNode.id}
              </div>
            </div>
          </div>

          <button
            className="btn btn-sm btn-outline-light border-0 rounded-circle p-1.5"
            onClick={onClose}
            title="Close Property Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Quick Actions Bar & Tabs */}
        <div className="bg-light border-bottom px-4 py-2 d-flex align-items-center justify-content-between">
          <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
            <button
              className={`btn btn-sm py-1 px-3 extra-small fw-semibold ${
                activeTab === 'properties' ? 'bg-primary text-white shadow-sm' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('properties')}
            >
              Properties
            </button>
            <button
              className={`btn btn-sm py-1 px-3 extra-small fw-semibold ${
                activeTab === 'events' ? 'bg-warning text-dark shadow-sm' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('events')}
            >
              <Zap size={12} className="me-1" /> Events & Logic
            </button>
          </div>

          {/* Component Action Toolbar */}
          <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
            <button
              className="btn btn-sm btn-light p-1 px-2 border-0 text-secondary hover-primary"
              onClick={() => onMoveNode(selectedNode.id, 'up')}
              title="Move Component Up"
            >
              <ArrowUp size={13} />
            </button>
            <button
              className="btn btn-sm btn-light p-1 px-2 border-0 text-secondary hover-primary"
              onClick={() => onMoveNode(selectedNode.id, 'down')}
              title="Move Component Down"
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="btn btn-sm btn-light p-1 px-2 border-0 text-secondary hover-primary"
              onClick={() => onDuplicateNode(selectedNode.id)}
              title="Duplicate Component"
            >
              <Copy size={13} />
            </button>
            <button
              className="btn btn-sm btn-light p-1 px-2 border-0 text-danger hover-danger"
              onClick={() => onDeleteNode(selectedNode.id)}
              title="Delete Component"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="card-body p-4 overflow-auto" style={{ maxHeight: '55vh' }}>
          {activeTab === 'properties' ? (
            <div className="d-flex flex-column gap-3">
              {selectedNode.type === 'HtmlTemplateComponent' && <button type="button" className="btn btn-primary d-flex align-items-center justify-content-center gap-2" onClick={() => setShowHtmlStudio(true)}><Sparkles size={16}/> Open Advanced HTML Studio</button>}
              {Object.entries(selectedNode.props).map(([propKey, propVal]) => {
                if (selectedNode.type === 'HtmlTemplateComponent' && propKey === 'document') return null;
                if (propKey === 'dataSource') return null;
                if ((propKey === 'data' || propKey === 'items') && ['DataTableComponent', 'TableDataComponent', 'ListComponent', 'GalleryComponent'].includes(selectedNode.type)) return <DataSourcePropertyEditor key="data-source" dataSource={selectedNode.props.dataSource} sampleData={Array.isArray(propVal) ? propVal : []} onChange={(source, sample) => handleDataSourceChange(source, sample, propKey)} />;
                if (typeof propVal === 'boolean') {
                  return (
                    <div
                      className="d-flex align-items-center justify-content-between bg-light p-2.5 px-3 rounded-3 border border-light"
                      key={propKey}
                    >
                      <label className="form-check-label fw-semibold extra-small text-dark mb-0 cursor-pointer" htmlFor={`modal_prop_${propKey}`}>
                        {propKey}
                      </label>
                      <input
                        className="form-check-input ms-2 cursor-pointer"
                        type="checkbox"
                        id={`modal_prop_${propKey}`}
                        checked={Boolean(propVal)}
                        onChange={(e) => handlePropChange(propKey, e.target.checked)}
                      />
                    </div>
                  );
                }

                if (typeof propVal === 'string' || typeof propVal === 'number') {
                  if (propKey === 'content' && ['DynamicHtmlComponent', 'HtmlEditorComponent'].includes(selectedNode.type)) return <div key={propKey} className="bg-light p-2.5 rounded-3 border border-light"><label className="form-label extra-small fw-bold text-secondary mb-1.5 d-block">content (HTML)</label><StudioHtmlEditor value={String(propVal)} onChange={(html) => handlePropChange(propKey, html)} /></div>;
                  const isLongText = String(propVal).length > 40 || propKey.toLowerCase().includes('content');
                  return (
                    <div key={propKey} className="bg-light p-2.5 rounded-3 border border-light">
                      <label className="form-label extra-small fw-bold text-secondary mb-1.5 d-block">{propKey}</label>
                      {isLongText ? (
                        <textarea
                          className="form-control form-control-sm bg-white text-dark border rounded-2"
                          rows={3}
                          value={propVal}
                          onChange={(e) => handlePropChange(propKey, e.target.value)}
                          style={{ fontSize: '0.78rem' }}
                        />
                      ) : (
                        <input
                          type={typeof propVal === 'number' ? 'number' : 'text'}
                          className="form-control form-control-sm bg-white text-dark border rounded-2"
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
                    <div key={propKey} className="bg-light p-2.5 rounded-3 border border-light">
                      <label className="form-label extra-small fw-bold text-secondary mb-1.5 d-block">
                        {propKey} (JSON Structure)
                      </label>
                      <textarea
                        className="form-control form-control-sm extra-small font-monospace bg-white text-dark border rounded-2"
                        rows={5}
                        value={JSON.stringify(propVal, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            handlePropChange(propKey, parsed);
                          } catch (err) {
                            // ignore syntax error while typing
                          }
                        }}
                        style={{ fontSize: '0.74rem' }}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          ) : (
            /* Events & Logic Tab */
            <div className="d-flex flex-column gap-3 extra-small">
              <div className="bg-light p-3 rounded-3 border">
                <label className="fw-bold text-dark d-block mb-1.5">onClick Event Handler</label>
                <select className="form-select form-select-sm extra-small bg-white">
                  <option>(None)</option>
                  <option>Trigger Flow: SubmitForm</option>
                  <option>Navigate Route: /services</option>
                </select>
              </div>
              <div className="bg-light p-3 rounded-3 border">
                <label className="fw-bold text-dark d-block mb-1.5">onSubmit Action Handler</label>
                <select className="form-select form-select-sm extra-small bg-white">
                  <option>Save To Tenant DB ({selectedNode.id})</option>
                  <option>Send Webhook Notification</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="card-footer bg-light border-top p-3 px-4 d-flex justify-content-between align-items-center">
          <small className="text-muted extra-small">
            Changes apply instantly to live canvas.
          </small>
          <button className="btn btn-primary btn-sm px-4 fw-semibold shadow-sm" onClick={onClose}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

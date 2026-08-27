'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import type { AppRouteTargetType } from '@/types';

export interface SiteMapTargetOption { id: string; label: string; type: AppRouteTargetType; suggestedPath?: string }
interface Props {
  isOpen: boolean; containers: string[]; initialContainerName: string; targets: SiteMapTargetOption[]; onClose: () => void;
  onCreate: (input: { containerName: string; nodeType: AppRouteTargetType; targetId: string; label: string; path: string; isStartPoint: boolean }) => Promise<void>;
}
const TYPES: Array<{ value: AppRouteTargetType; label: string }> = [
  { value: 'page', label: 'Page' }, { value: 'form', label: 'Form' }, { value: 'collection', label: 'Collection' },
  { value: 'component', label: 'App Component' }, { value: 'service', label: 'Service' }, { value: 'api', label: 'API' },
];

export const SiteMapNodeManagerModal: React.FC<Props> = ({ isOpen, containers, initialContainerName, targets, onClose, onCreate }) => {
  const [containerName, setContainerName] = useState(initialContainerName);
  const [nodeType, setNodeType] = useState<AppRouteTargetType>('page');
  const [targetId, setTargetId] = useState('');
  const [isStartPoint, setIsStartPoint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (isOpen) { setContainerName(initialContainerName); setTargetId(''); setError(null); } }, [initialContainerName, isOpen]);
  const options = useMemo(() => targets.filter((target) => target.type === nodeType), [nodeType, targets]);
  const selected = options.find((option) => option.id === targetId);
  if (!isOpen) return null;

  const create = async () => {
    if (!targetId || !selected) return setError('Please select an existing Project Resource');
    setBusy(true); setError(null);
    try {
      await onCreate({ containerName, nodeType, targetId, label: selected.label, path: selected.suggestedPath || `/${targetId.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`, isStartPoint });
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to add Site Map node'); }
    finally { setBusy(false); }
  };

  return <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2100, background: 'rgba(15,23,42,.55)' }}>
    <div className="card border-0 shadow-lg w-100" style={{ maxWidth: 900 }}>
      <div className="card-header text-white p-3 d-flex justify-content-between" style={{ background: 'linear-gradient(135deg, #0C58A9 0%, #083A6E 60%, #0B1F3A 100%)' }}>
        <div className="d-flex gap-2 align-items-center"><MapPin size={20}/><div><h5 className="mb-0">Add Site Map Node</h5><small className="text-white-50">Bind an existing Project Resource to the selected container</small></div></div>
        <button className="btn btn-sm btn-outline-light border-0" onClick={onClose} disabled={busy}><X size={17}/></button>
      </div>
      <div className="card-body p-4"><div className="p-3 border rounded-3 bg-light"><div className="row g-2 align-items-end">
        <div className="col-md-3"><label className="form-label small mb-1">Target Container</label><select className="form-select form-select-sm" value={containerName} onChange={(e) => setContainerName(e.target.value)}>{containers.map((name) => <option key={name}>{name}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label small mb-1">Node Type</label><select className="form-select form-select-sm" value={nodeType} onChange={(e) => { setNodeType(e.target.value as AppRouteTargetType); setTargetId(''); }}>{TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label small mb-1">Existing {TYPES.find((type) => type.value === nodeType)?.label}</label><select className="form-select form-select-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">{options.length ? 'Select...' : 'No resources available'}</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label small mb-1 d-block">Entry</label><label className="form-check form-switch mb-1"><input className="form-check-input" type="checkbox" checked={isStartPoint} onChange={(e) => setIsStartPoint(e.target.checked)}/><span className="form-check-label small">Start Point</span></label></div>
        <div className="col-md-1"><button className="btn btn-primary btn-sm w-100" title="Add Node" onClick={() => void create()} disabled={busy || !targetId || !containerName}><Plus size={13}/></button></div>
      </div>{isStartPoint && <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">This node becomes the Start Point for the container and replaces its previous Start Point.</div>}{error && <div className="text-danger small mt-2">{error}</div>}</div></div>
    </div>
  </div>;
};

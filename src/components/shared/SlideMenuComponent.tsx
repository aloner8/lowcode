'use client';

import React, { useState } from 'react';
import { Menu, X, ChevronRight, ChevronDown } from 'lucide-react';

export interface SlideMenuItem {
  id: string;
  label: string;
  type?: 'section' | 'item';
  iconName?: string;
  href?: string;
  badge?: string;
  active?: boolean;
  permission?: string;
  resource?: {
    kind: 'form' | 'datatable' | 'collection' | 'dashboard';
    table?: string; route?: string;
    componentType?: 'DataTableComponent' | 'FormComponent' | 'ListComponent' | 'GalleryComponent';
    collectionId?: string; componentId?: string; formId?: string;
    params?: Record<string, unknown>;
  };
  children?: SlideMenuItem[];
}

export interface SlideMenuProps {
  title?: string;
  dataSourceMode?: 'fixed-json' | 'collection';
  items?: SlideMenuItem[];
  collectionId?: string;
  collectionData?: Array<Record<string, unknown>>;
  collectionItems?: Array<Record<string, unknown>>;
  collectionMapping?: {
    idField?: string; labelField?: string; hrefField?: string; parentIdField?: string;
    typeField?: string; badgeField?: string; permissionField?: string;
  };
  onSelect?: (item: SlideMenuItem) => void;
  className?: string;
}

export const SlideMenuComponent: React.FC<SlideMenuProps> = ({
  title = 'Application Menu',
  dataSourceMode = 'fixed-json',
  items = [
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'users', label: 'User Management', badge: '12' },
    { id: 'settings', label: 'System Settings' },
    { id: 'logs', label: 'Audit Logs' },
  ],
  collectionData,
  collectionItems = [],
  collectionMapping = {},
  onSelect,
  className = '',
}) => {
  const menuItems = React.useMemo<SlideMenuItem[]>(() => {
    if (dataSourceMode !== 'collection') return items;
    const records = collectionData || collectionItems;
    const field = { id: collectionMapping.idField || 'id', label: collectionMapping.labelField || 'name', href: collectionMapping.hrefField || 'link', parent: collectionMapping.parentIdField || 'parent_id', type: collectionMapping.typeField || 'type', badge: collectionMapping.badgeField || 'badge', permission: collectionMapping.permissionField || 'permission' };
    const mapped = records.map((record, index) => ({
      id: String(record[field.id] ?? `menu-${index + 1}`), label: String(record[field.label] ?? record.title ?? `Menu ${index + 1}`),
      href: record[field.href] == null ? undefined : String(record[field.href]), type: record[field.type] === 'section' ? 'section' as const : 'item' as const,
      badge: record[field.badge] == null ? undefined : String(record[field.badge]), permission: record[field.permission] == null ? undefined : String(record[field.permission]),
      parentId: record[field.parent] == null ? null : String(record[field.parent]),
    }));
    const byId = new Map(mapped.map((item) => [item.id, { ...item, children: [] as SlideMenuItem[] }]));
    const roots: SlideMenuItem[] = [];
    byId.forEach((item) => { const parent = item.parentId ? byId.get(item.parentId) : undefined; const clean: SlideMenuItem = { id: item.id, label: item.label, href: item.href, type: item.type, badge: item.badge, permission: item.permission, children: item.children }; if (parent) parent.children.push(clean); else roots.push(clean); });
    return roots;
  }, [collectionData, collectionItems, collectionMapping, dataSourceMode, items]);
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(menuItems.filter((item) => item.children?.length).map((item) => [item.id, Boolean(item.active)])));

  return (
    <div className={`slide-menu-wrapper ${className}`}>
      {/* Toggle Button for Collapsed View */}
      {!isOpen && (
        <button className="btn btn-primary shadow-sm mb-3" onClick={() => setIsOpen(true)}>
          <Menu size={18} className="me-2" /> Show Menu
        </button>
      )}

      {/* Sidebar Panel */}
      {isOpen && (
        <div className="card shadow-sm border-0 bg-white p-3" style={{ maxWidth: '280px' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <h6 className="fw-bold mb-0 text-primary">{title}</h6>
            <button className="btn btn-sm btn-light rounded-circle" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="list-group list-group-flush">
            {menuItems.map((item) => item.type === 'section' ? (
              <div key={item.id} className="px-2 pt-3 pb-1 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: '.08em' }}>{item.label}</div>
            ) : (
              <React.Fragment key={item.id}>
              <button
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3 rounded-2 mb-1 border-0 ${
                  item.active ? 'bg-primary text-white fw-medium' : 'text-dark hover-bg-light'
                }`}
                onClick={() => item.children?.length ? setExpanded((value) => ({ ...value, [item.id]: !value[item.id] })) : onSelect?.(item)}
                title={item.permission ? `RBAC: ${item.permission}` : undefined}
              >
                <div className="d-flex align-items-center gap-2">
                  {item.children?.length ? (expanded[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <ChevronRight size={14} className={item.active ? 'text-white' : 'text-muted'} />}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`badge rounded-pill ${
                      item.active ? 'bg-white text-primary' : 'bg-primary text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
              {item.children?.length && expanded[item.id] && <div className="ms-3 ps-2 border-start mb-1">{item.children.map((child) => <button key={child.id} className={`list-group-item list-group-item-action border-0 rounded-2 py-1.5 px-2 mb-1 text-start ${child.active ? 'bg-primary bg-opacity-10 text-primary fw-semibold' : 'text-secondary'}`} style={{ fontSize: 12 }} onClick={() => onSelect?.(child)} title={child.resource?.table ? `Table: ${child.resource.table}` : child.href}><span className="me-2 text-muted">•</span>{child.label}</button>)}</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

'use client';
import React from 'react';

export interface ListComponentProps { title?: string; items?: Array<Record<string, unknown>>; primaryField?: string; secondaryField?: string; className?: string; }
export const ListComponent: React.FC<ListComponentProps> = ({ title, items = [], primaryField = 'name', secondaryField = 'description', className = '' }) => <div className={`card border-0 shadow-sm p-3 ${className}`}>
  {title && <h5 className="fw-bold mb-3">{title}</h5>}
  <div className="list-group list-group-flush">{items.length ? items.map((item, index) => <div className="list-group-item px-0" key={String(item.id ?? index)}><div className="fw-semibold">{String(item[primaryField] ?? '')}</div>{item[secondaryField] != null && <div className="small text-muted">{String(item[secondaryField])}</div>}</div>) : <div className="text-center text-muted py-4">No items to display</div>}</div>
</div>;

'use client';

import React from 'react';
import {
  FileText, MessageSquareWarning, Download, ClipboardList, Search, Users,
  Building2, Phone, Landmark, ScrollText, HandCoins, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/** Named rather than free-form so a page cannot ask for an icon that is absent. */
const ICONS: Record<string, LucideIcon> = {
  form: FileText,
  complaint: MessageSquareWarning,
  download: Download,
  procurement: ClipboardList,
  search: Search,
  people: Users,
  office: Building2,
  contact: Phone,
  law: ScrollText,
  budget: HandCoins,
  integrity: ShieldCheck,
  agency: Landmark,
};

export interface ServiceLink {
  label: string;
  href?: string;
  description?: string;
  icon?: keyof typeof ICONS;
  external?: boolean;
}

export interface ServiceLinksComponentProps {
  title?: string;
  subtitle?: string;
  items?: ServiceLink[];
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}

/**
 * The shortcut grid a visitor uses to reach a service directly — complaints,
 * forms, procurement notices — instead of hunting through the menu.
 */
export const ServiceLinksComponent: React.FC<ServiceLinksComponentProps> = ({
  title,
  subtitle,
  items = [],
  columns = 4,
  className = '',
}) => {
  const colClass = {
    2: 'col-6',
    3: 'col-6 col-md-4',
    4: 'col-6 col-md-3',
    6: 'col-4 col-md-2',
  }[columns];

  return (
    <section className={`gov-services ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <h2 className="gov-section-title h4 fw-bold mb-1">{title}</h2>}
          {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted small mb-0">ยังไม่ได้กำหนดรายการบริการ</p>
      ) : (
        <div className="row g-3">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon ?? 'form'] ?? FileText;
            return (
              <div className={colClass} key={`${item.label}-${index}`}>
                <a
                  href={item.href ?? '#'}
                  className="gov-service-tile"
                  {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  <span className="gov-service-icon" aria-hidden="true"><Icon size={24} /></span>
                  <span className="gov-service-label">{item.label}</span>
                  {item.description && <span className="gov-service-note">{item.description}</span>}
                  {item.external && <span className="visually-hidden">(เปิดในแท็บใหม่)</span>}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

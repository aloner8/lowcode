'use client';

import React from 'react';
import { MapPin, Phone, Mail, Clock, Printer } from 'lucide-react';

export interface FooterLinkGroup {
  title: string;
  links: Array<{ label: string; href?: string; external?: boolean }>;
}

export interface SiteFooterComponentProps {
  agencyName?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  officeHours?: string;
  /** Google Maps embed URL. Rendered in an iframe, so only https is accepted. */
  mapEmbedUrl?: string | null;
  groups?: FooterLinkGroup[];
  copyright?: string;
  className?: string;
}

/**
 * Footer for an agency site.
 *
 * The map is an `<iframe>`, so its URL is checked to be https before it is
 * rendered: an author-supplied `javascript:` or `data:` source would otherwise
 * run in the page.
 */
export const SiteFooterComponent: React.FC<SiteFooterComponentProps> = ({
  agencyName = 'ชื่อหน่วยงาน',
  address,
  phone,
  fax,
  email,
  officeHours,
  mapEmbedUrl = null,
  groups = [],
  copyright,
  className = '',
}) => {
  const safeMap = mapEmbedUrl && /^https:\/\//i.test(mapEmbedUrl) ? mapEmbedUrl : null;
  const year = new Date().getFullYear() + 543;

  return (
    <footer className={`gov-footer ${className}`}>
      <div className="gov-footer-main">
        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <p className="gov-footer-heading">{agencyName}</p>
            <ul className="gov-footer-contact">
              {address && (
                <li><MapPin size={15} aria-hidden="true" /> <span>{address}</span></li>
              )}
              {phone && (
                <li>
                  <Phone size={15} aria-hidden="true" />
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
                </li>
              )}
              {fax && (
                <li><Printer size={15} aria-hidden="true" /> <span>โทรสาร {fax}</span></li>
              )}
              {email && (
                <li>
                  <Mail size={15} aria-hidden="true" />
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )}
              {officeHours && (
                <li><Clock size={15} aria-hidden="true" /> <span>{officeHours}</span></li>
              )}
            </ul>
          </div>

          {groups.map((group) => (
            <div className="col-6 col-lg-2" key={group.title}>
              <p className="gov-footer-heading">{group.title}</p>
              <ul className="gov-footer-links">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href ?? '#'}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {link.label}
                      {link.external && <span className="visually-hidden">(เปิดในแท็บใหม่)</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {safeMap && (
            <div className="col-12 col-lg-4">
              <p className="gov-footer-heading">แผนที่</p>
              <div className="gov-footer-map">
                <iframe
                  src={safeMap}
                  title={`แผนที่${agencyName}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="gov-footer-bar">
        {copyright ?? `สงวนลิขสิทธิ์ © ${year} ${agencyName}`}
      </div>
    </footer>
  );
};

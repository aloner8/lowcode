'use client';

import React from 'react';
import {
  Lightbulb, Siren, Trash2, GraduationCap, ShieldAlert, MessageSquare,
  ArrowRight, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  light: Lightbulb,
  emergency: Siren,
  waste: Trash2,
  education: GraduationCap,
  corruption: ShieldAlert,
  general: MessageSquare,
};

export interface AlertChannel {
  label: string;
  description?: string;
  href?: string;
  icon?: keyof typeof ICONS;
}

export interface AlertChannelsComponentProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  channels?: AlertChannel[];
  className?: string;
}

/**
 * Where to report a problem in the area.
 *
 * A single "report a problem" button makes a resident work out which kind of
 * problem theirs is before they can start; naming the kinds up front is the
 * point of the section. Emergency is first and marked, because someone in one
 * should not be reading a grid.
 */
export const AlertChannelsComponent: React.FC<AlertChannelsComponentProps> = ({
  title = 'ระบบแจ้งเหตุอัจฉริยะ',
  subtitle,
  ctaLabel = 'เข้าสู่ระบบแจ้งเหตุออนไลน์',
  ctaHref,
  channels = [],
  className = '',
}) => (
  <section className={`gov-alert ${className}`}>
    <div className="gov-alert-head">
      <div>
        <h2 className="gov-alert-title">{title}</h2>
        {subtitle && <p className="gov-alert-sub">{subtitle}</p>}
      </div>
      {ctaHref && (
        <a className="gov-alert-cta" href={ctaHref}>
          {ctaLabel} <ArrowRight size={16} aria-hidden="true" />
        </a>
      )}
    </div>

    {channels.length > 0 && (
      <ul className="gov-alert-grid">
        {channels.map((channel, index) => {
          const Icon = ICONS[channel.icon ?? 'general'] ?? MessageSquare;
          const urgent = channel.icon === 'emergency';
          return (
            <li key={`${channel.label}-${index}`}>
              <a href={channel.href ?? ctaHref ?? '#'} className={`gov-alert-card ${urgent ? 'is-urgent' : ''}`}>
                <span className="gov-alert-icon" aria-hidden="true"><Icon size={22} /></span>
                <span className="gov-alert-label">{channel.label}</span>
                {channel.description && <span className="gov-alert-note">{channel.description}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

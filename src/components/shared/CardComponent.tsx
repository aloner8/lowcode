'use client';

import React from 'react';
import { Box, ArrowUpRight, TrendingUp, Sparkles } from 'lucide-react';

export interface CardComponentProps {
  title?: string;
  subtitle?: string;
  value?: string | number;
  badge?: string;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'dark';
  footerText?: string;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  title = 'Metric Overview',
  subtitle = 'System Active Stat',
  value = '1,248',
  badge = '+12.5%',
  variant = 'primary',
  footerText = 'Updated 5m ago',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: 'bg-success bg-opacity-10', border: 'border-success border-opacity-25', text: 'text-success', badgeBg: 'bg-success text-white' };
      case 'warning':
        return { bg: 'bg-warning bg-opacity-10', border: 'border-warning border-opacity-25', text: 'text-warning', badgeBg: 'bg-warning text-dark' };
      case 'info':
        return { bg: 'bg-info bg-opacity-10', border: 'border-info border-opacity-25', text: 'text-info', badgeBg: 'bg-info text-white' };
      case 'dark':
        return { bg: 'bg-dark bg-opacity-10', border: 'border-dark border-opacity-25', text: 'text-dark', badgeBg: 'bg-dark text-white' };
      default:
        return { bg: 'bg-primary bg-opacity-10', border: 'border-primary border-opacity-25', text: 'text-primary', badgeBg: 'bg-primary text-white' };
    }
  };

  const style = getVariantStyles();

  return (
    <div className={`card border rounded-3 p-3 shadow-sm ${style.bg} ${style.border}`}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="text-secondary extra-small fw-semibold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
          {title}
        </span>
        {badge && (
          <span className={`badge extra-small ${style.badgeBg}`} style={{ fontSize: '0.65rem' }}>
            <TrendingUp size={11} className="me-1" />
            {badge}
          </span>
        )}
      </div>

      <div className="d-flex align-items-baseline justify-content-between">
        <h3 className={`fw-bold mb-0 ${style.text}`}>{value}</h3>
        <ArrowUpRight size={18} className="text-muted opacity-50" />
      </div>

      <div className="d-flex align-items-center justify-content-between border-top border-secondary border-opacity-15 pt-2 mt-2 extra-small text-muted" style={{ fontSize: '0.72rem' }}>
        <span>{subtitle}</span>
        <span>{footerText}</span>
      </div>
    </div>
  );
};

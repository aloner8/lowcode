import React from 'react';

interface StatWidgetCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'purple';
}

export default function StatWidgetCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
}: StatWidgetCardProps) {
  const colorGradients = {
    primary: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    success: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    info: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
    danger: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    purple: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
  };

  return (
    <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
      <div className="card-body p-3.5 d-flex align-items-center justify-content-between">
        <div>
          <div className="text-secondary small fw-medium mb-1">{title}</div>
          <div className="fs-3 fw-bold text-dark lh-1 mb-1">{value}</div>
          {subtitle && <div className="text-muted extra-small" style={{ fontSize: '0.75rem' }}>{subtitle}</div>}
        </div>
        <div
          className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
          style={{
            width: '48px',
            height: '48px',
            background: colorGradients[color],
          }}
        >
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

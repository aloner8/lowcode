'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

export interface ChartComponentProps {
  title?: string;
  chartType?: 'bar' | 'line' | 'pie';
  dataPoints?: number[];
  categories?: string[];
  colorPreset?: 'indigo' | 'emerald' | 'sunset';
}

export const ChartComponent: React.FC<ChartComponentProps> = ({
  title = 'Monthly Activity Performance',
  chartType = 'bar',
  dataPoints = [35, 60, 45, 80, 65, 90, 75],
  categories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  colorPreset = 'indigo',
}) => {
  const maxVal = Math.max(...dataPoints, 100);

  const getBarColor = (index: number) => {
    if (colorPreset === 'emerald') return index % 2 === 0 ? '#10b981' : '#34d399';
    if (colorPreset === 'sunset') return index % 2 === 0 ? '#f59e0b' : '#fbbf24';
    return index % 2 === 0 ? '#4f46e5' : '#6366f1';
  };

  return (
    <div className="card shadow-sm border-0 rounded-3 p-3 bg-white">
      <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
        <div className="d-flex align-items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h6 className="fw-bold mb-0 text-dark small">{title}</h6>
        </div>
        <span className="badge bg-primary bg-opacity-10 text-primary extra-small">
          Live Chart Preview ({chartType.toUpperCase()})
        </span>
      </div>

      {/* Visual Bar Chart Generator */}
      <div className="d-flex align-items-end justify-content-between gap-2 pt-3 pb-1" style={{ height: '140px' }}>
        {dataPoints.map((val, idx) => {
          const heightPct = Math.round((val / maxVal) * 100);
          return (
            <div key={idx} className="d-flex flex-column align-items-center flex-grow-1 h-100 justify-content-end">
              <span className="extra-small text-muted mb-1 font-monospace" style={{ fontSize: '0.65rem' }}>
                {val}
              </span>
              <div
                className="w-100 rounded-top transition-all"
                style={{
                  height: `${heightPct}%`,
                  background: getBarColor(idx),
                  minHeight: '8px',
                  transition: 'height 0.3s ease',
                }}
              />
              <span className="extra-small text-secondary mt-1 font-semibold" style={{ fontSize: '0.68rem' }}>
                {categories[idx] || `Item ${idx + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

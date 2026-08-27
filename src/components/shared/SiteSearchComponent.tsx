'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';

export interface SiteSearchComponentProps {
  placeholder?: string;
  /** Page that shows results. Kept a GET form so a result URL can be shared. */
  action?: string;
  buttonLabel?: string;
  className?: string;
}

/** Site-wide search, sitting across the foot of the banner. */
export const SiteSearchComponent: React.FC<SiteSearchComponentProps> = ({
  placeholder = 'พิมพ์คำค้นหา เช่น ข้อบัญญัติ, ข่าวประชาสัมพันธ์, ประกาศ…',
  action = '/search',
  buttonLabel = 'ค้นหา',
  className = '',
}) => {
  const [term, setTerm] = useState('');

  return (
    <form className={`gov-search ${className}`} action={action} method="get" role="search">
      <label htmlFor="gov-search-input" className="visually-hidden">ค้นหาในเว็บไซต์</label>
      <Search size={18} className="gov-search-icon" aria-hidden="true" />
      <input
        id="gov-search-input"
        name="q"
        type="search"
        className="gov-search-input"
        placeholder={placeholder}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      <button type="submit" className="gov-search-btn">{buttonLabel}</button>
    </form>
  );
};

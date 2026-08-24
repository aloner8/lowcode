'use client';

import React from 'react';

export interface NavMenuItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface NavMenuProps {
  brandName?: string;
  brandLogo?: string;
  items?: NavMenuItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const NavMenuComponent: React.FC<NavMenuProps> = ({
  brandName = 'App Studio',
  brandLogo,
  items = [
    { label: 'Home', href: '#', active: true },
    { label: 'Services', href: '#' },
    { label: 'About', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  actions,
  className = '',
}) => {
  return (
    <nav className={`navbar navbar-expand-lg navbar-dark bg-primary shadow-sm rounded-3 mb-4 px-3 ${className}`}>
      <div className="container-fluid">
        <a className="navbar-brand fw-bold d-flex align-items-center gap-2" href="#">
          {brandLogo && <img src={brandLogo} alt="Logo" width="30" height="30" />}
          {brandName}
        </a>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMenuContent"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navMenuContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {items.map((item, idx) => (
              <li className="nav-item" key={idx}>
                <a className={`nav-link ${item.active ? 'active fw-semibold' : ''}`} href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
        </div>
      </div>
    </nav>
  );
};

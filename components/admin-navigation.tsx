"use client";

import { getAdminNavigation, type AdminRole } from "../lib/admin-navigation";

type AdminNavigationProps = {
  role: AdminRole;
  activeId: string;
  open: boolean;
  openTickets: number;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function AdminNavigation({ role, activeId, open, openTickets, onSelect, onClose }: AdminNavigationProps) {
  const sections = getAdminNavigation(role, openTickets);

  return (
    <nav id="admin-navigation" className={open ? "admin-tabs admin-navigation open" : "admin-tabs admin-navigation"} aria-label="منوی مدیریت" onClick={onClose}>
      {sections.map((section) => (
        <div className="admin-nav-section" key={section.label}>
          <h2>{section.label}</h2>
          <div className="admin-nav-items">
            {section.items.map((item) => item.href ? (
              <a className="admin-nav-link" href={item.href} key={item.id} onClick={onClose}>
                <span>{item.label}</span>
                {item.badge && <b className="admin-nav-badge">{item.badge}</b>}
              </a>
            ) : (
              <button type="button" className={activeId === item.id ? "selected" : ""} aria-current={activeId === item.id ? "page" : undefined} onClick={() => onSelect(item.id)} key={item.id}>
                <span>{item.label}</span>
                {item.badge && <b className="admin-nav-badge">{item.badge}</b>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

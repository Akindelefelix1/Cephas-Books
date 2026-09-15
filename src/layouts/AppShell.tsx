import { useState, type PropsWithChildren } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Command,
  Menu,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { allNavigation, primaryNavigation, secondaryNavigation } from '@/data/navigation';

interface AppShellProps extends PropsWithChildren {
  active: string;
  onNavigate: (id: string) => void;
  onQuickCreate: () => void;
  identity: {
    firstName: string;
    lastName: string;
    companyName: string;
    role: string;
    baseCurrency: string;
    countryCode: string;
  };
}

export function AppShell({ active, onNavigate, onQuickCreate, identity, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const companyName = identity.companyName || 'Your company';
  const companyInitials = getInitials(companyName);
  const userName = [identity.firstName, identity.lastName].filter(Boolean).join(' ');
  const navigate = (id: string) => {
    const parent = allNavigation.find((item) => item.children?.some((child) => child.id === id));
    if (parent) {
      setExpanded((value) => (value.includes(parent.id) ? value : [...value, parent.id]));
    }
    onNavigate(id);
    setMobileOpen(false);
  };
  const navGroup = (items: typeof allNavigation) =>
    items.map((item) => {
      const isParentActive =
        item.id === active || item.children?.some((child) => child.id === active);
      return (
        <div className="nav-entry" key={item.id}>
          <button
            className={`nav-item ${isParentActive ? 'active' : ''}`}
            aria-expanded={item.children ? expanded.includes(item.id) : undefined}
            onClick={() =>
              item.children
                ? setExpanded((value) =>
                    value.includes(item.id)
                      ? value.filter((id) => id !== item.id)
                      : [...value, item.id],
                  )
                : navigate(item.id)
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.children &&
              (expanded.includes(item.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
          </button>
          {item.children && expanded.includes(item.id) && (
            <div className="subnav">
              {item.children.map((child) => (
                <button
                  className={child.id === active ? 'active' : ''}
                  onClick={() => navigate(child.id)}
                  key={child.id}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar__brand">
          <Logo />
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <button className="create-button" onClick={onQuickCreate}>
          <Plus size={18} />
          Quick create<kbd>C</kbd>
        </button>
        <nav className="app-nav">
          <p className="nav-label">Workspace</p>
          {navGroup(primaryNavigation)}
          <p className="nav-label">Manage</p>
          {navGroup(secondaryNavigation)}
        </nav>
        <div className="sidebar__plan">
          <span>
            <Sparkles size={15} /> Business plan
          </span>
          <div>
            <i className="plan-usage" />
          </div>
          <small>7 of 10 seats used</small>
        </div>
        <button className="organisation" onClick={() => navigate('settings')}>
          <span className="avatar avatar--square">{companyInitials}</span>
          <span>
            <strong>{companyName}</strong>
            <small>
              {identity.countryCode} · {identity.baseCurrency}
            </small>
          </span>
          <ChevronDown size={16} />
        </button>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>
          <button className="global-search" onClick={() => setSearchOpen(true)}>
            <Search size={18} />
            <span>Search invoices, customers, transactions…</span>
            <kbd>
              <Command size={12} /> K
            </kbd>
          </button>
          <div className="topbar__right">
            <button
              className="icon-button notification-button"
              onClick={() => navigate('notifications')}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="profile"
              onClick={() => navigate('profile')}
              aria-label="Open profile"
            >
              <span className="avatar">{companyInitials}</span>
              <span>
                <strong>{companyName}</strong>
                <small>{userName || formatRole(identity.role)}</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <div className="page-content" id="main-content" role="main" tabIndex={-1}>
          {children}
        </div>
      </section>
      {searchOpen && (
        <div className="command-backdrop" onMouseDown={() => setSearchOpen(false)}>
          <section className="command-palette" onMouseDown={(e) => e.stopPropagation()}>
            <div className="command-input">
              <Search size={20} />
              <input autoFocus placeholder={`Search anything in ${companyName}…`} />
              <kbd>ESC</kbd>
            </div>
            <p className="command-label">Recent results</p>
            {[
              {
                type: 'Invoice',
                title: 'INV-00245',
                meta: 'Apex Retail Limited · ₦2,500,000',
                id: 'invoices',
              },
              {
                type: 'Customer',
                title: 'Northstar Schools',
                meta: '₦1,280,000 outstanding',
                id: 'customers',
              },
              {
                type: 'Account',
                title: '1020 · GTBank Current',
                meta: '₦18,450,200 balance',
                id: 'chart-of-accounts',
              },
            ].map((x) => (
              <button
                className="search-result"
                key={x.title}
                onClick={() => {
                  setSearchOpen(false);
                  navigate(x.id);
                }}
              >
                <span>{x.type.slice(0, 2)}</span>
                <div>
                  <strong>{x.title}</strong>
                  <small>{x.meta}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
            <div className="command-footer">
              <span>
                <kbd>↑↓</kbd> Navigate
              </span>
              <span>
                <kbd>↵</kbd> Open
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatRole(role: string): string {
  if (!role) return 'Account owner';
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

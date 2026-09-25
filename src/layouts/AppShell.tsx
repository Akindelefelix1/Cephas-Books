import { useState, type PropsWithChildren } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Command,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
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
  const [sidebarTheme, setSidebarTheme] = useState<SidebarTheme>(() => {
    const savedTheme = localStorage.getItem('cephas:sidebar-theme');
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';
  });
  const activeParent = allNavigation.find((item) =>
    item.children?.some((child) => child.id === active),
  )?.id;
  const [expanded, setExpanded] = useState<string | null>(activeParent ?? null);
  const [searchOpen, setSearchOpen] = useState(false);
  const companyName = identity.companyName || 'Your company';
  const companyInitials = getInitials(companyName);
  const userName = [identity.firstName, identity.lastName].filter(Boolean).join(' ');
  const updateSidebarTheme = (theme: SidebarTheme) => {
    setSidebarTheme(theme);
    localStorage.setItem('cephas:sidebar-theme', theme);
  };
  const navigate = (id: string) => {
    const parent = allNavigation.find((item) => item.children?.some((child) => child.id === id));
    if (parent) setExpanded(parent.id);
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
            aria-expanded={item.children ? expanded === item.id : undefined}
            onClick={() =>
              item.children
                ? setExpanded((value) => (value === item.id ? null : item.id))
                : navigate(item.id)
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.children &&
              (expanded === item.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
          </button>
          {item.children && expanded === item.id && (
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
      <aside className={`sidebar sidebar--${sidebarTheme} ${mobileOpen ? 'is-open' : ''}`}>
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
        <div className="sidebar-theme-toggle">
          <span>
            {sidebarTheme === 'light' ? <Sun size={17} /> : <Moon size={17} />}
            <span>
              <strong>Appearance</strong>
              <small>{sidebarTheme === 'light' ? 'Light theme' : 'Dark theme'}</small>
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sidebarTheme === 'dark'}
            aria-label={`Switch to ${sidebarTheme === 'light' ? 'dark' : 'light'} theme`}
            onClick={() => updateSidebarTheme(sidebarTheme === 'light' ? 'dark' : 'light')}
          >
            <i />
          </button>
        </div>
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
            {MOCK_SEARCH_RESULTS.map((x) => (
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

type SidebarTheme = 'light' | 'dark';

const MOCK_SEARCH_RESULTS = [
  { type: 'Invoice', title: 'INV-00245', meta: 'Apex Retail Limited · ₦2,500,000', id: 'invoices' },
  { type: 'Customer', title: 'Northstar Schools', meta: '₦1,280,000 outstanding', id: 'customers' },
  {
    type: 'Account',
    title: '1020 · GTBank Current',
    meta: '₦18,450,200 balance',
    id: 'chart-of-accounts',
  },
];

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

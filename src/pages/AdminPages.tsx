import { useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  Coins,
  CreditCard,
  Database,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';

export function UsersPage() {
  const [modal, setModal] = useState(false);
  const rows = [
    ['Tobi Adeyemi', 'tobi@acme.ng', 'Finance Manager', 'Lagos HQ', 'Active'],
    ['Ada Okafor', 'ada@acme.ng', 'Accountant', 'All branches', 'Active'],
    ['Emeka Okoro', 'emeka@acme.ng', 'Procurement', 'Lagos HQ', 'Active'],
    ['Aisha Bello', 'aisha@acme.ng', 'Sales', 'Abuja', 'Pending invite'],
    ['John Mensah', 'john@acme.ng', 'Auditor', 'Read-only', 'Active'],
  ];
  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Control access with granular view, create, edit, delete, approve, and export permissions."
        action="Invite user"
        onAction={() => setModal(true)}
      />
      <StatsGrid
        stats={[
          { label: 'Active users', value: '36', change: 'of 50 seats' },
          { label: 'Pending invites', value: '4', change: 'Expires in 5 days', tone: 'warning' },
          { label: 'Roles', value: '9', change: '2 custom' },
          { label: 'MFA enabled', value: '92%', change: '33 users', tone: 'positive' },
        ]}
      />
      <section className="users-grid">
        <div className="panel register-panel">
          <DataTable
            columns={[
              { key: 'name', label: 'User' },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role' },
              { key: 'scope', label: 'Access scope' },
              { key: 'status', label: 'Status' },
            ]}
            rows={rows.map((x) => ({
              name: x[0],
              email: x[1],
              role: x[2],
              scope: x[3],
              status: x[4],
            }))}
          />
        </div>
        <aside className="panel role-list">
          <header>
            <h2>Roles</h2>
            <button>
              <Plus />
            </button>
          </header>
          {[
            ['Owner', '1', 'Full access'],
            ['Administrator', '2', 'System administration'],
            ['Accountant', '6', 'Accounting & reports'],
            ['Finance Manager', '3', 'Finance & approvals'],
            ['Sales', '8', 'Customers & invoices'],
            ['Procurement', '4', 'Suppliers & purchases'],
            ['Inventory Manager', '4', 'Inventory operations'],
            ['Auditor', '2', 'Read-only finance'],
            ['Employee', '6', 'Expenses & workflows'],
          ].map((x, i) => (
            <button className={i === 2 ? 'active' : ''} key={x[0]}>
              <span>
                <strong>{x[0]}</strong>
                <small>{x[2]}</small>
              </span>
              <b>{x[1]}</b>
              <ChevronRight />
            </button>
          ))}
        </aside>
      </section>
      <section className="panel permission-matrix">
        <header>
          <div>
            <h2>Accountant permissions</h2>
            <p>Permissions apply across assigned branches.</p>
          </div>
          <button className="button button--secondary">Edit permissions</button>
        </header>
        <div className="permission-head">
          <span>Module</span>
          {['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export'].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        {[
          'Dashboard',
          'Sales',
          'Purchases',
          'Expenses',
          'Banking',
          'Accounting',
          'Reports',
          'Tax',
        ].map((x, i) => (
          <div className="permission-row" key={x}>
            <strong>{x}</strong>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <i className={(i < 5 && n < 4) || (i >= 4 && n !== 4) ? 'checked' : ''} key={n}>
                {((i < 5 && n < 4) || (i >= 4 && n !== 4)) && <Check />}
              </i>
            ))}
          </div>
        ))}
      </section>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Invite a team member"
        footer={
          <button className="button" onClick={() => setModal(false)}>
            Send invitation
          </button>
        }
      >
        <div className="form-grid">
          <label className="full">
            Work email
            <input placeholder="person@company.com" />
          </label>
          <label>
            Role
            <select>
              <option>Accountant</option>
              <option>Finance Manager</option>
              <option>Sales</option>
              <option>Auditor</option>
            </select>
          </label>
          <label>
            Branch access
            <select>
              <option>All branches</option>
              <option>Lagos Head Office</option>
              <option>Abuja Branch</option>
            </select>
          </label>
        </div>
      </Modal>
    </>
  );
}

export function SettingsPage({ type = 'settings' }: { type?: string }) {
  const sections = [
    ['Organisation', Building2, 'Business details, fiscal year and preferences'],
    ['Branches & departments', MapPin, 'Locations, warehouses, departments and cost centres'],
    ['Currencies', Coins, 'Base currency, exchange rates and revaluation'],
    ['Taxes', Globe2, 'Jurisdictions, rates and exemptions'],
    ['Invoices & documents', CreditCard, 'Numbering, templates, terms and reminders'],
    ['Notifications', Bell, 'Email, push, SMS and WhatsApp channels'],
    ['Security', ShieldCheck, 'MFA, sessions, access policies and backups'],
    ['Integrations', Database, 'Banks, payments, HR, POS and productivity apps'],
  ];
  const selected =
    type === 'branches'
      ? 1
      : type === 'currencies'
        ? 2
        : type === 'security'
          ? 6
          : type === 'integrations'
            ? 7
            : 0;
  return (
    <>
      <PageHeader
        title={
          type === 'security'
            ? 'Security'
            : type === 'integrations'
              ? 'Integrations'
              : type === 'branches'
                ? 'Branches & cost centres'
                : type === 'currencies'
                  ? 'Currencies & exchange rates'
                  : 'Settings'
        }
        description="Configure your organisation, financial controls, automation, and connected services."
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          {sections.map(([name, Icon, desc], i) => (
            <button className={i === selected ? 'active' : ''} key={String(name)}>
              <Icon />
              <span>
                <strong>{String(name)}</strong>
                <small>{String(desc)}</small>
              </span>
              <ChevronRight />
            </button>
          ))}
        </aside>
        <section className="settings-main panel">
          {selected === 0 ? (
            <OrganisationSettings />
          ) : selected === 1 ? (
            <BranchSettings />
          ) : selected === 2 ? (
            <CurrencySettings />
          ) : selected === 6 ? (
            <SecuritySettings />
          ) : (
            <Integrations />
          )}
        </section>
      </div>
    </>
  );
}

function OrganisationSettings() {
  return (
    <>
      <header className="settings-heading">
        <h2>Organisation profile</h2>
        <p>Legal and contact information used on financial documents.</p>
      </header>
      <div className="company-logo-upload">
        <span>AC</span>
        <div>
          <strong>Company logo</strong>
          <p>PNG or SVG, at least 256 × 256px.</p>
          <button>Replace logo</button>
        </div>
      </div>
      <div className="form-grid">
        <label>
          Business name
          <input defaultValue="Acme Holdings" />
        </label>
        <label>
          Legal name
          <input defaultValue="Acme Holdings Limited" />
        </label>
        <label>
          Registration number
          <input defaultValue="RC 1458230" />
        </label>
        <label>
          Tax ID
          <input defaultValue="01839201-0001" />
        </label>
        <label>
          Industry
          <select>
            <option>Professional services</option>
          </select>
        </label>
        <label>
          Business type
          <select>
            <option>Limited liability company</option>
          </select>
        </label>
        <label className="full">
          Registered address
          <textarea defaultValue="12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria" />
        </label>
      </div>
      <hr />
      <header className="settings-heading">
        <h2>Financial preferences</h2>
        <p>Core accounting rules for this organisation.</p>
      </header>
      <div className="form-grid">
        <label>
          Base currency
          <select>
            <option>NGN · Nigerian Naira</option>
          </select>
        </label>
        <label>
          Fiscal year
          <select>
            <option>January – December</option>
          </select>
        </label>
        <label>
          Accounting method
          <select>
            <option>Accrual basis</option>
            <option>Cash basis</option>
          </select>
        </label>
        <label>
          Inventory valuation
          <select>
            <option>Weighted average</option>
            <option>FIFO</option>
          </select>
        </label>
      </div>
      <div className="settings-save">
        <span>Last saved 2 minutes ago</span>
        <button className="button">Save changes</button>
      </div>
    </>
  );
}
function BranchSettings() {
  return (
    <>
      <header className="settings-heading">
        <h2>Organisation structure</h2>
        <p>Manage reporting entities, teams, stock locations, and cost allocation.</p>
        <button className="button">
          <Plus />
          Add branch
        </button>
      </header>
      {[
        ['Lagos Head Office', '12 Admiralty Way, Lekki', '24 users · 2 warehouses', 'Primary'],
        ['Abuja Branch', 'Central Business District', '8 users · 1 warehouse', 'Active'],
        ['Ibadan Branch', 'Bodija, Ibadan', '4 users · 1 warehouse', 'Active'],
        ['Port Harcourt Branch', 'GRA Phase 2', '3 users · 1 warehouse', 'Active'],
      ].map((x) => (
        <div className="branch-row" key={x[0]}>
          <span>
            <Building2 />
          </span>
          <div>
            <strong>{x[0]}</strong>
            <small>
              {x[1]} · {x[2]}
            </small>
          </div>
          <Badge>{x[3]}</Badge>
          <button className="row-action">
            <MoreHorizontal />
          </button>
        </div>
      ))}
      <header className="settings-heading secondary">
        <h2>Departments & cost centres</h2>
        <button className="button button--secondary">
          <Plus />
          Add department
        </button>
      </header>
      <div className="tag-list">
        {['Finance', 'Sales', 'Marketing', 'HR', 'Operations', 'IT', 'Production'].map((x) => (
          <span key={x}>
            {x}
            <b>×</b>
          </span>
        ))}
      </div>
    </>
  );
}
function CurrencySettings() {
  return (
    <>
      <header className="settings-heading">
        <h2>Currency management</h2>
        <p>Record foreign transactions and recognise realised or unrealised gains and losses.</p>
        <button className="button">
          <Plus />
          Add currency
        </button>
      </header>
      {[
        ['NGN', 'Nigerian Naira', '₦', '1.0000', 'Base currency'],
        ['USD', 'US Dollar', '$', '1,592.4500', 'Active'],
        ['GBP', 'British Pound', '£', '2,055.8400', 'Active'],
        ['EUR', 'Euro', '€', '1,753.2100', 'Active'],
      ].map((x) => (
        <div className="currency-row" key={x[0]}>
          <b>{x[0]}</b>
          <span>
            <strong>{x[1]}</strong>
            <small>Symbol: {x[2]}</small>
          </span>
          <span>
            <small>1 {x[0]} equals</small>
            <strong>₦{x[3]}</strong>
          </span>
          <Badge>{x[4]}</Badge>
          <button className="row-action">
            <MoreHorizontal />
          </button>
        </div>
      ))}
    </>
  );
}
function SecuritySettings() {
  const controls: Array<[LucideIcon, string, string, boolean]> = [
    [
      Smartphone,
      'Require multi-factor authentication',
      'Enforced for owners, admins, and finance roles',
      true,
    ],
    [
      LockKeyhole,
      'Strong password policy',
      'Minimum 12 characters and breached-password checks',
      true,
    ],
    [KeyRound, 'Session controls', 'Sign out after 30 minutes of inactivity', true],
    [Database, 'Encrypted backups', 'Daily backups with point-in-time recovery', true],
    [Mail, 'Login alerts', 'Notify users of new devices and unusual access', true],
    [ShieldCheck, 'IP allowlist', 'Restrict administrator access to trusted networks', false],
  ];
  return (
    <>
      <header className="settings-heading">
        <h2>Security posture</h2>
        <p>Protect financial data with strong access controls.</p>
      </header>
      <div className="security-score">
        <div>
          <ShieldCheck />
        </div>
        <span>
          <strong>Strong security posture</strong>
          <p>5 of 6 recommended controls are enabled.</p>
          <i>
            <b />
          </i>
        </span>
        <b>86%</b>
      </div>
      {controls.map(([Icon, title, desc, on]) => (
        <div className="setting-toggle" key={title}>
          <Icon />
          <span>
            <strong>{title}</strong>
            <small>{desc}</small>
          </span>
          <button className={on ? 'on' : ''}>
            <i />
          </button>
        </div>
      ))}
    </>
  );
}
function Integrations() {
  return (
    <>
      <header className="settings-heading">
        <h2>Connected apps</h2>
        <p>Connect the tools that power your financial operations.</p>
      </header>
      <div className="integration-grid">
        {[
          ['Cephas POS', 'Sales & inventory', 'CP', 'Connected'],
          ['Cephas HR', 'Payroll & employees', 'CH', 'Connected'],
          ['Paystack', 'Online payments', 'P', 'Connected'],
          ['GTBank', 'Open banking feed', 'GT', 'Connected'],
          ['Microsoft 365', 'Documents & identity', 'M', 'Connect'],
          ['WhatsApp Business', 'Customer messaging', 'W', 'Connect'],
        ].map((x) => (
          <article key={x[0]}>
            <span>{x[2]}</span>
            <div>
              <strong>{x[0]}</strong>
              <small>{x[1]}</small>
            </div>
            <button className={x[3] === 'Connected' ? 'connected' : ''}>
              {x[3] === 'Connected' && <Check />}
              {x[3]}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

export function NotificationsPage() {
  const notices: Array<[LucideIcon, string, string, string, string]> = [
    [
      CreditCard,
      'Payment received',
      'Apex Retail paid ₦2,500,000 for INV-00245.',
      '4 min ago',
      'success',
    ],
    [
      Bell,
      'Invoice overdue',
      'INV-00242 for Kora Foods is now 7 days overdue.',
      '1 hr ago',
      'warning',
    ],
    [Users, 'Approval requested', 'EXP-00194 · ₦420,000 needs your approval.', '2 hrs ago', 'blue'],
    [
      Building2,
      'Low inventory',
      'Wireless Mouse has fallen below its reorder level.',
      'Yesterday',
      'warning',
    ],
    [
      ShieldCheck,
      'New login detected',
      'A new Windows device signed into your account.',
      'Yesterday',
      'blue',
    ],
  ];
  const channels: Array<[LucideIcon, string, boolean]> = [
    [Bell, 'In-app', true],
    [Mail, 'Email', true],
    [Smartphone, 'Push', true],
    [MessageSquare, 'SMS', false],
    [MessageSquare, 'WhatsApp', false],
  ];
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Stay ahead of collections, approvals, stock, reconciliation, budgets, and tax deadlines."
      />
      <div className="notification-layout">
        <section className="panel notification-feed">
          <div className="tabs">
            <button className="active">
              All <span>8</span>
            </button>
            <button>Financial</button>
            <button>Approvals</button>
            <button>System</button>
          </div>
          {notices.map(([Icon, title, desc, time, tone]) => (
            <div className="notification-item" key={title}>
              <span className={tone}>
                <Icon />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
                <small>{time}</small>
              </div>
              <i />
            </div>
          ))}
        </section>
        <aside className="panel notification-prefs">
          <h2>Delivery channels</h2>
          <p>Choose how urgent updates reach you.</p>
          {channels.map(([Icon, name, on]) => (
            <div className="setting-toggle" key={name}>
              <Icon />
              <span>
                <strong>{name}</strong>
              </span>
              <button className={on ? 'on' : ''}>
                <i />
              </button>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}

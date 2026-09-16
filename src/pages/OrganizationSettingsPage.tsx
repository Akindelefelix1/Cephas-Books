import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, Database, Plus, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import {
  organizationApi,
  type AuditEntry,
  type OrganizationAdmin,
  type OrganizationMember,
  type OrganizationSection,
  type OrganizationView,
} from '@/services/organization';
import { confirmAction } from '@/utils/actions';

type Branch = { name: string; address: string; status: string };
type Currency = { code: string; name: string; symbol: string; rate: string; active: boolean };
type Integration = { id: string; connected: boolean };
type Security = Record<string, boolean>;

const titles: Record<OrganizationView, [string, string]> = {
  branches: ['Branches & centres', 'Manage operating locations and organisational structure.'],
  currencies: ['Currencies', 'Control transaction currencies and exchange rates.'],
  users: ['Users & roles', 'Manage team access, roles, and account status.'],
  'audit-logs': ['Audit logs', 'Review traceable organisation and access activity.'],
  integrations: ['Integrations', 'Connect and manage external business services.'],
  security: ['Security', 'Configure organisation-wide access and security controls.'],
  settings: ['Organisation settings', 'Manage your legal identity and financial defaults.'],
};

const roles = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'APPROVER', 'MEMBER', 'AUDITOR'];
const integrationCatalogue = [
  ['cephas-pos', 'Cephas POS', 'Sales and inventory'],
  ['cephas-hr', 'Cephas HR', 'Payroll and employees'],
  ['paystack', 'Paystack', 'Online payments'],
  ['gtbank', 'GTBank', 'Open banking feed'],
  ['microsoft-365', 'Microsoft 365', 'Documents and identity'],
  ['whatsapp', 'WhatsApp Business', 'Customer messaging'],
];
const securityControls = [
  ['mfa', 'Require multi-factor authentication'],
  ['strongPasswords', 'Strong password policy'],
  ['sessionTimeout', 'Automatic session timeout'],
  ['loginAlerts', 'New-device and unusual login alerts'],
  ['ipAllowlist', 'Administrator IP allowlist'],
];

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const arrayValue = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function OrganizationSettingsPage({ view, role }: { view: OrganizationView; role: string }) {
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [admin, setAdmin] = useState<OrganizationAdmin | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'branch' | 'currency' | 'invite' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await organizationApi.admin();
      setAdmin(base);
      if (view === 'users') setMembers(await organizationApi.users());
      if (view === 'audit-logs') setLogs(await organizationApi.auditLogs());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load organisation settings');
    } finally {
      setLoading(false);
    }
  }, [view]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setDialog(null);
      confirmAction(message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to complete this action');
    } finally {
      setBusy(false);
    }
  };
  const saveSection = (
    section: OrganizationSection,
    data: Record<string, unknown>,
    message: string,
  ) => run(() => organizationApi.updateSection(section, data), message);

  if (loading) return <LoadingState label={`Loading ${titles[view][0].toLowerCase()}…`} />;
  if (!admin)
    return (
      <div className="banking-alert" role="alert">
        {error || 'Organisation data is unavailable.'}
        <button onClick={() => void load()}>Try again</button>
      </div>
    );

  const branches = arrayValue<Branch>(objectValue(admin.settings.branches).items);
  const storedCurrencies = arrayValue<Currency>(objectValue(admin.settings.currencies).items);
  const currencies = storedCurrencies.length
    ? storedCurrencies
    : [
        {
          code: admin.organization.baseCurrency,
          name: 'Base currency',
          symbol: '',
          rate: '1',
          active: true,
        },
      ];
  const integrations = arrayValue<Integration>(objectValue(admin.settings.integrations).items);
  const security = objectValue(admin.settings.security) as Security;

  return (
    <>
      <PageHeader title={titles[view][0]} description={titles[view][1]} />
      {error && (
        <div className="banking-alert" role="alert">
          {error}
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {!canManage && view !== 'audit-logs' && (
        <div className="banking-alert">
          You have read-only access. An owner or administrator can make changes.
        </div>
      )}
      {view === 'settings' && (
        <form
          className="panel settings-api-panel"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(
              () =>
                organizationApi.updateOrganization({
                  name: String(data.get('name')),
                  countryCode: String(data.get('countryCode')).toUpperCase(),
                  baseCurrency: String(data.get('baseCurrency')).toUpperCase(),
                }),
              'Organisation settings saved',
            );
          }}
        >
          <header className="settings-heading">
            <h2>Organisation profile</h2>
            <p>These details drive documents, reports, and regional defaults.</p>
          </header>
          <div className="form-grid">
            <label>
              Business name
              <input
                name="name"
                defaultValue={admin.organization.name}
                required
                maxLength={120}
                disabled={!canManage}
              />
            </label>
            <label>
              Country code
              <input
                name="countryCode"
                defaultValue={admin.organization.countryCode}
                required
                minLength={2}
                maxLength={2}
                disabled={!canManage}
              />
            </label>
            <label>
              Base currency
              <input
                name="baseCurrency"
                defaultValue={admin.organization.baseCurrency}
                required
                minLength={3}
                maxLength={3}
                disabled={!canManage}
              />
            </label>
            <label>
              Last updated
              <input value={new Date(admin.organization.updatedAt).toLocaleString()} readOnly />
            </label>
          </div>
          {canManage && (
            <div className="settings-save">
              <span>Changes create an audit entry and notification.</span>
              <button className="button" disabled={busy}>
                Save changes
              </button>
            </div>
          )}
        </form>
      )}
      {view === 'branches' && (
        <section className="panel settings-api-panel">
          <header className="settings-heading">
            <div>
              <h2>Operating locations</h2>
              <p>{branches.length} branches and centres configured.</p>
            </div>
            {canManage && (
              <button className="button" onClick={() => setDialog('branch')}>
                <Plus /> Add branch
              </button>
            )}
          </header>
          {branches.length ? (
            branches.map((branch) => (
              <div className="branch-row" key={branch.name}>
                <span>
                  <Building2 />
                </span>
                <div>
                  <strong>{branch.name}</strong>
                  <small>{branch.address}</small>
                </div>
                <Badge>{branch.status}</Badge>
              </div>
            ))
          ) : (
            <Empty text="No branches have been added yet." />
          )}
        </section>
      )}
      {view === 'currencies' && (
        <section className="panel settings-api-panel">
          <header className="settings-heading">
            <div>
              <h2>Currency management</h2>
              <p>Rates are expressed against {admin.organization.baseCurrency}.</p>
            </div>
            {canManage && (
              <button className="button" onClick={() => setDialog('currency')}>
                <Plus /> Add currency
              </button>
            )}
          </header>
          {currencies.map((item) => (
            <div className="currency-row" key={item.code}>
              <b>{item.code}</b>
              <span>
                <strong>{item.name}</strong>
                <small>{item.symbol || 'No symbol'}</small>
              </span>
              <span>
                <small>Exchange rate</small>
                <strong>{item.rate}</strong>
              </span>
              <Badge>
                {item.code === admin.organization.baseCurrency
                  ? 'Base currency'
                  : item.active
                    ? 'Active'
                    : 'Inactive'}
              </Badge>
            </div>
          ))}
        </section>
      )}
      {view === 'users' && (
        <UsersSection
          members={members}
          canManage={canManage}
          busy={busy}
          onInvite={() => setDialog('invite')}
          onUpdate={(id, data) =>
            void run(() => organizationApi.updateUser(id, data), 'User access updated')
          }
        />
      )}
      {view === 'audit-logs' && <AuditSection logs={logs} />}
      {view === 'security' && (
        <section className="panel settings-api-panel">
          <header className="settings-heading">
            <h2>Security controls</h2>
            <p>Apply consistent safeguards across the organisation.</p>
          </header>
          <div className="security-score">
            <div>
              <ShieldCheck />
            </div>
            <span>
              <strong>Security posture</strong>
              <p>
                {securityControls.filter(([key]) => security[key] !== false).length} of{' '}
                {securityControls.length} controls enabled.
              </p>
            </span>
          </div>
          {securityControls.map(([key, label]) => {
            const enabled = security[key] !== false;
            return (
              <div className="setting-toggle" key={key}>
                <ShieldCheck />
                <span>
                  <strong>{label}</strong>
                  <small>Organisation-wide security policy</small>
                </span>
                <button
                  role="switch"
                  aria-checked={enabled}
                  className={enabled ? 'on' : ''}
                  disabled={!canManage || busy}
                  onClick={() =>
                    void saveSection(
                      'security',
                      { ...security, [key]: !enabled },
                      'Security policy updated',
                    )
                  }
                >
                  <i />
                </button>
              </div>
            );
          })}
        </section>
      )}
      {view === 'integrations' && (
        <section className="panel settings-api-panel">
          <header className="settings-heading">
            <h2>Connected apps</h2>
            <p>Connection status is saved to your organisation.</p>
          </header>
          <div className="integration-grid">
            {integrationCatalogue.map(([id, name, description]) => {
              const connected = integrations.some((item) => item.id === id && item.connected);
              return (
                <article key={id}>
                  <span>
                    <Database />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>{description}</small>
                  </div>
                  <button
                    className={connected ? 'connected' : ''}
                    disabled={!canManage || busy}
                    onClick={() =>
                      void saveSection(
                        'integrations',
                        {
                          items: [
                            ...integrations.filter((item) => item.id !== id),
                            { id, connected: !connected },
                          ],
                        },
                        connected ? `${name} disconnected` : `${name} connected`,
                      )
                    }
                  >
                    {connected && <Check />}
                    {connected ? 'Connected' : 'Connect'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <CreateDialog
        dialog={dialog}
        busy={busy}
        currencies={currencies}
        onClose={() => setDialog(null)}
        onSubmit={(kind, form) => {
          if (kind === 'branch')
            void saveSection(
              'branches',
              {
                items: [
                  ...branches,
                  {
                    name: String(form.get('name')),
                    address: String(form.get('address')),
                    status: 'Active',
                  },
                ],
              },
              'Branch added',
            );
          if (kind === 'currency')
            void saveSection(
              'currencies',
              {
                items: [
                  ...currencies,
                  {
                    code: String(form.get('code')).toUpperCase(),
                    name: String(form.get('name')),
                    symbol: String(form.get('symbol')),
                    rate: String(form.get('rate')),
                    active: true,
                  },
                ],
              },
              'Currency added',
            );
          if (kind === 'invite')
            void run(
              () =>
                organizationApi.inviteUser({
                  email: String(form.get('email')),
                  role: String(form.get('role')),
                }),
              'Existing user added to the organisation',
            );
        }}
      />
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Building2 />
      <strong>{text}</strong>
      <small>Use the action above to create the first record.</small>
    </div>
  );
}

function UsersSection({
  members,
  canManage,
  busy,
  onInvite,
  onUpdate,
}: {
  members: OrganizationMember[];
  canManage: boolean;
  busy: boolean;
  onInvite: () => void;
  onUpdate: (id: string, data: { role?: string; isActive?: boolean }) => void;
}) {
  return (
    <>
      <StatsGrid
        stats={[
          { label: 'Team members', value: String(members.length) },
          { label: 'Active users', value: String(members.filter((x) => x.user.isActive).length) },
          {
            label: 'Pending access',
            value: String(members.filter((x) => !x.user.verifiedAt).length),
            tone: 'warning',
          },
          {
            label: 'Administrators',
            value: String(members.filter((x) => ['OWNER', 'ADMIN'].includes(x.role)).length),
          },
        ]}
      />
      <section className="panel settings-api-panel">
        <header className="settings-heading">
          <div>
            <h2>Team access</h2>
            <p>Roles are enforced by the API on every protected action.</p>
          </div>
          {canManage && (
            <button className="button" onClick={onInvite}>
              <Users /> Add user
            </button>
          )}
        </header>
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    {[member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                      'Invited user'}
                  </td>
                  <td>{member.user.email}</td>
                  <td>
                    <select
                      value={member.role}
                      disabled={!canManage || busy || member.role === 'OWNER'}
                      onChange={(event) => onUpdate(member.id, { role: event.target.value })}
                    >
                      {roles.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge>{member.user.verifiedAt ? 'Verified' : 'Pending'}</Badge>
                  </td>
                  <td>
                    <button
                      className={`mini-switch ${member.user.isActive ? 'on' : ''}`}
                      role="switch"
                      aria-checked={member.user.isActive}
                      disabled={!canManage || busy || member.role === 'OWNER'}
                      onClick={() => onUpdate(member.id, { isActive: !member.user.isActive })}
                    >
                      <i />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AuditSection({ logs }: { logs: AuditEntry[] }) {
  return (
    <section className="panel settings-api-panel">
      <header className="settings-heading">
        <h2>Recorded activity</h2>
        <p>Immutable organisation actions, newest first.</p>
      </header>
      <div className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Area</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actor?.email || 'System'}</td>
                <td>{log.action.replaceAll('_', ' ').toLowerCase()}</td>
                <td>{log.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!logs.length && <Empty text="No audit activity has been recorded yet." />}
    </section>
  );
}

function CreateDialog({
  dialog,
  busy,
  currencies,
  onClose,
  onSubmit,
}: {
  dialog: 'branch' | 'currency' | 'invite' | null;
  busy: boolean;
  currencies: Currency[];
  onClose: () => void;
  onSubmit: (kind: 'branch' | 'currency' | 'invite', form: FormData) => void;
}) {
  if (!dialog) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        dialog === 'branch'
          ? 'Add branch'
          : dialog === 'currency'
            ? 'Add currency'
            : 'Add existing user'
      }
      footer={
        <>
          <button className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" form="organization-dialog" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="organization-dialog"
        className="form-grid"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(dialog, new FormData(event.currentTarget));
        }}
      >
        {dialog === 'branch' && (
          <>
            <label>
              Branch name
              <input name="name" required autoFocus />
            </label>
            <label>
              Address
              <input name="address" required />
            </label>
          </>
        )}
        {dialog === 'currency' && (
          <>
            <label>
              Currency code
              <input name="code" required minLength={3} maxLength={3} autoFocus />
            </label>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Symbol
              <input name="symbol" required />
            </label>
            <label>
              Exchange rate
              <input name="rate" required type="number" min="0.000001" step="any" />
            </label>
            {currencies.length > 12 && (
              <small className="full">
                Review whether every configured currency is still needed.
              </small>
            )}
          </>
        )}
        {dialog === 'invite' && (
          <>
            <label className="full">
              Cephas Books account email
              <input name="email" type="email" required autoFocus />
              <small>The user must already have a verified Cephas Books account.</small>
            </label>
            <label className="full">
              Role
              <select name="role" defaultValue="MEMBER">
                {roles
                  .filter((item) => item !== 'OWNER')
                  .map((item) => (
                    <option key={item}>{item}</option>
                  ))}
              </select>
            </label>
          </>
        )}
      </form>
    </Modal>
  );
}

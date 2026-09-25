import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Database,
  Map,
  MapPin,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import {
  organizationApi,
  type AuditEntry,
  type OrganizationAdmin,
  type LocationActivity,
  type OrganizationMember,
  type OrganizationSection,
  type OrganizationView,
} from '@/services/organization';
import { confirmAction } from '@/utils/actions';

type Branch = {
  id: string;
  regionId: string;
  name: string;
  address: string;
  status: string;
  managerIds: string[];
};
type Region = { id: string; stateId: string; name: string; managerIds: string[] };
type LocationState = { id: string; name: string; managerIds: string[] };
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
  const canViewAdministration = canManage || role === 'AUDITOR';
  const [admin, setAdmin] = useState<OrganizationAdmin | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<
    'state' | 'region' | 'branch' | 'currency' | 'invite' | null
  >(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [parentLocationId, setParentLocationId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    type: 'state' | 'region' | 'branch';
    id: string;
  } | null>(null);
  const [auditSearch, setAuditSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await organizationApi.admin();
      setAdmin(base);
      if ((view === 'users' || view === 'branches') && canViewAdministration)
        setMembers(await organizationApi.users());
      if (view === 'audit-logs' && canViewAdministration)
        setLogs(await organizationApi.auditLogs(auditSearch));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load organisation settings');
    } finally {
      setLoading(false);
    }
  }, [auditSearch, canViewAdministration, view]);
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
      setEditingIndex(null);
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

  const structure = objectValue(admin.settings.branches);
  const states = arrayValue<LocationState>(structure.states);
  const regions = arrayValue<Region>(structure.regions);
  const storedBranches = arrayValue<Branch | Omit<Branch, 'id' | 'regionId' | 'managerIds'>>(
    structure.items,
  );
  const branches = storedBranches.filter(
    (item): item is Branch =>
      typeof (item as Branch).id === 'string' && typeof (item as Branch).regionId === 'string',
  );
  const legacyBranches = storedBranches.filter((item) => !('id' in item) || !('regionId' in item));
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
              <h2>Centres and branches</h2>
              <p>State → Region → Branch hierarchy with scoped management access.</p>
            </div>
            {canManage && (
              <button
                className="button"
                onClick={() => {
                  setEditingLocationId(null);
                  setDialog('state');
                }}
              >
                <Plus /> Create state
              </button>
            )}
          </header>
          <div className="location-levels" aria-label="Organisation levels">
            <span>
              <b>1</b> States <small>{states.length}</small>
            </span>
            <ChevronRight />
            <span>
              <b>2</b> Regions <small>{regions.length}</small>
            </span>
            <ChevronRight />
            <span>
              <b>3</b> Branches <small>{branches.length}</small>
            </span>
          </div>
          {legacyBranches.length > 0 && (
            <div className="banking-alert location-migration-alert" role="status">
              <span>
                <strong>{legacyBranches.length} legacy branch records need a location.</strong>
                Create a state and region, then recreate these branches in the hierarchy. Their
                original details remain preserved until migration is complete.
              </span>
              <div>
                {legacyBranches.map((branch) => (
                  <small key={branch.name}>
                    {branch.name} · {branch.address}
                  </small>
                ))}
              </div>
            </div>
          )}
          {states.length ? (
            <div className="location-layout">
              <div className="location-tree">
                {states.map((state) => {
                  const stateRegions = regions.filter((region) => region.stateId === state.id);
                  return (
                    <article className="location-state" key={state.id}>
                      <div
                        className={`location-node location-node--state ${selectedLocation?.type === 'state' && selectedLocation.id === state.id ? 'selected' : ''}`}
                      >
                        <button
                          className="location-node__main"
                          onClick={() => setSelectedLocation({ type: 'state', id: state.id })}
                        >
                          <span>
                            <Map />
                          </span>
                          <div>
                            <strong>{state.name}</strong>
                            <small>
                              {stateRegions.length} region{stateRegions.length === 1 ? '' : 's'} ·{' '}
                              {
                                branches.filter((branch) =>
                                  stateRegions.some((region) => region.id === branch.regionId),
                                ).length
                              }{' '}
                              branches
                            </small>
                          </div>
                        </button>
                        {canManage && (
                          <div className="location-actions">
                            <button
                              onClick={() => {
                                setParentLocationId(state.id);
                                setEditingLocationId(null);
                                setDialog('region');
                              }}
                            >
                              <Plus /> Region
                            </button>
                            <button
                              aria-label={`Edit ${state.name}`}
                              onClick={() => {
                                setEditingLocationId(state.id);
                                setDialog('state');
                              }}
                            >
                              <MoreHorizontal />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="location-children">
                        {stateRegions.map((region) => {
                          const regionBranches = branches.filter(
                            (branch) => branch.regionId === region.id,
                          );
                          return (
                            <div className="location-region" key={region.id}>
                              <div
                                className={`location-node location-node--region ${selectedLocation?.type === 'region' && selectedLocation.id === region.id ? 'selected' : ''}`}
                              >
                                <button
                                  className="location-node__main"
                                  onClick={() =>
                                    setSelectedLocation({ type: 'region', id: region.id })
                                  }
                                >
                                  <span>
                                    <MapPin />
                                  </span>
                                  <div>
                                    <strong>{region.name}</strong>
                                    <small>
                                      {regionBranches.length} branch
                                      {regionBranches.length === 1 ? '' : 'es'}
                                    </small>
                                  </div>
                                </button>
                                {canManage && (
                                  <div className="location-actions">
                                    <button
                                      onClick={() => {
                                        setParentLocationId(region.id);
                                        setEditingLocationId(null);
                                        setDialog('branch');
                                      }}
                                    >
                                      <Plus /> Branch
                                    </button>
                                    <button
                                      aria-label={`Edit ${region.name}`}
                                      onClick={() => {
                                        setEditingLocationId(region.id);
                                        setDialog('region');
                                      }}
                                    >
                                      <MoreHorizontal />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="location-children location-children--branches">
                                {regionBranches.map((branch) => (
                                  <div
                                    className={`location-node location-node--branch ${selectedLocation?.type === 'branch' && selectedLocation.id === branch.id ? 'selected' : ''}`}
                                    key={branch.id}
                                  >
                                    <button
                                      className="location-node__main"
                                      onClick={() =>
                                        setSelectedLocation({ type: 'branch', id: branch.id })
                                      }
                                    >
                                      <span>
                                        <Building2 />
                                      </span>
                                      <div>
                                        <strong>{branch.name}</strong>
                                        <small>{branch.address}</small>
                                      </div>
                                      <Badge>{branch.status}</Badge>
                                    </button>
                                    {canManage && (
                                      <button
                                        className="row-action"
                                        aria-label={`Edit ${branch.name}`}
                                        onClick={() => {
                                          setEditingLocationId(branch.id);
                                          setDialog('branch');
                                        }}
                                      >
                                        <MoreHorizontal />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
              <LocationDetails
                selected={selectedLocation}
                states={states}
                regions={regions}
                branches={branches}
                members={members}
              />
            </div>
          ) : (
            <Empty text="No states have been added yet." />
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
              <button
                className="button"
                onClick={() => {
                  setEditingIndex(null);
                  setDialog('currency');
                }}
              >
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
              {canManage && item.code !== admin.organization.baseCurrency && (
                <button
                  className="row-action"
                  aria-label={`Edit ${item.code}`}
                  onClick={() => {
                    setEditingIndex(currencies.indexOf(item));
                    setDialog('currency');
                  }}
                >
                  <MoreHorizontal />
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {view === 'users' && !canViewAdministration && <AccessDenied />}
      {view === 'users' && canViewAdministration && (
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
      {view === 'audit-logs' && !canViewAdministration && <AccessDenied />}
      {view === 'audit-logs' && canViewAdministration && (
        <AuditSection logs={logs} search={auditSearch} onSearch={setAuditSearch} />
      )}
      {view === 'security' && (
        <section className="panel settings-api-panel">
          <header className="settings-heading">
            <h2>Security policy preferences</h2>
            <p>
              Record the controls your organisation requires. Enforcement depends on the
              corresponding platform capability.
            </p>
          </header>
          <div className="security-score">
            <div>
              <ShieldCheck />
            </div>
            <span>
              <strong>Security posture</strong>
              <p>
                {securityControls.filter(([key]) => security[key] === true).length} of{' '}
                {securityControls.length} controls enabled.
              </p>
            </span>
          </div>
          {securityControls.map(([key, label]) => {
            const enabled = security[key] === true;
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
            <h2>Integration preferences</h2>
            <p>
              Track which external services your organisation intends to use. Provider authorisation
              is completed separately.
            </p>
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
        members={members}
        states={states}
        regions={regions}
        editingState={states.find((item) => item.id === editingLocationId)}
        editingRegion={regions.find((item) => item.id === editingLocationId)}
        editingBranch={branches.find((item) => item.id === editingLocationId)}
        parentLocationId={parentLocationId}
        editingCurrency={editingIndex === null ? undefined : currencies[editingIndex]}
        onClose={() => {
          setDialog(null);
          setEditingIndex(null);
          setEditingLocationId(null);
          setParentLocationId(null);
        }}
        onSubmit={(kind, form) => {
          const managerIds = form.getAll('managerIds').map(String);
          const id = editingLocationId || crypto.randomUUID();
          if (kind === 'state')
            void saveSection(
              'branches',
              {
                states: [
                  ...states.filter((item) => item.id !== editingLocationId),
                  { id, name: String(form.get('name')), managerIds },
                ],
                regions,
                items: branches,
              },
              editingLocationId ? 'State updated' : 'State created',
            );
          if (kind === 'region')
            void saveSection(
              'branches',
              {
                states,
                regions: [
                  ...regions.filter((item) => item.id !== editingLocationId),
                  {
                    id,
                    stateId: String(form.get('stateId')),
                    name: String(form.get('name')),
                    managerIds,
                  },
                ],
                items: branches,
              },
              editingLocationId ? 'Region updated' : 'Region created',
            );
          if (kind === 'branch')
            void saveSection(
              'branches',
              {
                states,
                regions,
                items: [
                  ...branches.filter((item) => item.id !== editingLocationId),
                  {
                    id,
                    regionId: String(form.get('regionId')),
                    name: String(form.get('name')),
                    address: String(form.get('address')),
                    status: String(form.get('status') || 'Active'),
                    managerIds,
                  },
                ],
              },
              editingLocationId === null ? 'Branch added' : 'Branch updated',
            );
          if (kind === 'currency')
            void saveSection(
              'currencies',
              {
                items: [
                  ...currencies.filter((_, index) => index !== editingIndex),
                  {
                    code: String(form.get('code')).toUpperCase(),
                    name: String(form.get('name')),
                    symbol: String(form.get('symbol')),
                    rate: String(form.get('rate')),
                    active: String(form.get('active')) !== 'false',
                  },
                ],
              },
              editingIndex === null ? 'Currency added' : 'Currency updated',
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
                      {roles
                        .filter((item) => item !== 'OWNER' || member.role === 'OWNER')
                        .map((item) => (
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

function AccessDenied() {
  return (
    <div className="banking-alert" role="alert">
      You do not have permission to view this administration area.
    </div>
  );
}

function LocationDetails({
  selected,
  states,
  regions,
  branches,
  members,
}: {
  selected: { type: 'state' | 'region' | 'branch'; id: string } | null;
  states: LocationState[];
  regions: Region[];
  branches: Branch[];
  members: OrganizationMember[];
}) {
  const [activity, setActivity] = useState<LocationActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activeBranchId, setActiveBranchId] = useState(() =>
    localStorage.getItem('cephas:active-branch'),
  );
  const loadActivity = async (kind: string) => {
    if (!selected) return;
    setActivityLoading(true);
    setActivityError('');
    try {
      setActivity(await organizationApi.locationActivity(selected.type, selected.id, kind));
    } catch (caught) {
      setActivityError(
        caught instanceof Error ? caught.message : 'Unable to load location activity',
      );
    } finally {
      setActivityLoading(false);
    }
  };
  if (!selected)
    return (
      <aside className="location-details">
        <MapPin />
        <strong>Select a location</strong>
        <p>
          Choose a state, region, or branch to inspect its structure, managers, and scoped business
          activity.
        </p>
      </aside>
    );
  const location =
    selected.type === 'state'
      ? states.find((item) => item.id === selected.id)
      : selected.type === 'region'
        ? regions.find((item) => item.id === selected.id)
        : branches.find((item) => item.id === selected.id);
  if (!location) return null;
  const regionIds =
    selected.type === 'state'
      ? regions.filter((item) => item.stateId === selected.id).map((item) => item.id)
      : selected.type === 'region'
        ? [selected.id]
        : [];
  const scopedBranches =
    selected.type === 'branch'
      ? branches.filter((item) => item.id === selected.id)
      : branches.filter((item) => regionIds.includes(item.regionId));
  const managers = (location.managerIds || [])
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as OrganizationMember[];
  return (
    <aside className="location-details location-details--active">
      <span className="location-details__level">
        Level {selected.type === 'state' ? '1' : selected.type === 'region' ? '2' : '3'} ·{' '}
        {selected.type}
      </span>
      <h3>{location.name}</h3>
      {selected.type === 'branch' && (
        <button
          className={`active-branch-button ${activeBranchId === selected.id ? 'active' : ''}`}
          onClick={() => {
            if (activeBranchId === selected.id) {
              localStorage.removeItem('cephas:active-branch');
              setActiveBranchId(null);
            } else {
              localStorage.setItem('cephas:active-branch', selected.id);
              setActiveBranchId(selected.id);
            }
          }}
        >
          <Check /> {activeBranchId === selected.id ? 'Active branch' : 'Use for new records'}
        </button>
      )}
      <div className="location-details__stats">
        <span>
          <b>{scopedBranches.length}</b>
          <small>Branches</small>
        </span>
        <span>
          <b>{managers.length}</b>
          <small>Managers</small>
        </span>
      </div>
      <h4>Assigned managers</h4>
      {managers.length ? (
        managers.map((manager) => (
          <div className="location-manager" key={manager.id}>
            <span>{(manager.user.firstName?.[0] || manager.user.email[0]).toUpperCase()}</span>
            <div>
              <strong>
                {[manager.user.firstName, manager.user.lastName].filter(Boolean).join(' ') ||
                  manager.user.email}
              </strong>
              <small>{manager.role.replaceAll('_', ' ')}</small>
            </div>
          </div>
        ))
      ) : (
        <p>No manager assigned. You can add one now or later.</p>
      )}
      <h4>Scoped activity</h4>
      <div className="location-scope-grid">
        {['Transactions', 'Sales', 'Customers', 'Purchases', 'Invoices'].map((label) => (
          <button key={label} onClick={() => void loadActivity(label.toLowerCase())}>
            <span>{label}</span>
            <ChevronRight />
          </button>
        ))}
      </div>
      <small className="location-scope-note">
        {scopedBranches.length} branch{scopedBranches.length === 1 ? '' : 'es'} in this scope.
        Unassigned organisation records are never shown as branch data.
      </small>
      {activityLoading && <p className="location-activity-message">Loading scoped activity…</p>}
      {activityError && (
        <p className="location-activity-message location-activity-message--error">
          {activityError}
        </p>
      )}
      {activity && !activityLoading && (
        <div className="location-activity">
          <header>
            <strong>{activity.kind}</strong>
            <small>
              {activity.total} record{activity.total === 1 ? '' : 's'}
            </small>
          </header>
          {activity.data.length ? (
            activity.data.map((row) => (
              <div className="location-activity__row" key={row.id}>
                <span>
                  <strong>
                    {row.label || row.displayName || row.description || row.recordType || 'Record'}
                  </strong>
                  <small>
                    {row.recordType || row.type || row.status || 'Active'}
                    {row.date ? ` · ${new Date(row.date).toLocaleDateString()}` : ''}
                  </small>
                </span>
                {row.amount && <b>{Number(row.amount).toLocaleString()}</b>}
              </div>
            ))
          ) : (
            <p className="location-activity-message">No assigned records in this scope yet.</p>
          )}
        </div>
      )}
    </aside>
  );
}

function AuditSection({
  logs,
  search,
  onSearch,
}: {
  logs: AuditEntry[];
  search: string;
  onSearch: (value: string) => void;
}) {
  return (
    <section className="panel settings-api-panel">
      <header className="settings-heading">
        <div>
          <h2>Recorded activity</h2>
          <p>Immutable organisation actions, newest first.</p>
        </div>
        <label className="audit-search">
          Search audit logs
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Action or area"
          />
        </label>
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
  members,
  states,
  regions,
  editingState,
  editingRegion,
  editingBranch,
  editingCurrency,
  parentLocationId,
  onClose,
  onSubmit,
}: {
  dialog: 'state' | 'region' | 'branch' | 'currency' | 'invite' | null;
  busy: boolean;
  currencies: Currency[];
  members: OrganizationMember[];
  states: LocationState[];
  regions: Region[];
  editingState?: LocationState;
  editingRegion?: Region;
  editingBranch?: Branch;
  editingCurrency?: Currency;
  parentLocationId: string | null;
  onClose: () => void;
  onSubmit: (kind: 'state' | 'region' | 'branch' | 'currency' | 'invite', form: FormData) => void;
}) {
  if (!dialog) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        dialog === 'state'
          ? editingState
            ? 'Edit state'
            : 'Create state'
          : dialog === 'region'
            ? editingRegion
              ? 'Edit region'
              : 'Create region'
            : dialog === 'branch'
              ? editingBranch
                ? 'Edit branch'
                : 'Add branch'
              : dialog === 'currency'
                ? editingCurrency
                  ? 'Edit currency'
                  : 'Add currency'
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
        {(dialog === 'state' || dialog === 'region' || dialog === 'branch') && (
          <>
            {dialog === 'region' && (
              <label className="full">
                State
                <select
                  name="stateId"
                  defaultValue={editingRegion?.stateId || parentLocationId || ''}
                  required
                >
                  {states.map((state) => (
                    <option value={state.id} key={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dialog === 'branch' && (
              <label className="full">
                Region
                <select
                  name="regionId"
                  defaultValue={editingBranch?.regionId || parentLocationId || ''}
                  required
                >
                  {regions.map((region) => (
                    <option value={region.id} key={region.id}>
                      {states.find((state) => state.id === region.stateId)?.name} / {region.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dialog !== 'branch' && (
              <label className="full">
                {dialog === 'state' ? 'State' : 'Region'} name
                <input
                  name="name"
                  defaultValue={dialog === 'state' ? editingState?.name : editingRegion?.name}
                  required
                  autoFocus
                />
              </label>
            )}
          </>
        )}
        {dialog === 'branch' && (
          <>
            <label>
              Branch name
              <input name="name" defaultValue={editingBranch?.name} required autoFocus />
            </label>
            <label>
              Address
              <input name="address" defaultValue={editingBranch?.address} required />
            </label>
            <label className="full">
              Status
              <select name="status" defaultValue={editingBranch?.status ?? 'Active'}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </>
        )}
        {(dialog === 'state' || dialog === 'region' || dialog === 'branch') && (
          <fieldset className="manager-picker full">
            <legend>
              Managers <small>Optional · assign now or later</small>
            </legend>
            {members
              .filter((member) => member.user.isActive)
              .map((member) => {
                const selectedManagers =
                  dialog === 'state'
                    ? editingState?.managerIds
                    : dialog === 'region'
                      ? editingRegion?.managerIds
                      : editingBranch?.managerIds;
                return (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      name="managerIds"
                      value={member.id}
                      defaultChecked={selectedManagers?.includes(member.id)}
                    />
                    <span>
                      <strong>
                        {[member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                          member.user.email}
                      </strong>
                      <small>{member.role.replaceAll('_', ' ')}</small>
                    </span>
                  </label>
                );
              })}
            {!members.length && <p>Add organisation users before assigning managers.</p>}
          </fieldset>
        )}
        {dialog === 'currency' && (
          <>
            <label>
              Currency code
              <input
                name="code"
                defaultValue={editingCurrency?.code}
                required
                minLength={3}
                maxLength={3}
                autoFocus
              />
            </label>
            <label>
              Name
              <input name="name" defaultValue={editingCurrency?.name} required />
            </label>
            <label>
              Symbol
              <input name="symbol" defaultValue={editingCurrency?.symbol} required />
            </label>
            <label>
              Exchange rate
              <input
                name="rate"
                defaultValue={editingCurrency?.rate}
                required
                type="number"
                min="0.000001"
                step="any"
              />
            </label>
            <label className="full">
              Status
              <select name="active" defaultValue={String(editingCurrency?.active ?? true)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
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

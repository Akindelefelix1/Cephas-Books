import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  accountingApi,
  type AccountingView,
  type AssetDepreciationSummary,
  type FinanceRecord,
  type Journal,
  type LedgerAccount,
  type LedgerRow,
  type RecordKind,
  type TrialRow,
} from '@/services/accounting';
import { confirmAction } from '@/utils/actions';
import { getDefaultCurrency } from '@/utils/currency';
import { formatBusinessDate, getBusinessToday } from '@/utils/financial-configuration';
import { isWorkingOffline } from '@/services/offline';
const titles: Record<AccountingView, string> = {
  'chart-of-accounts': 'Chart of accounts',
  journals: 'Journal entries',
  'general-ledger': 'General ledger',
  'trial-balance': 'Trial balance',
  assets: 'Fixed assets',
  budgets: 'Budgeting',
  tax: 'Tax',
  payroll: 'Payroll',
};
const money = (v: string | number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: getDefaultCurrency() }).format(Number(v));
const kind = (v: AccountingView) =>
  ({ assets: 'ASSET', budgets: 'BUDGET', tax: 'TAX', payroll: 'PAYROLL' })[
    v as 'assets' | 'budgets' | 'tax' | 'payroll'
  ] as RecordKind;
export function AccountingFinancePage({ view, role }: { view: AccountingView; role: string }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role),
    canApprove = canEdit || role === 'APPROVER';
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]),
    [rows, setRows] = useState<(LedgerAccount | Journal | LedgerRow | TrialRow | FinanceRecord)[]>(
      [],
    ),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState(false),
    [assetSchedule, setAssetSchedule] = useState<AssetDepreciationSummary | null>(null),
    [assetScheduleOpen, setAssetScheduleOpen] = useState(false),
    [assetScheduleLoading, setAssetScheduleLoading] = useState(false),
    [assetScheduleBusy, setAssetScheduleBusy] = useState(false),
    [assetScheduleError, setAssetScheduleError] = useState(''),
    [offline, setOffline] = useState(() => isWorkingOffline()),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const a = await accountingApi.accounts(true);
      setAccounts(a);
      if (view === 'chart-of-accounts') setRows(a);
      else if (view === 'journals') setRows(await accountingApi.journals(search));
      else if (view === 'general-ledger') setRows(await accountingApi.ledger());
      else if (view === 'trial-balance') setRows((await accountingApi.trial()).rows);
      else setRows(await accountingApi.records(kind(view), search));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load accounting data');
    } finally {
      setLoading(false);
    }
  }, [view, search]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    const syncOfflineState = () => setOffline(isWorkingOffline());
    window.addEventListener('online', syncOfflineState);
    window.addEventListener('offline', syncOfflineState);
    window.addEventListener('cephas:sync-state', syncOfflineState);
    return () => {
      window.removeEventListener('online', syncOfflineState);
      window.removeEventListener('offline', syncOfflineState);
      window.removeEventListener('cephas:sync-state', syncOfflineState);
    };
  }, []);
  const run = async (f: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError('');
    try {
      await f();
      confirmAction(msg);
      setModal(false);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete action');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const ask = (f: () => Promise<unknown>, label: string) => {
    setError('');
    setConfirmation({
      title: 'Confirm action',
      message:
        'This action changes financial workflow or ledger state. Please confirm before continuing.',
      confirmLabel: label,
      onConfirm: () => void run(f, label).then((ok) => ok && setConfirmation(null)),
    });
  };
  const openAssetSchedule = async (asset: FinanceRecord) => {
    setAssetSchedule(assetSchedule ? { ...assetSchedule, asset } : null);
    setAssetScheduleOpen(true);
    setAssetScheduleLoading(true);
    setAssetScheduleError('');
    try {
      setAssetSchedule(await accountingApi.assetDepreciation(asset.id));
    } catch (caught) {
      setAssetScheduleError(caught instanceof Error ? caught.message : 'Unable to load depreciation schedule');
    } finally {
      setAssetScheduleLoading(false);
    }
  };
  const saveAssetDepreciationSettings = async (settings: NonNullable<AssetDepreciationSummary['settings']>) => {
    if (!assetSchedule) return;
    setAssetScheduleBusy(true);
    setAssetScheduleError('');
    try {
      await accountingApi.configureAssetDepreciation(assetSchedule.asset.id, settings);
      setAssetSchedule(await accountingApi.assetDepreciation(assetSchedule.asset.id));
      confirmAction('Depreciation settings saved');
      await load();
    } catch (caught) {
      setAssetScheduleError(caught instanceof Error ? caught.message : 'Unable to save depreciation settings');
    } finally {
      setAssetScheduleBusy(false);
    }
  };
  const generateAssetDepreciation = () => {
    if (!assetSchedule?.nextDue) return;
    setConfirmation({
      title: 'Generate depreciation journal?',
      message: `This posts ${money(assetSchedule.nextDue.depreciationAmount)} for ${assetSchedule.nextDue.periodStart} to ${assetSchedule.nextDue.periodEnd} to depreciation expense and accumulated depreciation.${assetSchedule.nextDue.status === 'REVERSED' ? ' This replaces the reversed journal for this period.' : ''}`,
      confirmLabel: 'Generate and post',
      onConfirm: () => void (async () => {
        setAssetScheduleBusy(true);
        setError('');
        try {
          await accountingApi.runAssetDepreciation(assetSchedule.asset.id, getBusinessToday());
          setAssetSchedule(await accountingApi.assetDepreciation(assetSchedule.asset.id));
          await load();
          setConfirmation(null);
          confirmAction('Depreciation journal posted');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Unable to generate depreciation');
        } finally {
          setAssetScheduleBusy(false);
        }
      })(),
    });
  };
  const actionable = !['general-ledger', 'trial-balance'].includes(view);
  const registeredAssets = view === 'assets' ? rows as FinanceRecord[] : [];
  const inServiceAssets = registeredAssets.filter((asset) => asset.status === 'ACTIVE');
  const assetCost = inServiceAssets.reduce((sum, asset) => sum + Number(asset.amount), 0);
  const assetAccumulated = inServiceAssets.reduce((sum, asset) => sum + Number(asset.data?.accumulatedDepreciation ?? 0), 0);
  const pageStats = view === 'assets'
    ? [
        { label: 'Registered assets', value: String(registeredAssets.length) },
        { label: 'Active asset cost', value: money(assetCost) },
        { label: 'Accumulated depreciation', value: money(assetAccumulated) },
        { label: 'Carrying amount', value: money(Math.max(0, assetCost - assetAccumulated)) },
      ]
    : [
        { label: 'Records', value: String(rows.length) },
        { label: 'Active accounts', value: String(accounts.filter((x) => x.isActive).length) },
        { label: 'Debit total', value: money(rows.reduce((sum, row) => sum + Number('debit' in row ? row.debit : 0), 0)) },
        { label: 'Credit total', value: money(rows.reduce((sum, row) => sum + Number('credit' in row ? row.credit : 0), 0)) },
      ];
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>Live organisation accounting records and balances.</p>
        </div>
        {canEdit && actionable && (
          <button className="button" onClick={() => setModal(true)} disabled={view === 'assets' && offline}>
            <Plus size={17} />{' '}
            {view === 'chart-of-accounts'
              ? 'New account'
              : view === 'journals'
                ? 'New journal'
                : `New ${titles[view].toLowerCase()}`}
          </button>
        )}
      </div>
      {view === 'assets' && offline && (
        <div className="banking-alert" role="status">
          Asset schedules and depreciation history are available from the offline snapshot. Registering assets, changing depreciation settings, and posting or reversing journals require a connection.
        </div>
      )}
      <StatsGrid stats={pageStats} />
      <section className="panel register-panel">
        <div className="banking-filters">
          <input
            placeholder={`Search ${titles[view].toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <LoadingState label="Loading accounting and finance…" />
        ) : (
          <Table view={view} rows={rows} canEdit={canEdit} canApprove={canApprove} ask={ask} onAssetSchedule={openAssetSchedule} />
        )}
      </section>
      <EntryModal
        open={modal}
        view={view}
        accounts={accounts.filter((x) => x.isActive)}
        busy={busy}
        error={error}
        close={() => setModal(false)}
        submit={(d) =>
          void run(
            () =>
              view === 'chart-of-accounts'
                ? accountingApi.createAccount(d)
                : view === 'journals'
                  ? accountingApi.createJournal(d)
                  : accountingApi.createRecord(d),
            `${titles[view]} saved`,
          )
        }
      />
      <ConfirmModal
        key={confirmation?.confirmLabel}
        confirmation={confirmation}
        busy={busy}
        error={error}
        onClose={() => setConfirmation(null)}
      />
      <AssetDepreciationModal
        key={assetSchedule?.asset.id ?? 'asset-depreciation'}
        open={assetScheduleOpen}
        data={assetSchedule}
        loading={assetScheduleLoading}
        busy={assetScheduleBusy}
        error={assetScheduleError || (assetScheduleOpen ? error : '')}
        canManage={canEdit}
        offline={offline}
        onClose={() => setAssetScheduleOpen(false)}
        onSave={saveAssetDepreciationSettings}
        onGenerate={generateAssetDepreciation}
      />
    </>
  );
}
function Table({
  view,
  rows,
  canEdit,
  canApprove,
  ask,
  onAssetSchedule,
}: {
  view: AccountingView;
  rows: (LedgerAccount | Journal | LedgerRow | TrialRow | FinanceRecord)[];
  canEdit: boolean;
  canApprove: boolean;
  ask: (f: () => Promise<unknown>, l: string) => void;
  onAssetSchedule: (asset: FinanceRecord) => void;
}) {
  const headers =
    view === 'chart-of-accounts'
      ? ['Code', 'Account', 'Type', 'Status']
      : view === 'journals'
        ? ['Number', 'Date', 'Description', 'Amount', 'Status']
        : view === 'general-ledger'
          ? ['Journal', 'Date', 'Account', 'Description', 'Debit', 'Credit']
          : view === 'trial-balance'
            ? ['Code', 'Account', 'Debit', 'Credit', 'Balance']
            : ['Reference', 'Name', 'Start', 'Amount', 'Status'];
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((x) => (
              <th key={x}>{x}</th>
            ))}
            {((canEdit || canApprove) || view === 'assets') && !['general-ledger', 'trial-balance'].includes(view) && (
              <th>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={'id' in r ? r.id : i}>
              {cells(view, r).map((x, j) => (
                <td key={j}>{x}</td>
              ))}
              {((canEdit || canApprove) || view === 'assets') && !['general-ledger', 'trial-balance'].includes(view) && (
                <td>
                  <div className="inline-actions">{actions(view, r, canEdit, canApprove, ask, onAssetSchedule)}</div>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="table-empty" colSpan={headers.length + 1}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function cells(
  v: AccountingView,
  r: LedgerAccount | Journal | LedgerRow | TrialRow | FinanceRecord,
): string[] {
  if (v === 'chart-of-accounts') {
    const x = r as LedgerAccount;
    return [x.code, x.name, x.type, x.isActive ? 'Active' : 'Archived'];
  }
  if (v === 'journals') {
    const x = r as Journal;
    return [
      x.number,
      formatBusinessDate(x.journalDate),
      x.description,
      money(x.total),
      x.status,
    ];
  }
  if (v === 'general-ledger') {
    const x = r as LedgerRow;
    return [
      x.number,
      formatBusinessDate(x.date),
      x.account ? `${x.account.code} — ${x.account.name}` : 'Unknown account',
      x.description,
      money(x.debit),
      money(x.credit),
    ];
  }
  if (v === 'trial-balance') {
    const x = r as TrialRow;
    return [x.account.code, x.account.name, money(x.debit), money(x.credit), money(x.balance)];
  }
  const x = r as FinanceRecord;
  return [
    x.reference,
    x.name,
    formatBusinessDate(x.startDate),
    money(x.amount),
    x.status,
  ];
}
function actions(
  v: AccountingView,
  r: LedgerAccount | Journal | LedgerRow | TrialRow | FinanceRecord,
  edit: boolean,
  approve: boolean,
  ask: (f: () => Promise<unknown>, l: string) => void,
  onAssetSchedule: (asset: FinanceRecord) => void,
) {
  if (v === 'chart-of-accounts' && edit) {
    const x = r as LedgerAccount;
    if (x.isSystem) return null;
    return (
      <button
        onClick={() =>
          ask(
            () => accountingApi.accountStatus(x.id, x.isActive ? 'ARCHIVED' : 'ACTIVE'),
            x.isActive ? 'Archive account' : 'Restore account',
          )
        }
      >
        {x.isActive ? 'Archive' : 'Restore'}
      </button>
    );
  }
  if (v === 'journals') {
    const x = r as Journal;
    const reverseJournal = async () => {
      const reversal = await accountingApi.reverseJournal(x.id);
      if (reversal.depreciationAssetId)
        await accountingApi.assetDepreciation(reversal.depreciationAssetId);
      return reversal;
    };
    return (
      <>
        {x.status === 'DRAFT' && approve && (
          <button onClick={() => ask(() => accountingApi.postJournal(x.id), 'Post journal')}>
            Post
          </button>
        )}
        {x.status === 'POSTED' && edit && (
          <button onClick={() => ask(reverseJournal, 'Reverse journal')}>
            Reverse
          </button>
        )}
      </>
    );
  }
  const x = r as FinanceRecord;
  if (v === 'assets')
    return (
      <>
        <button onClick={() => onAssetSchedule(x)}>Depreciation</button>
        {x.status === 'DRAFT' && edit && (
          <button onClick={() => ask(async () => {
            const result = await accountingApi.recordStatus(x.id, 'ACTIVE');
            await accountingApi.assetDepreciation(x.id);
            return result;
          }, 'Activate asset')}>
            Activate
          </button>
        )}
        {x.status === 'ACTIVE' && edit && (
          <button onClick={() => ask(async () => {
            const result = await accountingApi.recordStatus(x.id, 'DISPOSED');
            await accountingApi.assetDepreciation(x.id);
            return result;
          }, 'Dispose asset')}>
            Dispose
          </button>
        )}
      </>
    );
  if (['DRAFT', 'PENDING'].includes(x.status) && approve)
    return (
      <button
        onClick={() => ask(() => accountingApi.recordStatus(x.id, 'APPROVED'), 'Approve record')}
      >
        Approve
      </button>
    );
  if (x.status === 'APPROVED' && v === 'payroll' && edit)
    return (
      <button
        onClick={() => ask(() => accountingApi.recordStatus(x.id, 'PAID'), 'Mark payroll paid')}
      >
        Mark paid
      </button>
    );
  return null;
}
function EntryModal({
  open,
  view,
  accounts,
  busy,
  error,
  close,
  submit,
}: {
  open: boolean;
  view: AccountingView;
  accounts: LedgerAccount[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (d: Record<string, unknown>) => void;
}) {
  const [depreciationMethod, setDepreciationMethod] = useState('STRAIGHT_LINE');
  const today = getBusinessToday();
  return (
    <Modal
      open={open}
      onClose={close}
      title={
        view === 'chart-of-accounts'
          ? 'Create ledger account'
          : view === 'journals'
            ? 'Create balanced journal'
            : `Create ${titles[view].toLowerCase()}`
      }
      footer={
        <>
          <button className="button button--secondary" onClick={close}>
            Cancel
          </button>
          <button className="button" type="submit" form="accounting-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="accounting-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            g = (n: string) => String(f.get(n) || '');
          if (view === 'chart-of-accounts')
            submit({
              code: g('code'),
              name: g('name'),
              type: g('type'),
              description: g('description') || undefined,
            });
          else if (view === 'journals')
            submit({
              number: g('reference'),
              journalDate: g('startDate'),
              description: g('name'),
              lines: [
                {
                  accountId: g('debitAccount'),
                  debit: Number(g('amount')),
                  credit: 0,
                  memo: g('memo') || undefined,
                },
                {
                  accountId: g('creditAccount'),
                  debit: 0,
                  credit: Number(g('amount')),
                  memo: g('memo') || undefined,
                },
              ],
            });
          else
            submit({
              kind: kind(view),
              reference: g('reference'),
              name: g('name'),
              startDate: g('startDate'),
              endDate: g('endDate') || undefined,
              amount: Number(g('amount')),
              status: view === 'tax' ? 'PENDING' : 'DRAFT',
              data: {
                notes: g('memo'),
                ...(view === 'assets' ? {
                  depreciation: {
                    residualValue: Number(g('residualValue')),
                    usefulLifeYears: Number(g('usefulLifeYears')),
                    method: g('method'),
                    frequency: g('frequency'),
                    ...(g('reducingBalanceRate') ? { reducingBalanceRate: Number(g('reducingBalanceRate')) } : {}),
                  },
                } : {}),
              },
            });
        }}
      >
        {view === 'chart-of-accounts' ? (
          <>
            <label>
              Account code
              <input name="code" required maxLength={20} />
            </label>
            <label>
              Type
              <select name="type">
                <option>ASSET</option>
                <option>LIABILITY</option>
                <option>EQUITY</option>
                <option>INCOME</option>
                <option>EXPENSE</option>
              </select>
            </label>
            <label className="full">
              Account name
              <input name="name" required />
            </label>
            <label className="full">
              Description
              <textarea name="description" />
            </label>
          </>
        ) : (
          <>
            <label>
              {view === 'assets' ? 'Asset reference' : 'Reference'}
              <input name="reference" required />
            </label>
            <label>
              {view === 'journals' ? 'Journal date' : view === 'assets' ? 'Acquisition date' : 'Start date'}
              <input name="startDate" type="date" defaultValue={today} required />
            </label>
            <label className="full">
              {view === 'journals' ? 'Description' : view === 'assets' ? 'Asset description' : 'Name'}
              <input name="name" required />
            </label>
            {view === 'journals' && (
              <>
                <label>
                  Debit account
                  <select name="debitAccount" required defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Credit account
                  <select name="creditAccount" required defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              {view === 'assets' ? 'Acquisition cost' : 'Amount'}
              <input name="amount" type="number" min=".01" step=".01" required />
            </label>
            {view !== 'journals' && view !== 'assets' && (
              <label>
                End date
                <input name="endDate" type="date" />
              </label>
            )}
            {view === 'assets' && (
              <>
                <label>
                  Residual value
                  <input name="residualValue" type="number" min="0" step=".01" defaultValue="0" required />
                </label>
                <label>
                  Useful life (years)
                  <input name="usefulLifeYears" type="number" min="1" max="100" step="1" defaultValue="5" required />
                </label>
                <label>
                  Depreciation method
                  <select name="method" value={depreciationMethod} onChange={(event) => setDepreciationMethod(event.target.value)}>
                    <option value="STRAIGHT_LINE">Straight-line</option>
                    <option value="REDUCING_BALANCE">Reducing balance</option>
                  </select>
                </label>
                <label>
                  Depreciation frequency
                  <select name="frequency" defaultValue="MONTHLY">
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUALLY">Annually</option>
                  </select>
                </label>
                {depreciationMethod === 'REDUCING_BALANCE' && (
                  <label>
                    Annual reducing rate (%)
                    <input name="reducingBalanceRate" type="number" min=".01" max="100" step=".01" placeholder="Calculated from useful life if blank" />
                  </label>
                )}
                <small className="full">Straight-line depreciation is spread evenly over the useful life. Reducing balance uses the entered annual rate or derives one from cost, residual value, and useful life; the final period is capped at residual value.</small>
              </>
            )}
            <label className="full">
              Notes
              <textarea name="memo" />
            </label>
          </>
        )}
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

function AssetDepreciationModal({
  open,
  data,
  loading,
  busy,
  error,
  canManage,
  offline,
  onClose,
  onSave,
  onGenerate,
}: {
  open: boolean;
  data: AssetDepreciationSummary | null;
  loading: boolean;
  busy: boolean;
  error: string;
  canManage: boolean;
  offline: boolean;
  onClose: () => void;
  onSave: (settings: NonNullable<AssetDepreciationSummary['settings']>) => void;
  onGenerate: () => void;
}) {
  const today = getBusinessToday();
  const settings = data?.settings;
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={data ? `Depreciation · ${data.asset.name}` : 'Asset depreciation'}
      footer={
        <>
          <button className="button button--secondary" onClick={onClose}>Close</button>
          {!loading && data?.configured && ['DUE', 'REVERSED'].includes(data.nextDue?.status ?? '') && canManage && data.asset.status === 'ACTIVE' && (
            <button className="button" onClick={onGenerate} disabled={busy || offline}>
              {busy ? 'Posting…' : (data.nextDue?.status === 'REVERSED' ? 'Regenerate reversed period' : 'Generate next due journal')}
            </button>
          )}
        </>
      }
    >
      {loading && <LoadingState compact label="Loading asset depreciation…" />}
      {error && <div className="banking-alert" role="alert">{error}</div>}
      {!loading && data && (
        <div className="asset-depreciation">
          <div className="asset-depreciation__summary">
            <div><span>Acquisition cost</span><strong>{money(data.cost)}</strong></div>
            <div><span>Accumulated depreciation</span><strong>{money(data.accumulatedDepreciation)}</strong></div>
            <div><span>Carrying amount</span><strong>{money(data.carryingAmount)}</strong></div>
          </div>
          {!data.configured && canManage && (
            <form
              className="form-grid asset-depreciation__settings"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const method = String(form.get('method')) as NonNullable<AssetDepreciationSummary['settings']>['method'];
                onSave({
                  residualValue: Number(form.get('residualValue')),
                  usefulLifeYears: Number(form.get('usefulLifeYears')),
                  method,
                  frequency: String(form.get('frequency')) as NonNullable<AssetDepreciationSummary['settings']>['frequency'],
                  ...(String(form.get('reducingBalanceRate') ?? '') ? { reducingBalanceRate: Number(form.get('reducingBalanceRate')) } : {}),
                });
              }}
            >
              <p className="full">Complete depreciation settings for this existing asset before calculating its schedule.</p>
              <label>Residual value<input name="residualValue" type="number" min="0" max={data.cost} step=".01" defaultValue={settings?.residualValue ?? 0} required /></label>
              <label>Useful life (years)<input name="usefulLifeYears" type="number" min="1" max="100" step="1" defaultValue={settings?.usefulLifeYears ?? 5} required /></label>
              <label>Method<select name="method" defaultValue={settings?.method ?? 'STRAIGHT_LINE'}><option value="STRAIGHT_LINE">Straight-line</option><option value="REDUCING_BALANCE">Reducing balance</option></select></label>
              <label>Frequency<select name="frequency" defaultValue={settings?.frequency ?? 'MONTHLY'}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUALLY">Annually</option></select></label>
              <label className="full">Annual reducing balance rate (%)<input name="reducingBalanceRate" type="number" min=".01" max="100" step=".01" defaultValue={settings?.reducingBalanceRate} placeholder="Optional; calculated from asset life when blank" /></label>
              {canManage && <button className="button full" disabled={busy || offline}>{offline ? 'Connect to save settings' : busy ? 'Saving…' : 'Save depreciation settings'}</button>}
            </form>
          )}
          {data.configured && (
            <>
              <p className="asset-depreciation__method">
                {settings?.method === 'STRAIGHT_LINE' ? 'Straight-line' : 'Reducing balance'} · {settings?.frequency?.toLowerCase()} · {settings?.usefulLifeYears} years · residual {money(settings?.residualValue ?? 0)}
                {settings?.method === 'REDUCING_BALANCE' ? ` · annual rate ${settings.reducingBalanceRate ?? 'derived'}${settings.reducingBalanceRate === undefined ? '' : '%'}` : ''}
              </p>
              {data.asset.status === 'DISPOSED' && <div className="banking-alert">This asset has been disposed and cannot accrue further depreciation.</div>}
              {!['ACTIVE', 'DISPOSED'].includes(data.asset.status) && <div className="banking-alert">Only an active asset can generate depreciation journals. Activate this asset first if it is still in service.</div>}
              {data.nextDue?.status === 'REVERSED' && <div className="banking-alert">This period was reversed and is ready to regenerate. If later periods were posted, reverse those in reverse chronological order first.</div>}
              {offline && <div className="banking-alert" role="status">You are offline. This schedule is read-only until you reconnect.</div>}
              {!data.nextDue && <div className="banking-alert">No unrecorded depreciation period is due through {formatBusinessDate(today)}.</div>}
              <h3>Depreciation schedule</h3>
              <div className="data-table-wrap asset-depreciation__table">
                <table className="data-table">
                  <thead><tr><th>Period</th><th>Start</th><th>End</th><th>Depreciation</th><th>Accumulated</th><th>Carrying amount</th><th>Status</th></tr></thead>
                  <tbody>{data.schedule.map((period) => (
                    <tr key={period.periodEnd}>
                      <td>{period.period}</td><td>{formatBusinessDate(period.periodStart)}</td><td>{formatBusinessDate(period.periodEnd)}</td>
                      <td>{money(period.depreciationAmount)}</td><td>{money(period.accumulatedDepreciation)}</td><td>{money(period.carryingAmount)}</td><td>{period.status}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <h3>Depreciation history</h3>
              {data.history.length ? (
                <div className="data-table-wrap asset-depreciation__table">
                  <table className="data-table">
                    <thead><tr><th>Period end</th><th>Amount</th><th>Accumulated</th><th>Carrying amount</th><th>Journal</th><th>Status</th></tr></thead>
                    <tbody>{data.history.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatBusinessDate(entry.periodEnd)}</td><td>{money(entry.amount)}</td><td>{money(entry.accumulatedDepreciation)}</td>
                        <td>{money(entry.carryingAmount)}</td><td>{entry.journal?.number ?? 'Journal unavailable'}</td><td>{entry.status}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p>No depreciation journal entries have been generated.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

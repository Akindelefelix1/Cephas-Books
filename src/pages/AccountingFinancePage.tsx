import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  accountingApi,
  type AccountingView,
  type FinanceRecord,
  type Journal,
  type LedgerAccount,
  type LedgerRow,
  type RecordKind,
  type TrialRow,
} from '@/services/accounting';
import { confirmAction } from '@/utils/actions';
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
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v));
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
  const actionable = !['general-ledger', 'trial-balance'].includes(view);
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>Live organisation accounting records and balances.</p>
        </div>
        {canEdit && actionable && (
          <button className="button" onClick={() => setModal(true)}>
            <Plus size={17} />{' '}
            {view === 'chart-of-accounts'
              ? 'New account'
              : view === 'journals'
                ? 'New journal'
                : `New ${titles[view].toLowerCase()}`}
          </button>
        )}
      </div>
      <StatsGrid
        stats={[
          { label: 'Records', value: String(rows.length) },
          { label: 'Active accounts', value: String(accounts.filter((x) => x.isActive).length) },
          {
            label: 'Debit total',
            value: money(rows.reduce((s, x) => s + Number('debit' in x ? x.debit : 0), 0)),
          },
          {
            label: 'Credit total',
            value: money(rows.reduce((s, x) => s + Number('credit' in x ? x.credit : 0), 0)),
          },
        ]}
      />
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
          <Table view={view} rows={rows} canEdit={canEdit} canApprove={canApprove} ask={ask} />
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
    </>
  );
}
function Table({
  view,
  rows,
  canEdit,
  canApprove,
  ask,
}: {
  view: AccountingView;
  rows: (LedgerAccount | Journal | LedgerRow | TrialRow | FinanceRecord)[];
  canEdit: boolean;
  canApprove: boolean;
  ask: (f: () => Promise<unknown>, l: string) => void;
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
            {(canEdit || canApprove) && !['general-ledger', 'trial-balance'].includes(view) && (
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
              {(canEdit || canApprove) && !['general-ledger', 'trial-balance'].includes(view) && (
                <td>
                  <div className="inline-actions">{actions(view, r, canEdit, canApprove, ask)}</div>
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
      new Date(x.journalDate).toLocaleDateString(),
      x.description,
      money(x.total),
      x.status,
    ];
  }
  if (v === 'general-ledger') {
    const x = r as LedgerRow;
    return [
      x.number,
      new Date(x.date).toLocaleDateString(),
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
    new Date(x.startDate).toLocaleDateString(),
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
    return (
      <>
        {x.status === 'DRAFT' && approve && (
          <button onClick={() => ask(() => accountingApi.postJournal(x.id), 'Post journal')}>
            Post
          </button>
        )}
        {x.status === 'POSTED' && edit && (
          <button onClick={() => ask(() => accountingApi.reverseJournal(x.id), 'Reverse journal')}>
            Reverse
          </button>
        )}
      </>
    );
  }
  const x = r as FinanceRecord;
  if (v === 'assets' && x.status === 'DRAFT' && edit)
    return (
      <button
        onClick={() => ask(() => accountingApi.recordStatus(x.id, 'ACTIVE'), 'Activate asset')}
      >
        Activate
      </button>
    );
  if (['DRAFT', 'PENDING'].includes(x.status) && approve)
    return (
      <button
        onClick={() => ask(() => accountingApi.recordStatus(x.id, 'APPROVED'), 'Approve record')}
      >
        Approve
      </button>
    );
  if (x.status === 'ACTIVE' && v === 'assets' && edit)
    return (
      <button
        onClick={() => ask(() => accountingApi.recordStatus(x.id, 'DISPOSED'), 'Dispose asset')}
      >
        Dispose
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
  const today = new Date().toISOString().slice(0, 10);
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
              data: { notes: g('memo') },
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
              Reference
              <input name="reference" required />
            </label>
            <label>
              {view === 'journals' ? 'Journal date' : 'Start date'}
              <input name="startDate" type="date" defaultValue={today} required />
            </label>
            <label className="full">
              {view === 'journals' ? 'Description' : 'Name'}
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
              Amount
              <input name="amount" type="number" min=".01" step=".01" required />
            </label>
            {view !== 'journals' && (
              <label>
                End date
                <input name="endDate" type="date" />
              </label>
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

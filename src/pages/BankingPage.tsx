import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { Download, MoreHorizontal, Plus, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { ApiError } from '@/services/auth';
import {
  bankingApi,
  type BankAccount,
  type BankingSummary,
  type BankTransaction,
  type ReconciliationStatus,
  type TransactionFilters,
} from '@/services/banking';
import { confirmAction, downloadText } from '@/utils/actions';

type View = 'banking' | 'transactions' | 'reconciliation';
const money = (value: string | number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
const date = (value: string) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(value));
const errorMessage = (error: unknown) =>
  error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.';

export function BankingPage({ view = 'banking', role }: { view?: View; role: string }) {
  const canManage = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<BankingSummary | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 15,
    ...(view === 'reconciliation' ? { status: 'UNRECONCILED' } : {}),
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<
    'account' | 'transaction' | 'transfer' | 'import' | 'edit' | null
  >(null);
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextAccounts, nextSummary, nextTransactions] = await Promise.all([
        bankingApi.accounts(true),
        bankingApi.summary(),
        bankingApi.transactions(filters),
      ]);
      setAccounts(nextAccounts);
      setSummary(nextSummary);
      setTransactions(nextTransactions.data);
      setMeta(nextTransactions.meta);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const openQuickCreate = (event?: Event) => {
      const requested =
        event instanceof CustomEvent
          ? String(event.detail)
          : sessionStorage.getItem('cephas:quick-create');
      if (requested !== 'transactions' || view !== 'transactions') return;
      sessionStorage.removeItem('cephas:quick-create');
      if (canManage) setModal('transaction');
    };
    openQuickCreate();
    window.addEventListener('cephas:quick-create', openQuickCreate);
    return () => window.removeEventListener('cephas:quick-create', openQuickCreate);
  }, [canManage, view]);

  const submit = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setModal(null);
      setFile(null);
      confirmAction(message);
      await load();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const exportRows = async () => {
    setBusy(true);
    try {
      const result = await bankingApi.exportCsv(filters);
      downloadText(result.filename, result.csv);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const title =
    view === 'banking'
      ? 'Bank accounts'
      : view === 'transactions'
        ? 'Bank transactions'
        : 'Bank reconciliation';
  const description =
    view === 'banking'
      ? 'See cash across every account and manage your bank records.'
      : view === 'transactions'
        ? 'Track every cash movement across your accounts.'
        : 'Review and resolve unreconciled bank transactions.';
  const activeAccounts = accounts.filter((account) => account.isActive);
  const visibleAccounts = showArchived ? accounts : activeAccounts;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-header__actions">
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={() => void exportRows()}
          >
            <Download size={17} /> Export CSV
          </button>
          {canManage && view === 'banking' && (
            <button className="button" onClick={() => setModal('account')}>
              <Plus size={17} /> Add bank account
            </button>
          )}
          {canManage && view === 'transactions' && (
            <>
              <button
                className="button button--secondary"
                disabled={activeAccounts.length < 2}
                onClick={() => setModal('transfer')}
              >
                Transfer funds
              </button>
              <button
                className="button"
                disabled={!activeAccounts.length}
                onClick={() => setModal('transaction')}
              >
                <Plus size={17} /> Add transaction
              </button>
            </>
          )}
          {canManage && view === 'reconciliation' && (
            <button
              className="button"
              disabled={!activeAccounts.length}
              onClick={() => setModal('import')}
            >
              <Upload size={17} /> Import statement
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="banking-alert" role="alert">
          {error}
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading banking data…" />
      ) : (
        <>
          {summary && (
            <StatsGrid
              stats={[
                {
                  label: `Total cash (${summary.baseCurrency})`,
                  value: money(summary.totalCash, summary.baseCurrency),
                  change:
                    summary.totalsByCurrency.length > 1
                      ? `${summary.totalsByCurrency.length} currencies tracked separately`
                      : `${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'}`,
                },
                {
                  label: 'Money in',
                  value: money(summary.moneyIn, summary.baseCurrency),
                  change: 'This month',
                  tone: 'positive',
                },
                {
                  label: 'Money out',
                  value: money(summary.moneyOut, summary.baseCurrency),
                  change: 'This month',
                },
                {
                  label: 'Unreconciled',
                  value: String(summary.unreconciledCount),
                  change: money(summary.unreconciledAmount, summary.baseCurrency),
                  tone: 'warning',
                },
              ]}
            />
          )}
          {view === 'banking' && (
            <>
              <div className="banking-filters">
                <button
                  className={`filter-button ${showArchived ? 'active' : ''}`}
                  onClick={() => setShowArchived((current) => !current)}
                >
                  {showArchived ? 'Hide archived accounts' : 'Show archived accounts'}
                </button>
              </div>
              <div className="bank-accounts">
                {visibleAccounts.map((account, i) => (
                  <article
                    className={`bank-card ${account.isActive ? '' : 'is-archived'}`}
                    key={account.id}
                  >
                    <header>
                      <span className={`bank-logo bank-logo--${i % 3}`}>
                        {account.name.slice(0, 2)}
                      </span>
                      {canManage && account.isActive && (
                        <button
                          className="icon-button"
                          aria-label={`Edit ${account.name}`}
                          onClick={() => {
                            setSelected(account);
                            setModal('edit');
                          }}
                        >
                          <MoreHorizontal />
                        </button>
                      )}
                    </header>
                    <p>
                      {account.name}{' '}
                      <small>
                        {account.accountNumberLast4
                          ? `•••• ${account.accountNumberLast4}`
                          : account.accountType.replace('_', ' ')}
                      </small>
                    </p>
                    <strong>{money(account.currentBalance, account.currency)}</strong>
                    <span className="bank-card-footer">
                      <i className={account._count.transactions ? 'warning' : ''} />
                      {!account.isActive
                        ? 'Archived account'
                        : account._count.transactions
                          ? `${account._count.transactions} to reconcile`
                          : 'Up to date'}
                    </span>
                    {canManage && !account.isActive && (
                      <div className="inline-actions">
                        <button
                          onClick={() =>
                            setConfirmation({
                              title: 'Restore bank account?',
                              message: `${account.name} will become available for transactions and payments again.`,
                              confirmLabel: 'Restore account',
                              onConfirm: () =>
                                void submit(
                                  () => bankingApi.updateAccount(account.id, { isActive: true }),
                                  'Bank account restored',
                                ).then((ok) => ok && setConfirmation(null)),
                            })
                          }
                        >
                          Restore
                        </button>
                        <button
                          onClick={() =>
                            setConfirmation({
                              title: 'Permanently delete bank account?',
                              message:
                                'This cannot be undone. Accounts with any financial history are protected and cannot be deleted.',
                              confirmLabel: 'Delete permanently',
                              requireText: 'DELETE',
                              onConfirm: () =>
                                void submit(
                                  () => bankingApi.deleteAccount(account.id),
                                  'Bank account permanently deleted',
                                ).then((ok) => ok && setConfirmation(null)),
                            })
                          }
                        >
                          Delete permanently
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
          {view === 'banking' && !visibleAccounts.length && (
            <Empty
              text="No bank accounts yet. Add your first account to start tracking cash."
              action={canManage ? 'Add bank account' : undefined}
              onClick={canManage ? () => setModal('account') : undefined}
            />
          )}
          {view !== 'banking' && (
            <TransactionPanel
              accounts={accounts}
              rows={transactions}
              meta={meta}
              filters={filters}
              setFilters={setFilters}
              reconciliation={view === 'reconciliation'}
              canManage={canManage}
              onStatus={(id, status) => {
                const reconcile = status === 'RECONCILED';
                setError('');
                setConfirmation({
                  title: reconcile ? 'Reconcile transaction?' : 'Exclude transaction?',
                  message: reconcile
                    ? 'This transaction will be marked as reconciled and removed from the outstanding reconciliation queue.'
                    : 'This transaction will be excluded from reconciliation. Its financial value will remain in the account.',
                  confirmLabel: reconcile ? 'Reconcile transaction' : 'Exclude transaction',
                  onConfirm: () =>
                    void submit(
                      () => bankingApi.reconcile(id, status),
                      reconcile ? 'Transaction reconciled' : 'Transaction excluded',
                    ).then((ok) => ok && setConfirmation(null)),
                });
              }}
              onReverse={(id) => {
                setError('');
                setConfirmation({
                  title: 'Reverse transaction?',
                  message:
                    'The transaction will be marked reversed and the account balance recalculated.',
                  confirmLabel: 'Reverse transaction',
                  onConfirm: () =>
                    void submit(
                      () => bankingApi.reverseTransaction(id),
                      'Transaction reversed',
                    ).then((ok) => ok && setConfirmation(null)),
                });
              }}
            />
          )}
        </>
      )}
      <AccountModal
        open={modal === 'account' || modal === 'edit'}
        account={modal === 'edit' ? selected : null}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onArchive={() => {
          if (!selected) return;
          setModal(null);
          setConfirmation({
            title: 'Archive bank account?',
            message: `${selected.name} will be hidden from new transactions, transfers and payments. Its history and balance will remain available.`,
            confirmLabel: 'Archive account',
            onConfirm: () =>
              void submit(
                () => bankingApi.updateAccount(selected.id, { isActive: false }),
                'Bank account archived',
              ).then((ok) => ok && setConfirmation(null)),
          });
        }}
        onSubmit={(data) =>
          void submit(
            () =>
              selected && modal === 'edit'
                ? bankingApi.updateAccount(selected.id, {
                    name: data.name,
                    bankName: data.bankName,
                    accountType: data.accountType,
                    accountNumberLast4: data.accountNumberLast4,
                  })
                : bankingApi.createAccount(data),
            selected && modal === 'edit' ? 'Bank account updated' : 'Bank account added',
          )
        }
      />
      <TransactionModal
        open={modal === 'transaction'}
        accounts={activeAccounts}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onSubmit={(data) =>
          void submit(() => bankingApi.createTransaction(data), 'Transaction added')
        }
      />
      <TransferModal
        open={modal === 'transfer'}
        accounts={activeAccounts}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onSubmit={(data) => void submit(() => bankingApi.transfer(data), 'Funds transferred')}
      />
      <Modal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        title="Import bank statement"
        subtitle="CSV columns: date, description, reference, type, amount."
        footer={
          <button className="button" disabled={busy || !file} type="submit" form="import-form">
            {busy ? 'Importing…' : 'Import transactions'}
          </button>
        }
      >
        <form
          id="import-form"
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () =>
              void submit(
                () => bankingApi.importCsv(String(fd.get('accountId')), String(reader.result)),
                'Statement imported',
              );
            reader.readAsText(file);
          }}
        >
          <label className="full">
            Bank account
            <select name="accountId" required defaultValue="">
              <option value="" disabled>
                Select account
              </option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            CSV statement
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p className="form-error full">{error}</p>}
        </form>
      </Modal>
      <ConfirmModal
        key={confirmation?.title}
        confirmation={confirmation}
        busy={busy}
        error={error}
        onClose={() => setConfirmation(null)}
      />
    </>
  );
}

function Empty({ text, action, onClick }: { text: string; action?: string; onClick?: () => void }) {
  return (
    <div className="banking-state">
      <strong>{text}</strong>
      {action && onClick && (
        <button className="button" onClick={onClick}>
          {action}
        </button>
      )}
    </div>
  );
}

function TransactionPanel({
  accounts,
  rows,
  meta,
  filters,
  setFilters,
  reconciliation,
  onStatus,
  onReverse,
  canManage,
}: {
  accounts: BankAccount[];
  rows: BankTransaction[];
  meta: { page: number; pages: number; total: number };
  filters: TransactionFilters;
  setFilters: Dispatch<SetStateAction<TransactionFilters>>;
  reconciliation: boolean;
  onStatus: (id: string, status: ReconciliationStatus) => void;
  onReverse: (id: string) => void;
  canManage: boolean;
}) {
  const patch = (next: Partial<TransactionFilters>) =>
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  return (
    <section className="panel register-panel">
      <div className="banking-filters">
        <input
          aria-label="Search transactions"
          placeholder="Search description or reference"
          value={filters.search ?? ''}
          onChange={(e) => patch({ search: e.target.value })}
        />
        <select
          aria-label="Filter by account"
          value={filters.accountId ?? ''}
          onChange={(e) => patch({ accountId: e.target.value })}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {!reconciliation && (
          <select
            aria-label="Filter by type"
            value={filters.type ?? ''}
            onChange={(e) => patch({ type: e.target.value as TransactionFilters['type'] })}
          >
            <option value="">Money in & out</option>
            <option value="MONEY_IN">Money in</option>
            <option value="MONEY_OUT">Money out</option>
          </select>
        )}
        <input
          aria-label="From date"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => patch({ from: e.target.value })}
        />
        <input
          aria-label="To date"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => patch({ to: e.target.value })}
        />
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Description</th>
              <th>Reference</th>
              <th className="is-right">Money in</th>
              <th className="is-right">Money out</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="is-primary">{date(row.transactionDate)}</td>
                <td>{row.bankAccount.name}</td>
                <td>{row.description}</td>
                <td>{row.reference || '—'}</td>
                <td className="is-right">
                  {row.type === 'MONEY_IN' ? money(row.amount, row.bankAccount.currency) : '—'}
                </td>
                <td className="is-right">
                  {row.type === 'MONEY_OUT' ? money(row.amount, row.bankAccount.currency) : '—'}
                </td>
                <td>
                  <span className="banking-status">{row.reconciliationStatus.toLowerCase()}</span>
                </td>
                {canManage && (
                  <td>
                    <div className="inline-actions">
                      {reconciliation ? (
                        <>
                          <button onClick={() => onStatus(row.id, 'RECONCILED')}>Reconcile</button>
                          <button onClick={() => onStatus(row.id, 'EXCLUDED')}>Exclude</button>
                        </>
                      ) : (
                        <button onClick={() => onReverse(row.id)}>Reverse</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="table-empty" colSpan={canManage ? 8 : 7}>
                  {reconciliation
                    ? 'Everything is reconciled.'
                    : 'No transactions match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="table-pagination">
          <p>
            Showing {rows.length} of {meta.total}
          </p>
          <div>
            <button disabled={meta.page <= 1} onClick={() => patch({ page: meta.page - 1 })}>
              Previous
            </button>
            <span>
              {meta.page} / {Math.max(1, meta.pages)}
            </span>
            <button
              disabled={meta.page >= meta.pages}
              onClick={() => patch({ page: meta.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type AccountFormData = Parameters<typeof bankingApi.createAccount>[0];
function AccountModal({
  open,
  account,
  busy,
  error,
  onClose,
  onSubmit,
  onArchive,
}: {
  open: boolean;
  account: BankAccount | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => void;
  onArchive: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Edit bank account' : 'Add bank account'}
      subtitle="Account balances and transactions are securely stored in your organisation."
      footer={
        <>
          {account && (
            <button className="button button--danger" disabled={busy} onClick={onArchive}>
              Archive account
            </button>
          )}
          <button className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy} type="submit" form="account-form">
            {busy ? 'Saving…' : 'Save account'}
          </button>
        </>
      }
    >
      <form
        id="account-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSubmit({
            name: String(f.get('name')).trim(),
            bankName: String(f.get('bankName')).trim() || undefined,
            accountType: String(f.get('accountType')) as AccountFormData['accountType'],
            accountNumberLast4: String(f.get('accountNumber')).slice(-4) || undefined,
            currency: String(f.get('currency')),
            openingBalance: Number(f.get('openingBalance') ?? 0),
          });
        }}
      >
        <label className="full">
          Account name
          <input name="name" required maxLength={120} defaultValue={account?.name} />
        </label>
        <label>
          Bank name
          <input name="bankName" maxLength={120} defaultValue={account?.bankName} />
        </label>
        <label>
          Account type
          <select name="accountType" defaultValue={account?.accountType ?? 'CURRENT'}>
            <option value="CURRENT">Current</option>
            <option value="SAVINGS">Savings</option>
            <option value="CASH">Cash</option>
            <option value="CREDIT_CARD">Credit card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          Account number
          <input
            name="accountNumber"
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={20}
            defaultValue={account?.accountNumberLast4}
          />
        </label>
        <label>
          Currency
          <input name="currency" value={account?.currency ?? 'NGN'} readOnly />
        </label>
        {!account && (
          <label className="full">
            Opening balance
            <input name="openingBalance" type="number" step="0.01" defaultValue="0" required />
          </label>
        )}
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

type TransactionFormData = Parameters<typeof bankingApi.createTransaction>[0];
function TransactionModal({
  open,
  accounts,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  accounts: BankAccount[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add bank transaction"
      subtitle="Record money received or paid from an account."
      footer={
        <>
          <button className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy} type="submit" form="transaction-form">
            {busy ? 'Saving…' : 'Add transaction'}
          </button>
        </>
      }
    >
      <form
        id="transaction-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSubmit({
            bankAccountId: String(f.get('accountId')),
            transactionDate: String(f.get('date')),
            description: String(f.get('description')).trim(),
            reference: String(f.get('reference')).trim() || undefined,
            type: String(f.get('type')) as TransactionFormData['type'],
            amount: Number(f.get('amount')),
            notes: String(f.get('notes')).trim() || undefined,
          });
        }}
      >
        <label className="full">
          Bank account
          <select name="accountId" required defaultValue="">
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select name="type">
            <option value="MONEY_IN">Money in</option>
            <option value="MONEY_OUT">Money out</option>
          </select>
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label className="full">
          Description
          <input name="description" required maxLength={240} />
        </label>
        <label>
          Reference
          <input name="reference" maxLength={100} />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="full">
          Notes
          <textarea name="notes" maxLength={1000} />
        </label>
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

type TransferFormData = Parameters<typeof bankingApi.transfer>[0];
function TransferModal({
  open,
  accounts,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  accounts: BankAccount[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (data: TransferFormData) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer funds"
      subtitle="Move money between two accounts in the same currency."
      footer={
        <>
          <button className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy} type="submit" form="transfer-form">
            {busy ? 'Transferring…' : 'Transfer funds'}
          </button>
        </>
      }
    >
      <form
        id="transfer-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const fromAccountId = String(f.get('fromAccountId')),
            toAccountId = String(f.get('toAccountId'));
          if (fromAccountId === toAccountId) return;
          onSubmit({
            fromAccountId,
            toAccountId,
            transactionDate: String(f.get('date')),
            amount: Number(f.get('amount')),
            reference: String(f.get('reference')).trim() || undefined,
            notes: String(f.get('notes')).trim() || undefined,
          });
        }}
      >
        <label>
          From account
          <select name="fromAccountId" required defaultValue="">
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          To account
          <select name="toAccountId" required defaultValue="">
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          Reference
          <input name="reference" maxLength={100} />
        </label>
        <label className="full">
          Notes
          <textarea name="notes" maxLength={1000} />
        </label>
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

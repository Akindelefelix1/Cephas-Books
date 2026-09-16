import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { bankingApi, type BankAccount } from '@/services/banking';
import {
  purchasesApi,
  type PurchaseRow,
  type PurchaseSummary,
  type PurchaseView,
  type Supplier,
} from '@/services/purchases';
import { confirmAction, downloadText } from '@/utils/actions';
const money = (v?: string, c = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: c }).format(Number(v ?? 0));
const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-NG') : '—');
const titles: Record<PurchaseView, string> = {
  suppliers: 'Suppliers',
  'purchase-requests': 'Purchase requests',
  'purchase-orders': 'Purchase orders',
  bills: 'Bills',
  'supplier-payments': 'Supplier payments',
  payables: 'Payables',
  expenses: 'Expenses',
};
export function PurchasesSpendingPage({ view, role }: { view: PurchaseView; role: string }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role),
    canRequest = canEdit || role === 'MEMBER',
    canApprove = canEdit || role === 'APPROVER',
    canDelete = ['OWNER', 'ADMIN'].includes(role),
    allowedCreate =
      view === 'purchase-requests' ? canRequest : view === 'expenses' ? canRequest : canEdit;
  const [rows, setRows] = useState<(PurchaseRow | Supplier)[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [bills, setBills] = useState<PurchaseRow[]>([]),
    [requests, setRequests] = useState<PurchaseRow[]>([]),
    [accounts, setAccounts] = useState<BankAccount[]>([]),
    [summary, setSummary] = useState<PurchaseSummary | null>(null),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState<Supplier | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, sup, bill, req, acc, data] = await Promise.all([
        purchasesApi.summary(),
        purchasesApi.suppliers(),
        purchasesApi.list('bills'),
        purchasesApi.list('purchase-requests', '', 'APPROVED'),
        bankingApi.accounts(),
        view === 'suppliers'
          ? purchasesApi.suppliers(search)
          : purchasesApi.list(view, search, status),
      ]);
      setSummary(sum);
      setSuppliers(sup.filter((x) => x.isActive));
      setBills(
        bill.filter(
          (x) =>
            ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'].includes(x.status ?? '') &&
            Number(x.total) - Number(x.paidAmount) > 0,
        ),
      );
      setRequests(req);
      setAccounts(acc);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load purchases');
    } finally {
      setLoading(false);
    }
  }, [view, search, status]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    const openQuickCreate = (event?: Event) => {
      const requested =
        event instanceof CustomEvent
          ? String(event.detail)
          : sessionStorage.getItem('cephas:quick-create');
      if (requested !== view) return;
      sessionStorage.removeItem('cephas:quick-create');
      if (allowedCreate) setModal(true);
    };
    openQuickCreate();
    window.addEventListener('cephas:quick-create', openQuickCreate);
    return () => window.removeEventListener('cephas:quick-create', openQuickCreate);
  }, [allowedCreate, view]);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setModal(false);
      setSelected(null);
      confirmAction(msg);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const cols = columns(view);
  const exportCsv = () =>
    downloadText(
      `${view}.csv`,
      [
        cols.join(','),
        ...rows.map((r) =>
          values(view, r)
            .map((x) => `"${x.replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n'),
    );
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>Manage {titles[view].toLowerCase()} across your organisation.</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--secondary" onClick={exportCsv}>
            <Download size={17} /> Export CSV
          </button>
          {allowedCreate && (
            <button className="button" onClick={() => setModal(true)}>
              <Plus size={17} /> {action(view)}
            </button>
          )}
        </div>
      </div>
      {summary && (
        <StatsGrid
          stats={[
            { label: 'Active suppliers', value: String(summary.suppliers) },
            { label: 'Requests awaiting approval', value: String(summary.pendingRequests) },
            { label: 'Open purchase orders', value: money(summary.openOrders) },
            { label: 'Outstanding payables', value: money(summary.payable), tone: 'warning' },
          ]}
        />
      )}
      <section className="panel register-panel">
        <div className="banking-filters">
          <input
            aria-label="Search"
            placeholder={`Search ${titles[view].toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!['suppliers', 'supplier-payments', 'payables'].includes(view) && (
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses(view).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="banking-state">
            <RefreshCw className="spin" /> Loading…
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {cols.map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {(canEdit || canApprove) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {values(view, r).map((x, i) => (
                      <td key={i}>{x}</td>
                    ))}
                    {(canEdit || canApprove) && (
                      <td>
                        <div className="inline-actions">
                          {rowActions(
                            view,
                            r,
                            canEdit,
                            canApprove,
                            canDelete,
                            (f, m) => {
                              setError('');
                              setConfirmation({
                                title: 'Confirm action',
                                message:
                                  'Please confirm this workflow action. Related purchase, payable, expense, or banking records may be updated.',
                                confirmLabel: m,
                                requireText: /permanently/.test(m.toLowerCase())
                                  ? 'DELETE'
                                  : undefined,
                                onConfirm: () =>
                                  void run(f, m).then((ok) => ok && setConfirmation(null)),
                              });
                            },
                            () => {
                              if (view === 'suppliers') {
                                setSelected(r as Supplier);
                                setModal(true);
                              }
                            },
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td
                      className="table-empty"
                      colSpan={cols.length + (canEdit || canApprove ? 1 : 0)}
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <PurchaseModal
        open={modal}
        view={view}
        selected={selected}
        suppliers={suppliers}
        requests={requests}
        bills={bills}
        accounts={accounts}
        busy={busy}
        error={error}
        close={() => {
          setModal(false);
          setSelected(null);
        }}
        submit={(d) =>
          void run(
            () =>
              selected ? purchasesApi.updateSupplier(selected.id, d) : purchasesApi.create(view, d),
            `${titles[view]} saved`,
          )
        }
      />
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
function action(v: PurchaseView) {
  return v === 'suppliers'
    ? 'Add supplier'
    : v === 'purchase-requests'
      ? 'New request'
      : v === 'purchase-orders'
        ? 'New purchase order'
        : v === 'bills'
          ? 'Create bill'
          : v === 'expenses'
            ? 'Record expense'
            : 'Record payment';
}
function columns(v: PurchaseView) {
  if (v === 'suppliers') return ['Supplier', 'Email', 'Phone', 'Terms', 'Status'];
  if (v === 'purchase-requests')
    return ['Request', 'Requested by', 'Required', 'Estimate', 'Status'];
  if (v === 'purchase-orders') return ['Order', 'Supplier', 'Delivery', 'Total', 'Status'];
  if (v === 'bills' || v === 'payables')
    return ['Bill', 'Supplier', 'Due', 'Total', 'Outstanding', 'Status'];
  if (v === 'supplier-payments')
    return ['Reference', 'Supplier', 'Bill', 'Date', 'Amount', 'Method'];
  return ['Reference', 'Merchant', 'Category', 'Date', 'Amount', 'Status'];
}
function values(v: PurchaseView, r: PurchaseRow | Supplier) {
  if (v === 'suppliers') {
    const x = r as Supplier;
    return [
      x.displayName,
      x.email || '—',
      x.phone || '—',
      x.paymentTerms || '—',
      x.isActive ? 'Active' : 'Archived',
    ];
  }
  const x = r as PurchaseRow;
  if (v === 'purchase-requests')
    return [
      x.number ?? '',
      x.requestedBy ?? '',
      date(x.requiredDate),
      money(x.total, x.currency),
      x.status ?? '',
    ];
  if (v === 'purchase-orders')
    return [
      x.number ?? '',
      x.supplier?.displayName ?? '',
      date(x.deliveryDate),
      money(x.total, x.currency),
      x.status ?? '',
    ];
  if (v === 'bills' || v === 'payables')
    return [
      x.number ?? '',
      x.supplier?.displayName ?? '',
      date(x.dueDate),
      money(x.total, x.currency),
      money(String(Number(x.total) - Number(x.paidAmount)), x.currency),
      x.status ?? '',
    ];
  if (v === 'supplier-payments')
    return [
      x.reference ?? '',
      x.supplier?.displayName ?? '',
      x.bill?.number ?? '',
      date(x.paymentDate),
      money(x.amount, x.currency),
      x.reversedAt ? 'Reversed' : (x.method ?? ''),
    ];
  return [
    x.reference ?? '',
    x.merchant ?? '',
    x.category ?? '',
    date(x.expenseDate),
    money(x.amount, x.currency),
    x.status ?? '',
  ];
}
function statuses(v: PurchaseView) {
  return v === 'purchase-requests'
    ? ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED']
    : v === 'purchase-orders'
      ? ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BILLED', 'CANCELLED']
      : v === 'bills'
        ? ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID']
        : ['PENDING', 'APPROVED', 'REJECTED', 'VOID'];
}
function rowActions(
  v: PurchaseView,
  r: PurchaseRow | Supplier,
  edit: boolean,
  approve: boolean,
  canDelete: boolean,
  run: (f: () => Promise<unknown>, m: string) => void,
  onEdit: () => void,
) {
  const x = r as PurchaseRow;
  if (v === 'suppliers' && edit)
    return (
      <>
        <button onClick={onEdit}>Edit</button>
        {(r as Supplier).isActive && (
          <button
            onClick={() => run(() => purchasesApi.archiveSupplier(r.id), 'Supplier archived')}
          >
            Archive
          </button>
        )}
        {!(r as Supplier).isActive && (
          <>
            <button
              onClick={() => run(() => purchasesApi.restoreSupplier(r.id), 'Supplier restored')}
            >
              Restore
            </button>
            {canDelete && (
              <button
                onClick={() =>
                  run(() => purchasesApi.deleteSupplier(r.id), 'Supplier permanently deleted')
                }
              >
                Delete permanently
              </button>
            )}
          </>
        )}
      </>
    );
  if (v === 'purchase-requests')
    return (
      <>
        {x.status === 'PENDING' && approve && (
          <>
            <button
              onClick={() =>
                run(() => purchasesApi.status('requests', r.id, 'APPROVED'), 'Request approved')
              }
            >
              Approve
            </button>
            <button
              onClick={() =>
                run(() => purchasesApi.status('requests', r.id, 'REJECTED'), 'Request rejected')
              }
            >
              Reject
            </button>
          </>
        )}
      </>
    );
  if (v === 'purchase-orders' && edit)
    return (
      <>
        {x.status === 'DRAFT' && (
          <button
            onClick={() => run(() => purchasesApi.status('orders', r.id, 'ISSUED'), 'Order issued')}
          >
            Issue
          </button>
        )}
        {['ISSUED', 'PARTIALLY_RECEIVED'].includes(x.status ?? '') && (
          <button
            onClick={() =>
              run(() => purchasesApi.status('orders', r.id, 'RECEIVED'), 'Goods received')
            }
          >
            Receive
          </button>
        )}
        {['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(x.status ?? '') && (
          <button
            onClick={() => {
              const issue = new Date(),
                due = new Date(issue.getTime() + 30 * 86400000);
              run(
                () =>
                  purchasesApi.orderToBill(r.id, {
                    number: `BILL-${Date.now()}`,
                    issueDate: issue.toISOString().slice(0, 10),
                    dueDate: due.toISOString().slice(0, 10),
                  }),
                'Purchase order converted to bill',
              );
            }}
          >
            Create bill
          </button>
        )}
      </>
    );
  if ((v === 'bills' || v === 'payables') && approve)
    return (
      <>
        {x.status === 'DRAFT' && edit && (
          <button
            onClick={() =>
              run(() => purchasesApi.status('bills', r.id, 'PENDING_APPROVAL'), 'Bill submitted')
            }
          >
            Submit
          </button>
        )}
        {x.status === 'PENDING_APPROVAL' && approve && (
          <button
            onClick={() =>
              run(() => purchasesApi.status('bills', r.id, 'APPROVED'), 'Bill approved')
            }
          >
            Approve
          </button>
        )}
      </>
    );
  if (v === 'supplier-payments' && edit && !x.reversedAt)
    return (
      <button onClick={() => run(() => purchasesApi.reversePayment(r.id), 'Payment reversed')}>
        Reverse
      </button>
    );
  if (v === 'expenses' && approve)
    return (
      <>
        {x.status === 'PENDING' && (
          <>
            <button
              onClick={() =>
                run(() => purchasesApi.status('expenses', r.id, 'APPROVED'), 'Expense approved')
              }
            >
              Approve
            </button>
            <button
              onClick={() =>
                run(() => purchasesApi.status('expenses', r.id, 'REJECTED'), 'Expense rejected')
              }
            >
              Reject
            </button>
          </>
        )}
        {x.status === 'APPROVED' && edit && (
          <button
            onClick={() =>
              run(() => purchasesApi.status('expenses', r.id, 'VOID'), 'Expense voided')
            }
          >
            Void
          </button>
        )}
      </>
    );
  return null;
}
function PurchaseModal({
  open,
  view,
  selected,
  suppliers,
  requests,
  bills,
  accounts,
  busy,
  error,
  close,
  submit,
}: {
  open: boolean;
  view: PurchaseView;
  selected: Supplier | null;
  suppliers: Supplier[];
  requests: PurchaseRow[];
  bills: PurchaseRow[];
  accounts: BankAccount[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (d: Record<string, unknown>) => void;
}) {
  const line = ['purchase-requests', 'purchase-orders', 'bills'].includes(view),
    today = new Date().toISOString().slice(0, 10);
  return (
    <Modal
      open={open}
      onClose={close}
      title={selected ? `Edit ${selected.displayName}` : action(view)}
      footer={
        <>
          <button className="button button--secondary" onClick={close}>
            Cancel
          </button>
          <button className="button" disabled={busy} form="purchase-form" type="submit">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="purchase-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            g = (n: string) => String(f.get(n) || ''),
            optional = (n: string) => g(n) || undefined;
          if (view === 'suppliers')
            submit({
              displayName: g('displayName'),
              companyName: optional('companyName'),
              email: optional('email'),
              phone: optional('phone'),
              paymentTerms: optional('paymentTerms'),
              bankDetails: optional('bankDetails'),
            });
          else if (view === 'purchase-requests')
            submit({
              number: g('number'),
              requestedBy: g('requestedBy'),
              requiredDate: g('date'),
              currency: 'NGN',
              items: [
                {
                  description: g('description'),
                  quantity: Number(g('quantity')),
                  unitPrice: Number(g('unitPrice')),
                  taxRate: Number(g('taxRate')),
                },
              ],
              notes: optional('notes'),
            });
          else if (view === 'purchase-orders' || view === 'bills')
            submit({
              supplierId: g('supplierId'),
              ...(view === 'purchase-orders' ? { requestId: optional('requestId') } : {}),
              number: g('number'),
              [view === 'purchase-orders' ? 'orderDate' : 'issueDate']: g('startDate'),
              [view === 'purchase-orders' ? 'deliveryDate' : 'dueDate']: g('date'),
              currency: 'NGN',
              items: [
                {
                  description: g('description'),
                  quantity: Number(g('quantity')),
                  unitPrice: Number(g('unitPrice')),
                  taxRate: Number(g('taxRate')),
                },
              ],
              notes: optional('notes'),
            });
          else if (view === 'expenses')
            submit({
              supplierId: optional('supplierId'),
              bankAccountId: optional('bankAccountId'),
              reference: g('reference'),
              expenseDate: g('date'),
              merchant: g('merchant'),
              category: g('category'),
              amount: Number(g('amount')),
              taxAmount: Number(g('taxAmount')),
              currency: 'NGN',
              notes: optional('notes'),
            });
          else
            submit({
              billId: g('billId'),
              bankAccountId: optional('bankAccountId'),
              reference: g('reference'),
              paymentDate: g('date'),
              amount: Number(g('amount')),
              method: g('method'),
              notes: optional('notes'),
            });
        }}
      >
        {view === 'suppliers' ? (
          <>
            <label className="full">
              Supplier name
              <input name="displayName" required defaultValue={selected?.displayName} />
            </label>
            <label>
              Company
              <input name="companyName" defaultValue={selected?.companyName} />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={selected?.email} />
            </label>
            <label>
              Phone
              <input name="phone" defaultValue={selected?.phone} />
            </label>
            <label>
              Payment terms
              <input
                name="paymentTerms"
                placeholder="Net 30"
                defaultValue={selected?.paymentTerms}
              />
            </label>
            <label className="full">
              Bank details
              <textarea name="bankDetails" />
            </label>
          </>
        ) : (
          <>
            {view === 'purchase-requests' ? (
              <>
                <label>
                  Request number
                  <input name="number" required />
                </label>
                <label>
                  Requested by
                  <input name="requestedBy" required />
                </label>
              </>
            ) : view === 'expenses' ? (
              <>
                <label>
                  Reference
                  <input name="reference" required />
                </label>
                <label>
                  Merchant
                  <input name="merchant" required />
                </label>
                <label>
                  Category
                  <input name="category" required />
                </label>
                <label>
                  Supplier (optional)
                  <select name="supplierId" defaultValue="">
                    <option value="">None</option>
                    {suppliers.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : view === 'supplier-payments' || view === 'payables' ? (
              <>
                <label className="full">
                  Bill
                  <select name="billId" required defaultValue="">
                    <option value="" disabled>
                      Select bill
                    </option>
                    {bills.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.number} — {x.supplier?.displayName} (
                        {money(String(Number(x.total) - Number(x.paidAmount)), x.currency)})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reference
                  <input name="reference" required />
                </label>
                <label>
                  Method
                  <select name="method">
                    <option>Bank transfer</option>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Cheque</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="full">
                  Supplier
                  <select name="supplierId" required defaultValue="">
                    <option value="" disabled>
                      Select supplier
                    </option>
                    {suppliers.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                {view === 'purchase-orders' && (
                  <label className="full">
                    Approved request (optional)
                    <select name="requestId" defaultValue="">
                      <option value="">None</option>
                      {requests.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.number} — {x.requestedBy}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Number
                  <input name="number" required />
                </label>
              </>
            )}
            {(view === 'purchase-orders' || view === 'bills') && (
              <label>
                {view === 'bills' ? 'Issue' : 'Order'} date
                <input name="startDate" type="date" defaultValue={today} required />
              </label>
            )}
            <label>
              {view === 'purchase-requests'
                ? 'Required'
                : view === 'purchase-orders'
                  ? 'Delivery'
                  : view === 'bills'
                    ? 'Due'
                    : view === 'expenses'
                      ? 'Expense'
                      : 'Payment'}{' '}
              date
              <input name="date" type="date" defaultValue={today} required />
            </label>
            {line && (
              <>
                <label className="full">
                  Description
                  <input name="description" required />
                </label>
                <label>
                  Quantity
                  <input name="quantity" type="number" min=".0001" step=".0001" required />
                </label>
                <label>
                  Unit price
                  <input name="unitPrice" type="number" min="0" step=".01" required />
                </label>
                <label>
                  Tax %<input name="taxRate" type="number" min="0" step=".01" defaultValue="0" />
                </label>
              </>
            )}
            {(view === 'expenses' || view === 'supplier-payments' || view === 'payables') && (
              <>
                <label>
                  Amount
                  <input name="amount" type="number" min=".01" step=".01" required />
                </label>
                {view === 'expenses' && (
                  <label>
                    Tax amount
                    <input name="taxAmount" type="number" min="0" step=".01" defaultValue="0" />
                  </label>
                )}
                <label className="full">
                  Pay from account (optional)
                  <select name="bankAccountId" defaultValue="">
                    <option value="">Do not post to banking</option>
                    {accounts.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} — {money(x.currentBalance, x.currency)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="full">
              Notes
              <textarea name="notes" />
            </label>
          </>
        )}
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

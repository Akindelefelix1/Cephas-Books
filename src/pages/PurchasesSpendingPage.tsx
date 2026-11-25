import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Plus, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { bankingApi, type BankAccount } from '@/services/banking';
import {
  purchasesApi,
  type PurchaseRow,
  type PurchaseSummary,
  type PurchaseView,
  type Supplier,
  type GoodsReceivedOptions,
  type PurchaseProjectOption,
} from '@/services/purchases';
import { getOfflineQueue, isOfflineEnabledForCurrentAccount, isWorkingOffline } from '@/services/offline';
import { operationsApi } from '@/services/operations';
import { confirmAction, downloadText } from '@/utils/actions';
import { getDefaultCurrency } from '@/utils/currency';
import { PaymentTermsField } from '@/components/ui/PaymentTermsField';
import { addDaysToDateInput, duePeriodForDate, dueTimingLabel, parsePaymentTermDays, todayDateInput } from '@/utils/payment-terms';
const money = (v?: string, c = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: c }).format(Number(v ?? 0));
const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-NG') : '—');
function applyQueuedSupplierTerms(suppliers: Supplier[]): Supplier[] {
  const queuedTerms = new Map<string, number>();
  for (const entry of getOfflineQueue()) {
    const id = /^\/purchases\/suppliers\/([^/?]+)$/.exec(entry.path)?.[1];
    if (!id || entry.method !== 'PATCH' || !entry.body) continue;
    try {
      const body = JSON.parse(entry.body) as Record<string, unknown>;
      const days = Number(body.paymentTermsDays);
      if (Number.isInteger(days) && days >= 0 && days <= 3650) queuedTerms.set(id, days);
    } catch { /* keep the cached supplier values if a queue entry is malformed */ }
  }
  return suppliers.map((supplier) => {
    const days = queuedTerms.get(supplier.id);
    return days === undefined ? supplier : {
      ...supplier,
      paymentTermsDays: days,
      paymentTerms: days === 0 ? 'Due on receipt' : `Net ${days}`,
    };
  });
}
const titles: Record<PurchaseView, string> = {
  suppliers: 'Suppliers',
  'purchase-requests': 'Purchase requests',
  'purchase-orders': 'Purchase orders',
  'goods-received-notes': 'Goods received notes',
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
    [projects, setProjects] = useState<PurchaseProjectOption[]>([]),
    [summary, setSummary] = useState<PurchaseSummary | null>(null),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [duePeriod, setDuePeriod] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState<Supplier | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [orders, setOrders] = useState<PurchaseRow[]>([]),
    [activeOrder, setActiveOrder] = useState<PurchaseRow | null>(null),
    [grnOptions, setGrnOptions] = useState<GoodsReceivedOptions | null>(null),
    [grnOpen, setGrnOpen] = useState(false),
    [offlineMode, setOfflineMode] = useState(isWorkingOffline());
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, sup, bill, req, acc, data, orderRows] = await Promise.all([
        purchasesApi.summary(),
        purchasesApi.suppliers(),
        purchasesApi.list('bills'),
        purchasesApi.list('purchase-requests', '', 'APPROVED'),
        canEdit ? bankingApi.accounts() : Promise.resolve([]),
        view === 'suppliers'
          ? purchasesApi.suppliers(search)
          : view === 'goods-received-notes'
            ? purchasesApi.list(view, search, status)
            : purchasesApi.list(view, search, status),
        view === 'goods-received-notes'
          ? purchasesApi.list('purchase-orders')
          : Promise.resolve([]),
      ]);
      const suppliersWithQueuedTerms = applyQueuedSupplierTerms(sup);
      const visibleSupplierRows = view === 'suppliers'
        ? applyQueuedSupplierTerms(data as Supplier[])
        : data as (PurchaseRow | Supplier)[];
      setSummary(sum);
      setSuppliers(suppliersWithQueuedTerms.filter((x) => x.isActive));
      setBills(
        bill.filter(
          (x) =>
            ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'].includes(x.status ?? '') &&
            Number(x.total) - Number(x.paidAmount) > 0,
        ),
      );
      setRequests(req);
      setAccounts(acc);
      setRows(visibleSupplierRows);
      setOrders(orderRows);
      setProjects(view === 'expenses' ? await purchasesApi.projects().catch(() => []) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load purchases');
    } finally {
      setLoading(false);
    }
  }, [view, search, status, canEdit]);
  useEffect(() => {
    const refresh = () => setOfflineMode(isWorkingOffline());
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('cephas:sync-state', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('cephas:sync-state', refresh);
    };
  }, []);
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
      const result = await fn();
      setModal(false);
      setSelected(null);
      setGrnOpen(false);
      setActiveOrder(null);
      const queuedOffline = Boolean(
        result && typeof result === 'object' && 'queuedOffline' in result && result.queuedOffline === true,
      );
      confirmAction(queuedOffline ? `${msg} and queued for sync` : msg);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const openGrn = async (order?: PurchaseRow) => {
    setError('');
    try {
      const [options, orderRows] = await Promise.all([
        purchasesApi.grnOptions(),
        order ? Promise.resolve(orders) : purchasesApi.list('purchase-orders'),
      ]);
      setGrnOptions(options);
      setOrders(orderRows);
      setActiveOrder(order ?? null);
      setGrnOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load receipt options');
    }
  };
  const saveGrn = async (payload: Record<string, unknown>) => {
    const saved = await purchasesApi.createGrn(payload);
    // Refresh stock reads invalidated by the GRN for opted-in offline users.
    // This is best-effort and must not delay or undo a committed receipt.
    if (isOfflineEnabledForCurrentAccount())
      void Promise.allSettled([
        operationsApi.summary(),
        operationsApi.products(),
        operationsApi.branchInventory(),
        operationsApi.movements(),
      ]);
    return saved;
  };
  const cols = columns(view);
  const payableRows = view === 'payables' ? rows as PurchaseRow[] : [];
  const duePeriodCounts = ['OVERDUE', 'DUE_7', 'DUE_8_30', 'DUE_30_PLUS'].map((period) => ({
    period,
    count: payableRows.filter((bill) => duePeriodForDate(bill.dueDate ?? '') === period && Number(bill.total ?? 0) - Number(bill.paidAmount ?? 0) > 0).length,
  }));
  const visibleRows = view === 'payables' && duePeriod
    ? rows.filter((row) => duePeriodForDate((row as PurchaseRow).dueDate ?? '') === duePeriod)
    : rows;
  const showActions = canEdit || canApprove || view === 'goods-received-notes';
  const exportCsv = () =>
    downloadText(
      `${view}.csv`,
      [
        cols.join(','),
        ...visibleRows.map((r) =>
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
            <button
              className="button"
              onClick={() => (view === 'goods-received-notes' ? void openGrn() : setModal(true))}
              disabled={view === 'goods-received-notes' && offlineMode}
              title={
                view === 'goods-received-notes' && offlineMode
                  ? 'Connect to the internet to validate ordered quantities and update inventory.'
                  : undefined
              }
            >
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
      {view === 'payables' && <StatsGrid stats={[
        { label: 'Overdue bills', value: String(duePeriodCounts[0].count), tone: 'warning' },
        { label: 'Due within 7 days', value: String(duePeriodCounts[1].count) },
        { label: 'Due in 8–30 days', value: String(duePeriodCounts[2].count) },
        { label: 'Due after 30 days', value: String(duePeriodCounts[3].count) },
      ]} />}
      <section className="panel register-panel">
        {view === 'goods-received-notes' && offlineMode && (
          <p className="banking-alert" role="status">
            You can review GRNs saved on this device while offline. Recording a new GRN requires a
            live connection so outstanding quantities and stock are checked atomically.
          </p>
        )}
        <div className="banking-filters">
          <input
            aria-label="Search"
            placeholder={`Search ${titles[view].toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!['suppliers', 'supplier-payments', 'payables', 'goods-received-notes'].includes(
            view,
          ) && (
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses(view).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
          {view === 'payables' && (
            <select aria-label="Filter payables by due period" value={duePeriod} onChange={(event) => setDuePeriod(event.target.value)}>
              <option value="">All due periods</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DUE_7">Due within 7 days</option>
              <option value="DUE_8_30">Due in 8–30 days</option>
              <option value="DUE_30_PLUS">Due after 30 days</option>
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
          <LoadingState label="Loading purchases and spending…" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {cols.map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {showActions && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id}>
                    {values(view, r).map((x, i) => (
                      <td key={i}>{x}</td>
                    ))}
                    {showActions && (
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
                            () =>
                              offlineMode
                                ? setError('Connect to the internet before recording a receipt.')
                                : void openGrn(r as PurchaseRow),
                            offlineMode,
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td className="table-empty" colSpan={cols.length + (showActions ? 1 : 0)}>
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
        key={`${view}-${modal ? 'open' : 'closed'}-${selected?.id || 'new'}`}
        open={modal}
        view={view}
        selected={selected}
        suppliers={suppliers}
        projects={projects}
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
      <GoodsReceivedModal
        open={grnOpen}
        initialOrder={activeOrder}
        orders={orders}
        options={grnOptions}
        busy={busy}
        error={error}
        offline={offlineMode}
        close={() => {
          setGrnOpen(false);
          setActiveOrder(null);
        }}
        submit={(payload) =>
          void run(() => saveGrn(payload), 'Goods received note saved and accepted stock posted')
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
function supplierBankDetails(value?: string) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return { notes: value };
  }
}
function action(v: PurchaseView) {
  return v === 'suppliers'
    ? 'Add supplier'
    : v === 'purchase-requests'
      ? 'New request'
      : v === 'purchase-orders'
        ? 'New purchase order'
        : v === 'goods-received-notes'
          ? 'Record goods received'
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
  if (v === 'goods-received-notes')
    return [
      'GRN',
      'Purchase order',
      'Supplier',
      'Received',
      'Stock location',
      'Accepted / Exceptions',
      'Recorded by',
    ];
  if (v === 'bills' || v === 'payables')
    return ['Bill', 'Supplier', 'Due', 'Payment timing', 'Total', 'Outstanding', 'Status'];
  if (v === 'supplier-payments')
    return ['Reference', 'Supplier', 'Bill', 'Date', 'Amount', 'Method'];
  return ['Reference', 'Merchant', 'Category', 'Project / receipt type', 'Date', 'Amount', 'Status'];
}
function values(v: PurchaseView, r: PurchaseRow | Supplier) {
  if (v === 'suppliers') {
    const x = r as Supplier;
    return [
      x.displayName,
      x.email || '—',
      x.phone || '—',
      x.paymentTermsDays === 0 ? 'Due on receipt' : x.paymentTerms || `Net ${x.paymentTermsDays ?? 30}`,
      x.isActive ? 'Active' : 'Archived',
    ];
  }
  const x = r as PurchaseRow;
  if (v === 'goods-received-notes') {
    const items = (x.items ?? []) as unknown as Array<Record<string, unknown>>;
    const accepted = items.reduce((sum, line) => sum + Number(line.acceptedQuantity ?? 0), 0);
    const exceptions = items.reduce(
      (sum, line) => sum + Number(line.damagedQuantity ?? 0) + Number(line.rejectedQuantity ?? 0),
      0,
    );
    const recorder = x.recordedBy;
    return [
      x.reference ?? x.number ?? '',
      x.purchaseOrder?.number ?? '',
      x.supplier?.displayName ?? '',
      date(x.receivedDate),
      x.warehouse?.name ?? '',
      `${accepted} accepted / ${exceptions} damaged or rejected`,
      recorder
        ? `${recorder.firstName ?? ''} ${recorder.lastName ?? ''}`.trim() || recorder.email
        : '—',
    ];
  }
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
      dueTimingLabel(x.dueDate ?? ''),
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
    x.project ? `${x.project.code} · ${x.project.name}` : 'General business',
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
  onReceive: () => void,
  offline: boolean,
) {
  const x = r as PurchaseRow;
  if (v === 'goods-received-notes')
    return (
      <>
        <button onClick={() => exportGrn(x, true)}>
          <Printer size={15} /> Print
        </button>
        <button onClick={() => exportGrn(x)}>
          <Download size={15} /> Download PDF
        </button>
      </>
    );
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
        {['ISSUED', 'PARTIALLY_RECEIVED', 'BILLED'].includes(x.status ?? '') &&
          hasOrderOutstanding(x) && (
            <button
              onClick={onReceive}
              disabled={offline}
              title={offline ? 'Connect to the internet before recording a receipt.' : undefined}
            >
              Record GRN
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

function hasOrderOutstanding(order: PurchaseRow) {
  const lines = (order.items ?? []) as unknown as Array<Record<string, unknown>>;
  return lines.some((line, index) => {
    const received = (order.goodsReceivedNotes ?? []).reduce(
      (total, note) =>
        total +
        (Array.isArray(note.items) ? note.items : []).reduce((lineTotal, raw) => {
          const item = raw as Record<string, unknown>;
          return (
            lineTotal +
            (Number(item.orderLineIndex) === index ? Number(item.receivedQuantity ?? 0) : 0)
          );
        }, 0),
      0,
    );
    return Number(line.quantity ?? 0) - received > 0.00001;
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
function grnHtml(row: PurchaseRow) {
  const lines = (row.items ?? []) as unknown as Array<Record<string, unknown>>;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(row.reference)}</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#18212f}h1{margin-bottom:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:24px 0}table{border-collapse:collapse;width:100%}th,td{padding:9px;border:1px solid #ccd3dc;text-align:left}th{background:#f2f5f8}.notes{margin-top:24px;white-space:pre-wrap}@media print{body{margin:12mm}}</style></head><body><h1>Goods Received Note</h1><p>${escapeHtml(row.reference)}</p><div class="meta"><div><b>Supplier</b><br>${escapeHtml(row.supplier?.displayName)}</div><div><b>Purchase order</b><br>${escapeHtml(row.purchaseOrder?.number)}</div><div><b>Date received</b><br>${escapeHtml(date(row.receivedDate))}</div><div><b>Supplier reference</b><br>${escapeHtml(row.supplierReference || '—')}</div><div><b>Stock location</b><br>${escapeHtml(row.warehouse?.name)}</div><div><b>Recorded by</b><br>${escapeHtml(row.recordedBy?.firstName ? `${row.recordedBy.firstName} ${row.recordedBy.lastName ?? ''}` : row.recordedBy?.email)}</div></div><table><thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Accepted</th><th>Damaged</th><th>Rejected</th><th>Outstanding</th><th>Notes</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escapeHtml(line.itemName)}<br>${escapeHtml(line.itemDescription)}</td><td>${escapeHtml(line.orderedQuantity)}</td><td>${escapeHtml(line.receivedQuantity)}</td><td>${escapeHtml(line.acceptedQuantity)}</td><td>${escapeHtml(line.damagedQuantity)}</td><td>${escapeHtml(line.rejectedQuantity)}</td><td>${escapeHtml(line.outstandingQuantity)}</td><td>${escapeHtml(line.notes)}</td></tr>`).join('')}</tbody></table><div class="notes">${escapeHtml(row.notes)}</div></body></html>`;
}
function exportGrn(row: PurchaseRow, print = false) {
  const html = grnHtml(row);
  if (print) {
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  } else {
    downloadGrnPdf(row);
  }
}
function downloadGrnPdf(row: PurchaseRow) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 12;
  let y = 16;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Goods Received Note', left, y);
  pdf.setFontSize(10);
  pdf.text(String(row.reference ?? row.number ?? ''), pageWidth - left, y, { align: 'right' });
  y += 9;
  pdf.setFont('helvetica', 'normal');
  const recordedBy = row.recordedBy
    ? `${row.recordedBy.firstName ?? ''} ${row.recordedBy.lastName ?? ''}`.trim() ||
      row.recordedBy.email
    : '—';
  const metadata: string[][] = [
    [
      `Supplier: ${row.supplier?.displayName ?? ''}`,
      `Purchase order: ${row.purchaseOrder?.number ?? ''}`,
    ],
    [`Received: ${date(row.receivedDate)}`, `Supplier reference: ${row.supplierReference ?? '—'}`],
    [`Stock location: ${row.warehouse?.name ?? ''}`, `Recorded by: ${recordedBy}`],
  ];
  for (const [first, second] of metadata) {
    pdf.text(first, left, y);
    pdf.text(second, pageWidth / 2, y);
    y += 6;
  }
  y += 3;
  const columns = [
    { title: 'Item / details', x: left, width: 62 },
    { title: 'Ordered', x: 76, width: 16 },
    { title: 'Received', x: 93, width: 17 },
    { title: 'Accepted', x: 111, width: 17 },
    { title: 'Damaged', x: 129, width: 17 },
    { title: 'Rejected', x: 147, width: 17 },
    { title: 'Outstanding', x: 165, width: 22 },
    { title: 'Notes', x: 188, width: pageWidth - 200 },
  ];
  const drawHeader = () => {
    pdf.setFillColor(239, 243, 247);
    pdf.rect(left, y - 4, pageWidth - left * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    for (const column of columns) pdf.text(column.title, column.x, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
  };
  drawHeader();
  pdf.setFontSize(8);
  const lines = (row.items ?? []) as unknown as Array<Record<string, unknown>>;
  for (const line of lines) {
    const itemText = pdf.splitTextToSize(
      `${String(line.itemName ?? '')}\n${String(line.itemDescription ?? '')}`,
      60,
    ) as string[];
    const notesText = pdf.splitTextToSize(String(line.notes ?? '—'), 20) as string[];
    const rowHeight = Math.max(itemText.length, notesText.length, 1) * 4 + 3;
    if (y + rowHeight > pageHeight - 18) {
      pdf.addPage();
      y = 16;
      drawHeader();
    }
    pdf.text(itemText, columns[0].x, y);
    const values = [
      line.orderedQuantity,
      line.receivedQuantity,
      line.acceptedQuantity,
      line.damagedQuantity,
      line.rejectedQuantity,
      line.outstandingQuantity,
    ];
    values.forEach((value, index) => pdf.text(String(value ?? 0), columns[index + 1].x, y));
    pdf.text(notesText, columns[7].x, y);
    y += rowHeight;
    pdf.setDrawColor(215, 221, 228);
    pdf.line(left, y - 1, pageWidth - left, y - 1);
  }
  y += 5;
  if (row.notes && y + 14 > pageHeight - 12) {
    pdf.addPage();
    y = 16;
  }
  if (row.notes) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Receiving notes', left, y);
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(row.notes, pageWidth - left * 2) as string[];
    pdf.text(noteLines, left, y + 5);
  }
  pdf.save(`${String(row.reference ?? 'goods-received-note').replace(/[^a-z0-9-_]/gi, '_')}.pdf`);
}
type ReceiptInputs = {
  received: string;
  accepted: string;
  damaged: string;
  rejected: string;
  productId: string;
  notes: string;
};
function GoodsReceivedModal({
  open,
  initialOrder,
  orders,
  options,
  busy,
  error,
  offline,
  close,
  submit,
}: {
  open: boolean;
  initialOrder: PurchaseRow | null;
  orders: PurchaseRow[];
  options: GoodsReceivedOptions | null;
  busy: boolean;
  error: string;
  offline: boolean;
  close: () => void;
  submit: (data: Record<string, unknown>) => void;
}) {
  const availableOrders = (
    initialOrder
      ? [initialOrder, ...orders.filter((order) => order.id !== initialOrder.id)]
      : orders
  ).filter(
    (order) =>
      ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BILLED'].includes(order.status ?? '') &&
      (order.id === initialOrder?.id || hasOrderOutstanding(order)),
  );
  const [orderId, setOrderId] = useState(initialOrder?.id ?? availableOrders[0]?.id ?? '');
  const [quantities, setQuantities] = useState<Record<number, ReceiptInputs>>({});
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    setOrderId(initialOrder?.id ?? availableOrders[0]?.id ?? '');
    setQuantities({});
    setLocalError('');
  }, [initialOrder?.id, open]);
  const order = availableOrders.find((candidate) => candidate.id === orderId);
  const orderLines = (order?.items ?? []) as unknown as Array<Record<string, unknown>>;
  const priorReceived = (lineIndex: number) =>
    (order?.goodsReceivedNotes ?? []).reduce(
      (sum, grn) =>
        sum +
        (Array.isArray(grn.items) ? grn.items : []).reduce((lineSum, raw) => {
          const line = raw as Record<string, unknown>;
          return (
            lineSum +
            (Number(line.orderLineIndex) === lineIndex ? Number(line.receivedQuantity ?? 0) : 0)
          );
        }, 0),
      0,
    );
  const remaining = (lineIndex: number) =>
    Math.max(0, Number(orderLines[lineIndex]?.quantity ?? 0) - priorReceived(lineIndex));
  const hasRemaining = orderLines.some((_, index) => remaining(index) > 0.00001);
  const setLine = (index: number, key: keyof ReceiptInputs, value: string) => {
    setQuantities((current) => {
      const previous = current[index] ?? {
        received: '0',
        accepted: '0',
        damaged: '0',
        rejected: '0',
        productId: '',
        notes: '',
      };
      const next = { ...previous, [key]: value };
      if (
        key === 'received' &&
        (previous.accepted === previous.received || previous.accepted === '0')
      )
        next.accepted = value;
      return { ...current, [index]: next };
    });
  };
  const warehouseChoices = (options?.warehouses ?? []).filter(
    (warehouse) => !order?.branchId || warehouse.branchId === order.branchId,
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Record goods received"
      footer={
        <>
          <button className="button button--secondary" onClick={close}>
            Cancel
          </button>
          <button
            className="button"
            form="grn-form"
            type="submit"
            disabled={busy || offline || !order || !hasRemaining || !warehouseChoices.length}
          >
            {busy ? 'Saving…' : 'Save GRN & update stock'}
          </button>
        </>
      }
    >
      <form
        id="grn-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setLocalError('');
          if (!order) {
            setLocalError('Select a purchase order.');
            return;
          }
          const form = new FormData(event.currentTarget);
          const items = orderLines
            .map((_, orderLineIndex) => {
              const value = quantities[orderLineIndex] ?? {
                received: '0',
                accepted: '0',
                damaged: '0',
                rejected: '0',
                productId: '',
                notes: '',
              };
              return {
                orderLineIndex,
                productId:
                  value.productId ||
                  (typeof orderLines[orderLineIndex]?.productId === 'string'
                    ? String(orderLines[orderLineIndex].productId)
                    : undefined),
                receivedQuantity: Number(value.received),
                acceptedQuantity: Number(value.accepted),
                damagedQuantity: Number(value.damaged),
                rejectedQuantity: Number(value.rejected),
                notes: value.notes || undefined,
              };
            })
            .filter((line) => line.receivedQuantity > 0);
          if (!items.length) {
            setLocalError('Enter at least one received quantity.');
            return;
          }
          if (items.some((line) => line.acceptedQuantity > 0 && !line.productId)) {
            setLocalError('Choose an inventory product for each accepted line.');
            return;
          }
          submit({
            purchaseOrderId: order.id,
            warehouseId: String(form.get('warehouseId') ?? ''),
            reference: String(form.get('reference') ?? '').trim(),
            supplierReference: String(form.get('supplierReference') ?? '').trim() || undefined,
            receivedDate: String(form.get('receivedDate') ?? ''),
            items,
            notes: String(form.get('notes') ?? '').trim() || undefined,
          });
        }}
      >
        {initialOrder ? (
          <label>
            Purchase order
            <input
              value={`${initialOrder.number} — ${initialOrder.supplier?.displayName ?? ''}`}
              readOnly
            />
          </label>
        ) : (
          <label className="full">
            Purchase order
            <select
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setQuantities({});
              }}
              required
            >
              <option value="">Select an issued order</option>
              {availableOrders.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.number} — {candidate.supplier?.displayName ?? 'Supplier'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Supplier
          <input value={order?.supplier?.displayName ?? ''} readOnly />
        </label>
        <label>
          GRN reference
          <input name="reference" required maxLength={80} placeholder="GRN-00001" />
        </label>
        <label>
          Supplier delivery reference
          <input
            name="supplierReference"
            maxLength={120}
            placeholder="Delivery note / docket number"
          />
        </label>
        <label>
          Delivery date
          <input name="receivedDate" type="date" defaultValue={today} required />
        </label>
        <label>
          Receiving stock location
          <select
            name="warehouseId"
            required
            defaultValue={
              warehouseChoices.find((warehouse) => warehouse.isDefault)?.id ??
              warehouseChoices[0]?.id ??
              ''
            }
          >
            <option value="">Select location</option>
            {warehouseChoices.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>
        </label>
        <div className="grn-lines full">
          <h3>Delivery items</h3>
          {!availableOrders.length && !initialOrder && (
            <p>No issued purchase orders have outstanding quantities to receive.</p>
          )}
          {!!order && !hasRemaining && (
            <p>This purchase order has no outstanding quantities remaining.</p>
          )}
          {!orderLines.length && <p>Select a purchase order with item lines.</p>}
          {orderLines.map((line, index) => {
            const outstanding = remaining(index);
            const current = quantities[index] ?? {
              received: '0',
              accepted: '0',
              damaged: '0',
              rejected: '0',
              productId: '',
              notes: '',
            };
            const mappedProductId = typeof line.productId === 'string' ? line.productId : '';
            return (
              <fieldset className="grn-line" key={index} disabled={outstanding <= 0}>
                <legend>{String(line.name ?? `Item ${index + 1}`)}</legend>
                <p>
                  {String(line.description ?? '')} · Ordered {Number(line.quantity ?? 0)} ·
                  Previously received {priorReceived(index)} · Outstanding {outstanding}
                </p>
                {outstanding > 0 && (
                  <div className="form-grid form-grid--nested">
                    <label>
                      Received
                      <input
                        type="number"
                        min="0"
                        max={outstanding}
                        step=".0001"
                        value={current.received}
                        onChange={(event) => setLine(index, 'received', event.target.value)}
                      />
                    </label>
                    <label>
                      Accepted
                      <input
                        type="number"
                        min="0"
                        max={current.received}
                        step=".0001"
                        value={current.accepted}
                        onChange={(event) => setLine(index, 'accepted', event.target.value)}
                      />
                    </label>
                    <label>
                      Damaged
                      <input
                        type="number"
                        min="0"
                        max={current.received}
                        step=".0001"
                        value={current.damaged}
                        onChange={(event) => setLine(index, 'damaged', event.target.value)}
                      />
                    </label>
                    <label>
                      Rejected
                      <input
                        type="number"
                        min="0"
                        max={current.received}
                        step=".0001"
                        value={current.rejected}
                        onChange={(event) => setLine(index, 'rejected', event.target.value)}
                      />
                    </label>
                    <label className="full">
                      Inventory product (required for accepted units)
                      <select
                        value={current.productId || mappedProductId}
                        disabled={Boolean(mappedProductId)}
                        onChange={(event) => setLine(index, 'productId', event.target.value)}
                      >
                        <option value="">Select product</option>
                        {(options?.products ?? []).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} — {product.name} ({product.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      Item condition / exception notes
                      <input
                        value={current.notes}
                        onChange={(event) => setLine(index, 'notes', event.target.value)}
                        placeholder="Damage, defect or rejection details"
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
        <label className="full">
          Receiving notes
          <textarea name="notes" rows={3} />
        </label>
        {(offline || error || localError) && (
          <p className="form-error full">
            {offline
              ? 'Connect to the internet before recording a GRN. Stock is updated only after the server validates current balances.'
              : localError || error}
          </p>
        )}
      </form>
    </Modal>
  );
}
function PurchaseModal({
  open,
  view,
  selected,
  suppliers,
  projects,
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
  projects: PurchaseProjectOption[];
  requests: PurchaseRow[];
  bills: PurchaseRow[];
  accounts: BankAccount[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (d: Record<string, unknown>) => void;
}) {
  const line = ['purchase-requests', 'purchase-orders', 'bills'].includes(view),
    today = todayDateInput();
  const bank = supplierBankDetails(selected?.bankDetails);
  const [billSupplierId, setBillSupplierId] = useState('');
  const [billIssueDate, setBillIssueDate] = useState(today);
  const [lineItems, setLineItems] = useState([
    { name: '', description: '', quantity: '', unitPrice: '' },
  ]);
  const updateLine = (
    index: number,
    field: 'name' | 'description' | 'quantity' | 'unitPrice',
    value: string,
  ) =>
    setLineItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  useEffect(() => {
    if (!open) return;
    setBillSupplierId('');
    setBillIssueDate(todayDateInput());
  }, [open, view, selected?.id]);
  const selectedBillSupplier = suppliers.find((supplier) => supplier.id === billSupplierId);
  const billTermsDays = selectedBillSupplier?.paymentTermsDays ?? parsePaymentTermDays(selectedBillSupplier?.paymentTerms);
  const billDuePreview = addDaysToDateInput(billIssueDate, billTermsDays);
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
              paymentTermsDays: Number(g('paymentTermsDays') || 30),
              bankDetails: JSON.stringify({
                bankName: optional('bankName'),
                accountName: optional('accountName'),
                accountNumber: optional('accountNumber'),
                branchName: optional('branchName'),
                notes: optional('bankNotes'),
              }),
            });
          else if (view === 'purchase-requests')
            submit({
              number: g('number'),
              requestedBy: g('requestedBy'),
              requiredDate: g('date'),
              currency: getDefaultCurrency(),
              items: lineItems.map((item) => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                taxRate: Number(g('taxRate')),
              })),
              notes: optional('notes'),
            });
          else if (view === 'purchase-orders' || view === 'bills')
            submit({
              supplierId: g('supplierId'),
              ...(view === 'purchase-orders' ? { requestId: optional('requestId') } : {}),
              number: g('number'),
              [view === 'purchase-orders' ? 'orderDate' : 'issueDate']: g('startDate'),
              [view === 'purchase-orders' ? 'deliveryDate' : 'dueDate']: g('date'),
              currency: getDefaultCurrency(),
              items: lineItems.map((item) => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                taxRate: Number(g('taxRate')),
              })),
              notes: optional('notes'),
            });
          else if (view === 'expenses')
            submit({
              supplierId: optional('supplierId'),
              projectId: optional('projectId'),
              bankAccountId: optional('bankAccountId'),
              reference: g('reference'),
              expenseDate: g('date'),
              merchant: g('merchant'),
              category: g('category'),
              amount: Number(g('amount')),
              taxAmount: Number(g('taxAmount')),
              currency: getDefaultCurrency(),
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
            <PaymentTermsField
              key={selected?.id ?? 'new-supplier'}
              name="paymentTermsDays"
              value={selected?.paymentTermsDays ?? 30}
              title="Supplier payment terms"
            />
            <fieldset className="form-fieldset full">
              <legend>
                Bank details <small>Optional</small>
              </legend>
              <div className="form-grid form-grid--nested">
                <label>
                  Bank name
                  <input name="bankName" defaultValue={bank.bankName} />
                </label>
                <label>
                  Account name
                  <input name="accountName" defaultValue={bank.accountName} />
                </label>
                <label>
                  Account number
                  <input
                    name="accountNumber"
                    inputMode="numeric"
                    defaultValue={bank.accountNumber}
                  />
                </label>
                <label>
                  Branch
                  <input name="branchName" defaultValue={bank.branchName} />
                </label>
                <label className="full">
                  Additional notes
                  <textarea name="bankNotes" rows={2} defaultValue={bank.notes} />
                </label>
              </div>
            </fieldset>
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
                <label className="full">
                  Project (optional; project costs are tracked separately)
                  <select name="projectId" defaultValue=""><option value="">General business expense</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select>
                  <small className="field-hint">Project expenses use your organization’s base currency. Variance cost excludes recoverable tax.</small>
                </label>
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
                  <select
                    name="supplierId"
                    required
                    value={view === 'bills' ? billSupplierId : undefined}
                    onChange={view === 'bills' ? (event) => setBillSupplierId(event.target.value) : undefined}
                  >
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
                <input
                  name="startDate"
                  type="date"
                  required
                  value={view === 'bills' ? billIssueDate : undefined}
                  defaultValue={view === 'purchase-orders' ? today : undefined}
                  onChange={view === 'bills' ? (event) => setBillIssueDate(event.target.value) : undefined}
                />
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
              <input
                name="date"
                type="date"
                defaultValue={view === 'bills' ? undefined : today}
                value={view === 'bills' ? billDuePreview : undefined}
                readOnly={view === 'bills'}
                required
              />
              {view === 'bills' && <small className="field-hint">Calculated from supplier terms: {billTermsDays === 0 ? 'due on receipt' : `${billTermsDays} days`}.</small>}
            </label>
            {line && (
              <div className="invoice-line-editor full">
                <div className="invoice-line-editor__heading">
                  <span>Items</span>
                  <small>Add multiple items to this transaction.</small>
                </div>
                {lineItems.map((item, index) => (
                  <div className="invoice-line-editor__row" key={index}>
                    <label>
                      Name
                      <input
                        required
                        value={item.name}
                        onChange={(event) => updateLine(index, 'name', event.target.value)}
                      />
                    </label>
                    <label>
                      Line description
                      <input
                        required
                        value={item.description}
                        onChange={(event) => updateLine(index, 'description', event.target.value)}
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min=".0001"
                        step=".0001"
                        value={item.quantity}
                        onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                      />
                    </label>
                    <label>
                      Unit price
                      <input
                        required
                        type="number"
                        min="0"
                        step=".01"
                        value={item.unitPrice}
                        onChange={(event) => updateLine(index, 'unitPrice', event.target.value)}
                      />
                    </label>
                  </div>
                ))}
                <label className="full">
                  Tax %<input name="taxRate" type="number" min="0" step=".01" defaultValue="0" />
                </label>
                <button
                  type="button"
                  className="invoice-line-editor__add"
                  onClick={() =>
                    setLineItems((items) => [
                      ...items,
                      { name: '', description: '', quantity: '', unitPrice: '' },
                    ])
                  }
                >
                  <Plus size={16} /> Add another item
                </button>
              </div>
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

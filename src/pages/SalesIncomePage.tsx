import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Eye, Filter, History, LoaderCircle, MapPin, Plus, Send, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  salesApi,
  type CreditNote,
  type Customer,
  type Invoice,
  type Payment,
  type Quotation,
  type SalesSummary,
} from '@/services/sales';
import { confirmAction, downloadText } from '@/utils/actions';
import { getDefaultCurrency } from '@/utils/currency';
import { getOfflineQueue, isWorkingOffline } from '@/services/offline';
import { PaymentTermsField } from '@/components/ui/PaymentTermsField';
import { addDaysToDateInput, receivableAgeingLabel, receivableAgeingPeriod, RECEIVABLE_AGEING_PERIODS, todayDateInput } from '@/utils/payment-terms';
type View = 'customers' | 'quotations' | 'invoices' | 'payments' | 'credit-notes' | 'receivables';
type Row = Customer | Quotation | Invoice | Payment | CreditNote;
const cash = (v: string, c = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: c }).format(Number(v));
const day = (v: string) => new Date(v).toLocaleDateString('en-NG');
const todayIso = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const invoiceStatusLabel = (invoice: Invoice) => {
  if (invoice.status === 'VOID' || invoice.status === 'DRAFT') return invoice.status;
  const balance = Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount);
  if (balance <= 0) return 'PAID';
  return invoice.dueDate.slice(0, 10) < todayIso() ? 'OVERDUE' : invoice.status;
};
const queuedQuotationSendIds = () =>
  new Set(
    getOfflineQueue()
      .filter((item) => item.method === 'POST')
      .map((item) => /^\/sales\/quotations\/([^/]+)\/send$/.exec(item.path)?.[1])
      .filter((id): id is string => Boolean(id)),
  );
type QueuedCustomerPayment = {
  id: string;
  invoiceId: string;
  paymentDate: string;
  reference: string;
  amount: number;
  method: string;
};
function applyQueuedCustomerTerms(customers: Customer[]): Customer[] {
  const queuedTerms = new Map<string, number>();
  for (const entry of getOfflineQueue()) {
    const id = /^\/customers\/([^/?]+)$/.exec(entry.path)?.[1];
    if (!id || entry.method !== 'PATCH' || !entry.body) continue;
    try {
      const body = JSON.parse(entry.body) as Record<string, unknown>;
      const days = Number(body.paymentTermsDays);
      if (Number.isInteger(days) && days >= 0 && days <= 3650) queuedTerms.set(id, days);
    } catch { /* keep the cached customer values if a queue entry is malformed */ }
  }
  return customers.map((customer) => queuedTerms.has(customer.id)
    ? { ...customer, paymentTermsDays: queuedTerms.get(customer.id)! }
    : customer);
}
const queuedCustomerPayments = (): QueuedCustomerPayment[] =>
  getOfflineQueue().flatMap((entry) => {
    if (entry.path !== '/sales/payments' || entry.method !== 'POST' || !entry.body) return [];
    try {
      const data = JSON.parse(entry.body) as Record<string, unknown>;
      if (
        typeof data.invoiceId !== 'string' ||
        typeof data.paymentDate !== 'string' ||
        typeof data.reference !== 'string' ||
        typeof data.amount !== 'number' ||
        !Number.isFinite(data.amount) ||
        data.amount <= 0 ||
        typeof data.method !== 'string'
      ) return [];
      return [{
        id: `offline:${entry.id}`,
        invoiceId: data.invoiceId,
        paymentDate: data.paymentDate,
        reference: data.reference,
        amount: data.amount,
        method: data.method,
      }];
    } catch { return []; }
  });
const queuedPaymentAmount = (invoiceId: string) =>
  queuedCustomerPayments()
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amount, 0);
const invoiceOutstanding = (invoice: Invoice, includeQueued = false) =>
  Math.max(0, Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount) -
    (includeQueued ? queuedPaymentAmount(invoice.id) : 0));
export function SalesIncomePage({ view, role, onNavigate, canApproveCredit = false }: { view: View; role: string; onNavigate: (id: string) => void; canApproveCredit?: boolean }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const [summary, setSummary] = useState<SalesSummary | null>(null),
    [customers, setCustomers] = useState<Customer[]>([]),
    [projects, setProjects] = useState<Array<{ id: string; code: string; name: string }>>([]),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [duePeriod, setDuePeriod] = useState(''),
    [ageingCustomerId, setAgeingCustomerId] = useState(''),
    [filterOpen, setFilterOpen] = useState(false),
    [queuedQuotationSends, setQueuedQuotationSends] = useState<Set<string>>(() => queuedQuotationSendIds()),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState<Customer | null>(null),
    [customerPresetId, setCustomerPresetId] = useState(''),
    [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null),
    [historyEntries, setHistoryEntries] = useState<Invoice[]>([]),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState(''),
    [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null),
    [creditApprovalInvoice, setCreditApprovalInvoice] = useState<Invoice | null>(null),
    [creditApprovalReason, setCreditApprovalReason] = useState(''),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const adjustCustomerCredit = (customer: Customer) => { setHistoryCustomer(null); setSelected(customer); setModal(true); };
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c, i, projectOptions] = await Promise.all([
        salesApi.summary(),
        salesApi.customers(),
        salesApi.invoices(),
        view === 'invoices' ? salesApi.projects().catch(() => []) : Promise.resolve([]),
      ]);
      setSummary(s);
      const customersWithQueuedTerms = applyQueuedCustomerTerms(c.data);
      setCustomers(customersWithQueuedTerms.filter((customer) => customer.isActive));
      setInvoices(i);
      setProjects(projectOptions);
      if (view === 'customers')
        setRows(
          customersWithQueuedTerms.filter(
            (x) => !search || x.displayName.toLowerCase().includes(search.toLowerCase()),
          ),
        );
      else if (view === 'invoices')
        setRows(
          i.filter(
            (x) =>
              (!search ||
                x.number.toLowerCase().includes(search.toLowerCase()) ||
                x.customer.displayName.toLowerCase().includes(search.toLowerCase())) &&
              (!status || invoiceStatusLabel(x) === status),
          ),
        );
      else if (view === 'quotations') setRows(await salesApi.quotations({ search, status }));
      else if (view === 'payments') {
        const posted = await salesApi.payments({ search });
        const term = search.trim().toLowerCase();
        const pending = queuedCustomerPayments().flatMap((queued) => {
          const invoice = i.find((item) => item.id === queued.invoiceId);
          if (!invoice) return [];
          const payment: Payment = {
            id: queued.id,
            reference: queued.reference,
            amount: String(queued.amount),
            currency: invoice.currency,
            paymentDate: queued.paymentDate,
            method: queued.method,
            customer: invoice.customer,
            invoice,
          };
          return !term || `${payment.reference} ${payment.customer.displayName} ${payment.invoice.number}`.toLowerCase().includes(term)
            ? [payment]
            : [];
        });
        setRows([...pending, ...posted].sort((a, b) =>
          new Date((b as Payment).paymentDate).getTime() - new Date((a as Payment).paymentDate).getTime(),
        ));
      }
      else if (view === 'credit-notes') setRows(await salesApi.credits({ search }));
      else setRows(await salesApi.receivables({}));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load sales data');
    } finally {
      setLoading(false);
    }
  }, [view, search, status]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    let refreshTimer: number | undefined;
    const refreshQueuedSends = () => {
      const next = queuedQuotationSendIds();
      if (['invoices', 'payments', 'receivables'].includes(view)) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void load(), 250);
      }
      setQueuedQuotationSends((current) => {
        if (current.size === next.size && [...current].every((id) => next.has(id))) return current;
        if (!['invoices', 'payments', 'receivables'].includes(view)) void load();
        return next;
      });
    };
    window.addEventListener('cephas:sync-state', refreshQueuedSends);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('cephas:sync-state', refreshQueuedSends);
    };
  }, [load, view]);
  useEffect(() => {
    const openQuickCreate = (event?: Event) => {
      const requested =
        event instanceof CustomEvent
          ? String(event.detail)
          : sessionStorage.getItem('cephas:quick-create');
      if (requested !== view || !['invoices', 'payments'].includes(view)) return;
      sessionStorage.removeItem('cephas:quick-create');
      if (canEdit) setModal(true);
    };
    openQuickCreate();
    window.addEventListener('cephas:quick-create', openQuickCreate);
    return () => window.removeEventListener('cephas:quick-create', openQuickCreate);
  }, [canEdit, view]);
  useEffect(() => {
    const raw = sessionStorage.getItem('cephas:customer-document');
    if (!raw) return;
    try {
      const request = JSON.parse(raw) as { customerId?: string; view?: View };
      if (request.view === view && request.customerId && ['quotations', 'invoices'].includes(view)) {
        setCustomerPresetId(request.customerId);
        setModal(true);
        sessionStorage.removeItem('cephas:customer-document');
      }
    } catch {
      sessionStorage.removeItem('cephas:customer-document');
    }
  }, [view]);
  useEffect(() => {
    if (!historyCustomer) return;
    const refresh = () => {
      setHistoryError('');
      void salesApi
        .customerPurchaseHistory(historyCustomer.id)
        .then((entries) => setHistoryEntries(entries))
        .catch((caught) => {
          const message = caught instanceof Error ? caught.message : 'Unable to load customer dashboard';
          setHistoryError(message);
        })
        .finally(() => setHistoryLoading(false));
    };
    refresh();
    window.addEventListener('cephas:sync-state', refresh);
    return () => window.removeEventListener('cephas:sync-state', refresh);
  }, [historyCustomer]);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      setModal(false);
      setSelected(null);
      setCustomerPresetId('');
      await load();
      if (result && typeof result === 'object' && 'emailSent' in result && result.emailSent === false) {
        const failure = 'emailError' in result ? String(result.emailError) : 'Email delivery failed.';
        setError(view === 'invoices'
          ? `Invoice recorded as sent, but the email could not be delivered: ${failure}`
          : `Quotation saved as a draft, but it could not be emailed: ${failure}`);
        confirmAction(view === 'invoices' ? 'Invoice recorded as sent' : 'Quotation saved as draft');
      } else if (result && typeof result === 'object' && 'queuedOffline' in result) {
        confirmAction(view === 'invoices' && message.includes('emailed')
          ? 'Invoice and statement queued offline. They will be emailed when this device syncs.'
          : view === 'quotations' && message.includes('emailed')
          ? 'Quotation queued offline. It will be emailed when this device syncs.'
          : `${title[view]} queued offline and will sync when online`);
      } else confirmAction(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const requestInvoiceSend = async (invoice: Invoice) => {
    if (invoice.status !== 'DRAFT') {
      void run(() => salesApi.sendInvoice(invoice.id), 'Invoice and statement emailed to customer');
      return;
    }
    try {
      const status = await salesApi.customerCreditStatus(invoice.customerId);
      const balance = Math.max(0, Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount));
      if (Number(status.outstandingBalance) + balance > Number(status.creditLimit)) {
        if (!canApproveCredit) { setError('This invoice exceeds the customer credit limit and requires an authorized approver.'); return; }
        setCreditApprovalReason(''); setCreditApprovalInvoice(invoice); return;
      }
      void run(() => salesApi.sendInvoice(invoice.id), 'Invoice and statement emailed to customer');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to verify customer credit'); }
  };
  const title: Record<View, string> = {
    customers: 'Customers',
    quotations: 'Quotations',
    invoices: 'Invoices',
    payments: 'Payments received',
    'credit-notes': 'Credit notes',
    receivables: 'Receivables',
  };
  const receivableRows = view === 'receivables' ? rows as Invoice[] : [];
  const reportRows = receivableRows.filter((invoice) =>
    invoiceOutstanding(invoice) > 0 &&
    (!search.trim() || `${invoice.number} ${invoice.customer.displayName}`.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const ageingCustomers = [...new Map(
    receivableRows
      .filter((invoice) => invoiceOutstanding(invoice) > 0)
      .map((invoice) => [invoice.customerId, invoice.customer]),
  ).values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const overdueCountsByCustomer = new Map<string, number>();
  for (const invoice of receivableRows) {
    if (invoiceOutstanding(invoice) > 0 && receivableAgeingPeriod(invoice.dueDate) !== 'CURRENT') {
      overdueCountsByCustomer.set(invoice.customerId, (overdueCountsByCustomer.get(invoice.customerId) ?? 0) + 1);
    }
  }
  const duePeriodCounts = RECEIVABLE_AGEING_PERIODS.map(({ value: period }) => ({
    period,
    count: reportRows.filter((invoice) =>
      (!ageingCustomerId || invoice.customerId === ageingCustomerId) &&
      receivableAgeingPeriod(invoice.dueDate) === period,
    ).length,
  }));
  const visibleRows = view === 'receivables'
    ? reportRows.filter((invoice) =>
        (!duePeriod || receivableAgeingPeriod(invoice.dueDate) === duePeriod) &&
        (!ageingCustomerId || invoice.customerId === ageingCustomerId),
      )
    : rows;
  const action =
    view === 'customers'
      ? 'Add customer'
      : view === 'quotations'
        ? 'Create quotation'
        : view === 'invoices'
          ? 'Create invoice'
          : view === 'payments' || view === 'receivables'
            ? 'Record payment'
            : view === 'credit-notes'
              ? 'Create credit note'
              : '';
  const exportCsv = () => {
    const body = [
      columns(view).join(','),
      ...visibleRows.map((r) =>
        values(view, r, view === 'receivables' ? overdueCountsByCustomer.get((r as Invoice).customerId) ?? 0 : 0)
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    downloadText(`${view}.csv`, body);
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title[view]}</h1>
          <p>Manage {title[view].toLowerCase()} across your organisation.</p>
        </div>
        <div className="page-header__actions">
          {view === 'quotations' && (
            <button
              className="button button--secondary button--small"
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Filter size={15} /> Filter
            </button>
          )}
          <button className="button button--secondary" onClick={exportCsv} disabled={loading || Boolean(error)}>
            <Download size={17} /> Export CSV
          </button>
          {canEdit && action && (
            <button className="button" onClick={() => setModal(true)}>
              <Plus size={17} />
              {action}
            </button>
          )}
        </div>
      </div>
      {view === 'quotations' && filterOpen && (
        <div className="quotation-filter-panel">
          <label>
            Status
            <select aria-label="Filter quotations by status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED', 'VOID'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {summary && (
        <StatsGrid
          stats={[
            { label: 'Customers', value: String(summary.customers) },
            { label: 'Open quotations', value: String(summary.openQuotations) },
            { label: summary.projectReceived === undefined ? 'Receipts (cached)' : 'General receipts', value: cash(summary.received), tone: 'positive' },
            { label: summary.projectReceived === undefined ? 'Project receipts (refresh online)' : 'Project receipts', value: summary.projectReceived === undefined ? '—' : cash(summary.projectReceived), tone: 'positive' },
            { label: 'Outstanding receivables', value: cash(summary.receivable), tone: 'warning' },
          ]}
        />
      )}
      {view === 'receivables' && <div className="receivables-ageing-stats"><StatsGrid stats={duePeriodCounts.map(({ period, count }) => ({
        label: RECEIVABLE_AGEING_PERIODS.find((item) => item.value === period)?.label ?? period,
        value: String(count),
        ...(period !== 'CURRENT' && count ? { tone: 'warning' as const } : {}),
      }))} /></div>}
      <section className="panel register-panel">
        <div className={view === 'receivables' ? 'banking-filters banking-filters--ageing' : 'banking-filters'}>
          <input
            placeholder={view === 'receivables' ? 'Search customer or invoice number' : `Search ${title[view].toLowerCase()}`}
            aria-label={view === 'receivables' ? 'Search customer or invoice number' : 'Search'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {view === 'invoices' && (
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
          {view === 'receivables' && (
            <>
              <select aria-label="Filter receivables by ageing period" value={duePeriod} onChange={(event) => setDuePeriod(event.target.value)}>
                <option value="">All ageing periods</option>
                {RECEIVABLE_AGEING_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Filter receivables by customer" value={ageingCustomerId} onChange={(event) => setAgeingCustomerId(event.target.value)}>
                <option value="">All customers</option>
                {ageingCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}
              </select>
            </>
          )}
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <LoadingState label="Loading sales and income…" />
        ) : view === 'quotations' ? (
          <div className="quotation-card-grid">
            {(rows as Quotation[]).map((quotation) => (
              <article className="quotation-card" key={quotation.id}>
                <header className="quotation-card__header">
                  <div>
                    <span className={`quotation-status quotation-status--${quotation.status.toLowerCase()}`}>
                      {quotation.status}
                    </span>
                    <h2>{quotation.number}</h2>
                  </div>
                  <strong>{cash(quotation.total, quotation.currency)}</strong>
                </header>
                <div className="quotation-card__details">
                  <span><small>Customer</small>{quotation.customer.displayName}</span>
                  <span><small>Date</small>{day(quotation.issueDate)}</span>
                  <span><small>Valid until</small>{day(quotation.expiryDate)}</span>
                </div>
                <div className="quotation-card__items">
                  <strong>Items</strong>
                  {(quotation.items ?? []).map((item, index) => (
                    <div className="quotation-card__item" key={`${item.name}-${index}`}>
                      <span><b>{item.name}</b><small>{item.description}</small></span>
                      <span>
                        {item.quantity} × {cash(String(item.unitPrice), quotation.currency)} ={' '}
                        {cash(String(Number(item.quantity) * Number(item.unitPrice)), quotation.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                {quotation.notes && (
                  <p className="quotation-card__terms"><strong>Terms &amp; Conditions</strong>{quotation.notes}</p>
                )}
                {canEdit && (
                  <footer className="quotation-card__actions">
                    {actions(
                      'quotations', quotation,
                      (operation, message) => {
                        const queueEmail = message === 'Quotation emailed to customer' && isWorkingOffline();
                        if (queueEmail)
                          setQueuedQuotationSends((current) => new Set(current).add(quotation.id));
                        if (message === 'Quotation voided') {
                          setConfirmation({
                            title: 'Void quotation',
                            message: `Void ${quotation.number}? This status can’t be undone.`,
                            confirmLabel: 'Void quotation',
                            onConfirm: () => void run(operation, message).then((ok) => ok && setConfirmation(null)),
                          });
                        } else
                          void run(operation, message).then((ok) => {
                            if (queueEmail && !ok && !getOfflineQueue().some((item) => item.path === `/sales/quotations/${quotation.id}/send`))
                              setQueuedQuotationSends((current) => {
                                const next = new Set(current);
                                next.delete(quotation.id);
                                return next;
                              });
                          });
                      },
                      () => {},
                      () => {},
                      () => {},
                      canEdit,
                      queuedQuotationSends.has(quotation.id),
                    )}
                  </footer>
                )}
              </article>
            ))}
            {!rows.length && <p className="quotation-card-grid__empty">No quotations match these filters.</p>}
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns(view).map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {(canEdit || view === 'customers' || (view === 'invoices' && canApproveCredit)) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id}>
                    {values(view, r, view === 'receivables' ? overdueCountsByCustomer.get((r as Invoice).customerId) ?? 0 : 0).map((x, j) => (
                      <td key={j}>{x}</td>
                    ))}
                    {(canEdit || view === 'customers' || (view === 'invoices' && canApproveCredit)) && (
                      <td>
                        <div className="inline-actions">
                          {actions(
                            view,
                            r,
                            (op, msg) => {
                              setError('');
                              setConfirmation({
                                title: 'Confirm action',
                                message:
                                  'Please confirm this workflow action. Related documents, balances, or statuses may be updated.',
                                confirmLabel: msg,
                                onConfirm: () =>
                                  void run(op, msg).then((ok) => ok && setConfirmation(null)),
                              });
                            },
                            () => {
                              if (view === 'customers') {
                                setSelected(r as Customer);
                                setModal(true);
                              }
                            },
                            (invoice) => setPreviewInvoice(invoice),
                            (customer) => {
                              setHistoryEntries([]);
                              setHistoryError('');
                              setHistoryLoading(true);
                              setHistoryCustomer(customer);
                            },
                            canEdit,
                            false,
                            requestInvoiceSend,
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td
                      className="table-empty"
                      colSpan={columns(view).length + (canEdit || view === 'customers' || (view === 'invoices' && canApproveCredit) ? 1 : 0)}
                    >
                      {view === 'receivables' ? 'No outstanding invoices match these filters.' : 'No records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CreateModal
        key={`${view}-${modal ? 'open' : 'closed'}-${selected?.id || 'new'}`}
        open={modal}
        view={view}
        selected={selected}
        customerPresetId={customerPresetId}
        customers={customers}
        canApproveCredit={canApproveCredit}
        projects={projects}
        invoices={invoices.filter(
          (x) => Number(x.total) - Number(x.paidAmount) - Number(x.creditedAmount) > 0,
        )}
        busy={busy}
        error={error}
        close={() => {
          setModal(false);
          setSelected(null);
          setCustomerPresetId('');
        }}
        submit={(data, intent = 'draft') =>
          void run(
            () => create(view, data, selected, intent),
            intent === 'send'
              ? view === 'invoices'
                ? 'Invoice and statement emailed to customer'
                : 'Quotation emailed to customer'
              : view === 'quotations'
                ? 'Quotation saved as draft'
                : `${title[view]} saved`,
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
      <InvoicePreview
        key={previewInvoice?.id || 'closed'}
        invoice={previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        onSend={requestInvoiceSend}
      />
      <Modal open={Boolean(creditApprovalInvoice)} title="Approve credit limit exception" onClose={() => { if (!busy) setCreditApprovalInvoice(null); }} footer={<><button className="button button--secondary" onClick={() => setCreditApprovalInvoice(null)}>Cancel</button><button className="button" disabled={busy || !creditApprovalReason.trim()} onClick={() => { const invoice = creditApprovalInvoice; if (!invoice) return; setCreditApprovalInvoice(null); void run(() => salesApi.sendInvoice(invoice.id, { creditLimitOverride: true, creditLimitOverrideReason: creditApprovalReason.trim() }), 'Invoice and statement emailed to customer'); }}>Approve and send</button></>}>
        <p>{creditApprovalInvoice ? `${creditApprovalInvoice.number} will exceed ${creditApprovalInvoice.customer.displayName}’s approved credit limit. Record a reason for this exception.` : ''}</p>
        <label>Approval reason<textarea maxLength={1000} rows={3} value={creditApprovalReason} onChange={(event) => setCreditApprovalReason(event.target.value)} /></label>
      </Modal>
      <CustomerHistoryModal
        key={historyCustomer?.id || 'closed'}
        customer={historyCustomer}
        invoices={historyEntries}
        loading={historyLoading}
        error={historyError}
        onRetry={() => {
          if (!historyCustomer) return;
          setHistoryLoading(true);
          setHistoryError('');
          void salesApi.customerPurchaseHistory(historyCustomer.id)
            .then(setHistoryEntries)
            .catch((caught) => setHistoryError(caught instanceof Error ? caught.message : 'Unable to load customer dashboard'))
            .finally(() => setHistoryLoading(false));
        }}
        onClose={() => setHistoryCustomer(null)}
        onPreview={setPreviewInvoice}
        canEdit={canEdit}
        onCreateDocument={(target, customer) => {
          sessionStorage.setItem('cephas:customer-document', JSON.stringify({ customerId: customer.id, view: target }));
          setHistoryCustomer(null);
          onNavigate(target);
        }}
        onAdjustCredit={adjustCustomerCredit}
      />
    </>
  );
}
function columns(v: View) {
  return v === 'customers'
    ? ['Name', 'Email', 'Phone', 'Payment terms', 'Credit limit', 'Address', 'Status']
    : v === 'quotations'
      ? ['Number', 'Customer', 'Total', 'Expiry', 'Status']
      : v === 'invoices'
        ? ['Number', 'Customer', 'Project / receipt type', 'Total', 'Balance', 'Due', 'Status']
        : v === 'payments'
          ? ['Reference', 'Customer', 'Invoice Number', 'Receipt type', 'Amount', 'Date', 'Method']
          : v === 'credit-notes'
            ? ['Number', 'Customer', 'Invoice', 'Amount', 'Date', 'Status']
            : ['Customer', 'Invoice number', 'Due date', 'Outstanding balance', 'Ageing period', 'Overdue pattern'];
}
function values(v: View, r: Row, customerOverdueCount = 0): string[] {
  if (v === 'customers') {
    const x = r as Customer;
    return [
      x.displayName,
      x.email || '—',
      x.phone || '—',
      x.paymentTermsDays === 0 ? 'Due on receipt' : `Net ${x.paymentTermsDays ?? 30}`,
      cash(String(x.creditLimit ?? '0')),
      x.billingAddress || '—',
      x.isActive ? 'Active' : 'Archived',
    ];
  }
  if (v === 'quotations') {
    const x = r as Quotation;
    return [
      x.number,
      x.customer.displayName,
      cash(x.total, x.currency),
      day(x.expiryDate),
      x.status,
    ];
  }
  if (v === 'invoices' || v === 'receivables') {
    const x = r as Invoice,
      out = Number(x.total) - Number(x.paidAmount) - Number(x.creditedAmount);
    return v === 'invoices'
      ? [
          x.number,
          x.customer.displayName,
          x.project ? `${x.project.code} · ${x.project.name}` : 'General business',
          cash(x.total, x.currency),
          cash(String(out), x.currency),
          day(x.dueDate),
          invoiceStatusLabel(x),
        ]
      : [
          x.customer.displayName,
          x.number,
          day(x.dueDate),
          cash(String(out), x.currency),
          receivableAgeingLabel(x.dueDate),
          customerOverdueCount >= 2 ? '2+ overdue invoices' : '—',
        ];
  }
  if (v === 'payments') {
    const x = r as Payment;
    return [
      x.reference,
      x.customer.displayName,
      x.invoice.number,
      x.invoice.project ? `Project · ${x.invoice.project.code}` : 'General business',
      cash(x.amount, x.currency),
      day(x.paymentDate),
      x.method,
    ];
  }
  const x = r as CreditNote;
  return [
    x.number,
    x.customer.displayName,
    x.invoice.number,
    cash(x.amount, x.currency),
    day(x.issueDate),
    x.isVoid ? 'Void' : 'Active',
  ];
}
function actions(
  v: View,
  r: Row,
  run: (f: () => Promise<unknown>, m: string) => void,
  edit: () => void,
  preview: (invoice: Invoice) => void,
  history: (customer: Customer) => void,
  canEdit: boolean,
  sendQueued = false,
  sendInvoice?: (invoice: Invoice) => void,
) {
  if (v === 'invoices') {
    const invoice = r as Invoice;
    return (
      <>
        <button onClick={() => preview(invoice)}>
          <Eye size={15} /> Preview
        </button>
        <button onClick={() => printInvoice(invoice)}>
          <Download size={15} /> Download
        </button>
        <button
          onClick={() => sendInvoice ? sendInvoice(invoice) : run(() => salesApi.sendInvoice(invoice.id), 'Invoice and statement emailed to customer')}
        >
          <Send size={15} /> Send
        </button>
      </>
    );
  }
  if (v === 'customers')
    return (
      <>
        <button onClick={() => history(r as Customer)}>
          <History size={15} /> Dashboard
        </button>
        {canEdit && <button onClick={edit}>Edit</button>}
        {canEdit && (r as Customer).isActive && (
          <button onClick={() => run(() => salesApi.archiveCustomer(r.id), 'Customer archived')}>
            Archive
          </button>
        )}
        {canEdit && !(r as Customer).isActive && (
          <button
            onClick={() =>
              run(() => salesApi.updateCustomer(r.id, { isActive: true }), 'Customer restored')
            }
          >
            Restore
          </button>
        )}
      </>
    );
  if (v === 'quotations') {
    const x = r as Quotation;
    return (
      <>
        {x.status === 'DRAFT' && x.customer.email && (
          <button
            disabled={sendQueued}
            onClick={() => run(() => salesApi.sendQuotation(x.id), 'Quotation emailed to customer')}
          >
            {sendQueued ? 'Email queued' : 'Send'}
          </button>
        )}
        {x.status === 'DRAFT' && !x.customer.email && (
          <span className="quotation-card__send-hint">Add a customer email to send</span>
        )}
        {!['CONVERTED', 'VOID', 'DECLINED', 'EXPIRED'].includes(x.status) && (
          <button onClick={() => run(() => salesApi.convertQuotation(x.id), 'Invoice created')}>
            Convert
          </button>
        )}
        {!['CONVERTED', 'VOID'].includes(x.status) && (
          <button
            onClick={() => run(() => salesApi.quotationStatus(x.id, 'VOID'), 'Quotation voided')}
          >
            Void
          </button>
        )}
      </>
    );
  }
  if (v === 'payments') {
    if (r.id.startsWith('offline:')) return <span className="payment-pending-label">Pending sync</span>;
    return (
      <button onClick={() => run(() => salesApi.reversePayment(r.id), 'Payment reversed')}>
        Reverse
      </button>
    );
  }
  if (v === 'credit-notes' && !(r as CreditNote).isVoid)
    return (
      <button onClick={() => run(() => salesApi.voidCredit(r.id), 'Credit note voided')}>
        Void
      </button>
    );
  return null;
}
async function create(
  v: View,
  d: Record<string, unknown>,
  selected: Customer | null,
  intent: 'draft' | 'send' = 'draft',
) {
  if (v === 'customers')
    return selected ? salesApi.updateCustomer(selected.id, d) : salesApi.createCustomer(d);
  if (v === 'quotations')
    return salesApi.createQuotation({
      ...d,
      status: intent === 'send' ? 'DRAFT' : d.status || 'DRAFT',
      sendEmail: intent === 'send',
    });
  if (v === 'invoices') return salesApi.createInvoice({ ...d, sendEmail: intent === 'send' });
  if (v === 'payments' || v === 'receivables') return salesApi.createPayment(d);
  return salesApi.createCredit(d);
}
function InvoicePreview({ invoice, onClose, onSend }: { invoice: Invoice | null; onClose: () => void; onSend: (invoice: Invoice) => void | Promise<void> }) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  if (!invoice) return null;
  const send = async () => {
    if (sending) return;
    setSending(true);
    setSendError('');
    try {
      await onSend(invoice);
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : 'Unable to send invoice email');
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal
      open
      title={`Invoice ${invoice.number}`}
      onClose={() => {
        if (!sending) onClose();
      }}
      wide
      footer={
        <>
          <button className="button button--secondary" onClick={onClose} disabled={sending}>
            Close
          </button>
          <button
            className="button button--secondary"
            onClick={() => printInvoice(invoice)}
            disabled={sending}
          >
            <Download size={16} /> Download PDF
          </button>
          <button className="button" onClick={() => void send()} disabled={sending}>
            {sending ? (
              <>
                <LoaderCircle className="spin" size={16} /> Sending…
              </>
            ) : (
              <>
                <Send size={16} /> Send email
              </>
            )}
          </button>
        </>
      }
    >
      {sendError && <p className="form-error">{sendError}</p>}
      <InvoicePaper invoice={invoice} />
    </Modal>
  );
}
function CustomerHistoryModal({
  customer,
  invoices,
  loading,
  error,
  onRetry,
  onClose,
  onPreview,
  onCreateDocument,
  onAdjustCredit,
  canEdit,
}: {
  customer: Customer | null;
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
  onPreview: (invoice: Invoice) => void;
  onCreateDocument: (target: 'quotations' | 'invoices', customer: Customer) => void;
  canEdit: boolean;
  onAdjustCredit: (customer: Customer) => void;
}) {
  const [creditStatus, setCreditStatus] = useState<Awaited<ReturnType<typeof salesApi.customerCreditStatus>> | null>(null);
  const [creditHistory, setCreditHistory] = useState<Awaited<ReturnType<typeof salesApi.customerCreditLimitHistory>>>([]);
  const [creditOverrides, setCreditOverrides] = useState<Awaited<ReturnType<typeof salesApi.customerCreditOverrideHistory>>>([]);
  const [posCreditPayments, setPosCreditPayments] = useState<Awaited<ReturnType<typeof salesApi.customerPosCreditPayments>>>([]);
  const [creditHistoryError, setCreditHistoryError] = useState('');
  useEffect(() => {
    if (!customer) { setCreditStatus(null); setCreditHistory([]); setCreditOverrides([]); setPosCreditPayments([]); return; }
    let active = true;
    Promise.allSettled([salesApi.customerCreditStatus(customer.id), salesApi.customerCreditLimitHistory(customer.id), salesApi.customerCreditOverrideHistory(customer.id), salesApi.customerPosCreditPayments(customer.id)])
      .then(([statusResult, historyResult, overrideResult, posPaymentsResult]) => {
        if (!active) return;
        setCreditStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);
        setCreditHistory(historyResult.status === 'fulfilled' ? historyResult.value : []);
        setCreditOverrides(overrideResult.status === 'fulfilled' ? overrideResult.value : []);
        setPosCreditPayments(posPaymentsResult.status === 'fulfilled' ? posPaymentsResult.value : []);
        const failures = [statusResult, historyResult, overrideResult, posPaymentsResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result) => result.reason instanceof Error ? result.reason.message : 'Unable to load credit information');
        setCreditHistoryError(failures.join(' '));
      });
    return () => { active = false; };
  }, [customer?.id]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cardViews, setCardViews] = useState(['outstanding', 'invoiced', 'payments', 'credits', 'overdue']);
  const [openCard, setOpenCard] = useState<string | null>(null);
  if (!customer) return null;
  const offlineWrites = getOfflineQueue();
  const labels: Record<string, string> = { outstanding: 'Invoice outstanding balance', invoiced: 'Invoiced', payments: 'Invoice payments received', credits: 'Credits applied', overdue: 'Overdue balance' };
  const dateInRange = (value: string) => {
    const date = value.slice(0, 10);
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  };
  const pendingInvoices = offlineWrites.flatMap((entry) => {
    if (entry.path !== '/invoices' || entry.method !== 'POST' || !entry.body) return [];
    try {
      const data = JSON.parse(entry.body) as Record<string, unknown>;
      if (data.sendEmail !== true || data.customerId !== customer.id || typeof data.issueDate !== 'string' || typeof data.dueDate !== 'string' || !Array.isArray(data.items)) return [];
      const total = data.items.reduce((sum: number, rawItem: unknown) => {
        const item = rawItem as Record<string, unknown>;
        const base = Number(item.quantity) * Number(item.unitPrice);
        return sum + base + base * Number(item.taxRate ?? 0) / 100;
      }, 0) + Number(data.shippingAmount ?? 0);
      if (!Number.isFinite(total)) return [];
      return [{
        id: 'offline:' + entry.id,
        number: 'Pending sync ' + entry.id.slice(0, 8),
        status: 'PENDING_SEND',
        currency: typeof data.currency === 'string' ? data.currency : getDefaultCurrency(),
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: String(total),
        taxTotal: '0',
        shippingAmount: String(data.shippingAmount ?? 0),
        total: String(total),
        paidAmount: '0',
        creditedAmount: '0',
        customer,
        customerId: customer.id,
        items: [],
      } as Invoice];
    } catch { return []; }
  });
  const pendingPayments = offlineWrites.flatMap((entry) => {
    if (entry.path !== '/sales/payments' || entry.method !== 'POST' || !entry.body) return [];
    try {
      const data = JSON.parse(entry.body) as Record<string, unknown>;
      if (typeof data.invoiceId !== 'string' || typeof data.paymentDate !== 'string' || typeof data.reference !== 'string' || typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) return [];
      return [{ id: entry.id, invoiceId: data.invoiceId, paymentDate: data.paymentDate, reference: data.reference, amount: data.amount }];
    } catch { return []; }
  });
  const liveInvoices = [...invoices, ...pendingInvoices].filter((invoice) =>
    invoice.status !== 'VOID' &&
    (invoice.status !== 'DRAFT' || pendingPayments.some((payment) => payment.invoiceId === invoice.id)),
  );
  const currencies = [...new Set(liveInvoices.map((invoice) => invoice.currency))];
  if (!currencies.length) currencies.push(getDefaultCurrency());
  const pendingAmount = (invoice: Invoice) => Math.min(
    pendingPayments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0),
    Math.max(0, Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount)),
  );
  const balance = (invoice: Invoice) => Math.max(0, Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount) - pendingAmount(invoice));
  const dashboardStatus = (invoice: Invoice) =>
    invoice.id.startsWith('offline:')
      ? 'INVOICE PENDING SYNC'
      : pendingAmount(invoice) > 0
      ? balance(invoice) === 0 ? 'PAYMENT PENDING SYNC' : 'PARTIAL PAYMENT PENDING SYNC'
      : invoiceStatusLabel(invoice);
  const metricValue = (metric: string, currency: string) => {
    const records = liveInvoices.filter((invoice) => invoice.currency === currency);
    if (metric === 'outstanding') return records.reduce((sum, invoice) => sum + (dateInRange(invoice.issueDate) ? balance(invoice) : 0), 0);
    if (metric === 'invoiced') return records.reduce((sum, invoice) => sum + (dateInRange(invoice.issueDate) ? Number(invoice.total) : 0), 0);
    if (metric === 'payments') return records.flatMap((invoice) => invoice.payments ?? []).reduce((sum, payment) => sum + (dateInRange(payment.paymentDate) ? Number(payment.amount) : 0), 0) + pendingPayments.filter((payment) => records.some((invoice) => invoice.id === payment.invoiceId) && dateInRange(payment.paymentDate)).reduce((sum, payment) => sum + payment.amount, 0);
    if (metric === 'credits') return records.flatMap((invoice) => invoice.creditNotes ?? []).reduce((sum, credit) => sum + (!credit.isVoid && dateInRange(credit.issueDate) ? Number(credit.amount) : 0), 0);
    const today = todayIso();
    return records.reduce((sum, invoice) => sum + (dateInRange(invoice.issueDate) && invoice.dueDate.slice(0, 10) < today ? balance(invoice) : 0), 0);
  };
  const cardDetails = (metric: string, currency: string) => {
    const records = liveInvoices.filter((invoice) => invoice.currency === currency);
    const today = todayIso();
    if (metric === 'payments') {
      const posted = records.flatMap((invoice) => (invoice.payments ?? []).filter((payment) => dateInRange(payment.paymentDate)).map((payment) => ({ id: payment.id, reference: payment.reference, date: payment.paymentDate, amount: '-' + cash(payment.amount, invoice.currency), detail: 'Payment for ' + invoice.number })));
      const queued = pendingPayments.filter((payment) => records.some((invoice) => invoice.id === payment.invoiceId) && dateInRange(payment.paymentDate)).map((payment) => ({ id: payment.id, reference: payment.reference, date: payment.paymentDate, amount: '-' + cash(String(payment.amount), currency), detail: 'Payment pending sync' }));
      return [...posted, ...queued];
    }
    if (metric === 'credits') return records.flatMap((invoice) => (invoice.creditNotes ?? []).filter((credit) => !credit.isVoid && dateInRange(credit.issueDate)).map((credit) => ({ id: credit.id, reference: credit.number, date: credit.issueDate, amount: '−' + cash(credit.amount, invoice.currency), detail: 'Credit for ' + invoice.number })));
    return records.filter((invoice) => dateInRange(invoice.issueDate) && (metric === 'invoiced' || balance(invoice) > 0) && (metric !== 'overdue' || invoice.dueDate.slice(0, 10) < today)).map((invoice) => ({ id: invoice.id, reference: invoice.number, date: invoice.issueDate, amount: cash(String(metric === 'invoiced' ? invoice.total : balance(invoice)), invoice.currency), detail: dashboardStatus(invoice) + ' · due ' + day(invoice.dueDate), invoice }));
  };
  const downloadStatement = () => {
    const entries: { date: string; row: string[] }[] = [];
    for (const invoice of liveInvoices) {
      if (dateInRange(invoice.issueDate)) entries.push({ date: invoice.issueDate.slice(0, 10), row: [invoice.issueDate.slice(0, 10), invoice.id.startsWith('offline:') ? 'Invoice pending sync' : 'Invoice', invoice.number, invoice.number, invoice.currency, String(invoice.total), String(balance(invoice))] });
      for (const payment of invoice.payments ?? []) if (dateInRange(payment.paymentDate)) entries.push({ date: payment.paymentDate.slice(0, 10), row: [payment.paymentDate.slice(0, 10), 'Payment', payment.reference, invoice.number, invoice.currency, '-' + payment.amount, ''] });
      for (const payment of pendingPayments.filter((item) => item.invoiceId === invoice.id && dateInRange(item.paymentDate))) entries.push({ date: payment.paymentDate.slice(0, 10), row: [payment.paymentDate.slice(0, 10), 'Payment pending sync', payment.reference, invoice.number, invoice.currency, '-' + payment.amount, ''] });
      for (const credit of invoice.creditNotes ?? []) if (!credit.isVoid && dateInRange(credit.issueDate)) entries.push({ date: credit.issueDate.slice(0, 10), row: [credit.issueDate.slice(0, 10), 'Credit', credit.number, invoice.number, invoice.currency, '-' + credit.amount, ''] });
    }
    const currentBalances = currencies.map((currency) => [
      '',
      'Current total outstanding',
      '',
      '',
      currency,
      '',
      String(liveInvoices.filter((invoice) => invoice.currency === currency).reduce((sum, invoice) => sum + balance(invoice), 0)),
    ]);
    const lines = [
      ['Date', 'Type', 'Reference', 'Invoice', 'Currency', 'Amount', 'Current balance'],
      ...entries.sort((a, b) => a.date.localeCompare(b.date)).map((entry) => entry.row),
      ...currentBalances,
    ];
    const csv = lines.map((line) => line.map((value, index) => {
      const safeValue = index === 2 && /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
      return '"' + safeValue.replaceAll('"', '""') + '"';
    }).join(',')).join('\n');
    downloadText(customer.displayName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-statement.csv', csv);
  };
  return (
    <Modal
      open
      wide
      title={customer.displayName + ' customer dashboard'}
      subtitle={customer.billingAddress || customer.email || 'Everything tied to this customer'}
      onClose={onClose}
      footer={
        <>
          {canEdit && <button className="button button--secondary" onClick={() => onCreateDocument('quotations', customer)}>Create quotation</button>}
          {canEdit && <button className="button" onClick={() => onCreateDocument('invoices', customer)}>Create invoice</button>}
          <button className="button button--secondary" onClick={downloadStatement} disabled={loading || Boolean(error)}>Download statement</button>
          <button className="button button--secondary" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="customer-history">
        {loading ? (
          <LoadingState label="Loading customer history…" />
        ) : error ? (
          <div className="banking-alert" role="alert">
            {error}
            <button type="button" onClick={onRetry}>Try again</button>
          </div>
        ) : (
          <>
            <div className="customer-dashboard-toolbar">
              <strong>Account activity · balances update as payments are recorded</strong>
              <button type="button" className="button button--secondary button--small" aria-label="Filter customer dashboard by date" aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)}><Filter size={15} /> Filter</button>
            </div>
            <section className="customer-credit-panel" aria-label="Customer credit limit">
              <div><small>Approved credit limit</small><strong>{creditStatus ? cash(creditStatus.creditLimit, creditStatus.currency) : cash(String(customer.creditLimit ?? '0'))}</strong></div>
              <div><small>Outstanding credit</small><strong>{creditStatus ? cash(creditStatus.outstandingBalance, creditStatus.currency) : '—'}</strong></div>
              <div><small>Available credit</small><strong>{creditStatus ? cash(creditStatus.availableCredit, creditStatus.currency) : '—'}</strong></div>
              {creditStatus?.nearLimit && <p className="banking-alert" role="status">Customer has used {creditStatus.usagePercent}% of the approved credit limit.</p>}
              {creditStatus?.exceeded && <p className="form-error" role="alert">Outstanding credit currently exceeds the approved limit.</p>}
              {canEdit && <button className="button button--secondary button--small" onClick={() => onAdjustCredit(customer)}>Adjust credit limit</button>}
              {creditHistoryError && <p className="banking-alert" role="alert">Credit information is incomplete: {creditHistoryError}</p>}
              {!!creditHistory.length && <details className="customer-credit-history"><summary>Credit limit changes ({creditHistory.length})</summary>{creditHistory.map((entry) => <p key={entry.id}><strong>{cash(entry.previousLimit, creditStatus?.currency)} → {cash(entry.newLimit, creditStatus?.currency)}</strong> · {entry.reason}<small>{new Date(entry.createdAt).toLocaleString()} · {entry.actor?.firstName || entry.actor?.email || 'Staff'}</small></p>)}</details>}
              {!!creditOverrides.length && <details className="customer-credit-history"><summary>Credit exceptions approved ({creditOverrides.length})</summary>{creditOverrides.map((entry) => <p key={entry.id}><strong>{entry.targetType} · {entry.targetId}</strong> · {entry.reason}<small>Exposure {cash(entry.existingExposure, creditStatus?.currency)} + requested {cash(entry.requestedAmount, creditStatus?.currency)} · {new Date(entry.createdAt).toLocaleString()} · {entry.approver?.firstName || entry.approver?.email || 'Approver'}</small></p>)}</details>}
              {!!posCreditPayments.length && <details className="customer-credit-history"><summary>POS credit payments ({posCreditPayments.length})</summary>{posCreditPayments.map((payment) => <p key={payment.id}><strong>{cash(payment.amount, payment.currency)} · {payment.method} · {payment.sale.receiptNumber}</strong><small>{payment.reference} · {day(payment.paymentDate)} · {payment.receivedBy?.firstName || payment.receivedBy?.email || 'Staff'}</small></p>)}</details>}
            </section>
            {filterOpen && <div className="customer-dashboard-date-filter"><label>From<input type="date" max={toDate || undefined} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To<input type="date" min={fromDate || undefined} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><button type="button" className="button button--ghost button--small" onClick={() => { setFromDate(''); setToDate(''); }}>Clear dates</button></div>}
            {currencies.map((currency) => (
              <section className="customer-dashboard-currency" key={currency}>
                <h3>{currency}</h3>
                <div className="customer-dashboard-cards">
                  {cardViews.map((metric, index) => {
                    const cardId = currency + '-' + index;
                    const details = cardDetails(metric, currency);
                    return <article className={'customer-dashboard-card' + (openCard === cardId ? ' is-open' : '')} key={cardId}>
                      <button type="button" className="customer-dashboard-card__toggle" aria-expanded={openCard === cardId} onClick={() => setOpenCard((current) => current === cardId ? null : cardId)}><span>{labels[metric]}</span><strong>{cash(String(metricValue(metric, currency)), currency)}</strong><small>{details.length} records</small></button>
                      <label className="customer-dashboard-card__view">Calculation view<select aria-label={'Calculation view for card ' + (index + 1) + ' in ' + currency} value={metric} onChange={(event) => setCardViews((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      {openCard === cardId && <div className="customer-dashboard-card__details">{details.length ? details.map((item) => <div key={item.id}><span><strong>{item.reference}</strong><small>{item.detail} · {day(item.date)}</small></span><b>{item.amount}{'invoice' in item && ((item.invoice as Invoice).id.startsWith('offline:') ? <small>Pending sync</small> : <button type="button" onClick={() => onPreview(item.invoice as Invoice)}><Eye size={14} /> View</button>)}</b></div>) : <p>No activity in this date range.</p>}</div>}
                    </article>;
                  })}
                </div>
              </section>
            ))}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Issue date</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th className="is-right">Total</th>
                    <th className="is-right">Paid</th>
                    <th className="is-right">Balance</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {liveInvoices.filter((invoice) => dateInRange(invoice.issueDate)).map((invoice) => {
                    return (
                      <tr key={invoice.id}>
                        <td className="is-primary">{invoice.number}</td>
                        <td>{day(invoice.issueDate)}</td>
                        <td>{day(invoice.dueDate)}</td>
                        <td>{dashboardStatus(invoice)}</td>
                        <td className="is-right">{cash(invoice.total, invoice.currency)}</td>
                        <td className="is-right">{cash(String(Number(invoice.paidAmount) + pendingAmount(invoice)), invoice.currency)}</td>
                        <td className="is-right">{cash(String(balance(invoice)), invoice.currency)}</td>
                        <td className="is-right">
                          {invoice.id.startsWith('offline:') ? <span>Pending sync</span> : <button onClick={() => onPreview(invoice)}><Eye size={15} /> View</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {!liveInvoices.filter((invoice) => dateInRange(invoice.issueDate)).length && (
                    <tr>
                      <td className="table-empty" colSpan={8}>
                        No invoices recorded for this customer in the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function InvoicePaper({ invoice }: { invoice: Invoice }) {
  const subtotal =
    invoice.items?.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0) ??
    Number(invoice.subtotal);
  const companyName = invoice.organization?.name || 'Cephas Books';
  const terms = Math.max(
    0,
    Math.round(
      (new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / 86_400_000,
    ),
  );
  return (
    <article className="invoice-paper" id="invoice-paper">
      <div className="invoice-paper__accent" aria-hidden="true" />
      <div className="invoice-paper__content">
        <header className="invoice-paper__header">
          <div className="invoice-paper__brand">
            <div className="invoice-paper__logo" aria-label={`${companyName} logo`}>
              {companyName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
            <strong>{companyName}</strong>
            <span>Professional accounting made simple</span>
          </div>
          <h1>Invoice</h1>
        </header>
        <section className="invoice-paper__parties">
          <div>
            <b>Bill to</b>
            <strong>{invoice.customer.displayName}</strong>
            <span>
              {invoice.customer.companyName || invoice.customer.email || 'Valued customer'}
            </span>
            {invoice.customer.billingAddress && <span>{invoice.customer.billingAddress}</span>}
          </div>
          <div>
            <b>Ship to</b>
            <strong>{invoice.customer.displayName}</strong>
            <span>
              {invoice.shippingAddress ||
                invoice.customer.billingAddress ||
                invoice.customer.email ||
                'As agreed'}
            </span>
          </div>
          <div className="invoice-paper__details">
            <b>Details</b>
            <span>
              Invoice # <strong>{invoice.number}</strong>
            </span>
            <span>
              Invoice date <strong>{day(invoice.issueDate)}</strong>
            </span>
            <span>
              Terms <strong>Net {terms}</strong>
            </span>
            <span>
              Due date <strong>{day(invoice.dueDate)}</strong>
            </span>
          </div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Product/service</th>
              <th>Description</th>
              <th>Quantity/hrs</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{cash(String(item.unitPrice), invoice.currency)}</td>
                <td>
                  {cash(
                    item.lineTotal || String(Number(item.quantity) * Number(item.unitPrice)),
                    invoice.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="invoice-paper__footer">
          <div className="invoice-paper__message">
            <b>Customer message</b>
            <strong>Hello!</strong>
            <p>
              {invoice.notes ||
                `Thank you for your business. Please remit this invoice by ${day(invoice.dueDate)}.`}
            </p>
          </div>
          <div className="invoice-paper__totals">
            <span>
              Subtotal <b>{cash(String(subtotal), invoice.currency)}</b>
            </span>
            <span>
              Sales tax <b>{cash(invoice.taxTotal, invoice.currency)}</b>
            </span>
            <span>
              Shipping <b>{cash(invoice.shippingAmount || '0', invoice.currency)}</b>
            </span>
            <strong>
              Total <b>{cash(invoice.total, invoice.currency)}</b>
            </strong>
          </div>
        </footer>
        <section className="invoice-payment-history">
          <h2>Payment history</h2>
          <div className="data-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reference</th><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {(invoice.payments ?? []).map((payment) => (
                  <tr key={payment.id}>
                    <td>{day(payment.paymentDate)}</td><td>{payment.reference}</td><td>{payment.method}</td>
                    <td>{cash(payment.amount, invoice.currency)}</td>
                  </tr>
                ))}
                {queuedCustomerPayments().filter((payment) => payment.invoiceId === invoice.id).map((payment) => (
                  <tr key={payment.id}>
                    <td>{day(payment.paymentDate)}</td><td>{payment.reference} · Pending sync</td><td>{payment.method}</td>
                    <td>{cash(String(payment.amount), invoice.currency)}</td>
                  </tr>
                ))}
                {!invoice.payments?.length && !queuedCustomerPayments().some((payment) => payment.invoiceId === invoice.id) && <tr><td colSpan={4}>No payments recorded for this invoice.</td></tr>}
              </tbody>
            </table>
          </div>
          <p>Outstanding balance <strong>{cash(String(invoiceOutstanding(invoice, true)), invoice.currency)}</strong></p>
        </section>
        <div className="invoice-paper__bottom-line" />
      </div>
    </article>
  );
}
function printInvoice(invoice: Invoice) {
  const source = document.getElementById('invoice-paper');
  const popup = window.open('', '_blank', 'width=900,height=1100');
  if (!popup) return;
  const safe = (value: unknown) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  const company = invoice.organization?.name || 'Cephas Books';
  const initials = company
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const terms = Math.max(
    0,
    Math.round(
      (new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / 86_400_000,
    ),
  );
  const subtotal =
    invoice.items?.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0) ??
    Number(invoice.subtotal);
  const fallback = `<article class="invoice-paper"><div class="invoice-paper__accent"></div><div class="invoice-paper__content"><header class="invoice-paper__header"><div class="invoice-paper__brand"><div class="invoice-paper__logo">${safe(initials)}</div><strong>${safe(company)}</strong><span>Professional accounting made simple</span></div><h1>Invoice</h1></header><section class="invoice-paper__parties"><div><b>Bill to</b><strong>${safe(invoice.customer.displayName)}</strong><span>${safe(invoice.customer.companyName || invoice.customer.email || 'Valued customer')}</span><span>${safe(invoice.customer.billingAddress)}</span></div><div><b>Ship to</b><strong>${safe(invoice.customer.displayName)}</strong><span>${safe(invoice.shippingAddress || invoice.customer.billingAddress || invoice.customer.email || 'As agreed')}</span></div><div class="invoice-paper__details"><b>Details</b><span>Invoice # <strong>${safe(invoice.number)}</strong></span><span>Invoice date <strong>${safe(day(invoice.issueDate))}</strong></span><span>Terms <strong>Net ${terms}</strong></span><span>Due date <strong>${safe(day(invoice.dueDate))}</strong></span></div></section><table><thead><tr><th>Product/service</th><th>Description</th><th>Quantity/hrs</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${(invoice.items || []).map((item) => `<tr><td>${safe(item.name)}</td><td>${safe(item.description)}</td><td>${safe(item.quantity)}</td><td>${safe(cash(String(item.unitPrice), invoice.currency))}</td><td>${safe(cash(item.lineTotal || String(Number(item.quantity) * Number(item.unitPrice)), invoice.currency))}</td></tr>`).join('')}</tbody></table><footer class="invoice-paper__footer"><div class="invoice-paper__message"><b>Customer message</b><strong>Hello!</strong><p>${safe(invoice.notes || `Thank you for your business. Please remit this invoice by ${day(invoice.dueDate)}.`)}</p></div><div class="invoice-paper__totals"><span>Subtotal <b>${safe(cash(String(subtotal), invoice.currency))}</b></span><span>Sales tax <b>${safe(cash(invoice.taxTotal, invoice.currency))}</b></span><span>Shipping <b>${safe(cash(invoice.shippingAmount || '0', invoice.currency))}</b></span><strong>Total <b>${safe(cash(invoice.total, invoice.currency))}</b></strong></div></footer><div class="invoice-paper__bottom-line"></div></div></article>`;
  popup.document.write(
    `<html><head><title>Invoice ${invoice.number}</title><style>${invoicePrintCss}</style></head><body>${source?.outerHTML || fallback}<script>window.onload=()=>window.print()</script></body></html>`,
  );
  popup.document.close();
}
const invoicePrintCss = `*{box-sizing:border-box}body{margin:0;background:#eceff3;font-family:Arial,sans-serif;color:#20242c}.invoice-paper{position:relative;width:210mm;min-height:297mm;margin:auto;overflow:hidden;background:#fff}.invoice-paper__accent{position:absolute;z-index:0;top:-44mm;left:50%;width:238mm;height:238mm;border-radius:50%;background:#ff8500;transform:translateX(-50%)}.invoice-paper__content{position:relative;z-index:1;width:174mm;min-height:253mm;margin:22mm auto;padding:9mm 10mm 8mm;background:#fff;box-shadow:0 8px 30px #1f293726}.invoice-paper__header{display:flex;align-items:flex-start;justify-content:space-between;border-top:2px solid #ff8500;padding-top:8mm}.invoice-paper__header h1{margin:3mm 0 0;font-size:27px}.invoice-paper__brand{display:grid;gap:2px;font-size:10px}.invoice-paper__logo{display:grid;width:15mm;height:12mm;place-items:center;margin-bottom:2mm;background:#20242c;color:#fff;font-size:18px;font-weight:800}.invoice-paper__brand>strong{font-size:14px}.invoice-paper__brand>span{color:#667085}.invoice-paper__parties{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8mm;margin:16mm -10mm 7mm;padding:5mm 10mm;background:#f3f4f6}.invoice-paper__parties>div{display:grid;align-content:start;gap:2px;font-size:9px}.invoice-paper__parties b{margin-bottom:2px}.invoice-paper__parties strong{font-size:10px}.invoice-paper__parties span{color:#555d69}.invoice-paper__details span{display:flex;justify-content:space-between;gap:5px}.invoice-paper table{width:100%;border-collapse:collapse}.invoice-paper th{padding:3mm 2mm;border-bottom:1px solid #272b32;font-size:9px;text-align:left}.invoice-paper td{padding:3mm 2mm;border-bottom:1px solid #e5e7eb;font-size:9px}.invoice-paper th:nth-child(n+3),.invoice-paper td:nth-child(n+3){text-align:right}.invoice-paper__footer{display:grid;grid-template-columns:1.5fr 1fr;gap:14mm;margin-top:9mm}.invoice-paper__message{display:grid;align-content:start;gap:3px;font-size:9px}.invoice-paper__message>strong{margin-top:2mm}.invoice-paper__message p{margin:0;line-height:1.5;color:#59616d}.invoice-paper__totals{display:grid;align-self:start}.invoice-paper__totals span,.invoice-paper__totals>strong{display:flex;justify-content:space-between;padding:2.3mm 1mm;font-size:9px}.invoice-paper__totals>strong{margin-top:1mm;border-top:1.5px solid #252932;font-size:14px}.invoice-paper__bottom-line{height:2px;margin-top:18mm;background:#ff8500}@page{size:A4;margin:0}@media print{body{background:#fff}.invoice-paper{break-after:page}}`;
function CreateModal({
  open,
  view,
  selected,
  customerPresetId,
  projects,
  customers,
  canApproveCredit,
  invoices,
  busy,
  error,
  close,
  submit,
}: {
  open: boolean;
  view: View;
  selected: Customer | null;
  customerPresetId: string;
  projects: Array<{ id: string; code: string; name: string }>;
  customers: Customer[];
  canApproveCredit: boolean;
  invoices: Invoice[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (d: Record<string, unknown>, intent?: 'draft' | 'send') => void;
}) {
  const document = view === 'quotations' || view === 'invoices';
  const paymentForm = view === 'payments' || view === 'receivables';
  const [lineItems, setLineItems] = useState([
    { name: '', description: '', quantity: '', unitPrice: '' },
  ]);
  const [taxRate, setTaxRate] = useState('0');
  const [customerSelect, setCustomerSelect] = useState(customerPresetId);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(todayDateInput());
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [creditStatus, setCreditStatus] = useState<Awaited<ReturnType<typeof salesApi.customerCreditStatus>> | null>(null);
  const [creditStatusError, setCreditStatusError] = useState('');
  const [approveCredit, setApproveCredit] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [creditCheckMessage, setCreditCheckMessage] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('Generating…');
  useEffect(() => {
    if (!open) return;
    setLineItems([{ name: '', description: '', quantity: '', unitPrice: '' }]);
    setTaxRate('0');
    setPaymentInvoiceId('');
    setInvoiceSearch('');
    setPaymentAmount('');
    setInvoiceIssueDate(todayDateInput());
  }, [open, view]);
  useEffect(() => setCustomerSelect(customerPresetId), [customerPresetId, open]);
  const selectedCustomerForInvoice = customers.find((customer) => customer.id === customerSelect);
  const invoiceTermsDays = selectedCustomerForInvoice?.paymentTermsDays ?? 30;
  const invoiceDuePreview = addDaysToDateInput(invoiceIssueDate, invoiceTermsDays);
  useEffect(() => {
    setCreditStatus(null); setCreditStatusError(''); setApproveCredit(false); setApprovalReason('');
    if (!open || view !== 'invoices' || !customerSelect) return;
    let active = true;
    void salesApi.customerCreditStatus(customerSelect).then((status) => { if (active) setCreditStatus(status); })
      .catch((caught) => { if (active) setCreditStatusError(caught instanceof Error ? caught.message : 'Unable to check customer credit'); });
    return () => { active = false; };
  }, [open, view, customerSelect]);
  useEffect(() => {
    if (!open || !document) return;
    const request =
      view === 'invoices' ? salesApi.nextInvoiceNumber() : salesApi.nextQuotationNumber();
    void request
      .then(({ number }) => setInvoiceNumber(number))
      .catch(() => setInvoiceNumber('Available after saving'));
  }, [document, open, view]);
  const updateLine = (
    index: number,
    field: 'name' | 'description' | 'quantity' | 'unitPrice',
    value: string,
  ) =>
    setLineItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  const quotationTotal = lineItems.reduce((sum, item) => {
    const amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    return sum + amount + amount * (Number(taxRate || 0) / 100);
  }, 0);
  const pendingPayments = queuedCustomerPayments();
  const payableInvoices = invoices.filter((invoice) => {
    const queued = pendingPayments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
    return !['DRAFT', 'VOID'].includes(invoice.status) &&
      Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount) - queued > 0;
  });
  const visiblePaymentInvoices = payableInvoices.filter((invoice) => {
    const term = invoiceSearch.trim().toLowerCase();
    return invoice.id === paymentInvoiceId || !term || `${invoice.number} ${invoice.customer.displayName} ${invoice.customer.companyName ?? ''} ${invoice.customer.email ?? ''}`.toLowerCase().includes(term);
  });
  const selectedPaymentInvoice = payableInvoices.find((invoice) => invoice.id === paymentInvoiceId);
  const queuedForSelectedInvoice = selectedPaymentInvoice
    ? pendingPayments.filter((payment) => payment.invoiceId === selectedPaymentInvoice.id).reduce((sum, payment) => sum + payment.amount, 0)
    : 0;
  const selectedOutstanding = selectedPaymentInvoice
    ? Math.max(0, Number(selectedPaymentInvoice.total) - Number(selectedPaymentInvoice.paidAmount) - Number(selectedPaymentInvoice.creditedAmount) - queuedForSelectedInvoice)
    : 0;
  return (
    <Modal
      open={open}
      onClose={close}
      wide={document}
      title={
        selected
          ? `Edit ${selected.displayName}`
          : view === 'customers'
            ? 'Add customer'
            : view === 'quotations'
              ? 'Create quotation'
              : view === 'invoices'
                ? 'Create invoice'
                : view === 'credit-notes'
                  ? 'Create credit note'
                  : 'Record payment'
      }
      footer={
        <>
          <button className="button button--secondary" onClick={close}>
            Cancel
          </button>
          {view === 'quotations' || view === 'invoices' ? (
            <>
              <button
                className="button button--secondary"
                disabled={busy}
                form="sales-form"
                type="submit"
                name="intent"
                value="draft"
                onClick={() => {
                  const statusField = window.document
                    .getElementById('sales-form')
                    ?.querySelector<HTMLSelectElement>('select[name="status"]');
                  if (statusField) statusField.value = 'DRAFT';
                }}
              >
                {busy ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                className="button"
                disabled={busy}
                form="sales-form"
                type="submit"
                name="intent"
                value="send"
                onClick={() => {
                  const statusField = window.document
                    .getElementById('sales-form')
                    ?.querySelector<HTMLSelectElement>('select[name="status"]');
                  if (statusField) statusField.value = 'SENT';
                }}
              >
                {busy ? 'Sending…' : view === 'invoices' ? 'Save & Send Invoice + Statement' : 'Save & Send to Customer'}
              </button>
            </>
          ) : (
            <button className="button" disabled={busy} form="sales-form" type="submit">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      }
    >
      <form
        id="sales-form"
        className="form-grid"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            get = (n: string) => String(f.get(n) || '');
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const intent = submitter?.value === 'send' ? 'send' : 'draft';
          if (view === 'invoices' && intent === 'send' && isWorkingOffline()) {
            setCreditCheckMessage('Sending an invoice requires an online credit limit check. Save it as a draft and send after reconnecting.');
            return;
          }
          if (view === 'invoices' && intent === 'send' && creditStatus &&
            Number(creditStatus.outstandingBalance) + quotationTotal + Number(get('shippingAmount') || 0) > Number(creditStatus.creditLimit) &&
            (!canApproveCredit || !approveCredit || !approvalReason.trim())) {
            setCreditCheckMessage(canApproveCredit
              ? 'This invoice exceeds the credit limit. Approve the exception and enter a reason to send it.'
              : 'This invoice exceeds the customer credit limit and requires an authorized approver.');
            return;
          }
          setCreditCheckMessage('');
          if (document && intent === 'send') {
            const customerField = e.currentTarget.querySelector<HTMLSelectElement>('select[name="customerId"]');
            const selectedCustomer = customers.find((customer) => customer.id === get('customerId'));
            if (!selectedCustomer?.email) {
              customerField?.setCustomValidity('Add an email address to this customer before sending.');
              customerField?.reportValidity();
              return;
            }
          }
          if (view === 'customers')
            if (selected && Number(get('creditLimit') || 0) !== Number(selected.creditLimit ?? 0) && !get('creditLimitReason').trim()) {
              const reasonField = e.currentTarget.querySelector<HTMLInputElement>('input[name="creditLimitReason"]');
              reasonField?.setCustomValidity('Enter a reason for changing the credit limit.');
              reasonField?.reportValidity();
              return;
            }
          if (view === 'customers')
            submit({
              name: get('name'),
              displayName: get('displayName'),
              email: get('email') || undefined,
              phone: get('phone') || undefined,
              companyName: get('companyName') || undefined,
              billingAddress: get('billingAddress') || undefined,
              paymentTermsDays: Number(get('paymentTermsDays') || 30),
              creditLimit: Number(get('creditLimit') || 0),
              ...(get('creditLimitReason').trim() ? { creditLimitReason: get('creditLimitReason').trim() } : {}),
            });
          else if (document)
            submit({
              customerId: get('customerId'),
              ...(view === 'invoices' && get('projectId') ? { projectId: get('projectId') } : {}),
              currency: getDefaultCurrency(),
              issueDate: get('issueDate'),
              ...(view === 'quotations'
                ? { expiryDate: get('dueDate'), status: get('status') }
                : {
                    dueDate: get('dueDate'),
                    shippingAddress: get('shippingAddress') || undefined,
                    shippingAmount: Number(get('shippingAmount')),
                  }),
              items: lineItems.map((item) => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                taxRate: Number(get('taxRate')),
              })),
              notes: get('notes') || undefined,
              ...(view === 'invoices' ? { creditLimitOverride: approveCredit, creditLimitOverrideReason: approvalReason.trim() || undefined } : {}),
            }, intent);
          else if (view === 'credit-notes')
            submit({
              invoiceId: get('invoiceId'),
              number: get('number'),
              amount: Number(get('amount')),
              issueDate: get('date'),
              reason: get('reason'),
            });
          else
            submit({
              invoiceId: get('invoiceId'),
              reference: get('reference'),
              amount: Number(get('amount')),
              paymentDate: get('date'),
              method: get('method'),
              notes: get('notes') || undefined,
            });
        }}
      >
        {creditCheckMessage && <p className="form-error full" role="alert">{creditCheckMessage}</p>}
        {view === 'customers' ? (
          <>
            <label>
              Name
              <input name="name" required defaultValue={selected?.name ?? selected?.displayName} />
            </label>
            <label className="full">
              Display name
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
            <PaymentTermsField
              key={selected?.id ?? 'new-customer'}
              name="paymentTermsDays"
              value={selected?.paymentTermsDays ?? 30}
              title="Customer payment terms"
            />
            <label>
              Phone
              <input name="phone" defaultValue={selected?.phone} />
            </label>
            <label>
              Approved credit limit
              <input name="creditLimit" type="number" min="0" step="0.01" defaultValue={selected?.creditLimit ?? '0'} />
            </label>
            <label>
              Credit limit adjustment reason <small>{selected ? 'Required when changed' : 'Optional'}</small>
              <input name="creditLimitReason" maxLength={1000} onChange={(event) => event.currentTarget.setCustomValidity('')} placeholder="Reason for setting or changing the limit" />
            </label>
            <label className="full">
              <span className="field-label">
                <MapPin size={14} /> Address <small>Optional</small>
              </span>
              <textarea
                name="billingAddress"
                rows={2}
                placeholder="Street, city, state"
                defaultValue={selected?.billingAddress}
              />
            </label>
          </>
        ) : (
          <>
            <label className="full">
              {document ? 'Customer Name' : 'Invoice Number'}
              {paymentForm && (
                <input
                  className="payment-invoice-search"
                  type="search"
                  aria-label="Search invoices by number or customer"
                  placeholder="Search invoice number or customer"
                  value={invoiceSearch}
                  onChange={(event) => setInvoiceSearch(event.target.value)}
                />
              )}
              <select
                name={document ? 'customerId' : 'invoiceId'}
                required
                value={document ? customerSelect : paymentForm ? paymentInvoiceId : undefined}
                defaultValue={document || paymentForm ? undefined : ''}
                onChange={(event) => {
                  if (document) setCustomerSelect(event.target.value);
                  if (paymentForm) {
                    setPaymentInvoiceId(event.target.value);
                    setPaymentAmount('');
                  }
                  event.currentTarget.setCustomValidity('');
                }}
              >
                <option value="" disabled>
                  {document ? 'Select a customer name' : 'Select an invoice number'}
                </option>
                {(document ? customers : paymentForm ? visiblePaymentInvoices : invoices).map((x) => (
                  <option key={x.id} value={x.id}>
                    {'displayName' in x ? x.displayName : `${x.number} — ${x.customer.displayName}`}
                  </option>
                ))}
              </select>
              {paymentForm && (
                <>
                  {!payableInvoices.length && <small className="field-hint">There are no outstanding invoices available for payment.</small>}
                  {!!payableInvoices.length && !visiblePaymentInvoices.length && <small className="field-hint">No outstanding invoices match this search.</small>}
                </>
              )}
              {view === 'invoices' && customers.length === 0 && (
                <small className="field-hint">Add a customer with a name before creating an invoice.</small>
              )}
            </label>
            {view === 'invoices' && creditStatus && (() => {
              const shipping = Number((window.document.querySelector<HTMLInputElement>('input[name="shippingAmount"]')?.value) || 0);
              const exceeds = Number(creditStatus.outstandingBalance) + quotationTotal + shipping > Number(creditStatus.creditLimit);
              return <div className={(exceeds ? 'banking-alert' : 'field-hint') + ' full'} role={exceeds ? 'alert' : 'status'}>
                Outstanding {cash(creditStatus.outstandingBalance, creditStatus.currency)} · available {cash(creditStatus.availableCredit, creditStatus.currency)}. {exceeds ? 'This invoice would exceed the approved credit limit.' : creditStatus.nearLimit ? 'Customer is approaching the approved credit limit.' : ''}
                {exceeds && canApproveCredit && <div><label><input type="checkbox" checked={approveCredit} onChange={(event) => setApproveCredit(event.target.checked)} /> Approve this credit exception</label>{approveCredit && <input aria-label="Credit exception approval reason" required maxLength={1000} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Approval reason" />}</div>}
              </div>;
            })()}
            {view === 'invoices' && creditStatusError && <p className="field-hint full">Credit balance could not be verified. Sending will still be checked securely by the server.</p>}
            {document && (
              <>
                {view === 'quotations' && (
                  <div className="quotation-section-title full">
                    <h3>Quotation</h3>
                    <p>Set the status and details that will appear on the customer quotation.</p>
                  </div>
                )}
                {view === 'invoices' && (
                  <div className="quotation-section-title full">
                    <h3>Invoice</h3>
                  <p>Choose a customer and enter the invoice billing details.</p>
                  </div>
                )}
                {view === 'invoices' && (
                  <label className="full">
                    Project (optional)
                    <select name="projectId" defaultValue="">
                      <option value="">General business invoice</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
                    </select>
                    <small className="field-hint">Payments against this invoice count as project receipts. Project invoices must use your organization’s base currency.</small>
                  </label>
                )}
                <label>
                  Number
                  <input
                    value={invoiceNumber}
                    readOnly
                    aria-label={`Automatically generated ${view === 'invoices' ? 'invoice' : 'quotation'} number`}
                  />
                </label>
                {view === 'quotations' && (
                  <label>
                    Status
                    <select name="status" defaultValue="DRAFT">
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                    </select>
                  </label>
                )}
                <label>
                  {view === 'quotations' ? 'Date' : 'Issue date'}
                  <input
                    name="issueDate"
                    type="date"
                    required
                    value={view === 'invoices' ? invoiceIssueDate : undefined}
                    defaultValue={view === 'quotations' ? todayDateInput() : undefined}
                    onChange={view === 'invoices' ? (event) => setInvoiceIssueDate(event.target.value) : undefined}
                  />
                </label>
                <label>
                  {view === 'quotations' ? 'Expiry' : 'Due'} date
                  <input
                    name="dueDate"
                    type="date"
                    required
                    value={view === 'invoices' ? invoiceDuePreview : undefined}
                    readOnly={view === 'invoices'}
                  />
                  {view === 'invoices' && <small className="field-hint">Calculated from customer terms: {invoiceTermsDays === 0 ? 'due on receipt' : `${invoiceTermsDays} days`}.</small>}
                </label>
                <div className="invoice-line-editor full">
                  <div className="invoice-line-editor__heading">
                    <span>{view === 'invoices' ? 'Invoice' : 'Quotation'} items</span>
                    <small>Add as many line items as needed.</small>
                  </div>
                  {lineItems.map((item, index) => (
                    <div className={`invoice-line-editor__row ${view === 'quotations' ? 'quotation-item-row' : ''}`} key={index}>
                      <label>
                        {view === 'quotations' ? 'Item Name' : 'Name'}
                        <input
                          required
                          value={item.name}
                          onChange={(event) => updateLine(index, 'name', event.target.value)}
                        />
                      </label>
                      <label>
                        {view === 'quotations' ? 'Item Details' : 'Line description'}
                        <input
                          required
                          value={item.description}
                          onChange={(event) => updateLine(index, 'description', event.target.value)}
                        />
                      </label>
                      <label>
                        {view === 'quotations' ? 'Qty' : 'Quantity'}
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
                        {view === 'quotations' ? 'Rate' : 'Unit price'}
                        <input
                          required
                          type="number"
                          min="0"
                          step=".01"
                          value={item.unitPrice}
                          onChange={(event) => updateLine(index, 'unitPrice', event.target.value)}
                        />
                      </label>
                      {view === 'quotations' && (
                        <label>
                          Amount
                          <input
                            readOnly
                            value={cash(String(Number(item.quantity || 0) * Number(item.unitPrice || 0)), getDefaultCurrency())}
                            aria-label={`Amount for item ${index + 1}`}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove item ${index + 1}`}
                        disabled={lineItems.length === 1}
                        onClick={() =>
                          setLineItems((items) =>
                            items.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
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
                <label>
                  Tax %<input name="taxRate" type="number" min="0" step=".01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
                </label>
                {view === 'quotations' && (
                  <div className="quotation-total-card">
                    <small>Quotation total</small>
                    <strong>{cash(String(quotationTotal))}</strong>
                  </div>
                )}
                {view === 'invoices' && (
                  <>
                    <label>
                      Shipping amount
                      <input
                        name="shippingAmount"
                        type="number"
                        min="0"
                        step=".01"
                        defaultValue="0"
                      />
                    </label>
                    <label className="full">
                      Shipping address <small>Optional — billing address is used by default</small>
                      <textarea name="shippingAddress" rows={2} placeholder="Delivery address" />
                    </label>
                  </>
                )}
                <label className="full">
                  {view === 'quotations' ? 'Terms & Conditions' : 'Customer message'} <small>Optional</small>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder={view === 'quotations' ? 'Enter the terms and conditions for this quotation.' : 'Thank you for your business. Please remit this invoice by the due date.'}
                  />
                </label>
              </>
            )}
            {!document && (
              <>
                {paymentForm && selectedPaymentInvoice && (
                  <section className="payment-invoice-summary full" aria-live="polite">
                    <header>
                      <div><small>Selected invoice</small><strong>{selectedPaymentInvoice.number}</strong></div>
                      <span>{invoiceStatusLabel(selectedPaymentInvoice).replaceAll('_', ' ')}</span>
                    </header>
                    <div className="payment-invoice-summary__customer">
                      <strong>{selectedPaymentInvoice.customer.displayName}</strong>
                      {selectedPaymentInvoice.customer.companyName && <span>{selectedPaymentInvoice.customer.companyName}</span>}
                      {selectedPaymentInvoice.customer.email && <span>{selectedPaymentInvoice.customer.email}</span>}
                    </div>
                    <div className="payment-invoice-summary__amounts">
                      <span>Invoice total <b>{cash(selectedPaymentInvoice.total, selectedPaymentInvoice.currency)}</b></span>
                      <span>Paid to date <b>{cash(selectedPaymentInvoice.paidAmount, selectedPaymentInvoice.currency)}</b></span>
                      {Number(selectedPaymentInvoice.creditedAmount) > 0 && <span>Credits applied <b>{cash(selectedPaymentInvoice.creditedAmount, selectedPaymentInvoice.currency)}</b></span>}
                      <span>Outstanding <b>{cash(String(selectedOutstanding), selectedPaymentInvoice.currency)}</b></span>
                      {paymentAmount && Number(paymentAmount) > 0 && Number(paymentAmount) <= selectedOutstanding && (
                        <span>Balance after payment <b>{cash(String(selectedOutstanding - Number(paymentAmount)), selectedPaymentInvoice.currency)}</b></span>
                      )}
                    </div>
                  </section>
                )}
                {paymentForm && selectedPaymentInvoice && (
                  <label key={selectedPaymentInvoice.id} className="payment-invoice-confirmation full">
                    <input type="checkbox" name="confirmInvoiceAllocation" required />
                    <span>I confirm this payment belongs to invoice <strong>{selectedPaymentInvoice.number}</strong> for <strong>{selectedPaymentInvoice.customer.displayName}</strong>.</span>
                  </label>
                )}
                <label>
                  {view === 'credit-notes' ? 'Credit note number' : 'Reference'}
                  <input name={view === 'credit-notes' ? 'number' : 'reference'} required />
                </label>
                <label>
                  Amount
                  <input
                    name="amount"
                    type="number"
                    min=".01"
                    step=".01"
                    max={paymentForm && selectedPaymentInvoice ? selectedOutstanding : undefined}
                    required
                    value={paymentForm ? paymentAmount : undefined}
                    onChange={paymentForm ? (event) => setPaymentAmount(event.target.value) : undefined}
                  />
                </label>
                <label>
                  Date
                  <input name="date" type="date" required />
                </label>
                {view === 'credit-notes' ? (
                  <label className="full">
                    Reason
                    <input name="reason" required />
                  </label>
                ) : (
                  <label>
                    Method
                    <select name="method">
                      <option>Bank transfer</option>
                      <option>Cash</option>
                      <option>Card</option>
                      <option>Cheque</option>
                    </select>
                  </label>
                )}
              </>
            )}
          </>
        )}
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

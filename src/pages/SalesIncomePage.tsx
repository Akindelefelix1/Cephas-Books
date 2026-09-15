import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatsGrid } from '@/components/ui/StatsGrid';
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
type View = 'customers' | 'quotations' | 'invoices' | 'payments' | 'credit-notes' | 'receivables';
type Row = Customer | Quotation | Invoice | Payment | CreditNote;
const cash = (v: string, c = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: c }).format(Number(v));
const day = (v: string) => new Date(v).toLocaleDateString('en-NG');
export function SalesIncomePage({ view, role }: { view: View; role: string }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const [summary, setSummary] = useState<SalesSummary | null>(null),
    [customers, setCustomers] = useState<Customer[]>([]),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState<Customer | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c, i] = await Promise.all([
        salesApi.summary(),
        salesApi.customers(),
        salesApi.invoices(),
      ]);
      setSummary(s);
      setCustomers(c.data);
      setInvoices(i);
      if (view === 'customers')
        setRows(
          c.data.filter(
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
              (!status || x.status === status),
          ),
        );
      else if (view === 'quotations') setRows(await salesApi.quotations({ search, status }));
      else if (view === 'payments') setRows(await salesApi.payments({ search }));
      else if (view === 'credit-notes') setRows(await salesApi.credits({ search }));
      else setRows(await salesApi.receivables({ search }));
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
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setModal(false);
      setSelected(null);
      confirmAction(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record');
    } finally {
      setBusy(false);
    }
  };
  const title: Record<View, string> = {
    customers: 'Customers',
    quotations: 'Quotations',
    invoices: 'Invoices',
    payments: 'Payments received',
    'credit-notes': 'Credit notes',
    receivables: 'Receivables',
  };
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
      ...rows.map((r) =>
        values(view, r)
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
          <button className="button button--secondary" onClick={exportCsv}>
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
      {summary && (
        <StatsGrid
          stats={[
            { label: 'Customers', value: String(summary.customers) },
            { label: 'Open quotations', value: String(summary.openQuotations) },
            { label: 'Payments received', value: cash(summary.received), tone: 'positive' },
            { label: 'Outstanding receivables', value: cash(summary.receivable), tone: 'warning' },
          ]}
        />
      )}
      <section className="panel register-panel">
        <div className="banking-filters">
          <input
            placeholder={`Search ${title[view].toLowerCase()}`}
            aria-label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(view === 'invoices' || view === 'quotations') && (
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {[
                'DRAFT',
                'SENT',
                'ACCEPTED',
                'PARTIALLY_PAID',
                'PAID',
                'OVERDUE',
                'DECLINED',
                'VOID',
              ].map((x) => (
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
            <RefreshCw className="spin" />
            Loading…
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns(view).map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {values(view, r).map((x, j) => (
                      <td key={j}>{x}</td>
                    ))}
                    {canEdit && (
                      <td>
                        <div className="inline-actions">
                          {actions(
                            view,
                            r,
                            (op, msg) => void run(op, msg),
                            () => {
                              if (view === 'customers') {
                                setSelected(r as Customer);
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
                    <td className="table-empty" colSpan={columns(view).length + 1}>
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CreateModal
        open={modal}
        view={view}
        selected={selected}
        customers={customers}
        invoices={invoices.filter(
          (x) => Number(x.total) - Number(x.paidAmount) - Number(x.creditedAmount) > 0,
        )}
        busy={busy}
        error={error}
        close={() => {
          setModal(false);
          setSelected(null);
        }}
        submit={(data) => void run(() => create(view, data, selected), `${title[view]} saved`)}
      />
    </>
  );
}
function columns(v: View) {
  return v === 'customers'
    ? ['Name', 'Email', 'Phone', 'Status']
    : v === 'quotations'
      ? ['Number', 'Customer', 'Total', 'Expiry', 'Status']
      : v === 'invoices'
        ? ['Number', 'Customer', 'Total', 'Balance', 'Due', 'Status']
        : v === 'payments'
          ? ['Reference', 'Customer', 'Invoice', 'Amount', 'Date', 'Method']
          : v === 'credit-notes'
            ? ['Number', 'Customer', 'Invoice', 'Amount', 'Date', 'Status']
            : ['Invoice', 'Customer', 'Due date', 'Original', 'Outstanding', 'Age'];
}
function values(v: View, r: Row): string[] {
  if (v === 'customers') {
    const x = r as Customer;
    return [x.displayName, x.email || '—', x.phone || '—', x.isActive ? 'Active' : 'Archived'];
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
          cash(x.total, x.currency),
          cash(String(out), x.currency),
          day(x.dueDate),
          x.status,
        ]
      : [
          x.number,
          x.customer.displayName,
          day(x.dueDate),
          cash(x.total, x.currency),
          cash(String(out), x.currency),
          `${Math.max(0, Math.floor((Date.now() - new Date(x.dueDate).getTime()) / 86400000))} days`,
        ];
  }
  if (v === 'payments') {
    const x = r as Payment;
    return [
      x.reference,
      x.customer.displayName,
      x.invoice.number,
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
) {
  if (v === 'customers')
    return (
      <>
        <button onClick={edit}>Edit</button>
        <button onClick={() => run(() => salesApi.archiveCustomer(r.id), 'Customer archived')}>
          Archive
        </button>
      </>
    );
  if (v === 'quotations') {
    const x = r as Quotation;
    return (
      <>
        <button
          onClick={() => run(() => salesApi.quotationStatus(x.id, 'SENT'), 'Quotation marked sent')}
        >
          Send
        </button>
        <button onClick={() => run(() => salesApi.convertQuotation(x.id), 'Invoice created')}>
          Convert
        </button>
        <button
          onClick={() => run(() => salesApi.quotationStatus(x.id, 'VOID'), 'Quotation voided')}
        >
          Void
        </button>
      </>
    );
  }
  if (v === 'payments')
    return (
      <button onClick={() => run(() => salesApi.reversePayment(r.id), 'Payment reversed')}>
        Reverse
      </button>
    );
  if (v === 'credit-notes')
    return (
      <button onClick={() => run(() => salesApi.voidCredit(r.id), 'Credit note voided')}>
        Void
      </button>
    );
  return null;
}
async function create(v: View, d: Record<string, unknown>, selected: Customer | null) {
  if (v === 'customers')
    return selected ? salesApi.updateCustomer(selected.id, d) : salesApi.createCustomer(d);
  if (v === 'quotations') return salesApi.createQuotation(d);
  if (v === 'invoices') return salesApi.createInvoice(d);
  if (v === 'payments' || v === 'receivables') return salesApi.createPayment(d);
  return salesApi.createCredit(d);
}
function CreateModal({
  open,
  view,
  selected,
  customers,
  invoices,
  busy,
  error,
  close,
  submit,
}: {
  open: boolean;
  view: View;
  selected: Customer | null;
  customers: Customer[];
  invoices: Invoice[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (d: Record<string, unknown>) => void;
}) {
  const document = view === 'quotations' || view === 'invoices';
  return (
    <Modal
      open={open}
      onClose={close}
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
          <button className="button" disabled={busy} form="sales-form" type="submit">
            {busy ? 'Saving…' : 'Save'}
          </button>
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
          if (view === 'customers')
            submit({
              displayName: get('displayName'),
              email: get('email') || undefined,
              phone: get('phone') || undefined,
              companyName: get('companyName') || undefined,
            });
          else if (document)
            submit({
              customerId: get('customerId'),
              number: get('number'),
              currency: 'NGN',
              issueDate: get('issueDate'),
              ...(view === 'quotations'
                ? { expiryDate: get('dueDate') }
                : { dueDate: get('dueDate'), status: 'DRAFT' }),
              items: [
                {
                  description: get('description'),
                  quantity: Number(get('quantity')),
                  unitPrice: Number(get('unitPrice')),
                  taxRate: Number(get('taxRate')),
                },
              ],
              notes: get('notes') || undefined,
            });
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
        {view === 'customers' ? (
          <>
            <label className="full">
              Customer name
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
          </>
        ) : (
          <>
            <label className="full">
              {document ? 'Customer' : 'Invoice'}
              <select name={document ? 'customerId' : 'invoiceId'} required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                {(document ? customers : invoices).map((x) => (
                  <option key={x.id} value={x.id}>
                    {'displayName' in x ? x.displayName : `${x.number} — ${x.customer.displayName}`}
                  </option>
                ))}
              </select>
            </label>
            {document && (
              <>
                <label>
                  Number
                  <input name="number" required />
                </label>
                <label>
                  Issue date
                  <input name="issueDate" type="date" required />
                </label>
                <label>
                  {view === 'quotations' ? 'Expiry' : 'Due'} date
                  <input name="dueDate" type="date" required />
                </label>
                <label className="full">
                  Line description
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
            {!document && (
              <>
                <label>
                  {view === 'credit-notes' ? 'Credit note number' : 'Reference'}
                  <input name={view === 'credit-notes' ? 'number' : 'reference'} required />
                </label>
                <label>
                  Amount
                  <input name="amount" type="number" min=".01" step=".01" required />
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

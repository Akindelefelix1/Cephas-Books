import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Eye, History, MapPin, Plus, Send, Trash2 } from 'lucide-react';
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
type View = 'customers' | 'quotations' | 'invoices' | 'payments' | 'credit-notes' | 'receivables';
type Row = Customer | Quotation | Invoice | Payment | CreditNote;
const cash = (v: string, c = getDefaultCurrency()) =>
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
    [selected, setSelected] = useState<Customer | null>(null),
    [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null),
    [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]),
    [historyLoading, setHistoryLoading] = useState(false),
    [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
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
      setCustomers(c.data.filter((customer) => customer.isActive));
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
    if (!historyCustomer) return;
    void salesApi
      .customerPurchaseHistory(historyCustomer.id)
      .then(setHistoryInvoices)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load purchase history'),
      )
      .finally(() => setHistoryLoading(false));
  }, [historyCustomer]);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setModal(false);
      setSelected(null);
      confirmAction(message);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record');
      return false;
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
              {(view === 'quotations'
                ? ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED', 'VOID']
                : ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID']
              ).map((x) => (
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
          <LoadingState label="Loading sales and income…" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns(view).map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {(canEdit || view === 'customers') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {values(view, r).map((x, j) => (
                      <td key={j}>{x}</td>
                    ))}
                    {(canEdit || view === 'customers') && (
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
                              setHistoryInvoices([]);
                              setHistoryLoading(true);
                              setHistoryCustomer(customer);
                            },
                            canEdit,
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
                      colSpan={columns(view).length + (canEdit || view === 'customers' ? 1 : 0)}
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
      <ConfirmModal
        key={confirmation?.title}
        confirmation={confirmation}
        busy={busy}
        error={error}
        onClose={() => setConfirmation(null)}
      />
      <InvoicePreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      <CustomerHistoryModal
        customer={historyCustomer}
        invoices={historyInvoices}
        loading={historyLoading}
        onClose={() => setHistoryCustomer(null)}
        onPreview={setPreviewInvoice}
      />
    </>
  );
}
function columns(v: View) {
  return v === 'customers'
    ? ['Name', 'Email', 'Phone', 'Address', 'Status']
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
    return [
      x.displayName,
      x.email || '—',
      x.phone || '—',
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
  preview: (invoice: Invoice) => void,
  history: (customer: Customer) => void,
  canEdit: boolean,
) {
  if (v === 'invoices') {
    const invoice = r as Invoice;
    return (
      <>
        <button onClick={() => preview(invoice)}><Eye size={15} /> Preview</button>
        <button onClick={() => printInvoice(invoice)}><Download size={15} /> Download</button>
        <button onClick={() => run(() => salesApi.sendInvoice(invoice.id), 'Invoice emailed to customer')}><Send size={15} /> Send</button>
      </>
    );
  }
  if (v === 'customers')
    return (
      <>
        <button onClick={() => history(r as Customer)}><History size={15} /> History</button>
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
        {x.status === 'DRAFT' && (
          <button
            onClick={() =>
              run(() => salesApi.quotationStatus(x.id, 'SENT'), 'Quotation marked sent')
            }
          >
            Send
          </button>
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
  if (v === 'payments')
    return (
      <button onClick={() => run(() => salesApi.reversePayment(r.id), 'Payment reversed')}>
        Reverse
      </button>
    );
  if (v === 'credit-notes' && !(r as CreditNote).isVoid)
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
function InvoicePreview({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  if (!invoice) return null;
  return (
    <Modal open title={`Invoice ${invoice.number}`} onClose={onClose} wide footer={<><button className="button button--secondary" onClick={onClose}>Close</button><button className="button button--secondary" onClick={() => printInvoice(invoice)}><Download size={16} /> Download PDF</button><button className="button" onClick={() => void salesApi.sendInvoice(invoice.id).then(() => confirmAction('Invoice emailed to customer'))}><Send size={16} /> Send email</button></>}>
      <InvoicePaper invoice={invoice} />
    </Modal>
  );
}
function CustomerHistoryModal({
  customer,
  invoices,
  loading,
  onClose,
  onPreview,
}: {
  customer: Customer | null;
  invoices: Invoice[];
  loading: boolean;
  onClose: () => void;
  onPreview: (invoice: Invoice) => void;
}) {
  if (!customer) return null;
  const purchases = invoices
    .filter((invoice) => invoice.customerId === customer.id || invoice.customer.id === customer.id)
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  const total = purchases.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstanding = purchases.reduce(
    (sum, invoice) =>
      sum + Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount),
    0,
  );
  return (
    <Modal
      open
      wide
      title={`${customer.displayName} purchase history`}
      subtitle={customer.billingAddress || customer.email || 'Customer account history'}
      onClose={onClose}
      footer={<button className="button button--secondary" onClick={onClose}>Close</button>}
    >
      <div className="customer-history">
        {loading ? (
          <LoadingState label="Loading purchase history…" />
        ) : (
          <>
        <div className="customer-history__summary">
          <div><span>Invoices</span><strong>{purchases.length}</strong></div>
          <div><span>Total purchases</span><strong>{cash(String(total))}</strong></div>
          <div><span>Outstanding</span><strong>{cash(String(Math.max(0, outstanding)))}</strong></div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Status</th>
                <th className="is-right">Total</th>
                <th className="is-right">Paid</th>
                <th className="is-right">Balance</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((invoice) => {
                const balance =
                  Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount);
                return (
                  <tr key={invoice.id}>
                    <td className="is-primary">{invoice.number}</td>
                    <td>{day(invoice.issueDate)}</td>
                    <td><span className="banking-status">{invoice.status.replace('_', ' ')}</span></td>
                    <td className="is-right">{cash(invoice.total, invoice.currency)}</td>
                    <td className="is-right">{cash(invoice.paidAmount, invoice.currency)}</td>
                    <td className="is-right">{cash(String(Math.max(0, balance)), invoice.currency)}</td>
                    <td className="is-right">
                      <button onClick={() => onPreview(invoice)}><Eye size={15} /> View</button>
                    </td>
                  </tr>
                );
              })}
              {!purchases.length && (
                <tr><td className="table-empty" colSpan={7}>No purchases recorded for this customer.</td></tr>
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
  const subtotal = invoice.items?.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0) ?? Number(invoice.subtotal);
  return <article className="invoice-paper" id="invoice-paper">
    <header><div><h1>INVOICE</h1><span>THANK YOU FOR YOUR BUSINESS</span></div><div className="invoice-paper__meta"><b>DATE</b><strong>{day(invoice.issueDate)}</strong><b>INVOICE NO.</b><strong>{invoice.number}</strong></div></header>
    <section className="invoice-paper__addresses"><div><b>FROM</b><strong>Cephas Books</strong><span>Professional accounting made simple</span></div><div><b>BILL TO</b><strong>{invoice.customer.displayName}</strong><span>{invoice.customer.companyName || invoice.customer.email || 'Valued customer'}</span></div></section>
    <table><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>AMOUNT</th></tr></thead><tbody>{invoice.items?.map((item, index) => <tr key={index}><td>{item.description}</td><td>{item.quantity}</td><td>{cash(String(item.unitPrice), invoice.currency)}</td><td>{cash(item.lineTotal || String(Number(item.quantity) * Number(item.unitPrice)), invoice.currency)}</td></tr>)}</tbody></table>
    <footer><div><b>PAYMENT INFORMATION</b><p>Please remit payment by {day(invoice.dueDate)}.</p><em>Thank you!</em></div><div className="invoice-paper__totals"><span>SUBTOTAL <b>{cash(String(subtotal), invoice.currency)}</b></span><span>TAX <b>{cash(invoice.taxTotal, invoice.currency)}</b></span><strong>TOTAL DUE <b>{cash(invoice.total, invoice.currency)}</b></strong></div></footer>
  </article>;
}
function printInvoice(invoice: Invoice) {
  const source = document.getElementById('invoice-paper');
  const popup = window.open('', '_blank', 'width=900,height=1100');
  if (!popup) return;
  const fallback = `<article class="invoice-paper"><header><div><h1>INVOICE</h1><span>THANK YOU FOR YOUR BUSINESS</span></div><div class="invoice-paper__meta"><b>DATE</b><strong>${day(invoice.issueDate)}</strong><b>INVOICE NO.</b><strong>${invoice.number}</strong></div></header><section class="invoice-paper__addresses"><div><b>FROM</b><strong>Cephas Books</strong></div><div><b>BILL TO</b><strong>${invoice.customer.displayName}</strong><span>${invoice.customer.email || ''}</span></div></section><table><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>AMOUNT</th></tr></thead><tbody>${(invoice.items || []).map((item) => `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${cash(String(item.unitPrice), invoice.currency)}</td><td>${cash(item.lineTotal || String(Number(item.quantity) * Number(item.unitPrice)), invoice.currency)}</td></tr>`).join('')}</tbody></table><footer><div><b>PAYMENT INFORMATION</b><p>Please remit payment by ${day(invoice.dueDate)}.</p><em>Thank you!</em></div><div class="invoice-paper__totals"><strong>TOTAL DUE <b>${cash(invoice.total, invoice.currency)}</b></strong></div></footer></article>`;
  popup.document.write(`<html><head><title>Invoice ${invoice.number}</title><style>${invoicePrintCss}</style></head><body>${source?.outerHTML || fallback}<script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}
const invoicePrintCss = `body{margin:0;background:#eee;font-family:Arial,sans-serif}.invoice-paper{box-sizing:border-box;width:210mm;min-height:297mm;margin:auto;padding:20mm;background:#f8f1e2;color:#493b2e;border:10px solid #604a34}.invoice-paper header,.invoice-paper footer,.invoice-paper__addresses{display:flex;justify-content:space-between;gap:28px}.invoice-paper h1{font-family:Georgia,serif;font-style:italic;font-size:35px;margin:0}.invoice-paper header span,.invoice-paper b{font-size:10px;letter-spacing:.7px}.invoice-paper__meta{display:grid;grid-template-columns:auto auto;gap:5px 16px}.invoice-paper__meta strong{font-size:12px}.invoice-paper__addresses{margin:45px 0 24px}.invoice-paper__addresses div{display:grid;gap:5px;min-width:180px}.invoice-paper__addresses strong{font-family:Georgia,serif}.invoice-paper__addresses span{font-size:12px}.invoice-paper table{width:100%;border-collapse:collapse;background:#fffdf8;border:1px solid #9a876e}.invoice-paper th{padding:10px;background:#604a34;color:white;font-size:10px;text-align:left}.invoice-paper td{padding:13px 10px;border-bottom:1px solid #ddd1bf;font-size:12px}.invoice-paper th:nth-child(2),.invoice-paper td:nth-child(2){text-align:center}.invoice-paper th:nth-child(3),.invoice-paper th:nth-child(4),.invoice-paper td:nth-child(3),.invoice-paper td:nth-child(4){text-align:right}.invoice-paper footer{margin-top:32px}.invoice-paper footer>div{flex:1;font-size:12px}.invoice-paper footer em{display:block;margin-top:45px;font-family:Georgia,serif;font-size:18px}.invoice-paper__totals{border:1px solid #9a876e;align-self:start}.invoice-paper__totals span,.invoice-paper__totals strong{display:flex;justify-content:space-between;padding:9px 12px;font-size:11px}.invoice-paper__totals strong{background:#604a34;color:#fff}@page{size:A4;margin:0}@media print{body{background:white}.invoice-paper{border-width:8px}}`;
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
  const [lineItems, setLineItems] = useState([{ description: '', quantity: '', unitPrice: '' }]);
  const [invoiceNumber, setInvoiceNumber] = useState('Generating…');
  useEffect(() => {
    if (!open || view !== 'invoices') return;
    setInvoiceNumber('Generating…');
    void salesApi.nextInvoiceNumber()
      .then(({ number }) => setInvoiceNumber(number))
      .catch(() => setInvoiceNumber('Available after saving'));
  }, [open, view]);
  const updateLine = (index: number, field: 'description' | 'quantity' | 'unitPrice', value: string) =>
    setLineItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
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
              billingAddress: get('billingAddress') || undefined,
            });
          else if (document)
            submit({
              customerId: get('customerId'),
              ...(view === 'quotations' ? { number: get('number') } : {}),
              currency: getDefaultCurrency(),
              issueDate: get('issueDate'),
              ...(view === 'quotations'
                ? { expiryDate: get('dueDate') }
                : { dueDate: get('dueDate'), status: 'DRAFT' }),
              items: view === 'invoices'
                ? lineItems.map((item) => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxRate: Number(get('taxRate')) }))
                : [{ description: get('description'), quantity: Number(get('quantity')), unitPrice: Number(get('unitPrice')), taxRate: Number(get('taxRate')) }],
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
            <label className="full">
              <span className="field-label"><MapPin size={14} /> Address <small>Optional</small></span>
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
                  {view === 'invoices' ? <input value={invoiceNumber} readOnly aria-label="Automatically generated invoice number" /> : <input name="number" required />}
                </label>
                <label>
                  Issue date
                  <input name="issueDate" type="date" required />
                </label>
                <label>
                  {view === 'quotations' ? 'Expiry' : 'Due'} date
                  <input name="dueDate" type="date" required />
                </label>
                {view === 'invoices' ? (
                  <div className="invoice-line-editor full">
                    <div className="invoice-line-editor__heading"><span>Invoice items</span><small>Only these fields change for each line.</small></div>
                    {lineItems.map((item, index) => (
                      <div className="invoice-line-editor__row" key={index}>
                        <label>Line description<input required value={item.description} onChange={(event) => updateLine(index, 'description', event.target.value)} /></label>
                        <label>Quantity<input required type="number" min=".0001" step=".0001" value={item.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /></label>
                        <label>Unit price<input required type="number" min="0" step=".01" value={item.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} /></label>
                        <button type="button" className="icon-button" aria-label={`Remove item ${index + 1}`} disabled={lineItems.length === 1} onClick={() => setLineItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="invoice-line-editor__add" onClick={() => setLineItems((items) => [...items, { description: '', quantity: '', unitPrice: '' }])}><Plus size={16} /> Add another item</button>
                  </div>
                ) : <>
                  <label className="full">Line description<input name="description" required /></label>
                  <label>Quantity<input name="quantity" type="number" min=".0001" step=".0001" required /></label>
                  <label>Unit price<input name="unitPrice" type="number" min="0" step=".01" required /></label>
                </>}
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

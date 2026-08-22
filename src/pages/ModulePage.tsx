import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import type { ModuleDefinition } from '@/types/app';

export function ModulePage({ definition }: { definition: ModuleDefinition }) {
  const [modal, setModal] = useState(false);
  const [rows, setRows] = useState(definition.rows);
  const [tab, setTab] = useState(definition.tabs?.[0] ?? 'All');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const availableFilters = useMemo(() => {
    if (definition.filters?.length) return definition.filters;
    const statuses = Array.from(
      new Set(rows.map((row) => String(row.status ?? '')).filter(Boolean)),
    );
    return ['All records', ...statuses];
  }, [definition.filters, rows]);
  const filteredRows = useMemo(() => {
    const firstTab = definition.tabs?.[0];
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTab = !definition.tabs || tab === firstTab || String(row.status) === tab;
      const matchesQuery =
        !normalizedQuery ||
        Object.values(row).some((value) => String(value).toLowerCase().includes(normalizedQuery));
      const normalizedFilter = activeFilter?.toLowerCase();
      const currentMonth = new Intl.DateTimeFormat('en-GB', {
        month: 'short',
        year: 'numeric',
      }).format(new Date());
      const matchesFilter =
        !normalizedFilter ||
        normalizedFilter.startsWith('all ') ||
        (normalizedFilter === 'this month'
          ? Object.values(row).some((value) => String(value).includes(currentMonth))
          : normalizedFilter === 'outstanding'
            ? Number(String(row.amount ?? '').replace(/[^0-9.-]/g, '')) > 0
            : Object.values(row).some((value) => String(value).toLowerCase() === normalizedFilter));
      return matchesTab && matchesQuery && matchesFilter;
    });
  }, [activeFilter, definition.tabs, query, rows, tab]);
  const tabCount = (name: string) =>
    name === definition.tabs?.[0]
      ? rows.length
      : rows.filter((row) => String(row.status) === name).length;
  return (
    <>
      <PageHeader
        title={definition.title}
        description={definition.description}
        action={definition.action}
        onAction={() => setModal(true)}
      />
      <StatsGrid stats={definition.stats} />
      <section className="panel register-panel">
        {definition.tabs && (
          <div className="tabs">
            {definition.tabs.map((x) => (
              <button className={tab === x ? 'active' : ''} onClick={() => setTab(x)} key={x}>
                {x}
                <span>{tabCount(x)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${definition.title.toLowerCase()}…`}
            />
          </div>
          <div>
            {definition.filters?.slice(0, 2).map((filter) => (
              <button
                className={`filter-button ${
                  activeFilter === filter ||
                  (!activeFilter && filter.toLowerCase().startsWith('all '))
                    ? 'active'
                    : ''
                }`}
                key={filter}
                onClick={() =>
                  setActiveFilter(filter.toLowerCase().startsWith('all ') ? null : filter)
                }
              >
                {filter}
              </button>
            ))}
            <label className={`filter-button account-filter ${activeFilter ? 'active' : ''}`}>
              <Filter size={15} />
              <span className="sr-only">Filter {definition.title.toLowerCase()}</span>
              <select
                value={activeFilter ?? availableFilters[0] ?? 'All records'}
                onChange={(event) => {
                  const filter = event.target.value;
                  setActiveFilter(filter.toLowerCase().startsWith('all ') ? null : filter);
                }}
                aria-label={`Filter ${definition.title.toLowerCase()}`}
              >
                {availableFilters.map((filter) => (
                  <option key={filter}>{filter}</option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              aria-label="Reset table view"
              title="Reset table view"
              disabled={!query && !activeFilter && tab === (definition.tabs?.[0] ?? 'All')}
              onClick={() => {
                setQuery('');
                setActiveFilter(null);
                setTab(definition.tabs?.[0] ?? 'All');
              }}
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
        </div>
        <DataTable columns={definition.columns} rows={filteredRows} />
      </section>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={definition.action}
        subtitle={`Add a new record to ${definition.title.toLowerCase()}.`}
        wide={definition.title === 'Invoices'}
        footer={
          <>
            <button className="button button--secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button
              className="button"
              type={definition.title === 'Invoices' || definition.title === 'Quotations' ? 'button' : 'submit'}
              form={definition.title === 'Invoices' ? undefined : definition.title === 'Quotations' ? 'quotation-form' : 'generic-record-form'}
              onClick={definition.title === 'Invoices' || definition.title === 'Quotations' ? () => setModal(false) : undefined}
            >
              {definition.title === 'Quotations' ? 'Save & send to customer' : `Save ${definition.title === 'Invoices' ? 'and send' : ''}`}
            </button>
            {definition.title === 'Quotations' && (
              <button className="button button--secondary" type="button" onClick={() => setModal(false)}>
                Save as draft
              </button>
            )}
          </>
        }
      >
        {definition.title === 'Invoices' ? (
          <InvoiceForm />
        ) : definition.title === 'Quotations' ? (
          <QuotationForm />
        ) : definition.title === 'Customers' ? (
          <CustomerForm
            onSubmit={(form) => {
              const displayName = String(form.get('displayName') ?? '').trim();
              const companyName = String(form.get('companyName') ?? '').trim();
              const name = String(form.get('name') ?? '').trim();
              setRows((currentRows) => [
                {
                  party: displayName || companyName || name,
                  reference: `CUS-${String(Date.now()).slice(-5)}`,
                  date: new Date().toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  }),
                  amount: '₦0',
                  status: 'Active',
                },
                ...currentRows,
              ]);
              setModal(false);
            }}
          />
        ) : definition.title === 'Payments received' ? (
          <PaymentForm />
        ) : (
          <GenericForm
            title={definition.title}
            onSubmit={(form) => {
              const name = String(form.get('name') ?? '').trim();
              const date = String(form.get('date') ?? '');
              const amount = String(form.get('amount') ?? '').trim() || '₦0';
              const status = String(form.get('status') ?? 'Draft');
              const prefix = definition.title.slice(0, 3).toUpperCase();
              const reference = `${prefix}-${String(Date.now()).slice(-5)}`;
              const row = Object.fromEntries(
                definition.columns.map((column) => {
                  if (column.key === 'reference') return [column.key, reference];
                  if (column.key === 'date') return [column.key, date];
                  if (column.key === 'amount') return [column.key, amount];
                  if (column.key === 'status') return [column.key, status];
                  return [column.key, name];
                }),
              );
              setRows((currentRows) => [row, ...currentRows]);
              setModal(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function QuotationForm() {
  const today = new Date().toLocaleDateString('en-CA');
  const [items, setItems] = useState([['Business software licence', '1', '₦0', '₦0']]);
  return (
    <form id="quotation-form" className="quotation-form" onSubmit={(event) => event.preventDefault()}>
      <div className="form-grid">
        <label>Customer name<input required placeholder="Select or enter customer" /></label>
        <label>Date<input type="date" defaultValue={today} required /></label>
        <label>Status<select defaultValue="Draft"><option>Draft</option><option>Sent</option><option>Accepted</option><option>Rejected</option><option>Expired</option></select></label>
        <label>Terms & conditions<input placeholder="e.g. Valid for 30 days" /></label>
      </div>
      <section className="quotation-items">
        <div className="quotation-items-heading"><h3>Items</h3><span>Item name, quantity, rate and amount</span></div>
        {items.map((item, index) => (
          <div className="quotation-item" key={index}>
            <label>Item name / details<input defaultValue={item[0]} required /></label>
            <label>Qty<input type="number" min="1" defaultValue={item[1]} required /></label>
            <label>Rate<input inputMode="decimal" defaultValue={item[2]} required /></label>
            <label>Amount<input inputMode="decimal" defaultValue={item[3]} required /></label>
          </div>
        ))}
        <button className="button button--secondary quotation-add-item" type="button" onClick={() => setItems((current) => [...current, ['', '1', '₦0', '₦0']])}>+ Add new item</button>
      </section>
      <label className="full">Notes / terms<textarea placeholder="Additional details for the customer" /></label>
    </form>
  );
}

function CustomerForm({ onSubmit }: { onSubmit: (form: FormData) => void }) {
  return (
    <form
      id="generic-record-form"
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <label>
        Name
        <input name="name" placeholder="Contact name" required autoFocus />
      </label>
      <label>
        Email
        <input name="email" type="email" placeholder="name@company.com" required />
      </label>
      <label>
        Company name
        <input name="companyName" placeholder="Registered company name" required />
      </label>
      <label>
        Display name <small>(optional)</small>
        <input name="displayName" placeholder="Name shown on transactions" />
      </label>
      <label>
        Phone <small>(optional)</small>
        <input name="phone" type="tel" placeholder="+234 800 000 0000" />
      </label>
      <label>
        Tax ID <small>(optional)</small>
        <input name="taxId" placeholder="Tax identification number" />
      </label>
      <label className="full">
        Billing address <small>(optional)</small>
        <textarea name="address" placeholder="Street, city, state and country" />
      </label>
      <label className="full">
        Notes <small>(optional)</small>
        <textarea name="notes" placeholder="Credit terms or other customer context…" />
      </label>
    </form>
  );
}

function PaymentForm() {
  return (
    <form id="generic-record-form" className="form-grid" onSubmit={(event) => event.preventDefault()}>
      <label className="full">Invoice number<input name="invoice" placeholder="e.g. INV-00245" required /></label>
      <label>Customer<input name="customer" placeholder="Customer name" required /></label>
      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="₦ 0.00" required /></label>
      <label>Date<input name="date" type="date" defaultValue={new Date().toLocaleDateString('en-CA')} required /></label>
      <label>Method<select name="method"><option>Bank transfer</option><option>Card</option><option>POS</option><option>Cash</option><option>Mobile payment</option></select></label>
      <label className="full">Reference / notes<textarea name="notes" placeholder="Payment reference or notes" /></label>
    </form>
  );
}

function GenericForm({ title, onSubmit }: { title: string; onSubmit: (form: FormData) => void }) {
  const today = new Date().toLocaleDateString('en-CA');
  return (
    <form
      id="generic-record-form"
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <label>
        {title.includes('customer')
          ? 'Customer / company name'
          : title.includes('supplier')
            ? 'Supplier / company name'
            : 'Reference / name'}
        <input name="name" placeholder="Enter details" required />
      </label>
      <label>
        Date
        <input name="date" type="date" defaultValue={today} required />
      </label>
      <label>
        Amount
        <input name="amount" placeholder="₦ 0.00" inputMode="decimal" />
      </label>
      <label>
        Status
        <select name="status">
          <option>Draft</option>
          <option>Pending approval</option>
          <option>Approved</option>
        </select>
      </label>
      <label className="full">
        Description
        <textarea name="description" placeholder="Add notes or context…" />
      </label>
      <label>
        Attachment type
        <select name="attachmentType" defaultValue="Receipt">
          <option>Receipt</option>
          <option>Invoice</option>
          <option>Bank statement</option>
          <option>Contract</option>
          <option>Other document</option>
        </select>
      </label>
      <label>
        Receipt / attachment <small>(optional)</small>
        <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
      </label>
    </form>
  );
}

function InvoiceForm() {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + 30);
  const [lineItems, setLineItems] = useState([
    ['Business software licence', '2', '₦500,000', 'VAT 7.5%', '₦1,000,000'],
    ['Implementation service', '1', '₦250,000', 'VAT 7.5%', '₦250,000'],
  ]);
  return (
    <div className="invoice-form">
      <div className="form-grid">
        <label>
          Customer
          <select defaultValue="" required>
            <option value="" disabled>Select customer</option>
            <option>Apex Retail Limited</option>
            <option>Northstar Schools</option>
          </select>
        </label>
        <label>
          Invoice number
          <input defaultValue="INV-00246" />
        </label>
        <label>
          Invoice date
          <input type="date" defaultValue={today.toLocaleDateString('en-CA')} />
        </label>
        <label>
          Due date
          <input type="date" defaultValue={dueDate.toLocaleDateString('en-CA')} />
        </label>
        <label>
          Currency
          <select>
            <option>NGN — Nigerian Naira</option>
            <option>USD — US Dollar</option>
          </select>
        </label>
        <label>
          Payment terms
          <select>
            <option>Net 30</option>
            <option>Due on receipt</option>
            <option>Net 15</option>
          </select>
        </label>
        <label>
          Invoice status
          <select defaultValue="Draft" aria-label="Invoice status">
            <option>Draft</option><option>Sent</option><option>Partially paid</option><option>Paid</option><option>Overdue</option>
          </select>
        </label>
      </div>
      <div className="invoice-items">
        <div className="invoice-item-head">
          <span>Item / description</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Tax</span>
          <span>Amount</span>
        </div>
        {lineItems.map((row, i) => (
          <div className="invoice-item-row" key={i}>
            {row.map((x, j) => (
              <input key={j} defaultValue={x} />
            ))}
          </div>
        ))}
        <button
          onClick={() => setLineItems((items) => [...items, ['', '1', '₦0', 'VAT 7.5%', '₦0']])}
        >
          + Add line item
        </button>
      </div>
      <div className="invoice-bottom">
        <label>
          Notes
          <textarea defaultValue="Thank you for your business." />
        </label>
        <div className="invoice-totals">
          <span>
            Subtotal <b>₦1,250,000</b>
          </span>
          <span>
            Discount <b>−₦50,000</b>
          </span>
          <span>
            VAT (7.5%) <b>₦90,000</b>
          </span>
          <strong>
            Total <b>₦1,290,000</b>
          </strong>
        </div>
      </div>
      <label className="invoice-send-option">
        <input type="checkbox" defaultChecked />
        <span><strong>Send invoice and customer statement</strong><small>Email both documents to the customer after saving.</small></span>
      </label>
    </div>
  );
}

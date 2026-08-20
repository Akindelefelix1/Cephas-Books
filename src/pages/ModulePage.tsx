import { ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import type { ModuleDefinition } from '@/types/app';

export function ModulePage({ definition }: { definition: ModuleDefinition }) {
  const [modal, setModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
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
      const matchesFilter =
        !normalizedFilter ||
        normalizedFilter.startsWith('all ') ||
        (normalizedFilter === 'outstanding'
          ? Number(String(row.amount ?? '').replace(/[^0-9.-]/g, '')) > 0
          : Object.values(row).some(
              (value) => String(value).toLowerCase() === normalizedFilter,
            ));
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
                  activeFilter === filter || (!activeFilter && filter.toLowerCase().startsWith('all '))
                    ? 'active'
                    : ''
                }`}
                key={filter}
                onClick={() =>
                  setActiveFilter(filter.toLowerCase().startsWith('all ') ? null : filter)
                }
              >
                {filter}
                <ChevronDown size={14} />
              </button>
            ))}
            <button
              className="filter-button"
              onClick={() => setFilterModal(true)}
              aria-label={`Filter ${definition.title.toLowerCase()}`}
            >
              <Filter size={15} /> Filters
              {activeFilter && <span className="filter-count">1</span>}
            </button>
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
        open={filterModal}
        onClose={() => setFilterModal(false)}
        title={`Filter ${definition.title.toLowerCase()}`}
        subtitle="Choose which records to display."
        footer={
          <button
            className="button button--secondary"
            onClick={() => {
              setActiveFilter(null);
              setFilterModal(false);
            }}
          >
            Clear filters
          </button>
        }
      >
        <div className="account-action-list">
          {availableFilters.map((filter) => {
            const isAll = filter.toLowerCase().startsWith('all ');
            const selected = isAll ? !activeFilter : activeFilter === filter;
            return (
              <button
                className={`button button--secondary ${selected ? 'active' : ''}`}
                key={filter}
                onClick={() => {
                  setActiveFilter(isAll ? null : filter);
                  setFilterModal(false);
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </Modal>
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
              type={definition.title === 'Invoices' ? 'button' : 'submit'}
              form={definition.title === 'Invoices' ? undefined : 'generic-record-form'}
              onClick={definition.title === 'Invoices' ? () => setModal(false) : undefined}
            >
              Save {definition.title === 'Invoices' ? 'and send' : ''}
            </button>
          </>
        }
      >
        {definition.title === 'Invoices' ? (
          <InvoiceForm />
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

function GenericForm({
  title,
  onSubmit,
}: {
  title: string;
  onSubmit: (form: FormData) => void;
}) {
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
      <label className="full upload-field">
        <input type="file" />
        <span>
          Drop receipt or attachment here, or <b>browse files</b>
        </span>
        <small>PDF, JPG, PNG, DOCX, XLSX · max 10 MB</small>
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
          <select defaultValue="Apex Retail Limited">
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
    </div>
  );
}

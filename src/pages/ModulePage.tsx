import { ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import type { ModuleDefinition } from '@/types/app';

export function ModulePage({ definition }: { definition: ModuleDefinition }) {
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState(definition.tabs?.[0] ?? 'All');
  const [query, setQuery] = useState('');
  const filteredRows = useMemo(() => {
    const firstTab = definition.tabs?.[0];
    const normalizedQuery = query.trim().toLowerCase();
    return definition.rows.filter((row) => {
      const matchesTab = !definition.tabs || tab === firstTab || String(row.status) === tab;
      const matchesQuery =
        !normalizedQuery ||
        Object.values(row).some((value) => String(value).toLowerCase().includes(normalizedQuery));
      return matchesTab && matchesQuery;
    });
  }, [definition, query, tab]);
  const tabCount = (name: string) =>
    name === definition.tabs?.[0]
      ? definition.rows.length
      : definition.rows.filter((row) => String(row.status) === name).length;
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
          <div
            className="table-search"
            onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
          >
            <Search size={17} />
            <input placeholder={`Search ${definition.title.toLowerCase()}…`} />
          </div>
          <div>
            {definition.filters?.slice(0, 2).map((filter) => (
              <button className="filter-button" key={filter}>
                {filter}
                <ChevronDown size={14} />
              </button>
            ))}
            <button className="filter-button">
              <Filter size={15} /> Filters
            </button>
            <button className="icon-button">
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
            <button className="button" onClick={() => setModal(false)}>
              Save {definition.title === 'Invoices' ? 'and send' : ''}
            </button>
          </>
        }
      >
        {definition.title === 'Invoices' ? (
          <InvoiceForm />
        ) : (
          <GenericForm title={definition.title} />
        )}
      </Modal>
    </>
  );
}

function GenericForm({ title }: { title: string }) {
  return (
    <div className="form-grid">
      <label>
        {title.includes('customer')
          ? 'Customer / company name'
          : title.includes('supplier')
            ? 'Supplier / company name'
            : 'Reference / name'}
        <input placeholder="Enter details" />
      </label>
      <label>
        Date
        <input type="date" defaultValue="2026-08-17" />
      </label>
      <label>
        Amount
        <input placeholder="₦ 0.00" inputMode="decimal" />
      </label>
      <label>
        Status
        <select>
          <option>Draft</option>
          <option>Pending approval</option>
          <option>Approved</option>
        </select>
      </label>
      <label className="full">
        Description
        <textarea placeholder="Add notes or context…" />
      </label>
      <label className="full upload-field">
        <input type="file" />
        <span>
          Drop receipt or attachment here, or <b>browse files</b>
        </span>
        <small>PDF, JPG, PNG, DOCX, XLSX · max 10 MB</small>
      </label>
    </div>
  );
}

function InvoiceForm() {
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
          <input type="date" defaultValue="2026-08-17" />
        </label>
        <label>
          Due date
          <input type="date" defaultValue="2026-09-16" />
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
        {[
          ['Business software licence', '2', '₦500,000', 'VAT 7.5%', '₦1,000,000'],
          ['Implementation service', '1', '₦250,000', 'VAT 7.5%', '₦250,000'],
        ].map((row, i) => (
          <div className="invoice-item-row" key={i}>
            {row.map((x, j) => (
              <input key={j} defaultValue={x} />
            ))}
          </div>
        ))}
        <button>+ Add line item</button>
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

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { posApi, type PosSale } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';

const money = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

export function PosHistoryPage() {
    const [sales, setSales] = useState<PosSale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [filters, setFilters] = useState({ search: '', from: '', to: '', customerId: '' });
    const [error, setError] = useState('');
    useEffect(() => { void salesApi.customers().then((result) => setCustomers(result.data)).catch(() => undefined); }, []);
    useEffect(() => {
        const query = Object.fromEntries(Object.entries({ ...filters, page: String(page), limit: '10' }).filter(([, value]) => value));
        void posApi.sales(query).then((result) => { setSales(result.data); setMeta(result.meta); }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load sales history'));
    }, [filters, page]);
    const updateFilter = (key: keyof typeof filters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
    return <>
        <PageHeader title="POS sales history" description="Review, search, and filter completed point-of-sale transactions." />
        <section className="panel pos-history-filters">
            <label><Search size={16} /> <input placeholder="Receipt number or customer" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
            <label>From <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></label>
            <label>To <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></label>
            <label>Customer <select value={filters.customerId} onChange={(event) => updateFilter('customerId', event.target.value)}><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.displayName}</option>)}</select></label>
        </section>
        {error && <p className="form-error">{error}</p>}
        <section className="panel data-table-wrap">
            <table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Payment</th><th className="is-right">Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="is-primary">{sale.receiptNumber}</td><td>{new Date(sale.createdAt).toLocaleString()}</td><td>{sale.customer?.displayName ?? 'Walk-in customer'}</td><td>{sale.payments.map((payment) => payment.method).join(', ')}</td><td className="is-right">{money(Number(sale.total))}</td></tr>)}{!sales.length && <tr><td className="table-empty" colSpan={5}>No sales match the selected filters.</td></tr>}</tbody></table>
            <div className="table-pagination"><p>Showing <strong>{meta.total ? (meta.page - 1) * meta.limit + 1 : 0}–{Math.min(meta.page * meta.limit, meta.total)}</strong> of {meta.total}</p><div><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {meta.totalPages}</span><button aria-label="Next page" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>
        </section>
    </>;
}
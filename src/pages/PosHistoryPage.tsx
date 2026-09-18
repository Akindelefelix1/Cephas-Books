import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, ReceiptText, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { posApi, type PosSale } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';

const money = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

const printReceipt = (sale: PosSale, download = false) => {
    const receipt = window.open('', '_blank', 'width=420,height=720');
    if (!receipt) return;
    receipt.document.write(`<!doctype html><html><head><title>${download ? 'Download' : 'Print'} ${sale.receiptNumber}</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:360px;margin:32px auto}h1{font-size:20px;margin:0 0 4px}p{margin:4px 0;color:#667085}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.total{font-size:18px;font-weight:700;border-top:2px solid #172033;margin-top:10px;padding-top:10px}.center{text-align:center}.muted{color:#667085}@media print{body{margin:0 auto}}</style></head><body><div class="center"><h1>Cephas Books</h1><p>Sales receipt</p><p>${sale.receiptNumber} · ${new Date(sale.createdAt).toLocaleString()}</p></div>${sale.items.map((item) => `<div class="row"><span>${item.description} x ${item.quantity}</span><strong>${money(Number(item.lineTotal))}</strong></div>`).join('')}<div class="row total"><span>Total</span><strong>${money(Number(sale.total))}</strong></div><div class="row"><span>Paid</span><strong>${money(Number(sale.paidAmount))}</strong></div><div class="row"><span>Change</span><strong>${money(Number(sale.changeAmount))}</strong></div><p class="center muted">Thank you for your business.</p><script>window.onload=()=>window.print()</script></body></html>`);
    receipt.document.close();
};

export function PosHistoryPage() {
    const [sales, setSales] = useState<PosSale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [filters, setFilters] = useState({ search: '', from: '', to: '', customerId: '' });
    const [selectedSale, setSelectedSale] = useState<PosSale | null>(null);
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
        <section className="panel pos-history-table data-table-wrap">
            <table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Payment</th><th className="is-right">Total</th><th aria-label="Actions" /></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="is-primary">{sale.receiptNumber}</td><td>{new Date(sale.createdAt).toLocaleString()}</td><td>{sale.customer?.displayName ?? 'Walk-in customer'}</td><td>{sale.payments.map((payment) => payment.method).join(', ')}</td><td className="is-right">{money(Number(sale.total))}</td><td className="is-right"><button type="button" className="button button--secondary button--small" onClick={() => setSelectedSale(sale)}><ReceiptText size={15} /> View receipt</button></td></tr>)}{!sales.length && <tr><td className="table-empty" colSpan={6}>No sales match the selected filters.</td></tr>}</tbody></table>
            <div className="table-pagination"><p>Showing <strong>{meta.total ? (meta.page - 1) * meta.limit + 1 : 0}–{Math.min(meta.page * meta.limit, meta.total)}</strong> of {meta.total}</p><div><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {meta.totalPages}</span><button aria-label="Next page" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>
        </section>
        {selectedSale && <Modal open title="Sales receipt" onClose={() => setSelectedSale(null)} footer={null}><div className="receipt-card"><div className="receipt-card__heading"><strong>Cephas Books</strong><small>{selectedSale.receiptNumber}</small><small>{new Date(selectedSale.createdAt).toLocaleString()}</small></div>{selectedSale.items.map((item) => <div className="receipt-card__row" key={`${item.description}-${item.quantity}`}><span>{item.description}<small>{item.quantity} item(s)</small></span><strong>{money(Number(item.lineTotal))}</strong></div>)}<div className="receipt-card__total"><span>Total</span><strong>{money(Number(selectedSale.total))}</strong></div><div className="receipt-card__actions"><button className="button button--secondary" onClick={() => printReceipt(selectedSale)}><Printer size={16} /> Print</button><button className="button" onClick={() => printReceipt(selectedSale, true)}><Download size={16} /> Download PDF</button></div></div></Modal>}
    </>;
}
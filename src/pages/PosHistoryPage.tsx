import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, ReceiptText, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SalesReceipt } from '@/components/ui/SalesReceipt';
import { posApi, type PosSale } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';
import { getDefaultCurrency } from '@/utils/currency';

const money = (value: number, currency = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
const monthFormatter = new Intl.DateTimeFormat('en-NG', { month: 'short' });

export function PosHistoryPage({ canReprint = false }: { canReprint?: boolean }) {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', from: '', to: '', customerId: '' });
  const [selectedSale, setSelectedSale] = useState<PosSale | null>(null);
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  const [annualSales, setAnnualSales] = useState<PosSale[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void salesApi
      .customers()
      .then((result) => setCustomers(result.data))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const query = Object.fromEntries(
      Object.entries({ ...filters, page: String(page), limit: '10' }).filter(([, value]) => value),
    );
    void posApi
      .sales(query)
      .then((result) => {
        setSales(result.data);
        setMeta(result.meta);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load sales history'),
      );
  }, [filters, page]);
  useEffect(() => {
    let active = true;
    const loadAnnualSales = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      setAnnualSales([]);
      try {
        const from = `${analyticsYear}-01-01`;
        const to = `${analyticsYear}-12-31`;
        const first = await posApi.sales({ from, to, page: '1', limit: '100' });
        const remaining = await Promise.all(
          Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) =>
            posApi.sales({ from, to, page: String(index + 2), limit: '100' }),
          ),
        );
        if (active) setAnnualSales([first, ...remaining].flatMap((result) => result.data));
      } catch (caught) {
        if (active)
          setAnalyticsError(
            caught instanceof Error ? caught.message : 'Unable to load annual sales',
          );
      } finally {
        if (active) setAnalyticsLoading(false);
      }
    };
    void loadAnnualSales();
    return () => {
      active = false;
    };
  }, [analyticsYear]);
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const monthlySales = Array.from({ length: 12 }, (_, month) => {
    const monthSales = annualSales.filter((sale) => new Date(sale.createdAt).getMonth() === month);
    return {
      month,
      label: monthFormatter.format(new Date(analyticsYear, month, 1)),
      total: monthSales.reduce((sum, sale) => sum + Number(sale.total), 0),
      transactions: monthSales.length,
    };
  });
  const annualTotal = monthlySales.reduce((sum, month) => sum + month.total, 0);
  const monthsWithSales = monthlySales.filter((month) => month.total > 0);
  const averageMonthlySales = monthsWithSales.length ? annualTotal / monthsWithSales.length : 0;
  const bestMonth = monthsWithSales.reduce<(typeof monthlySales)[number] | null>(
    (best, month) => (!best || month.total > best.total ? month : best),
    null,
  );
  const lowestMonth = monthsWithSales.reduce<(typeof monthlySales)[number] | null>(
    (lowest, month) => (!lowest || month.total < lowest.total ? month : lowest),
    null,
  );
  const maximumMonthlyTotal = Math.max(...monthlySales.map((month) => month.total), 1);
  const availableYears = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);
  return (
    <>
      <PageHeader
        title="POS sales history"
        description="Review, search, and filter completed point-of-sale transactions."
      />
      <section className="panel pos-sales-analytics" aria-busy={analyticsLoading}>
        <header className="pos-sales-analytics__header">
          <div>
            <h2>
              <BarChart3 size={20} /> Yearly sales comparison
            </h2>
            <p>Compare total POS sales and transaction volume month by month.</p>
          </div>
          <label>
            Year
            <select
              value={analyticsYear}
              onChange={(event) => setAnalyticsYear(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="pos-sales-analytics__summary">
          <article>
            <small>Annual sales</small>
            <strong>{money(annualTotal)}</strong>
            <span>{annualSales.length} transactions</span>
          </article>
          <article>
            <small>Monthly average</small>
            <strong>{money(averageMonthlySales)}</strong>
            <span>Across months with sales</span>
          </article>
          <article>
            <small>Highest month</small>
            <strong>{bestMonth ? money(bestMonth.total) : money(0)}</strong>
            <span>{bestMonth?.label || 'No sales yet'}</span>
          </article>
          <article>
            <small>Lowest month</small>
            <strong>{lowestMonth ? money(lowestMonth.total) : money(0)}</strong>
            <span>{lowestMonth?.label || 'No sales yet'}</span>
          </article>
        </div>
        {analyticsError ? (
          <div className="banking-alert">{analyticsError}</div>
        ) : analyticsLoading ? (
          <p className="pos-sales-analytics__empty">Loading annual sales…</p>
        ) : (
          <div className="pos-sales-chart-scroll">
            <div
              className="pos-sales-chart"
              role="img"
              aria-label={`Monthly POS sales chart for ${analyticsYear}`}
            >
              {monthlySales.map((month) => (
                <div className="pos-sales-chart__month" key={month.month}>
                  <div className="pos-sales-chart__value">{money(month.total)}</div>
                  <div className="pos-sales-chart__track">
                    <div
                      className="pos-sales-chart__bar"
                      style={{
                        height: `${month.total ? Math.max(7, (month.total / maximumMonthlyTotal) * 100) : 0}%`,
                      }}
                      title={`${month.label}: ${money(month.total)} from ${month.transactions} transactions`}
                    />
                  </div>
                  <strong>{month.label}</strong>
                  <small>
                    {month.transactions} sale{month.transactions === 1 ? '' : 's'}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="panel pos-history-filters">
        <label>
          <Search size={16} />{' '}
          <input
            placeholder="Receipt number or customer"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </label>
        <label>
          From{' '}
          <input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </label>
        <label>
          Customer{' '}
          <select
            value={filters.customerId}
            onChange={(event) => updateFilter('customerId', event.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option value={customer.id} key={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </label>
      </section>
      {error && <p className="form-error">{error}</p>}
      <section className="panel pos-history-table data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th className="is-right">Discount</th>
              <th className="is-right">Total</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td className="is-primary">{sale.receiptNumber}</td>
                <td>{new Date(sale.createdAt).toLocaleString()}</td>
                <td>{sale.customer?.displayName ?? 'Walk-in customer'}</td>
                <td>{sale.payments.map((payment) => payment.method).join(', ')}</td>
                <td className="is-right">
                  {money(Number(sale.discountTotal || 0), sale.currency)}
                </td>
                <td className="is-right">{money(Number(sale.total), sale.currency)}</td>
                <td className="is-right">
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <ReceiptText size={15} /> View receipt
                  </button>
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td className="table-empty" colSpan={7}>
                  No sales match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="table-pagination">
          <p>
            Showing{' '}
            <strong>
              {meta.total ? (meta.page - 1) * meta.limit + 1 : 0}–
              {Math.min(meta.page * meta.limit, meta.total)}
            </strong>{' '}
            of {meta.total}
          </p>
          <div>
            <button
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page} of {meta.totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {selectedSale && (
        <Modal open title="Sales receipt" onClose={() => setSelectedSale(null)} footer={null} wide>
          <SalesReceipt
            key={selectedSale.id}
            sale={selectedSale}
            historical
            canReprint={canReprint}
            onSaleChange={(updatedSale) => {
              setSelectedSale(updatedSale);
              setSales((current) =>
                current.map((sale) => (sale.id === updatedSale.id ? updatedSale : sale)),
              );
            }}
          />
        </Modal>
      )}
    </>
  );
}

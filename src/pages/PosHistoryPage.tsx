import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ReceiptText,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SalesReceipt } from '@/components/ui/SalesReceipt';
import { posApi, type PosAuditEntry, type PosSale } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';
import { getDefaultCurrency } from '@/utils/currency';

const money = (value: number, currency = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
const monthFormatter = new Intl.DateTimeFormat('en-NG', { month: 'short' });
const paymentLabel = (method: string) =>
  ({ CASH: 'Cash', CARD: 'POS / Card', TRANSFER: 'Bank transfer', CREDIT: 'Customer credit' })[
    method
  ] ?? method;
const quantityLabel = (value: number) =>
  new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 }).format(value);

export function PosHistoryPage({
  canReprint = false,
  canReturn = false,
  canVoid = false,
  canViewAudit = false,
}: {
  canReprint?: boolean;
  canReturn?: boolean;
  canVoid?: boolean;
  canViewAudit?: boolean;
}) {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', from: '', to: '', customerId: '' });
  const [selectedSale, setSelectedSale] = useState<PosSale | null>(null);
  const [auditEntries, setAuditEntries] = useState<PosAuditEntry[]>([]);
  const [recentAudit, setRecentAudit] = useState<PosAuditEntry[]>([]);
  const [recentAuditLoading, setRecentAuditLoading] = useState(canViewAudit);
  const [auditLoading, setAuditLoading] = useState(false);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  const [annualSales, setAnnualSales] = useState<PosSale[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!canViewAudit) return;
    void posApi
      .auditLog()
      .then(setRecentAudit)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load POS audit events'),
      )
      .finally(() => setRecentAuditLoading(false));
  }, [canViewAudit]);
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
    if (includeVoided) query.includeVoided = 'true';
    void posApi
      .sales(query)
      .then((result) => {
        setSales(result.data);
        setMeta(result.meta);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load sales history'),
      );
  }, [filters, includeVoided, page]);
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
  const openSale = (sale: PosSale) => {
    setSelectedSale(sale);
    setActionNotice('');
    setError('');
    setAuditEntries([]);
    setShowReturnForm(false);
    setShowVoidForm(false);
    setReturnReason('');
    setVoidReason('');
    setReturnItemId(sale.items[0]?.productId || '');
    setReturnQuantity('1');
    if (!canViewAudit) return;
    setAuditLoading(true);
    void posApi
      .audit(sale.id)
      .then(setAuditEntries)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load POS audit events'),
      )
      .finally(() => setAuditLoading(false));
  };
  const returnedQuantity = (productId: string) =>
    (selectedSale?.returns || [])
      .filter((entry) => entry.productId === productId)
      .reduce((sum, entry) => sum + Number(entry.quantity), 0);
  const selectedReturnItem = selectedSale?.items.find((item) => item.productId === returnItemId);
  const returnRemaining = selectedReturnItem
    ? Math.max(0, Number(selectedReturnItem.quantity) - returnedQuantity(returnItemId))
    : 0;
  const refreshSale = async (saleId: string) => {
    const refreshed = await posApi.receipt(saleId);
    setSelectedSale(refreshed);
    setSales((current) =>
      includeVoided || refreshed.status !== 'VOIDED'
        ? current.map((sale) => (sale.id === refreshed.id ? refreshed : sale))
        : current.filter((sale) => sale.id !== refreshed.id),
    );
    if (canViewAudit) {
      const [entries, recent] = await Promise.all([posApi.audit(saleId), posApi.auditLog()]);
      setAuditEntries(entries);
      setRecentAudit(recent);
    }
  };
  const submitReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSale || !selectedReturnItem) return;
    setActionBusy(true);
    setError('');
    setActionNotice('');
    try {
      await posApi.returnItem(selectedSale.id, {
        productId: returnItemId,
        quantity: Number(returnQuantity),
        reason: returnReason.trim(),
      });
      setShowReturnForm(false);
      setReturnReason('');
      setReturnQuantity('1');
      setActionNotice('Return processed. Eligible inventory and accounting entries were updated.');
      try {
        await refreshSale(selectedSale.id);
      } catch (caught) {
        setActionNotice(
          `Return processed, but sale details could not be refreshed: ${caught instanceof Error ? caught.message : 'Unknown error'}`,
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to process item return');
    } finally {
      setActionBusy(false);
    }
  };
  const submitVoid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSale) return;
    setActionBusy(true);
    setError('');
    setActionNotice('');
    try {
      await posApi.voidSale(selectedSale.id, voidReason.trim());
      setShowVoidForm(false);
      setVoidReason('');
      setActionNotice(
        'Sale voided. Payments, accounting entries, and eligible inventory were reversed.',
      );
      try {
        await refreshSale(selectedSale.id);
      } catch (caught) {
        setActionNotice(
          `Sale was voided, but its details could not be refreshed: ${caught instanceof Error ? caught.message : 'Unknown error'}`,
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to void sale');
    } finally {
      setActionBusy(false);
    }
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
          {canVoid && (
            <label className="pos-history-void-filter">
              <input
                type="checkbox"
                checked={includeVoided}
                onChange={(event) => {
                  setPage(1);
                  setIncludeVoided(event.target.checked);
                }}
              />
              Include voided sales
            </label>
          )}
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
      {canViewAudit && (
        <section className="panel pos-audit-log">
          <header>
            <div>
              <h2>
                <Activity size={17} /> Recent POS audit events
              </h2>
              <small>Latest register, shift, receipt, return, and sale activity.</small>
            </div>
          </header>
          {recentAuditLoading ? (
            <p>Loading POS audit events…</p>
          ) : recentAudit.length ? (
            <div className="pos-audit-log__list">
              {recentAudit.map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.action.replaceAll('_', ' ')}</strong>
                  <span>
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId}` : ''}
                  </span>
                  {typeof entry.metadata?.reason === 'string' && (
                    <span>Reason: {entry.metadata.reason}</span>
                  )}
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </article>
              ))}
            </div>
          ) : (
            <p>No POS audit events recorded yet.</p>
          )}
        </section>
      )}
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
                <td>
                  {sale.payments
                    .map(
                      (payment) =>
                        `${payment.method}${payment.status && payment.status !== 'APPROVED' ? ` · ${payment.status}` : ''}`,
                    )
                    .join(', ')}
                </td>
                <td className="is-right">
                  {money(Number(sale.discountTotal || 0), sale.currency)}
                </td>
                <td className="is-right">{money(Number(sale.total), sale.currency)}</td>
                <td className="is-right">
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => openSale(sale)}
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
        <Modal
          open
          title={`Sale ${selectedSale.receiptNumber}`}
          onClose={() => setSelectedSale(null)}
          footer={null}
          wide
        >
          <div className="pos-sale-management">
            <div className="pos-sale-management__summary">
              <span
                className={`badge ${selectedSale.status === 'VOIDED' ? 'badge--danger' : 'badge--success'}`}
              >
                <i /> {selectedSale.status}
              </span>
              <span>
                {selectedSale.payments.map((payment) => (
                  <small key={`${payment.method}-${payment.reference || payment.amount}`}>
                    {paymentLabel(payment.method)} · {payment.status || 'APPROVED'} ·{' '}
                    {money(Number(payment.amount), selectedSale.currency)}
                  </small>
                ))}
              </span>
            </div>
            {selectedSale.returns?.length ? (
              <section className="pos-sale-returns">
                <h3>Returned items</h3>
                <small>
                  Processed returns restore eligible inventory and post the matching accounting
                  adjustment.
                </small>
                {selectedSale.returns.map((returned) => (
                  <p key={returned.id}>
                    {selectedSale.items.find((item) => item.productId === returned.productId)
                      ?.description || 'Item'}{' '}
                    · {returned.quantity} · {money(Number(returned.amount), selectedSale.currency)}{' '}
                    · {returned.reason}
                  </p>
                ))}
              </section>
            ) : null}
            {canReturn && selectedSale.status === 'COMPLETED' && (
              <section className="pos-sale-actions">
                {!showReturnForm ? (
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => setShowReturnForm(true)}
                  >
                    <RotateCcw size={14} /> Return item
                  </button>
                ) : (
                  <form
                    className="form-grid pos-action-form"
                    onSubmit={(event) => void submitReturn(event)}
                  >
                    <label className="full">
                      Item
                      <select
                        value={returnItemId}
                        onChange={(event) => {
                          setReturnItemId(event.target.value);
                          setReturnQuantity('1');
                        }}
                      >
                        {selectedSale.items.map((item) => {
                          const remaining =
                            Number(item.quantity) - returnedQuantity(item.productId || '');
                          return (
                            <option
                              key={item.id || item.productId}
                              value={item.productId || ''}
                              disabled={remaining <= 0}
                            >
                              {item.description} · {quantityLabel(remaining)} remaining
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label>
                      Quantity (up to {quantityLabel(returnRemaining)})
                      <input
                        type="number"
                        min="0.0001"
                        max={returnRemaining}
                        step={selectedReturnItem?.product?.allowFractionalSale ? 0.5 : 1}
                        required
                        value={returnQuantity}
                        onChange={(event) => setReturnQuantity(event.target.value)}
                      />
                    </label>
                    <label className="full">
                      Return reason
                      <textarea
                        required
                        maxLength={1000}
                        value={returnReason}
                        onChange={(event) => setReturnReason(event.target.value)}
                      />
                    </label>
                    <div className="form-actions full">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => setShowReturnForm(false)}
                      >
                        Cancel
                      </button>
                      <button className="button" disabled={actionBusy || returnRemaining <= 0}>
                        {actionBusy ? 'Processing…' : 'Process return'}
                      </button>
                    </div>
                  </form>
                )}
                {canVoid &&
                  !selectedSale.returns?.length &&
                  (!showVoidForm ? (
                    <button
                      type="button"
                      className="button button--danger button--small"
                      onClick={() => setShowVoidForm(true)}
                    >
                      <ShieldAlert size={14} /> Void sale
                    </button>
                  ) : (
                    <form
                      className="form-grid pos-action-form"
                      onSubmit={(event) => void submitVoid(event)}
                    >
                      <label className="full">
                        Void reason
                        <textarea
                          required
                          maxLength={1000}
                          value={voidReason}
                          onChange={(event) => setVoidReason(event.target.value)}
                        />
                      </label>
                      <div className="form-actions full">
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => setShowVoidForm(false)}
                        >
                          Cancel
                        </button>
                        <button className="button button--danger" disabled={actionBusy}>
                          {actionBusy ? 'Reversing…' : 'Confirm void'}
                        </button>
                      </div>
                    </form>
                  ))}
              </section>
            )}
            {actionNotice && <p className="form-success">{actionNotice}</p>}
            {error && <p className="form-error">{error}</p>}
            {canViewAudit && (
              <section className="pos-sale-audit">
                <h3>
                  <Activity size={16} /> POS audit events
                </h3>
                {auditLoading ? (
                  <p>Loading audit events…</p>
                ) : auditEntries.length ? (
                  <ul>
                    {auditEntries.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.action.replaceAll('_', ' ')}</strong>
                        <time>{new Date(entry.createdAt).toLocaleString()}</time>
                        {typeof entry.metadata?.reason === 'string' && (
                          <p>Reason: {entry.metadata.reason}</p>
                        )}
                        {entry.actorId && <small>Actor ID: {entry.actorId}</small>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No audit events recorded for this sale.</p>
                )}
              </section>
            )}
            {selectedSale.status !== 'VOIDED' && (
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
            )}
            {selectedSale.status === 'VOIDED' && (
              <div className="pos-void-notice">
                <AlertTriangle size={17} /> This sale was voided. Its payment entries and accounting
                journals were reversed and eligible inventory was restored.
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

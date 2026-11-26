import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  LayoutGrid,
  List,
  LoaderCircle,
  Package,
  PackagePlus,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAction, downloadText } from '@/utils/actions';
import { appDialog } from '@/utils/appDialogs';
import { isWorkingOffline } from '@/services/offline';
import { formatBusinessDate, formatBusinessDateTime, getBusinessToday, getReportingTimeZone } from '@/utils/financial-configuration';
import { purchasesApi } from '@/services/purchases';
import { salesApi } from '@/services/sales';
import {
  INVENTORY_CHANGED_EVENT,
  operationsApi,
  type OperationsSummary,
  type BranchInventory,
  type OperationsView,
  type Product,
  type ProductDetails,
  type ProductCategory,
  type TaxRate,
  type Project,
  type ProjectPlan,
  type ProjectVarianceReport,
  type StockAdjustment,
  type StockMovement,
  type Warehouse,
} from '@/services/operations';

type Row = Product | Warehouse | StockMovement | StockAdjustment | Project;
type InventoryMonth = {
  key: string;
  label: string;
  totalUnits: number;
  inventoryValue: number;
  highest: { name: string; quantity: number } | null;
  lowest: { name: string; quantity: number } | null;
};
const money = (value: string | number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value));
const quantity = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { maximumFractionDigits: 4 }).format(Number(value));
const date = (value?: string) => (value ? formatBusinessDate(value) : '—');
const titles: Record<OperationsView, string> = {
  products: 'Products & services',
  warehouses: 'Branches & stock locations',
  'branch-inventory': 'Branches & stock locations',
  'stock-movements': 'Stock movements',
  'stock-adjustments': 'Stock adjustments',
  projects: 'Projects',
  'project-ai': 'Project management AI',
};

export function InventoryOperationsPage({ view, role, onNavigate }: { view: OperationsView; role: string; onNavigate: (id: string) => void }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const offlineMode = isWorkingOffline();
  const canApprove = canEdit || role === 'APPROVER';
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventory | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productMeta, setProductMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [taxRatesOpen, setTaxRatesOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [display, setDisplay] = useState<'table' | 'cards'>('table');
  const [detail, setDetail] = useState<ProductDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [restockOpen, setRestockOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [inventoryMonths, setInventoryMonths] = useState<InventoryMonth[]>([]);
  const [analyticsError, setAnalyticsError] = useState('');
  const [varianceReport, setVarianceReport] = useState<ProjectVarianceReport | null>(null);
  const [varianceLoading, setVarianceLoading] = useState(false);
  const [varianceOffline, setVarianceOffline] = useState(false);
  const openVariance = async (project: Project) => {
    setVarianceLoading(true);
    setError('');
    setVarianceReport(null);
    setVarianceOffline(false);
    try {
      setVarianceReport(await operationsApi.projectVariance(project.id));
    } catch (caught) {
      if (isWorkingOffline() && project.actualRevenue !== undefined && project.costVariance !== undefined) {
        const [expenseRows, paymentRows] = await Promise.all([
          purchasesApi.list('expenses').catch(() => []),
          salesApi.payments({}).catch(() => []),
        ]);
        const expenses = expenseRows.filter((item) => item.project?.id === project.id).map((item) => ({
          id: item.id, reference: item.reference ?? '', expenseDate: item.expenseDate ?? '',
          merchant: item.merchant ?? '', category: item.category ?? '',
          amount: String(Number(item.amount ?? 0) - Number(item.taxAmount ?? 0)), taxAmount: item.taxAmount ?? '0', status: item.status ?? '',
        }));
        const payments = paymentRows.filter((item) => item.invoice.project?.id === project.id).map((item) => ({
          id: item.id, reference: item.reference, paymentDate: item.paymentDate, amount: item.amount,
          invoice: { number: item.invoice.number }, customer: { displayName: item.customer.displayName },
        }));
        const costDelta = Number(project.actualCost) - Number(project.budget);
        const revenueDelta = Number(project.actualRevenue) - Number(project.revenue);
        setVarianceOffline(true);
        setVarianceReport({
          project,
          summary: {
            budgetedCost: project.budget, actualCost: project.actualCost,
            costVariance: String(Math.abs(costDelta)), costVarianceSigned: String(costDelta),
            costVariancePercent: project.costVariancePercent, costVarianceType: project.costVarianceType,
            expectedRevenue: project.revenue, actualRevenue: project.actualRevenue,
            revenueVariance: String(Math.abs(revenueDelta)), revenueVarianceSigned: String(revenueDelta),
            revenueVariancePercent: project.revenueVariancePercent, revenueVarianceType: project.revenueVarianceType,
          },
          expenses, payments,
        });
      } else {
        setError(caught instanceof Error ? caught.message : 'Unable to load project report');
      }
    }
    finally { setVarianceLoading(false); }
  };

  useEffect(() => {
    if (view !== 'stock-movements' || sessionStorage.getItem('cephas:inventory-open-movement') !== '1')
      return;
    sessionStorage.removeItem('cephas:inventory-open-movement');
    setModal(true);
  }, [view]);

  const load = useCallback(async () => {
    if (view === 'project-ai') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [s, p, w, c, rates] = await Promise.all([
        operationsApi.summary(),
        view === 'products' ? Promise.resolve([]) : operationsApi.products(),
        operationsApi.warehouses(),
        operationsApi.categories(),
        view === 'products' ? operationsApi.taxRates() : Promise.resolve([]),
      ]);
      setSummary(s);
      setProducts(p.filter((x) => x.isActive && x.type === 'PRODUCT'));
      setWarehouses(w.filter((x) => x.isActive));
      setCategories(c);
      setTaxRates(rates);
      if (view === 'branch-inventory') setBranchInventory(await operationsApi.branchInventory());
      if (view === 'products') {
        const result = await operationsApi.productsPage({
          search,
          status,
          category: categoryFilter,
          page: String(productPage),
          limit: '15',
        });
        setRows(result.data);
        setProducts(
          result.data.filter((product) => product.isActive && product.type === 'PRODUCT'),
        );
        setProductMeta(result.meta);
        if (result.meta.page !== productPage) setProductPage(result.meta.page);
      } else if (view === 'warehouses') setRows(await operationsApi.warehouses({ search, status }));
      else if (view === 'stock-movements')
        setRows(await operationsApi.movements({ search, type: status }));
      else if (view === 'stock-adjustments')
        setRows(await operationsApi.adjustments({ search, status }));
      else if (view === 'projects') setRows(await operationsApi.projects({ search, status }));
      else setRows([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load operations data');
    } finally {
      setLoading(false);
    }
  }, [view, search, status, categoryFilter, productPage]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(INVENTORY_CHANGED_EVENT, refresh);
    window.addEventListener('cephas:sync-state', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refresh);
      window.removeEventListener('cephas:sync-state', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await operation();
      setModal(false);
      setSelected(null);
      const queuedOffline = Boolean(
        result && typeof result === 'object' && 'queuedOffline' in result && result.queuedOffline === true,
      );
      confirmAction(queuedOffline ? `${message} and queued for sync` : message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save record');
    } finally {
      setBusy(false);
    }
  };
  const openProduct = async (product: Product) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setError('');
    try {
      setDetail(await operationsApi.product(product.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load product history');
    } finally {
      setDetailLoading(false);
    }
  };
  const productAction = async (kind: 'status' | 'delete') => {
    if (!detail) return;
    if (kind === 'delete' && isWorkingOffline()) {
      setError('Permanently deleting products requires an internet connection.');
      return;
    }
    if (kind === 'status' && detail.id.startsWith('offline-product:')) {
      setError('Sync this newly created item before archiving or restoring it.');
      return;
    }
    if (kind === 'delete' && !await appDialog(
      'Permanently delete product?',
      `Delete ${detail.name}? This cannot be undone.`,
      { confirmLabel: 'Delete product', cancelLabel: 'Cancel' },
    ))
      return;
    setActionBusy(kind);
    setError('');
    try {
      const result = kind === 'delete'
        ? await operationsApi.deleteProduct(detail.id)
        : await operationsApi.productStatus(detail.id, !detail.isActive);
      const queuedOffline = Boolean(
        result && typeof result === 'object' && 'queuedOffline' in result && result.queuedOffline === true,
      );
      confirmAction(queuedOffline
        ? `${detail.isActive ? 'Archive' : 'Restore'} change queued for sync`
        : kind === 'delete' ? 'Item deleted' : detail.isActive ? 'Item archived' : 'Item restored');
      setDetailOpen(false);
      setDetail(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update item');
    } finally {
      setActionBusy('');
    }
  };
  const restock = async (data: Record<string, unknown>) => {
    if (!detail || actionBusy) return;
    setActionBusy('restock');
    setError('');
    try {
      const result = await operationsApi.restockProduct(detail.id, data);
      window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT));
      const queuedOffline = Boolean(
        result && typeof result === 'object' && 'queuedOffline' in result && result.queuedOffline === true,
      );
      confirmAction(queuedOffline ? `${detail.name} restock queued for sync` : `${detail.name} restocked`);
      setRestockOpen(false);
      await load();
      setDetail(await operationsApi.product(detail.id));
      setDetailOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to restock item');
    } finally {
      setActionBusy('');
    }
  };
  const openInventoryAnalytics = async () => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const [allProducts, movements] = await Promise.all([
        operationsApi.products(),
        operationsApi.movements(),
      ]);
      setInventoryMonths(buildInventoryMonths(allProducts, movements));
    } catch (caught) {
      setAnalyticsError(
        caught instanceof Error ? caught.message : 'Unable to load inventory analytics',
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };
  if (view === 'project-ai') return <ProjectAiPage canEdit={canEdit} />;
  const action = {
    products: 'New item',
    warehouses: 'Add branch/location',
    'branch-inventory': '',
    'stock-movements': 'Record movement',
    'stock-adjustments': 'New adjustment',
    projects: 'New project',
    'project-ai': '',
  }[view];
  const exportRows = (items: Row[]) =>
    downloadText(
      `${view}.csv`,
      [
        columns(view).join(','),
        ...items.map((row) =>
          values(view, row, summary?.baseCurrency)
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n'),
    );
  const exportCsv = async () => {
    if (view === 'branch-inventory' && branchInventory) {
      const branchNames = branchInventory.branches.map((branch) => branch.name);
      const lines = [
        ['SKU', 'Product', 'Unit', ...branchNames, 'Total across branches'],
        ...branchInventory.products.map((product) => [
          product.sku,
          product.productName,
          product.unit,
          ...branchInventory.branches.map((branch) =>
            product.locations.find((location) => location.branchId === branch.id)?.quantity ?? '0',
          ),
          product.totalQuantity,
        ]),
      ];
      const csv = lines.map((line) => line.map((value) => {
        const safe = /^[\s]*[=+@-]/.test(String(value)) ? `'${value}` : String(value);
        return `"${safe.replaceAll('"', '""')}"`;
      }).join(',')).join('\n');
      downloadText('branch-inventory.csv', csv);
      return;
    }
    if (view !== 'products') return exportRows(rows);
    try {
      setBusy(true);
      const allProducts = await operationsApi.products({
        search,
        status,
        category: categoryFilter,
      });
      exportRows(allProducts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to export products');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>Manage {titles[view].toLowerCase()} with controlled, traceable operational records.</p>
        </div>
        <div className="page-header__actions">
          {view === 'branch-inventory' && (
            <>
              <button className="button button--secondary" onClick={() => onNavigate('warehouses')}>
                Manage branches
              </button>
              {canEdit && (
                <button className="button" onClick={() => setModal(true)} disabled={offlineMode} title={offlineMode ? 'Connect to the internet to register a branch.' : undefined}>
                  <Plus size={17} /> Add branch
                </button>
              )}
              <button className="button" onClick={() => {
                sessionStorage.setItem('cephas:inventory-open-movement', '1');
                onNavigate('stock-movements');
              }} disabled={!canEdit}>
                New receipt / transfer
              </button>
            </>
          )}
          {view === 'products' && (
            <button
              className="button button--secondary"
              onClick={() => void openInventoryAnalytics()}
            >
              <BarChart3 size={17} /> Monthly stock insights
            </button>
          )}
          {view === 'products' && canEdit && (
            <button className="button button--secondary" onClick={() => { setTaxRatesOpen(true); void operationsApi.taxRates(true).then(setTaxRates); }} disabled={offlineMode} title={offlineMode ? 'Connect to manage tax rates.' : undefined}>
              Manage tax rates
            </button>
          )}
          <button
            className="button button--secondary"
            onClick={() => void exportCsv()}
            disabled={busy}
          >
            <Download size={17} /> Export CSV
          </button>
          {canEdit && action && view !== 'branch-inventory' && (
            <button className="button" onClick={() => setModal(true)} disabled={offlineMode && view === 'warehouses'} title={offlineMode && view === 'warehouses' ? 'Connect to the internet to register a branch.' : undefined}>
              <Plus size={17} /> {action}
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <StatsGrid
          stats={[
            { label: 'Inventory value', value: 'Loading…' },
            { label: 'Active items', value: 'Loading…' },
            { label: 'Stock alerts', value: 'Loading…' },
            { label: view === 'projects' ? 'Active projects' : 'Warehouses', value: 'Loading…' },
          ]}
        />
      ) : (
        summary && (
          <StatsGrid
            stats={[
              {
                label: 'Inventory value',
                value: money(
                  view === 'branch-inventory' && branchInventory
                    ? branchInventory.branches.reduce((value, branch) => value + Number(branch.inventoryValue), 0)
                    : summary.inventoryValue,
                  summary.baseCurrency,
                ),
              },
              { label: 'Active items', value: String(view === 'branch-inventory' ? branchInventory?.products.length ?? 0 : summary.products) },
              {
                label: 'Stock alerts',
                value: view === 'branch-inventory'
                  ? `${branchInventory?.branches.reduce((count, branch) => count + branch.lowStock, 0) ?? 0} low · ${branchInventory?.branches.reduce((count, branch) => count + branch.outOfStock, 0) ?? 0} out`
                  : `${summary.lowStock} low · ${summary.outOfStock} out`,
                tone: (view === 'branch-inventory'
                  ? branchInventory?.branches.some((branch) => branch.outOfStock)
                  : summary.outOfStock) ? 'danger' : 'warning',
              },
              {
                label: view === 'projects' ? 'Active projects' : view === 'branch-inventory' ? 'Active branches' : 'Warehouses',
                value: String(view === 'projects' ? summary.activeProjects : view === 'branch-inventory' ? branchInventory?.branches.length ?? 0 : summary.warehouses),
              },
            ]}
          />
        )
      )}
      <section className={`panel register-panel${view === 'branch-inventory' ? ' register-panel--branch-stock' : ''}`}>
        <div className={`banking-filters${view === 'branch-inventory' ? ' banking-filters--branch-stock' : ''}`}>
          <input
            aria-label="Search"
            placeholder={`Search ${titles[view].toLowerCase()}`}
            value={search}
            onChange={(e) => {
              setProductPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setProductPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {statusOptions(view).map((x) => (
              <option key={x} value={x}>
                {x.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          {view === 'products' && (
            <select
              aria-label="Category"
              value={categoryFilter}
              onChange={(event) => {
                setProductPage(1);
                setCategoryFilter(event.target.value);
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
          {view === 'products' && (
            <div className="inventory-view-toggle" aria-label="Inventory view">
              <button
                className={display === 'table' ? 'is-active' : ''}
                aria-label="Table view"
                aria-pressed={display === 'table'}
                onClick={() => setDisplay('table')}
              >
                <List size={17} />
              </button>
              <button
                className={display === 'cards' ? 'is-active' : ''}
                aria-label="Card view"
                aria-pressed={display === 'cards'}
                onClick={() => setDisplay('cards')}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          )}
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <LoadingState label="Loading inventory and operations…" />
        ) : view === 'branch-inventory' ? (
          <BranchStockView data={branchInventory} search={search} status={status} />
        ) : view === 'products' && display === 'cards' ? (
          <ProductCards
            products={rows as Product[]}
            currency={summary?.baseCurrency}
            open={openProduct}
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns(view).map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                  {(canEdit || canApprove || view === 'projects') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={view === 'products' ? 'inventory-row' : ''}
                    onClick={
                      view === 'products' ? () => void openProduct(row as Product) : undefined
                    }
                  >
                    {values(view, row, summary?.baseCurrency).map((x, index) => (
                      <td key={index}>{x}</td>
                    ))}
                    {(canEdit || canApprove || view === 'projects') && (
                      <td>
                        <div className="inline-actions">
                          {rowActions(
                            view,
                            row,
                            canEdit,
                            canApprove,
                            (operation, message) => {
                              if (view === 'products') setActionBusy(row.id);
                              void run(operation, message).finally(() => setActionBusy(''));
                            },
                            () => {
                              setSelected(row);
                              setModal(true);
                            },
                            view === 'products'
                              ? () => void openProduct(row as Product)
                              : undefined,
                            view === 'projects' ? () => void openVariance(row as Project) : undefined,
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
                      colSpan={columns(view).length + (canEdit || canApprove || view === 'projects' ? 1 : 0)}
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && view === 'products' && productMeta.total > 0 && (
          <div className="table-pagination">
            <p>
              Showing{' '}
              <strong>
                {(productMeta.page - 1) * productMeta.limit + 1}–
                {Math.min(productMeta.page * productMeta.limit, productMeta.total)}
              </strong>{' '}
              of {productMeta.total}
            </p>
            <div>
              <button
                aria-label="Previous page"
                disabled={productMeta.page === 1}
                onClick={() => setProductPage((page) => page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {productMeta.page} of {productMeta.totalPages}
              </span>
              <button
                aria-label="Next page"
                disabled={productMeta.page >= productMeta.totalPages}
                onClick={() => setProductPage((page) => page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
      <OperationsModal
        key={`${view}-${selected?.id || 'new'}-${modal ? 'open' : 'closed'}`}
        open={modal}
        view={view}
        selected={selected}
        products={products}
        categories={categories}
        taxRates={taxRates.filter((rate) => rate.isActive)}
        offline={offlineMode}
        warehouses={warehouses}
        busy={busy}
        error={error}
        close={() => {
          setModal(false);
          setSelected(null);
        }}
        submit={(data, transfer) =>
          void run(() => save(view, data, selected, transfer), `${titles[view]} saved`)
        }
      />
      <TaxRatesModal
        open={taxRatesOpen}
        rates={taxRates}
        offline={offlineMode}
        onClose={() => setTaxRatesOpen(false)}
        onChanged={() => void operationsApi.taxRates(true).then(setTaxRates)}
      />
      <ProductDetailsModal
        key={detail?.id || (detailOpen ? 'loading' : 'closed')}
        open={detailOpen}
        product={detail}
        loading={detailLoading}
        error={error}
        canEdit={canEdit}
        canDelete={['OWNER', 'ADMIN'].includes(role)}
        offline={offlineMode}
        busy={actionBusy}
        currency={summary?.baseCurrency || 'NGN'}
        close={() => {
          if (!actionBusy) {
            setDetailOpen(false);
            setDetail(null);
            setError('');
          }
        }}
        edit={() => {
          if (detail) {
            setDetailOpen(false);
            setSelected(detail);
            setModal(true);
          }
        }}
        changeStatus={() => void productAction('status')}
        restock={() => {
          setDetailOpen(false);
          setRestockOpen(true);
          setError('');
        }}
        remove={() => void productAction('delete')}
      />
      <RestockModal
        key={`${detail?.id || 'none'}-${restockOpen ? 'open' : 'closed'}`}
        open={restockOpen}
        product={detail}
        warehouses={warehouses}
        busy={actionBusy === 'restock'}
        error={error}
        currency={summary?.baseCurrency || 'NGN'}
        close={() => {
          if (!actionBusy) {
            setRestockOpen(false);
            setDetailOpen(Boolean(detail));
            setError('');
          }
        }}
        submit={(data) => void restock(data)}
      />
      <Modal
        open={Boolean(varianceReport) || varianceLoading}
        wide
        title={varianceReport ? `${varianceReport.project.name} · Variance report` : 'Project variance report'}
        subtitle={varianceOffline ? 'Offline copy from this device. It uses the last cached project totals and transaction details.' : 'Budget compared with approved project costs and recorded project receipts.'}
        onClose={() => { setVarianceReport(null); setVarianceOffline(false); }}
        footer={<button className="button button--secondary" onClick={() => { setVarianceReport(null); setVarianceOffline(false); }}>Close</button>}
      >
        {varianceLoading ? <LoadingState label="Preparing project report…" /> : varianceReport && <>
          <div className="project-variance-summary">
            {[
          ['Budgeted cost', varianceReport.summary.budgetedCost], ['Actual cost (excl. tax)', varianceReport.summary.actualCost],
              [`${varianceReport.summary.costVarianceType.toLowerCase()} cost variance · ${Number(varianceReport.summary.costVariancePercent).toFixed(1)}%`, varianceReport.summary.costVariance],
              ['Expected revenue', varianceReport.summary.expectedRevenue], ['Project receipts', varianceReport.summary.actualRevenue],
              [`${varianceReport.summary.revenueVarianceType.toLowerCase()} revenue variance · ${Number(varianceReport.summary.revenueVariancePercent).toFixed(1)}%`, varianceReport.summary.revenueVariance],
            ].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{money(value)}</strong></article>)}
          </div>
          <h3>Project expenses</h3><p className="field-hint">Only approved expenses count toward actual cost; recoverable tax is excluded.</p><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Merchant</th><th>Status</th><th>Cost excl. tax</th><th>Tax</th></tr></thead><tbody>{varianceReport.expenses.map(x => <tr key={x.id}><td>{x.reference}</td><td>{date(x.expenseDate)}</td><td>{x.merchant}</td><td>{x.status}</td><td>{money(x.amount)}</td><td>{money(x.taxAmount)}</td></tr>)}{!varianceReport.expenses.length && <tr><td className="table-empty" colSpan={6}>No project expenses recorded.</td></tr>}</tbody></table></div>
          <h3>Project receipts</h3><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Amount</th></tr></thead><tbody>{varianceReport.payments.map(x => <tr key={x.id}><td>{x.reference}</td><td>{date(x.paymentDate)}</td><td>{x.customer.displayName}</td><td>{x.invoice.number}</td><td>{money(x.amount)}</td></tr>)}{!varianceReport.payments.length && <tr><td className="table-empty" colSpan={5}>No project receipts recorded.</td></tr>}</tbody></table></div>
          <button className="button button--secondary" onClick={() => downloadVarianceCsv(varianceReport)}>Download report CSV</button>
        </>}
      </Modal>
      <Modal
        open={analyticsOpen}
        wide
        title="Monthly stock insights"
        subtitle="Month-end stock levels and inventory value for the latest 12 months."
        onClose={() => setAnalyticsOpen(false)}
        footer={
          <button className="button button--secondary" onClick={() => setAnalyticsOpen(false)}>
            Close
          </button>
        }
      >
        {analyticsError ? (
          <div className="banking-alert">{analyticsError}</div>
        ) : analyticsLoading ? (
          <LoadingState label="Calculating monthly inventory…" />
        ) : inventoryMonths.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total units</th>
                  <th>Inventory value</th>
                  <th>Highest stock</th>
                  <th>Lowest stock</th>
                </tr>
              </thead>
              <tbody>
                {inventoryMonths.map((month) => (
                  <tr key={month.key}>
                    <td>
                      <strong>{month.label}</strong>
                    </td>
                    <td>{quantity(month.totalUnits)}</td>
                    <td>{money(month.inventoryValue, summary?.baseCurrency)}</td>
                    <td>
                      {month.highest
                        ? `${month.highest.name} · ${quantity(month.highest.quantity)}`
                        : '—'}
                    </td>
                    <td>
                      {month.lowest
                        ? `${month.lowest.name} · ${quantity(month.lowest.quantity)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">No stock movement history is available yet.</div>
        )}
      </Modal>
    </>
  );
}
function downloadVarianceCsv(report: ProjectVarianceReport) {
  const s = report.summary;
  const rows: Array<Array<string | number>> = [
    ['Section', 'Reference', 'Date', 'Description', 'Status', 'Amount excl. tax', 'Tax', 'Variance %', 'Variance type'],
    ['Summary', '', '', 'Budgeted cost', '', s.budgetedCost, '', '', ''],
    ['Summary', '', '', 'Actual cost excl. tax', '', s.actualCost, '', '', ''],
    ['Summary', '', '', 'Cost variance', '', s.costVariance, '', s.costVariancePercent, s.costVarianceType],
    ['Summary', '', '', 'Expected revenue', '', s.expectedRevenue, '', '', ''],
    ['Summary', '', '', 'Actual project receipts', '', s.actualRevenue, '', '', ''],
    ['Summary', '', '', 'Revenue variance', '', s.revenueVariance, '', s.revenueVariancePercent, s.revenueVarianceType],
    ...report.expenses.map((x) => ['Expense', x.reference, date(x.expenseDate), `${x.merchant} · ${x.category}`, x.status, x.amount, x.taxAmount, '', ''] as Array<string | number>),
    ...report.payments.map((x) => ['Project receipt', x.reference, date(x.paymentDate), `${x.customer.displayName} · Invoice ${x.invoice.number}`, 'Recorded', x.amount, '', '', ''] as Array<string | number>),
  ];
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value);
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
  downloadText(`${report.project.code}-variance.csv`, csv);
}

function buildInventoryMonths(products: Product[], movements: StockMovement[]): InventoryMonth[] {
  if (!movements.length) return [];
  const productMap = new Map<string, Product>();
  products.forEach((product) => productMap.set(product.id, product));
  movements.forEach((movement) => productMap.set(movement.product.id, movement.product));
  const ordered = [...movements].sort(
    (left, right) => new Date(left.movementDate).getTime() - new Date(right.movementDate).getTime(),
  );
  const first = new Date(ordered[0].movementDate);
  const today = new Date();
  const firstMonth = new Date(first.getFullYear(), first.getMonth(), 1);
  const earliestVisible = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const start = firstMonth > earliestVisible ? firstMonth : earliestVisible;
  const quantities = new Map<string, number>();
  let movementIndex = 0;
  const rows: InventoryMonth[] = [];

  for (let month = new Date(start); month <= today; month.setMonth(month.getMonth() + 1)) {
    const calendarMonthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const periodEnd =
      month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
        ? new Date(today.getTime() + 1)
        : calendarMonthEnd;
    while (
      movementIndex < ordered.length &&
      new Date(ordered[movementIndex].movementDate) < periodEnd
    ) {
      const movement = ordered[movementIndex];
      const signedQuantity = ['ISSUE', 'TRANSFER_OUT'].includes(movement.type)
        ? -Number(movement.quantity)
        : Number(movement.quantity);
      quantities.set(
        movement.product.id,
        (quantities.get(movement.product.id) || 0) + signedQuantity,
      );
      movementIndex += 1;
    }
    const stockedProducts = [...productMap.values()]
      .filter(
        (product) => product.type === 'PRODUCT' && new Date(product.createdAt || 0) < periodEnd,
      )
      .map((product) => ({
        name: product.name,
        quantity: Math.max(0, quantities.get(product.id) || 0),
        salePrice: Number(product.salePrice),
      }));
    const ranked = [...stockedProducts].sort(
      (left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name),
    );
    rows.push({
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric', timeZone: getReportingTimeZone() }).format(month),
      totalUnits: stockedProducts.reduce((sum, product) => sum + product.quantity, 0),
      inventoryValue: stockedProducts.reduce(
        (sum, product) => sum + product.quantity * product.salePrice,
        0,
      ),
      highest: ranked[0] ? { name: ranked[0].name, quantity: ranked[0].quantity } : null,
      lowest: ranked.length
        ? {
            name: ranked[ranked.length - 1].name,
            quantity: ranked[ranked.length - 1].quantity,
          }
        : null,
    });
  }
  return rows.reverse();
}

function columns(view: OperationsView) {
  if (view === 'products')
    return [
      'SKU',
      'Item',
      'Type / category',
      'Available units',
      'Unit price',
      'Total stock value',
      'Status',
    ];
  if (view === 'warehouses') return ['Code', 'Branch / stock location', 'Manager', 'Address', 'Status'];
  if (view === 'stock-movements')
    return ['Reference', 'Transfer ID', 'Item', 'Branch', 'Date', 'Type / quantity', 'Recorded by'];
  if (view === 'stock-adjustments')
    return ['Reference', 'Item', 'Warehouse', 'Date / quantity', 'Status'];
  return ['Code', 'Project / client', 'Owner', 'Timeline', 'Budget / actual', 'Status'];
}
function values(view: OperationsView, row: Row, currency = 'NGN') {
  if (view === 'products') {
    const x = row as Product;
    return [
      x.sku,
      x.name,
      `${x.type} · ${x.category || 'Uncategorised'}`,
      x.type === 'SERVICE' ? 'Not stocked' : quantity(x.stockQuantity),
      money(x.salePrice, currency),
      x.type === 'SERVICE' ? '—' : money(x.stockValue, currency),
      x.isActive ? 'ACTIVE' : 'ARCHIVED',
    ];
  }
  if (view === 'warehouses') {
    const x = row as Warehouse;
    return [
      x.code,
      `${x.name}${x.isDefault ? ' · Default' : ''}`,
      x.manager || '—',
      x.address || '—',
      x.isActive ? 'ACTIVE' : 'ARCHIVED',
    ];
  }
  if (view === 'stock-movements') {
    const x = row as StockMovement;
    return [
      x.reference,
      x.transferGroupId ? `TRF-${x.transferGroupId.replaceAll('-', '').slice(0, 10).toUpperCase()}` : '—',
      x.product.name,
      x.warehouse.name,
      date(x.movementDate),
      `${x.type.replaceAll('_', ' ')} · ${x.quantity}`,
      x.performedBy
        ? `${[x.performedBy.firstName, x.performedBy.lastName].filter(Boolean).join(' ') || x.performedBy.email}`
        : 'Legacy record',
    ];
  }
  if (view === 'stock-adjustments') {
    const x = row as StockAdjustment;
    return [
      x.reference,
      x.product.name,
      x.warehouse.name,
      `${date(x.adjustmentDate)} · ${Number(x.quantityDelta) > 0 ? '+' : ''}${x.quantityDelta}`,
      x.status,
    ];
  }
  const x = row as Project;
  return [
    x.code,
    `${x.name}${x.client ? ` · ${x.client}` : ''}`,
    x.owner,
    `${date(x.startDate)} – ${date(x.endDate)}`,
    `${money(x.budget, currency)} / ${money(x.actualCost, currency)}`,
    x.status,
  ];
}
function statusOptions(view: OperationsView) {
  if (view === 'products') return ['active', 'archived', 'low_stock', 'out_of_stock'];
  if (view === 'warehouses') return ['active', 'archived'];
  if (view === 'branch-inventory') return ['LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK'];
  if (view === 'stock-movements')
    return ['RECEIPT', 'ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'];
  if (view === 'stock-adjustments') return ['DRAFT', 'APPROVED', 'VOID'];
  return ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
}
function rowActions(
  view: OperationsView,
  row: Row,
  canEdit: boolean,
  canApprove: boolean,
  run: (op: () => Promise<unknown>, message: string) => void,
  edit: () => void,
  viewProduct?: () => void,
  viewProject?: () => void,
) {
  if (view === 'products' && canEdit) {
    return (
      <button
        onClick={(event) => {
          event.stopPropagation();
          viewProduct?.();
        }}
      >
        <Eye size={14} /> Actions
      </button>
    );
  }
  if (view === 'warehouses' && canEdit) {
    const x = row as Warehouse;
    return (
      <>
        <button onClick={edit}>Edit</button>
        {!x.isDefault && x.isActive && (
          <button
            onClick={() =>
              run(() => operationsApi.makeDefaultWarehouse(x.id), `${x.name} is now the default`)
            }
          >
            Make default
          </button>
        )}
        <button
          onClick={() =>
            run(
              () => operationsApi.warehouseStatus(x.id, !x.isActive),
              x.isActive ? 'Warehouse archived' : 'Warehouse restored',
            )
          }
        >
          {x.isActive ? 'Archive' : 'Restore'}
        </button>
      </>
    );
  }
  if (view === 'stock-adjustments' && canApprove && (row as StockAdjustment).status === 'DRAFT') {
    const x = row as StockAdjustment;
    return (
      <>
        <button
          onClick={() =>
            run(() => operationsApi.adjustmentStatus(x.id, 'APPROVED'), 'Adjustment approved')
          }
        >
          Approve
        </button>
        <button
          onClick={() =>
            run(() => operationsApi.adjustmentStatus(x.id, 'VOID'), 'Adjustment voided')
          }
        >
          Void
        </button>
      </>
    );
  }
  if (view === 'projects') {
    const x = row as Project;
    return (
      <>
        <button onClick={viewProject}>Variance report</button>
        {canEdit && <button onClick={edit}>Edit</button>}
        {canApprove && x.status === 'PLANNED' && (
          <button
            onClick={() =>
              run(() => operationsApi.projectStatus(x.id, 'ACTIVE'), 'Project started')
            }
          >
            Start
          </button>
        )}
        {canApprove && x.status === 'ACTIVE' && (
          <button
            onClick={() =>
              run(() => operationsApi.projectStatus(x.id, 'COMPLETED'), 'Project completed')
            }
          >
            Complete
          </button>
        )}
      </>
    );
  }
  return null;
}
async function save(
  view: OperationsView,
  data: Record<string, unknown>,
  selected: Row | null,
  transfer: boolean,
) {
  if (view === 'products')
    return selected
      ? operationsApi.updateProduct(selected.id, data)
      : operationsApi.createProduct(data);
  if (view === 'warehouses')
    return selected
      ? operationsApi.updateWarehouse(selected.id, data)
      : operationsApi.createWarehouse(data);
  if (view === 'branch-inventory') return operationsApi.createBranch(data);
  if (view === 'stock-movements')
    return transfer ? operationsApi.transfer(data) : operationsApi.createMovement(data);
  if (view === 'stock-adjustments') return operationsApi.createAdjustment(data);
  return selected
    ? operationsApi.updateProject(selected.id, data)
    : operationsApi.createProject(data);
}

function BranchStockView({
  data,
  search,
  status,
}: {
  data: BranchInventory | null;
  search: string;
  status: string;
}) {
  if (!data) return <LoadingState label="Loading branch stock…" />;
  const query = search.trim().toLowerCase();
  const matchingBranches = data.branches.filter(
    (branch) => !query || `${branch.code} ${branch.name} ${branch.address ?? ''} ${branch.manager ?? ''}`.toLowerCase().includes(query),
  );
  const matchesProduct = data.products.some(
    (product) => `${product.sku} ${product.productName}`.toLowerCase().includes(query),
  );
  const branchSearchMatches = Boolean(query && matchingBranches.length && !matchesProduct);
  const visibleBranches = branchSearchMatches ? matchingBranches : data.branches;
  const products = data.products.filter((product) => {
    const relevantLocations = product.locations.filter(
      (location) => !branchSearchMatches || visibleBranches.some((branch) => branch.id === location.branchId),
    );
    const matchesSearch = !query ||
      `${product.sku} ${product.productName}`.toLowerCase().includes(query) ||
      product.locations.some((location) => `${location.branchName} ${location.code}`.toLowerCase().includes(query));
    const matchesStatus = !status || relevantLocations.some((location) => location.status === status);
    return matchesSearch && matchesStatus;
  });
  return (
    <div className="branch-stock-overview">
      <p className="branch-stock-overview__hint">
        Each active warehouse is an independently stocked branch location. Receipts and transfers update the same stock ledger used by sales and POS.
      </p>
      {!!data.pendingOfflineChanges && (
        <div className="banking-alert" role="status">
          {data.pendingOfflineChanges} offline stock change{data.pendingOfflineChanges === 1 ? '' : 's'} shown provisionally. Balances will be confirmed when sync completes.
        </div>
      )}
      <div className="branch-stock-overview__locations">
        {visibleBranches.map((branch) => (
          <article className="branch-stock-location" key={branch.id}>
            <div>
              <span className="branch-stock-location__code">{branch.code}</span>
              <h2>{branch.name}</h2>
              <p>{branch.address || 'No address recorded'}{branch.manager ? ` · ${branch.manager}` : ''}</p>
            </div>
            <div className="branch-stock-location__alerts">
              <span>{branch.lowStock} low</span>
              <span className={branch.outOfStock ? 'is-danger' : ''}>{branch.outOfStock} out</span>
            </div>
          </article>
        ))}
        {!data.branches.length && <p className="table-empty">Create a warehouse to register the first branch stock location.</p>}
      </div>
      <div className="branch-stock-overview__products">
        {products.map((product) => (
          <article className="branch-stock-product" key={product.productId}>
            <header>
              <div><small>{product.sku}</small><h3>{product.productName}</h3></div>
              <strong>Total: {quantity(product.totalQuantity)} {product.unit}</strong>
            </header>
            <div className="branch-stock-product__locations">
              {product.locations.filter((location) => !branchSearchMatches || visibleBranches.some((branch) => branch.id === location.branchId)).map((location) => (
                <div key={location.branchId}>
                  <span>{location.branchName}</span>
                  <strong>{quantity(location.quantity)} {product.unit}</strong>
                  <small className={`branch-stock-status branch-stock-status--${location.status.toLowerCase()}`}>
                    {location.status.replaceAll('_', ' ')}
                  </small>
                </div>
              ))}
              {!product.locations.length && <p>No active branches yet.</p>}
            </div>
          </article>
        ))}
        {!products.length && <p className="table-empty">No products match these branch stock filters.</p>}
      </div>
    </div>
  );
}

function ProductCards({
  products,
  currency = 'NGN',
  open,
}: {
  products: Product[];
  currency?: string;
  open: (product: Product) => void;
}) {
  if (!products.length)
    return <div className="table-empty inventory-empty">No products or services found.</div>;
  return (
    <div className="inventory-card-grid">
      {products.map((product) => {
        const stockQuantity = Number(product.stockQuantity);
        const stockState =
          product.isActive && product.type === 'PRODUCT'
            ? stockQuantity <= 0
              ? 'out'
              : stockQuantity <= Number(product.reorderLevel)
                ? 'low'
                : null
            : null;
        return (
          <article
            key={product.id}
            className="inventory-card"
            tabIndex={0}
            role="button"
            onClick={() => open(product)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open(product);
              }
            }}
          >
            <div className="inventory-card__top">
              <span className="inventory-card__icon">
                <Package size={21} />
              </span>
              <span
                className={`inventory-status ${product.isActive ? 'is-active' : 'is-archived'}`}
              >
                {product.isActive ? 'Active' : 'Archived'}
              </span>
            </div>
            <div>
              <small>{product.sku}</small>
              <h3>{product.name}</h3>
              <p>
                {product.category || 'Uncategorised'} ·{' '}
                {product.type === 'PRODUCT' ? 'Product' : 'Service'}
              </p>
            </div>
            <div className="inventory-card__metrics">
              <span>
                <small>Available units</small>
                <strong>
                  {product.type === 'PRODUCT' ? quantity(product.stockQuantity) : 'Not stocked'}
                </strong>
              </span>
              <span>
                <small>Unit price</small>
                <strong>{money(product.salePrice, currency)}</strong>
              </span>
              <span>
                <small>Total stock value</small>
                <strong>
                  {product.type === 'PRODUCT' ? money(product.stockValue, currency) : '—'}
                </strong>
              </span>
            </div>
            {stockState && (
              <div className={`inventory-card__warning is-${stockState}`}>
                {stockState === 'out'
                  ? 'Out of stock'
                  : `Low stock - reorder at ${quantity(product.reorderLevel)} ${product.unit}`}
              </div>
            )}
            <div className="inventory-card__footer">
              <span>View product history</span>
              <Eye size={17} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function personName(person: { email: string; firstName?: string; lastName?: string } | null) {
  if (!person) return 'Not recorded';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;
}

function ProductDetailsModal({
  open,
  product,
  loading,
  error,
  canEdit,
  canDelete,
  offline,
  busy,
  currency,
  close,
  edit,
  changeStatus,
  restock,
  remove,
}: {
  open: boolean;
  product: ProductDetails | null;
  loading: boolean;
  error: string;
  canEdit: boolean;
  canDelete: boolean;
  offline: boolean;
  busy: string;
  currency: string;
  close: () => void;
  edit: () => void;
  changeStatus: () => void;
  restock: () => void;
  remove: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'sales' | 'stock' | 'activity'>('overview');
  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={product?.name || 'Product details'}
      subtitle={
        product
          ? `${product.sku} · ${product.type === 'PRODUCT' ? 'Product' : 'Service'}`
          : 'Loading product history'
      }
      footer={
        product ? (
          <>
            <button className="button button--secondary" onClick={close} disabled={Boolean(busy)}>
              Close
            </button>
            {canEdit && (
              <button className="button button--secondary" onClick={edit} disabled={Boolean(busy)}>
                Edit
              </button>
            )}
            {canEdit && product.isActive && product.type === 'PRODUCT' && (
              <button
                className="button button--secondary"
                onClick={restock}
                disabled={Boolean(busy) || (offline && product.id.startsWith('offline-product:'))}
                title={offline && product.id.startsWith('offline-product:') ? 'Sync this new item before recording stock against it.' : undefined}
              >
                <PackagePlus size={16} /> Restock
              </button>
            )}
            {canEdit && (
              <button className="button" onClick={changeStatus} disabled={Boolean(busy) || (offline && product.id.startsWith('offline-product:'))}>
                {busy === 'status' ? (
                  <>
                    <LoaderCircle className="spin" size={16} />{' '}
                    {product.isActive ? 'Archiving…' : 'Restoring…'}
                  </>
                ) : product.isActive ? (
                  'Archive'
                ) : (
                  'Restore'
                )}
              </button>
            )}
            {canDelete && !product.isActive && (
              <button className="button button--danger" onClick={remove} disabled={Boolean(busy) || offline} title={offline ? 'Connect to the internet to permanently delete an item.' : undefined}>
                {busy === 'delete' ? (
                  <>
                    <LoaderCircle className="spin" size={16} /> Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Delete permanently
                  </>
                )}
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingState label="Loading product history…" />
      ) : error && !product ? (
        <div className="banking-alert">{error}</div>
      ) : (
        product && (
          <div className="product-details">
            {error && <div className="banking-alert">{error}</div>}
            {product.pendingOffline && <div className="banking-alert" role="status">This item has pending offline changes and will sync when you reconnect.</div>}
            {product.offlineHistoryLimited && <div className="banking-alert" role="status">Offline view: saved product details and stock history are available. Sales and user activity history require a connection.</div>}
            <div className="product-details__hero">
              <div className="product-details__identity">
                <span className="inventory-card__icon">
                  <Package size={24} />
                </span>
                <div>
                  <strong>{product.category || 'Uncategorised'}</strong>
                  <span>{product.description || 'No description added.'}</span>
                </div>
              </div>
              <span
                className={`inventory-status ${product.isActive ? 'is-active' : 'is-archived'}`}
              >
                {product.isActive ? 'Active' : 'Archived'}
              </span>
            </div>
            <div className="product-details__stats">
              <div>
                <small>Current stock</small>
                <strong>
                  {product.type === 'PRODUCT'
                    ? `${quantity(product.stockQuantity)} ${product.unit} available`
                    : 'Service'}
                </strong>
              </div>
              <div>
                <small>Stock value</small>
                <strong>{money(product.stockValue, currency)}</strong>
              </div>
              <div>
                <small>Units sold</small>
                <strong>{product.offlineHistoryLimited ? 'Unavailable offline' : product.salesSummary.unitsSold}</strong>
              </div>
              <div>
                <small>Net sales</small>
                <strong>{product.offlineHistoryLimited ? 'Unavailable offline' : money(product.salesSummary.netSales, currency)}</strong>
              </div>
            </div>
            <div className="product-detail-tabs" role="tablist">
              {(['overview', 'sales', 'stock', 'activity'] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  className={tab === value ? 'is-active' : ''}
                  onClick={() => setTab(value)}
                >
                  {value === 'stock' ? 'Stock history' : value[0].toUpperCase() + value.slice(1)}
                  {value === 'sales'
                    ? product.offlineHistoryLimited ? '' : ` (${product.sales.length})`
                    : value === 'stock'
                      ? ` (${product.movements.length})`
                      : value === 'activity'
                        ? ` (${product.activity.length})`
                        : ''}
                </button>
              ))}
            </div>
            {tab === 'overview' && (
              <div className="product-overview-grid">
                <div>
                  <small>Date added</small>
                  <strong>{formatBusinessDateTime(product.createdAt)}</strong>
                </div>
                <div>
                  <small>Added by</small>
                  <strong>{personName(product.createdBy)}</strong>
                </div>
                <div>
                  <small>Sale price</small>
                  <strong>{money(product.salePrice, currency)}</strong>
                </div>
                <div>
                  <small>Cost price</small>
                  <strong>{money(product.costPrice, currency)}</strong>
                </div>
                <div>
                  <small>Tax rate</small>
                  <strong>{product.taxRateName ?? 'Tax'} · {product.taxRate}%</strong>
                </div>
                <div>
                  <small>Reorder level</small>
                  <strong>
                    {product.reorderLevel} {product.unit}
                  </strong>
                </div>
                <div>
                  <small>Sale quantity</small>
                  <strong>
                    {product.allowFractionalSale ? 'Half units allowed' : 'Whole units only'}
                  </strong>
                </div>
              </div>
            )}
            {tab === 'sales' && (
              <div className="product-history-stack">
                <div className="product-sales-summary">
                  <span>
                    <small>Gross sales</small>
                    <strong>{product.offlineHistoryLimited ? 'Unavailable offline' : money(product.salesSummary.grossSales, currency)}</strong>
                  </span>
                  <span>
                    <small>Returns</small>
                    <strong>{product.offlineHistoryLimited ? 'Unavailable offline' : money(product.salesSummary.returnsValue, currency)}</strong>
                  </span>
                  <span>
                    <small>Net sales</small>
                    <strong>{product.offlineHistoryLimited ? 'Unavailable offline' : money(product.salesSummary.netSales, currency)}</strong>
                  </span>
                </div>
                <HistoryTable
                  headers={['Receipt', 'Date', 'Quantity', 'Amount', 'Cashier', 'Status']}
                  empty={product.offlineHistoryLimited ? 'Sales history requires an internet connection.' : 'No sales recorded for this item.'}
                  rows={product.sales.map((sale) => [
                    sale.sale.receiptNumber,
                    date(sale.sale.createdAt),
                    `${sale.quantity} ${product.unit}`,
                    money(sale.lineTotal, sale.sale.currency),
                    personName(sale.cashier),
                    sale.sale.status,
                  ])}
                />
              </div>
            )}
            {tab === 'stock' && (
              <>
                <HistoryTable
                  headers={['Reference', 'Date', 'Warehouse', 'Movement', 'Quantity', 'Unit cost']}
                  empty="No stock movements recorded for this item."
                  rows={product.movements.map((movement) => [
                    movement.reference,
                    date(movement.movementDate),
                    movement.warehouse.name,
                    movement.type.replaceAll('_', ' '),
                    movement.quantity,
                    money(movement.unitCost, currency),
                  ])}
                />
                {product.adjustments.length > 0 && (
                  <>
                    <h3 className="product-details__subheading">Stock adjustments</h3>
                    <HistoryTable
                      headers={['Reference', 'Date', 'Warehouse', 'Reason', 'Change', 'Status']}
                      empty=""
                      rows={product.adjustments.map((adjustment) => [
                        adjustment.reference,
                        date(adjustment.adjustmentDate),
                        adjustment.warehouse.name,
                        adjustment.reason,
                        adjustment.quantityDelta,
                        adjustment.status,
                      ])}
                    />
                  </>
                )}
              </>
            )}
            {tab === 'activity' && (
              <HistoryTable
                headers={['Action', 'Date', 'Performed by']}
                empty="No product activity has been recorded yet."
                rows={product.activity.map((entry) => [
                  entry.action,
                  formatBusinessDateTime(entry.createdAt),
                  personName(entry.actor),
                ])}
              />
            )}
          </div>
        )
      )}
    </Modal>
  );
}

function RestockModal({
  open,
  product,
  warehouses,
  busy,
  error,
  currency,
  close,
  submit,
}: {
  open: boolean;
  product: ProductDetails | null;
  warehouses: Warehouse[];
  busy: boolean;
  error: string;
  currency: string;
  close: () => void;
  submit: (data: Record<string, unknown>) => void;
}) {
  if (!product) return null;
  const today = getBusinessToday();
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Restock ${product.name}`}
      subtitle={`${quantity(product.stockQuantity)} ${product.unit} currently available`}
      footer={
        <>
          <button className="button button--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="button" type="submit" form="restock-form" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={16} /> Adding stock…
              </>
            ) : (
              <>
                <PackagePlus size={16} /> Add stock
              </>
            )}
          </button>
        </>
      }
    >
      <form
        id="restock-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const get = (name: string) => String(form.get(name) || '');
          submit({
            warehouseId: get('warehouseId'),
            quantity: Number(get('quantity')),
            unitCost: Number(get('unitCost')),
            movementDate: get('movementDate'),
            reference: get('reference') || undefined,
            notes: get('notes') || undefined,
          });
        }}
      >
        <div className="inventory-restock-summary full">
          <span>
            <small>Available now</small>
            <strong>
              {quantity(product.stockQuantity)} {product.unit}
            </strong>
          </span>
          <span>
            <small>Current unit cost</small>
            <strong>{money(product.costPrice, currency)}</strong>
          </span>
        </div>
        <label className="full">
          Warehouse
          <select name="warehouseId" required defaultValue={product.defaultWarehouseId || ''}>
            <option value="" disabled>
              Select warehouse
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity to add
          <input name="quantity" type="number" min=".0001" step=".0001" required autoFocus />
        </label>
        <label>
          Unit cost
          <input
            name="unitCost"
            type="number"
            min="0"
            step=".01"
            required
            defaultValue={product.costPrice}
          />
        </label>
        <label>
          Restock date
          <input name="movementDate" type="date" required defaultValue={today} />
        </label>
        <label>
          Reference <small>Optional — generated automatically</small>
          <input name="reference" maxLength={120} placeholder="Supplier receipt or delivery note" />
        </label>
        <label className="full">
          Notes <small>Optional</small>
          <textarea name="notes" rows={3} placeholder="Supplier, batch, or delivery details" />
        </label>
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

function TaxRatesModal({
  open,
  rates,
  offline,
  onClose,
  onChanged,
}: {
  open: boolean;
  rates: TaxRate[];
  offline: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setEditing(null); setError(''); }
  }, [open]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const payload = {
        name: String(form.get('taxRateDisplayName') ?? '').trim(),
        rate: Number(form.get('rate')),
        description: String(form.get('description') ?? '').trim() || undefined,
      };
      if (editing) await operationsApi.updateTaxRate(editing.id, payload);
      else await operationsApi.createTaxRate(payload);
      setEditing(null);
      onChanged();
      confirmAction(editing ? 'Tax rate updated' : 'Tax rate created');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save tax rate');
    } finally { setBusy(false); }
  };
  const toggle = async (rate: TaxRate) => {
    setBusy(true); setError('');
    try {
      await operationsApi.taxRateStatus(rate.id, !rate.isActive);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update tax rate');
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title="Tax rates and treatments" footer={<button className="button button--secondary" onClick={onClose}>Close</button>}>
      <div className="tax-rate-manager">
        {offline && <div className="banking-alert" role="status">Tax rates are read-only offline. Reconnect to make changes.</div>}
        <p>Configure rates once, assign them to products or services, and use the same treatment on sales documents. Saved invoices and receipts retain their original tax snapshots.</p>
        <form key={editing?.id ?? 'new-tax-rate'} className="form-grid tax-rate-manager__form" autoComplete="off" onSubmit={(event) => void save(event)}>
          <label>Rate name<input name="taxRateDisplayName" autoComplete="off" required maxLength={100} defaultValue={editing?.name ?? ''} placeholder="e.g. Standard VAT" /></label>
          <label>Rate (%)<input name="rate" type="number" min="0" max="100" step=".0001" required defaultValue={editing?.rate ?? ''} /></label>
          <label className="full">Description <small>Optional</small><input name="description" maxLength={500} defaultValue={editing?.description ?? ''} placeholder="Tax jurisdiction or treatment notes" /></label>
          {error && <p className="form-error full" role="alert">{error}</p>}
          <div className="tax-rate-manager__actions full">
            {editing && <button type="button" className="button button--secondary" onClick={() => setEditing(null)}>Cancel edit</button>}
            <button className="button" disabled={busy || offline}>{busy ? 'Saving…' : editing ? 'Save rate changes' : 'Add tax rate'}</button>
          </div>
        </form>
        <div className="tax-rate-manager__list">
          {!rates.length && <p>No tax rates configured yet.</p>}
          {rates.map((rate) => (
            <article className="tax-rate-manager__row" key={rate.id}>
              <div><strong>{rate.name}</strong><span>{rate.rate}%{rate.description ? ` · ${rate.description}` : ''}</span></div>
              <span className={`tax-rate-status ${rate.isActive ? 'tax-rate-status--active' : 'tax-rate-status--archived'}`}>{rate.isActive ? 'Active' : 'Archived'}</span>
              <div className="inline-actions">
                <button className="button button--small button--secondary" onClick={() => setEditing(rate)} disabled={busy || offline}>Edit</button>
                <button className="button button--small button--secondary" onClick={() => void toggle(rate)} disabled={busy || offline}>{rate.isActive ? 'Archive' : 'Restore'}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function HistoryTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  empty: string;
}) {
  if (!rows.length) return <div className="product-history-empty">{empty}</div>;
  return (
    <div className="data-table-wrap product-history-table">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                <td key={index}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperationsModal({
  open,
  view,
  selected,
  products,
  categories,
  taxRates,
  offline,
  warehouses,
  busy,
  error,
  close,
  submit,
}: {
  open: boolean;
  view: OperationsView;
  selected: Row | null;
  products: Product[];
  categories: ProductCategory[];
  taxRates: TaxRate[];
  offline: boolean;
  warehouses: Warehouse[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (data: Record<string, unknown>, transfer: boolean) => void;
}) {
  const [transfer, setTransfer] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    warehouses.find((warehouse) => warehouse.isDefault)?.id || '',
  );
  useEffect(() => {
    if (!sourceWarehouseId && warehouses.length)
      setSourceWarehouseId(warehouses.find((warehouse) => warehouse.isDefault)?.id || warehouses[0].id);
  }, [sourceWarehouseId, warehouses]);
  const [selectedCategory, setSelectedCategory] = useState(
    view === 'products' ? ((selected as Product | null)?.category ?? '') : '',
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [allowFractionalSale, setAllowFractionalSale] = useState(
    view === 'products' ? ((selected as Product | null)?.allowFractionalSale ?? false) : false,
  );
  const [itemType, setItemType] = useState<'PRODUCT' | 'SERVICE'>(
    view === 'products' ? ((selected as Product | null)?.type ?? 'PRODUCT') : 'PRODUCT',
  );
  const today = getBusinessToday();
  const closeModal = () => {
    setTransfer(false);
    close();
  };
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (name: string) => {
      const field = name === 'name'
        ? view === 'products' ? 'inventoryItemName' : view === 'projects' ? 'projectDisplayName' : 'stockLocationName'
        : name === 'code'
          ? view === 'projects' ? 'projectCode' : 'stockLocationCode'
          : name;
      return String(f.get(field) || '');
    };
    const num = (name: string) => Number(get(name));
    if (view === 'products')
      submit(
        {
          sku: get('sku'),
          name: get('name'),
          type: itemType,
          category: selectedCategory || undefined,
          description: get('description') || undefined,
          unit: get('unit'),
          salePrice: num('salePrice'),
          costPrice: num('costPrice'),
          taxRateId: get('taxRateId') || undefined,
          taxRate: Number(
            taxRates.find((rate) => rate.id === get('taxRateId'))?.rate ??
              (p?.taxRateId === get('taxRateId') ? p.taxRate : 0),
          ),
          reorderLevel: num('reorderLevel'),
          allowFractionalSale,
          defaultWarehouseId: get('defaultWarehouseId') || undefined,
          ...(itemType === 'PRODUCT'
            ? p
              ? (offline ? {} : { availableQuantity: num('availableQuantity') })
              : { openingQuantity: num('openingQuantity') }
            : {}),
        },
        false,
      );
    else if (view === 'warehouses' || view === 'branch-inventory')
      submit(
        {
          code: get('code'),
          name: get('name'),
          manager: get('manager') || undefined,
          address: get('address') || undefined,
        },
        false,
      );
    else if (view === 'stock-movements')
      submit(
        transfer
          ? {
              productId: get('productId'),
              fromWarehouseId: get('warehouseId'),
              toWarehouseId: get('toWarehouseId'),
              quantity: num('quantity'),
              unitCost: num('unitCost'),
              movementDate: get('date'),
              reference: get('reference'),
              notes: get('notes') || undefined,
            }
          : {
              productId: get('productId'),
              warehouseId: get('warehouseId'),
              type: get('type'),
              quantity: num('quantity'),
              unitCost: num('unitCost'),
              movementDate: get('date'),
              reference: get('reference'),
              notes: get('notes') || undefined,
            },
        transfer,
      );
    else if (view === 'stock-adjustments')
      submit(
        {
          productId: get('productId'),
          warehouseId: get('warehouseId'),
          reference: get('reference'),
          adjustmentDate: get('date'),
          quantityDelta: num('quantity'),
          unitCost: num('unitCost'),
          reason: get('reason'),
          notes: get('notes') || undefined,
        },
        false,
      );
    else
      submit(
        {
          code: get('code'),
          name: get('name'),
          client: get('client') || undefined,
          owner: get('owner'),
          startDate: get('startDate'),
          endDate: get('endDate') || undefined,
          budget: num('budget'),
          revenue: num('revenue'),
          status: get('status'),
          description: get('description') || undefined,
          tasks: selected && 'tasks' in selected ? selected.tasks : [],
        },
        false,
      );
  };
  const p = selected as Product | null,
    w = selected as Warehouse | null,
    project = selected as Project | null;
  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    setCategoryError('');
    try {
      const category = await operationsApi.createCategory(name);
      setSelectedCategory(category.name);
      setNewCategory('');
      setAddingCategory(false);
      confirmAction(`Category “${category.name}” added`);
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : 'Unable to add category');
    }
  };
  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={`${selected ? 'Edit' : 'Create'} ${titles[view].toLowerCase()}`}
      footer={
        <>
          <button className="button button--secondary" onClick={closeModal}>
            Cancel
          </button>
          <button className="button" type="submit" form="operations-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="operations-form" className="form-grid" autoComplete="off" onSubmit={handle}>
        {view === 'products' && (
          <>
            <label>
              SKU
              <input name="sku" required defaultValue={p?.sku} />
            </label>
            <label>
              Item name
              <input name="inventoryItemName" autoComplete="off" required defaultValue={p?.name} />
            </label>
            <label>
              Type
              <select
                name="type"
                value={itemType}
                onChange={(event) => setItemType(event.target.value as 'PRODUCT' | 'SERVICE')}
                disabled={Boolean(p)}
              >
                <option>PRODUCT</option>
                <option>SERVICE</option>
              </select>
              {p && <small>Item type cannot change after creation.</small>}
            </label>
            <label>
              Category
              <div className="category-picker">
                <select
                  name="category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                  {selectedCategory &&
                    !categories.some((category) => category.name === selectedCategory) && (
                      <option value={selectedCategory}>{selectedCategory}</option>
                    )}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Add category"
                  title="Add category"
                  onClick={() => setAddingCategory((value) => !value)}
                >
                  <Plus size={16} />
                </button>
              </div>
              {addingCategory && (
                <div className="category-picker__add">
                  <input
                    value={newCategory}
                    placeholder="New category"
                    onChange={(event) => setNewCategory(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addCategory();
                      }
                    }}
                  />
                  <button type="button" onClick={() => void addCategory()}>
                    Add
                  </button>
                </div>
              )}
              {categoryError && <small className="form-error">{categoryError}</small>}
            </label>
            <label>
              Unit
              <input
                name="unit"
                required
                maxLength={40}
                pattern=".*[A-Za-z].*"
                title="Enter a unit name such as unit, kg, pack, or bottle"
                placeholder="e.g. unit, kg, pack"
                defaultValue={p?.unit && /[A-Za-z]/.test(p.unit) ? p.unit : 'unit'}
              />
            </label>
            <label>
              Sale price
              <input
                name="salePrice"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={p?.salePrice || 0}
              />
            </label>
            <label>
              Cost price
              <input
                name="costPrice"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={p?.costPrice || 0}
              />
            </label>
            <label>
              Tax treatment
              <select name="taxRateId" defaultValue={p?.taxRateId ?? ''}>
                <option value="">No tax (0%)</option>
              {p?.taxRateId && !taxRates.some((rate) => rate.id === p.taxRateId) && (
                <option value={p.taxRateId}>{p.taxRateName ?? 'Saved tax treatment'} · {p.taxRate}%</option>
              )}
                {taxRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>{rate.name} · {rate.rate}%</option>
                ))}
              </select>
              {!taxRates.length && <small>{offline ? 'No saved tax rates are available offline. Reconnect and refresh the offline workspace to assign a tax treatment.' : 'Create a tax rate first to assign a tax treatment.'}</small>}
            </label>
            <label>
              Reorder level
              <input
                name="reorderLevel"
                type="number"
                min="0"
                step=".0001"
                required
                defaultValue={p?.reorderLevel || 0}
              />
            </label>
            {itemType === 'PRODUCT' && (
              <label>
                Default branch stock location
                <select
                  name="defaultWarehouseId"
                  defaultValue={
                    p?.defaultWarehouseId ||
                    warehouses.find((warehouse) => warehouse.isDefault)?.id ||
                    ''
                  }
                >
                  <option value="">No default warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} — {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!p && itemType === 'PRODUCT' && (
              <>
                <label>
                  Opening quantity
                  <input
                    name="openingQuantity"
                    type="number"
                    min="0"
                    step={allowFractionalSale ? '.5' : '1'}
                    defaultValue="0"
                  />
                </label>
              </>
            )}
            {p && itemType === 'PRODUCT' && (
              <label>
                Total available quantity
                <input
                  name="availableQuantity"
                  type="number"
                  min="0"
                  step={allowFractionalSale ? '.5' : '1'}
                  defaultValue={p.stockQuantity}
                  required
                  disabled={offline}
                />
                <small>
                  {offline
                    ? 'Stock count corrections require a connection so inventory adjustments and accounting stay in sync. Use Restock for a queued stock receipt.'
                    : `Exact stock count in ${p.unit || 'units'}. Changes are saved as an inventory adjustment.`}
                </small>
              </label>
            )}
            <label className="full fractional-sale-option">
              <input
                name="allowFractionalSale"
                type="checkbox"
                checked={allowFractionalSale}
                onChange={(event) => setAllowFractionalSale(event.target.checked)}
              />
              <span>
                <strong>Allow sales in half units</strong>
                <small>
                  Cashiers can sell quantities such as 0.5, 1.5, or 5.5. Leave off for whole-unit
                  sales only.
                </small>
              </span>
            </label>
            <label className="full">
              Description
              <textarea name="description" defaultValue={p?.description} />
            </label>
          </>
        )}
        {(view === 'warehouses' || view === 'branch-inventory') && (
          <>
            <label>
              Code
              <input name="stockLocationCode" autoComplete="off" required defaultValue={w?.code} />
            </label>
            <label>
              Name
              <input name="stockLocationName" autoComplete="off" required defaultValue={w?.name} />
            </label>
            <label>
              Manager
              <input name="manager" defaultValue={w?.manager} />
            </label>
            <label className="full">
              Address
              <textarea name="address" defaultValue={w?.address} />
            </label>
          </>
        )}
        {(view === 'stock-movements' || view === 'stock-adjustments') && (
          <>
            <label className="full">
              Product
              <select name="productId" required defaultValue="">
                <option value="" disabled>
                  Select product
                </option>
                {products.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.sku} — {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select
                name="warehouseId"
                required
                defaultValue={warehouses.find((warehouse) => warehouse.isDefault)?.id || ''}
                onChange={(event) => setSourceWarehouseId(event.target.value)}
              >
                <option value="" disabled>
                  Select branch location
                </option>
                {warehouses.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.code} — {x.name}
                  </option>
                ))}
              </select>
            </label>
            {view === 'stock-movements' && (
              <label>
                Movement mode
                <select
                  value={transfer ? 'TRANSFER' : 'SINGLE'}
                  onChange={(e) => setTransfer(e.target.value === 'TRANSFER')}
                >
                  <option value="SINGLE">Receipt / issue</option>
                  <option value="TRANSFER">Branch transfer</option>
                </select>
              </label>
            )}
            {view === 'stock-movements' && transfer && (
              <label>
                Destination
                <select name="toWarehouseId" required defaultValue="">
                  <option value="" disabled>
                    Select destination branch
                  </option>
                  {warehouses.filter((x) => x.id !== sourceWarehouseId).map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.code} — {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {view === 'stock-movements' && !transfer && (
              <label>
                Type
                <select name="type">
                  <option>RECEIPT</option>
                  <option>ISSUE</option>
                </select>
              </label>
            )}
            <label>
              Reference
              <input name="reference" required />
            </label>
            <label>
              Date
              <input name="date" type="date" required defaultValue={today} />
            </label>
            <label>
              Quantity{view === 'stock-adjustments' && ' (+ or -)'}
              <input
                name="quantity"
                type="number"
                step=".0001"
                {...(view === 'stock-movements' ? { min: 0.0001 } : {})}
                required
              />
            </label>
            <label>
              Unit cost
              <input name="unitCost" type="number" min="0" step=".01" required defaultValue="0" />
            </label>
            {view === 'stock-adjustments' && (
              <label className="full">
                Reason
                <input name="reason" required />
              </label>
            )}
            <label className="full">
              Notes
              <textarea name="notes" />
            </label>
          </>
        )}
        {view === 'projects' && (
          <>
            <label>
              Project code
              <input name="projectCode" autoComplete="off" required defaultValue={project?.code} />
            </label>
            <label>
              Project name
              <input name="projectDisplayName" autoComplete="off" required defaultValue={project?.name} />
            </label>
            <label>
              Client
              <input name="client" defaultValue={project?.client} />
            </label>
            <label>
              Owner
              <input name="owner" required defaultValue={project?.owner} />
            </label>
            <label>
              Start date
              <input
                name="startDate"
                type="date"
                required
                defaultValue={project?.startDate?.slice(0, 10)}
              />
            </label>
            <label>
              End date
              <input name="endDate" type="date" defaultValue={project?.endDate?.slice(0, 10)} />
            </label>
            <label>
              Budget
              <input
                name="budget"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={project?.budget || 0}
              />
            </label>
            <label>
              Expected revenue
              <input
                name="revenue"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={project?.revenue || 0}
              />
            </label>
            <label>
              Status
              <select name="status" defaultValue={project?.status || 'PLANNED'}>
                {statusOptions('projects').map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="full">
              Description
              <textarea name="description" defaultValue={project?.description} />
            </label>
          </>
        )}
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

function ProjectAiPage({ canEdit }: { canEdit: boolean }) {
  const [plan, setPlan] = useState<ProjectPlan | null>(null),
    [draft, setDraft] = useState<Record<string, string | number> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const savePlan = async () => {
    if (!plan || !draft) return;
    setBusy(true);
    setError('');
    try {
      await operationsApi.createProject({
        code: draft.code,
        name: plan.name,
        owner: draft.owner,
        startDate: draft.startDate,
        endDate: draft.targetDate || undefined,
        budget: draft.budget,
        revenue: 0,
        status: 'PLANNED',
        description: plan.summary,
        tasks: plan.tasks,
      });
      confirmAction('AI project plan saved as a planned project');
      setPlan(null);
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save project');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Project management AI</h1>
          <p>Generate a structured project brief, delivery plan, risks, and actionable tasks.</p>
        </div>
      </div>
      <section className="panel register-panel">
        <form
          className="form-grid"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            const next = {
              code: String(f.get('projectCode')),
              name: String(f.get('projectDisplayName')),
              objective: String(f.get('objective')),
              owner: String(f.get('owner')),
              startDate: String(f.get('startDate')),
              targetDate: String(f.get('targetDate') || ''),
              budget: Number(f.get('budget') || 0),
            };
            if (next.targetDate && next.targetDate < next.startDate) {
              setError('Target date cannot be before the project start date.');
              setPlan(null);
              return;
            }
            setDraft(next);
            setBusy(true);
            setError('');
            operationsApi
              .planProject({
                name: next.name,
                objective: next.objective,
                owner: next.owner,
                targetDate: next.targetDate || undefined,
                budget: next.budget,
              })
              .then(setPlan)
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Unable to generate plan'),
              )
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Project code
            <input name="projectCode" autoComplete="off" required />
          </label>
          <label>
            Project name
            <input name="projectDisplayName" autoComplete="off" required />
          </label>
          <label>
            Owner
            <input name="owner" required />
          </label>
          <label>
            Start date
            <input name="startDate" type="date" required />
          </label>
          <label>
            Target date
            <input name="targetDate" type="date" />
          </label>
          <label>
            Budget
            <input name="budget" type="number" min="0" step=".01" />
          </label>
          <label className="full">
            Objective
            <textarea name="objective" required />
          </label>
          {error && (
            <div className="banking-alert form-alert full" role="alert" aria-live="polite">
              <span>
                <strong>Unable to generate the project plan</strong>
                <small>{error}</small>
              </span>
              <button type="button" onClick={() => setError('')}>
                Dismiss
              </button>
            </div>
          )}
          <div className="full">
            <button className="button" disabled={busy || !canEdit}>
              <Sparkles size={17} /> {busy ? 'Generating…' : 'Generate project plan'}
            </button>
          </div>
        </form>
      </section>
      {plan && (
        <section className="panel register-panel">
          <div className="page-header">
            <div>
              <h2>{plan.name}</h2>
              <p>{plan.summary}</p>
            </div>
            <button className="button" disabled={busy} onClick={() => void savePlan()}>
              Save as project
            </button>
          </div>
          <h3>Recommended tasks</h3>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Phase</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {plan.tasks.map((task) => (
                  <tr key={task.title}>
                    <td>{task.title}</td>
                    <td>{task.phase}</td>
                    <td>{task.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Key risks</h3>
          <ul>
            {plan.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

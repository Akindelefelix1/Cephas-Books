import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
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
import {
  INVENTORY_CHANGED_EVENT,
  operationsApi,
  type OperationsSummary,
  type OperationsView,
  type Product,
  type ProductDetails,
  type ProductCategory,
  type Project,
  type ProjectPlan,
  type StockAdjustment,
  type StockMovement,
  type Warehouse,
} from '@/services/operations';

type Row = Product | Warehouse | StockMovement | StockAdjustment | Project;
const money = (value: string | number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value));
const quantity = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { maximumFractionDigits: 4 }).format(Number(value));
const date = (value?: string) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');
const titles: Record<OperationsView, string> = {
  products: 'Products & services',
  warehouses: 'Warehouses',
  'stock-movements': 'Stock movements',
  'stock-adjustments': 'Stock adjustments',
  projects: 'Projects',
  'project-ai': 'Project management AI',
};

export function InventoryOperationsPage({ view, role }: { view: OperationsView; role: string }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const canApprove = canEdit || role === 'APPROVER';
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [display, setDisplay] = useState<'table' | 'cards'>('table');
  const [detail, setDetail] = useState<ProductDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [restockOpen, setRestockOpen] = useState(false);

  const load = useCallback(async () => {
    if (view === 'project-ai') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [s, p, w, c] = await Promise.all([
        operationsApi.summary(),
        operationsApi.products(),
        operationsApi.warehouses(),
        operationsApi.categories(),
      ]);
      setSummary(s);
      setProducts(p.filter((x) => x.isActive && x.type === 'PRODUCT'));
      setWarehouses(w.filter((x) => x.isActive));
      setCategories(c);
      if (view === 'products') setRows(await operationsApi.products({ search, status }));
      else if (view === 'warehouses') setRows(await operationsApi.warehouses({ search, status }));
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
  }, [view, search, status]);
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
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setModal(false);
      setSelected(null);
      confirmAction(message);
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
    if (
      kind === 'delete' &&
      !window.confirm(`Permanently delete ${detail.name}? This cannot be undone.`)
    )
      return;
    setActionBusy(kind);
    setError('');
    try {
      if (kind === 'delete') await operationsApi.deleteProduct(detail.id);
      else await operationsApi.productStatus(detail.id, !detail.isActive);
      confirmAction(
        kind === 'delete' ? 'Item deleted' : detail.isActive ? 'Item archived' : 'Item restored',
      );
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
      await operationsApi.restockProduct(detail.id, data);
      window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT));
      confirmAction(`${detail.name} restocked`);
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
  if (view === 'project-ai') return <ProjectAiPage canEdit={canEdit} />;
  const action = {
    products: 'New item',
    warehouses: 'Add warehouse',
    'stock-movements': 'Record movement',
    'stock-adjustments': 'New adjustment',
    projects: 'New project',
    'project-ai': '',
  }[view];
  const exportCsv = () =>
    downloadText(
      `${view}.csv`,
      [
        columns(view).join(','),
        ...rows.map((row) =>
          values(view, row, summary?.baseCurrency)
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n'),
    );
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>Manage {titles[view].toLowerCase()} with controlled, traceable operational records.</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--secondary" onClick={exportCsv}>
            <Download size={17} /> Export CSV
          </button>
          {canEdit && (
            <button className="button" onClick={() => setModal(true)}>
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
                value: money(summary.inventoryValue, summary.baseCurrency),
              },
              { label: 'Active items', value: String(summary.products) },
              {
                label: 'Stock alerts',
                value: `${summary.lowStock} low · ${summary.outOfStock} out`,
                tone: summary.outOfStock ? 'danger' : 'warning',
              },
              {
                label: view === 'projects' ? 'Active projects' : 'Warehouses',
                value: String(view === 'projects' ? summary.activeProjects : summary.warehouses),
              },
            ]}
          />
        )
      )}
      <section className="panel register-panel">
        <div className="banking-filters">
          <input
            aria-label="Search"
            placeholder={`Search ${titles[view].toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statusOptions(view).map((x) => (
              <option key={x} value={x}>
                {x.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
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
                  {(canEdit || canApprove) && <th>Actions</th>}
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
                    {(canEdit || canApprove) && (
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
                      colSpan={columns(view).length + (canEdit || canApprove ? 1 : 0)}
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
      <OperationsModal
        key={`${view}-${selected?.id || 'new'}-${modal ? 'open' : 'closed'}`}
        open={modal}
        view={view}
        selected={selected}
        products={products}
        categories={categories}
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
      <ProductDetailsModal
        key={detail?.id || (detailOpen ? 'loading' : 'closed')}
        open={detailOpen}
        product={detail}
        loading={detailLoading}
        error={error}
        canEdit={canEdit}
        canDelete={['OWNER', 'ADMIN'].includes(role)}
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
    </>
  );
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
  if (view === 'warehouses') return ['Code', 'Warehouse', 'Manager', 'Address', 'Status'];
  if (view === 'stock-movements')
    return ['Reference', 'Item', 'Warehouse', 'Date', 'Type / quantity'];
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
    return [x.code, x.name, x.manager || '—', x.address || '—', x.isActive ? 'ACTIVE' : 'ARCHIVED'];
  }
  if (view === 'stock-movements') {
    const x = row as StockMovement;
    return [
      x.reference,
      x.product.name,
      x.warehouse.name,
      date(x.movementDate),
      `${x.type.replaceAll('_', ' ')} · ${x.quantity}`,
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
  if (view === 'products' || view === 'warehouses') return ['active', 'archived'];
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
  if (view === 'stock-movements')
    return transfer ? operationsApi.transfer(data) : operationsApi.createMovement(data);
  if (view === 'stock-adjustments') return operationsApi.createAdjustment(data);
  return selected
    ? operationsApi.updateProject(selected.id, data)
    : operationsApi.createProject(data);
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
                disabled={Boolean(busy)}
              >
                <PackagePlus size={16} /> Restock
              </button>
            )}
            {canEdit && (
              <button className="button" onClick={changeStatus} disabled={Boolean(busy)}>
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
              <button className="button button--danger" onClick={remove} disabled={Boolean(busy)}>
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
                <strong>{product.salesSummary.unitsSold}</strong>
              </div>
              <div>
                <small>Net sales</small>
                <strong>{money(product.salesSummary.netSales, currency)}</strong>
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
                    ? ` (${product.sales.length})`
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
                  <strong>{new Date(product.createdAt).toLocaleString('en-NG')}</strong>
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
                  <strong>{product.taxRate}%</strong>
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
                    <strong>{money(product.salesSummary.grossSales, currency)}</strong>
                  </span>
                  <span>
                    <small>Returns</small>
                    <strong>{money(product.salesSummary.returnsValue, currency)}</strong>
                  </span>
                  <span>
                    <small>Net sales</small>
                    <strong>{money(product.salesSummary.netSales, currency)}</strong>
                  </span>
                </div>
                <HistoryTable
                  headers={['Receipt', 'Date', 'Quantity', 'Amount', 'Cashier', 'Status']}
                  empty="No sales recorded for this item."
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
                  new Date(entry.createdAt).toLocaleString('en-NG'),
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
  const today = new Date().toLocaleDateString('en-CA');
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
  warehouses: Warehouse[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (data: Record<string, unknown>, transfer: boolean) => void;
}) {
  const [transfer, setTransfer] = useState(false);
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
  const today = new Date().toLocaleDateString('en-CA');
  const closeModal = () => {
    setTransfer(false);
    close();
  };
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (name: string) => String(f.get(name) || '');
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
          taxRate: num('taxRate'),
          reorderLevel: num('reorderLevel'),
          allowFractionalSale,
          defaultWarehouseId: get('defaultWarehouseId') || undefined,
          ...(itemType === 'PRODUCT'
            ? p
              ? { availableQuantity: num('availableQuantity') }
              : { openingQuantity: num('openingQuantity') }
            : {}),
        },
        false,
      );
    else if (view === 'warehouses')
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
          actualCost: num('actualCost'),
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
      <form id="operations-form" className="form-grid" onSubmit={handle}>
        {view === 'products' && (
          <>
            <label>
              SKU
              <input name="sku" required defaultValue={p?.sku} />
            </label>
            <label>
              Item name
              <input name="name" required defaultValue={p?.name} />
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
              Tax %
              <input
                name="taxRate"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={p?.taxRate || 0}
              />
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
                Default stock warehouse
                <select name="defaultWarehouseId" defaultValue={p?.defaultWarehouseId || ''}>
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
                />
                <small>
                  Exact stock count in {p.unit || 'units'}. Changes are saved as an inventory
                  adjustment.
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
        {view === 'warehouses' && (
          <>
            <label>
              Code
              <input name="code" required defaultValue={w?.code} />
            </label>
            <label>
              Name
              <input name="name" required defaultValue={w?.name} />
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
              Warehouse
              <select name="warehouseId" required defaultValue="">
                <option value="" disabled>
                  Select warehouse
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
                  <option value="TRANSFER">Warehouse transfer</option>
                </select>
              </label>
            )}
            {view === 'stock-movements' && transfer && (
              <label>
                Destination
                <select name="toWarehouseId" required defaultValue="">
                  <option value="" disabled>
                    Select destination
                  </option>
                  {warehouses.map((x) => (
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
              <input name="code" required defaultValue={project?.code} />
            </label>
            <label>
              Project name
              <input name="name" required defaultValue={project?.name} />
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
              Actual cost
              <input
                name="actualCost"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={project?.actualCost || 0}
              />
            </label>
            <label>
              Revenue
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
        actualCost: 0,
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
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            const next = {
              code: String(f.get('code')),
              name: String(f.get('name')),
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
            <input name="code" required />
          </label>
          <label>
            Project name
            <input name="name" required />
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

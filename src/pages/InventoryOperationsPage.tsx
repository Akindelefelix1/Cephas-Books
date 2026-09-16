import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { confirmAction, downloadText } from '@/utils/actions';
import {
  operationsApi,
  type OperationsSummary,
  type OperationsView,
  type Product,
  type Project,
  type ProjectPlan,
  type StockAdjustment,
  type StockMovement,
  type Warehouse,
} from '@/services/operations';

type Row = Product | Warehouse | StockMovement | StockAdjustment | Project;
const money = (value: string | number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value));
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (view === 'project-ai') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [s, p, w] = await Promise.all([
        operationsApi.summary(),
        operationsApi.products(),
        operationsApi.warehouses(),
      ]);
      setSummary(s);
      setProducts(p.filter((x) => x.isActive && x.type === 'PRODUCT'));
      setWarehouses(w.filter((x) => x.isActive));
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
      {summary && (
        <StatsGrid
          stats={[
            {
              label: 'Inventory value',
              value: money(summary.inventoryValue, summary.baseCurrency),
            },
            { label: 'Active items', value: String(summary.products) },
            {
              label: 'Low / out of stock',
              value: `${summary.lowStock} / ${summary.outOfStock}`,
              tone: summary.outOfStock ? 'danger' : 'warning',
            },
            {
              label: view === 'projects' ? 'Active projects' : 'Warehouses',
              value: String(view === 'projects' ? summary.activeProjects : summary.warehouses),
            },
          ]}
        />
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
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="banking-state">
            <RefreshCw className="spin" /> Loading…
          </div>
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
                  <tr key={row.id}>
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
                            (operation, message) => void run(operation, message),
                            () => {
                              setSelected(row);
                              setModal(true);
                            },
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
        open={modal}
        view={view}
        selected={selected}
        products={products}
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
    </>
  );
}

function columns(view: OperationsView) {
  if (view === 'products') return ['SKU', 'Item', 'Type / category', 'Stock / value', 'Status'];
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
      x.type === 'SERVICE'
        ? money(x.salePrice, currency)
        : `${x.stockQuantity} ${x.unit} · ${money(x.stockValue, currency)}`,
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
) {
  if (view === 'products' && canEdit) {
    const x = row as Product;
    return (
      <>
        <button onClick={edit}>Edit</button>
        <button
          onClick={() =>
            run(
              () => operationsApi.productStatus(x.id, !x.isActive),
              x.isActive ? 'Item archived' : 'Item restored',
            )
          }
        >
          {x.isActive ? 'Archive' : 'Restore'}
        </button>
      </>
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

function OperationsModal({
  open,
  view,
  selected,
  products,
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
  warehouses: Warehouse[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (data: Record<string, unknown>, transfer: boolean) => void;
}) {
  const [transfer, setTransfer] = useState(false);
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
          type: get('type'),
          category: get('category') || undefined,
          description: get('description') || undefined,
          unit: get('unit'),
          salePrice: num('salePrice'),
          costPrice: num('costPrice'),
          taxRate: num('taxRate'),
          reorderLevel: num('reorderLevel'),
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
              <select name="type" defaultValue={p?.type || 'PRODUCT'}>
                <option>PRODUCT</option>
                <option>SERVICE</option>
              </select>
            </label>
            <label>
              Category
              <input name="category" defaultValue={p?.category} />
            </label>
            <label>
              Unit
              <input name="unit" required defaultValue={p?.unit || 'unit'} />
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

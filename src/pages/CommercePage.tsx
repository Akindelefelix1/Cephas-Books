import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import {
  commerceApi,
  type CommerceCatalogItem,
  type CommerceChannel,
  type CommerceOrder,
  type CommerceSummary,
  type CommerceView,
} from '@/services/commerce';
import { operationsApi, type Warehouse } from '@/services/operations';
import { posApi, type PosBranch } from '@/services/pos';
import { confirmAction } from '@/utils/actions';
import { getDefaultCurrency } from '@/utils/currency';

const titles: Record<CommerceView, [string, string]> = {
  'commerce-dashboard': ['Commerce', 'One view of channels, orders, sales, and inventory.'],
  'sales-channels': ['Sales channels', 'Manage every physical and digital route to market.'],
  'channel-orders': [
    'Channel orders',
    'Orders from POS and direct sales in one operational queue.',
  ],
  fulfillment: [
    'Fulfillment',
    'Prepare the connected order flow for picking, packing, and delivery.',
  ],
  payouts: ['Payouts', 'Reconcile channel settlements, fees, refunds, and bank deposits.'],
  'product-channel-mapping': [
    'Product/channel mapping',
    'Publish the central inventory catalogue across active channels.',
  ],
  'commerce-analytics': ['Commerce analytics', 'Understand revenue and orders by sales source.'],
  'commerce-settings': ['Commerce settings', 'Control shared synchronization defaults.'],
};

const channelTypes: Array<[CommerceChannel['type'], string]> = [
  ['POS', 'Cephas POS / physical store'],
  ['B2B', 'B2B / wholesale'],
  ['ONLINE_STORE', 'Online store'],
  ['MARKETPLACE', 'Marketplace'],
  ['SOCIAL', 'Social / assisted commerce'],
  ['CUSTOM_API', 'Custom API'],
];

const money = (value: string | number, currency = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value));
const number = (value: string | number) => new Intl.NumberFormat('en-NG').format(Number(value));
const dateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';
const channelLabel = (type: CommerceChannel['type']) =>
  channelTypes.find(([value]) => value === type)?.[1] ?? type;

export function CommercePage({ view, canManage }: { view: CommerceView; canManage: boolean }) {
  const [summary, setSummary] = useState<CommerceSummary | null>(null);
  const [channels, setChannels] = useState<CommerceChannel[]>([]);
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [catalog, setCatalog] = useState<CommerceCatalogItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<PosBranch[]>([]);
  const [editing, setEditing] = useState<CommerceChannel | null>(null);
  const [channelModal, setChannelModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      commerceApi.summary(),
      commerceApi.channels(),
      commerceApi.orders(),
      commerceApi.catalog(),
      operationsApi.warehouses({ status: 'active' }),
      posApi.branches(),
    ])
      .then(
        ([nextSummary, nextChannels, nextOrders, nextCatalog, nextWarehouses, nextBranches]) => {
          setSummary(nextSummary);
          setChannels(nextChannels);
          setOrders(nextOrders);
          setCatalog(nextCatalog);
          setWarehouses(nextWarehouses);
          setBranches(nextBranches);
        },
      )
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Unable to load Commerce');
      })
      .finally(() => setLoading(false));
  }, []);

  const sourceTotals = useMemo(() => {
    const totals = new Map<string, { orders: number; revenue: number }>();
    for (const order of orders) {
      const row = totals.get(order.source) ?? { orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      totals.set(order.source, row);
    }
    return [...totals.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  const saveChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: String(form.get('name') || '').trim(),
      type: String(form.get('type')) as CommerceChannel['type'],
      branchId: String(form.get('branchId') || '') || undefined,
      warehouseId: String(form.get('warehouseId')),
      syncInventory: form.get('syncInventory') === 'on',
      syncOrders: form.get('syncOrders') === 'on',
      syncCustomers: form.get('syncCustomers') === 'on',
      ...(editing ? { status: editing.status } : {}),
    };
    setBusyId('save');
    setError('');
    try {
      const saved = editing
        ? await commerceApi.updateChannel(editing.id, data)
        : await commerceApi.createChannel(data);
      setChannels((current) =>
        editing
          ? current.map((channel) => (channel.id === saved.id ? saved : channel))
          : [saved, ...current],
      );
      setChannelModal(false);
      setEditing(null);
      confirmAction(`${saved.name} ${editing ? 'updated' : 'connected'} successfully.`);
      const nextSummary = await commerceApi.summary();
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save sales channel');
    } finally {
      setBusyId('');
    }
  };

  const sync = async (channel: CommerceChannel) => {
    setBusyId(channel.id);
    setError('');
    try {
      const updated = await commerceApi.syncChannel(channel.id);
      setChannels((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      confirmAction(`${updated.name} synchronized with central inventory.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to synchronize channel');
    } finally {
      setBusyId('');
    }
  };

  const toggle = async (channel: CommerceChannel) => {
    setBusyId(channel.id);
    try {
      const updated = await commerceApi.updateChannel(channel.id, {
        name: channel.name,
        type: channel.type,
        branchId: channel.branchId || undefined,
        warehouseId: channel.warehouseId,
        syncInventory: channel.syncInventory,
        syncOrders: channel.syncOrders,
        syncCustomers: channel.syncCustomers,
        status: channel.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      });
      setChannels((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      confirmAction(`${updated.name} is now ${updated.status.toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update channel');
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <LoadingState label="Loading Commerce…" />;
  const [title, description] = titles[view];

  return (
    <div className="commerce-page">
      <header className="commerce-page__header">
        <div>
          <span className="commerce-page__eyebrow">
            <ShoppingBag size={14} /> Commerce & sales channels
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {view === 'sales-channels' && canManage && (
          <button
            className="button"
            onClick={() => {
              setEditing(null);
              setChannelModal(true);
              setError('');
            }}
          >
            <Plus size={16} /> Connect channel
          </button>
        )}
      </header>
      {error && <p className="form-error">{error}</p>}

      {view === 'commerce-dashboard' && summary && (
        <>
          <section className="commerce-stats">
            <CommerceStat
              icon={CircleDollarSign}
              label="Today's sales"
              value={money(summary.todaySales, summary.currency)}
              detail={`${summary.todayOrders} orders`}
            />
            <CommerceStat
              icon={PackageCheck}
              label="Units sold today"
              value={number(summary.todayUnits)}
              detail={`${money(summary.averageOrderValue, summary.currency)} average order`}
            />
            <CommerceStat
              icon={TrendingUp}
              label="Sales this month"
              value={money(summary.monthSales, summary.currency)}
              detail={`${summary.pendingOrders} pending direct orders`}
            />
            <CommerceStat
              icon={Boxes}
              label="Inventory value"
              value={money(summary.inventoryValue, summary.currency)}
              detail={`${summary.products} active products`}
            />
          </section>
          <div className="commerce-dashboard-grid">
            <section className="panel commerce-overview-panel">
              <header>
                <div>
                  <h2>Channel health</h2>
                  <p>Connected routes to market</p>
                </div>
                <Store size={20} />
              </header>
              <div className="commerce-health-row">
                <span>Active channels</span>
                <strong>
                  {summary.activeChannels} / {summary.channelCount}
                </strong>
              </div>
              <div className="commerce-health-row">
                <span>Central catalogue</span>
                <strong>{summary.products} products</strong>
              </div>
              <div className="commerce-health-row">
                <span>Inventory synchronization</span>
                <strong className="commerce-good">
                  <CheckCircle2 size={14} /> Inventory-owned
                </strong>
              </div>
            </section>
            <section className="panel commerce-overview-panel">
              <header>
                <div>
                  <h2>Stock attention</h2>
                  <p>Live from Inventory & operations</p>
                </div>
                <AlertTriangle size={20} />
              </header>
              <div className="commerce-health-row">
                <span>Low stock</span>
                <strong className={summary.lowStock ? 'commerce-warning' : ''}>
                  {summary.lowStock}
                </strong>
              </div>
              <div className="commerce-health-row">
                <span>Out of stock</span>
                <strong className={summary.outOfStock ? 'commerce-danger' : ''}>
                  {summary.outOfStock}
                </strong>
              </div>
              <p className="commerce-note">
                Stock remains controlled by the central Inventory module. Commerce only publishes
                availability.
              </p>
            </section>
          </div>
        </>
      )}

      {view === 'sales-channels' && (
        <section className="commerce-channel-grid">
          {channels.map((channel) => (
            <article className="panel commerce-channel-card" key={channel.id}>
              <header>
                <div className="commerce-channel-icon">
                  <Store size={19} />
                </div>
                <span
                  className={`badge ${channel.status === 'ACTIVE' ? 'badge--success' : 'badge--warning'}`}
                >
                  <i /> {channel.status === 'ACTIVE' ? 'Active' : 'Paused'}
                </span>
              </header>
              <h2>{channel.name}</h2>
              <p>{channelLabel(channel.type)}</p>
              <dl>
                <div>
                  <dt>Inventory source</dt>
                  <dd>
                    {channel.warehouse.code} · {channel.warehouse.name}
                  </dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>
                    {branches.find((branch) => branch.id === channel.branchId)?.name ??
                      'All / not assigned'}
                  </dd>
                </div>
                <div>
                  <dt>Last synchronized</dt>
                  <dd>{dateTime(channel.lastSyncedAt)}</dd>
                </div>
              </dl>
              <div className="commerce-sync-tags">
                <span className={channel.syncInventory ? 'on' : ''}>Inventory</span>
                <span className={channel.syncOrders ? 'on' : ''}>Orders</span>
                <span className={channel.syncCustomers ? 'on' : ''}>Customers</span>
              </div>
              {canManage && (
                <footer>
                  <button
                    className="button button--secondary button--small"
                    disabled={busyId === channel.id || channel.status !== 'ACTIVE'}
                    onClick={() => void sync(channel)}
                  >
                    <RefreshCw size={14} /> Sync now
                  </button>
                  <button
                    className="button button--secondary button--small"
                    onClick={() => {
                      setEditing(channel);
                      setChannelModal(true);
                      setError('');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="button button--secondary button--small"
                    disabled={busyId === channel.id}
                    onClick={() => void toggle(channel)}
                  >
                    {channel.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                  </button>
                </footer>
              )}
            </article>
          ))}
          {!channels.length && (
            <div className="panel commerce-empty">
              <Store size={28} />
              <h2>No sales channels connected</h2>
              <p>
                Connect POS, a store, B2B sales, a marketplace, or a custom API to start
                orchestrating Commerce.
              </p>
              {canManage && (
                <button className="button" onClick={() => setChannelModal(true)}>
                  Connect first channel
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {view === 'channel-orders' && <CommerceOrders orders={orders} />}
      {view === 'product-channel-mapping' && (
        <CommerceCatalog catalog={catalog} channels={channels} currency={summary?.currency} />
      )}
      {view === 'commerce-analytics' && (
        <CommerceAnalytics rows={sourceTotals} currency={summary?.currency} />
      )}
      {view === 'fulfillment' && (
        <CommerceComingSoon
          icon={PackageCheck}
          title="Fulfillment starts with channel orders"
          text="Connected orders will move through approval, reservation, picking, packing, dispatch, and delivery without creating a second sales record."
        />
      )}
      {view === 'payouts' && (
        <CommerceComingSoon
          icon={CircleDollarSign}
          title="No marketplace payouts yet"
          text="Payout reconciliation will connect gross sales, fees, refunds, net settlement, and the matching bank deposit."
        />
      )}
      {view === 'commerce-settings' && <CommerceSettings />}

      <Modal
        open={channelModal}
        title={editing ? 'Edit sales channel' : 'Connect sales channel'}
        onClose={() => {
          setChannelModal(false);
          setEditing(null);
        }}
        footer={null}
      >
        <form className="form-grid" onSubmit={(event) => void saveChannel(event)}>
          <label className="full">
            Channel name
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={editing?.name || ''}
              placeholder="e.g. Lagos retail store"
            />
          </label>
          <label className="full">
            Channel type
            <select name="type" required defaultValue={editing?.type || 'POS'}>
              {channelTypes.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Inventory warehouse
            <select name="warehouseId" required defaultValue={editing?.warehouseId || ''}>
              <option value="" disabled>
                Select central stock location
              </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
            <small>Availability is always read from this Inventory warehouse.</small>
          </label>
          <label className="full">
            Branch / location
            <select name="branchId" defaultValue={editing?.branchId || ''}>
              <option value="">Not branch-specific</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="full commerce-sync-options">
            <legend>Synchronize</legend>
            <label>
              <input
                type="checkbox"
                name="syncInventory"
                defaultChecked={editing?.syncInventory ?? true}
              />{' '}
              Inventory availability
            </label>
            <label>
              <input
                type="checkbox"
                name="syncOrders"
                defaultChecked={editing?.syncOrders ?? true}
              />{' '}
              Orders
            </label>
            <label>
              <input
                type="checkbox"
                name="syncCustomers"
                defaultChecked={editing?.syncCustomers ?? true}
              />{' '}
              Customers
            </label>
          </fieldset>
          {error && <p className="form-error full">{error}</p>}
          <div className="form-actions full">
            <button className="button" disabled={busyId === 'save'}>
              {busyId === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Connect channel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CommerceStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="panel commerce-stat">
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function CommerceOrders({ orders }: { orders: CommerceOrder[] }) {
  return (
    <section className="panel commerce-table">
      <header>
        <div>
          <h2>Unified order activity</h2>
          <p>Existing POS sales and direct invoices; no duplicate order database.</p>
        </div>
        <span>{orders.length} recent records</span>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Channel</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={`${order.source}-${order.id}`}>
                <td>
                  <strong>{order.reference}</strong>
                </td>
                <td>{order.source}</td>
                <td>{order.customer}</td>
                <td>{new Date(order.createdAt).toLocaleDateString('en-NG')}</td>
                <td>{money(order.total, order.currency)}</td>
                <td>
                  <span className="badge">{order.status.replaceAll('_', ' ')}</span>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={6} className="pos-empty">
                  No channel orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommerceCatalog({
  catalog,
  channels,
  currency,
}: {
  catalog: CommerceCatalogItem[];
  channels: CommerceChannel[];
  currency?: string;
}) {
  return (
    <section className="panel commerce-table">
      <header>
        <div>
          <h2>Central product catalogue</h2>
          <p>Stock and pricing come directly from Inventory & operations.</p>
        </div>
        <span>
          {channels.filter((channel) => channel.status === 'ACTIVE').length} active channels
        </span>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>Available</th>
              <th>Price</th>
              <th>Published to</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((product) => (
              <tr key={product.id}>
                <td>{product.sku}</td>
                <td>
                  <strong>{product.name}</strong>
                  <small className="commerce-table-subtitle">{product.unit}</small>
                </td>
                <td>{product.category || 'Uncategorised'}</td>
                <td className={Number(product.stockQuantity) <= 0 ? 'commerce-danger' : ''}>
                  {number(product.stockQuantity)}
                </td>
                <td>{money(product.salePrice, currency)}</td>
                <td>{product.channelCount} channels</td>
              </tr>
            ))}
            {!catalog.length && (
              <tr>
                <td colSpan={6} className="pos-empty">
                  Add products in Inventory to publish them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommerceAnalytics({
  rows,
  currency,
}: {
  rows: Array<[string, { orders: number; revenue: number }]>;
  currency?: string;
}) {
  const maximum = Math.max(1, ...rows.map(([, data]) => data.revenue));
  return (
    <section className="panel commerce-analytics">
      <header>
        <h2>Sales by source</h2>
        <p>Revenue represented by the current unified order activity.</p>
      </header>
      {rows.map(([source, data]) => (
        <div className="commerce-analytics-row" key={source}>
          <div>
            <strong>{source}</strong>
            <span>
              {data.orders} orders · {money(data.revenue, currency)}
            </span>
          </div>
          <div className="commerce-analytics-bar">
            <i style={{ width: `${Math.max(4, (data.revenue / maximum) * 100)}%` }} />
          </div>
        </div>
      ))}
      {!rows.length && (
        <p className="pos-empty">Sales analytics will appear when orders are recorded.</p>
      )}
    </section>
  );
}

function CommerceComingSoon({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Store;
  title: string;
  text: string;
}) {
  return (
    <section className="panel commerce-empty commerce-empty--wide">
      <Icon size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      <span>Foundation ready for the next Commerce workflow.</span>
    </section>
  );
}

function CommerceSettings() {
  return (
    <section className="panel commerce-settings">
      <h2>Synchronization principles</h2>
      <div>
        <CheckCircle2 size={18} />
        <span>
          <strong>Inventory remains the stock authority</strong>
          <small>Commerce reads availability; stock changes stay in Inventory & operations.</small>
        </span>
      </div>
      <div>
        <CheckCircle2 size={18} />
        <span>
          <strong>Sales remains the transaction authority</strong>
          <small>Channel orders flow into existing POS and Sales records.</small>
        </span>
      </div>
      <div>
        <CheckCircle2 size={18} />
        <span>
          <strong>Accounting remains the financial authority</strong>
          <small>Revenue, payments, fees, refunds, and payouts post through Accounting.</small>
        </span>
      </div>
    </section>
  );
}

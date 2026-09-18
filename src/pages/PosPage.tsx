import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Download,
  Printer,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { operationsApi, type Product, type Warehouse } from '@/services/operations';
import { posApi, type PosRegister, type PosSale, type PosShift } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';
const money = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(v);
const quantity = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 }).format(Number(value));
const paymentLabel = (method: string) =>
  ({ CASH: 'Cash', CARD: 'POS / Card', TRANSFER: 'Bank transfer', CREDIT: 'Customer credit' })[
    method
  ] ?? method;
type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
type PaymentInput = { method: PaymentMethod; amount: string };
type Line = Product & { quantity: number };
const printReceipt = (sale: PosSale, download = false) => {
  const receipt = window.open('', '_blank', 'width=420,height=720');
  if (!receipt) return;
  const title = download ? `Download ${sale.receiptNumber} as PDF` : `Print ${sale.receiptNumber}`;
  receipt.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:360px;margin:32px auto}h1{font-size:20px;margin:0 0 4px}p{margin:4px 0;color:#667085}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.total{font-size:18px;font-weight:700;border-top:2px solid #172033;margin-top:10px;padding-top:10px}.center{text-align:center}.muted{color:#667085}@media print{body{margin:0 auto}}</style></head><body><div class="center"><h1>Cephas Books</h1><p>Sales receipt</p><p>${sale.receiptNumber} · ${new Date(sale.createdAt).toLocaleString()}</p></div>${sale.items.map((item) => `<div class="row"><span>${item.description} x ${item.quantity}</span><strong>${money(Number(item.lineTotal))}</strong></div>`).join('')}<div class="row total"><span>Total</span><strong>${money(Number(sale.total))}</strong></div><div class="row"><span>Paid</span><strong>${money(Number(sale.paidAmount))}</strong></div><div class="row"><span>Change</span><strong>${money(Number(sale.changeAmount))}</strong></div><p class="center muted">Thank you for your business.</p><script>window.onload=()=>window.print()</script></body></html>`);
  receipt.document.close();
};
export function PosPage({ role, onNavigate }: { role: string; onNavigate: (id: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [registers, setRegisters] = useState<PosRegister[]>([]),
    [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [shift, setShift] = useState<PosShift | null>(null),
    [cart, setCart] = useState<Line[]>([]),
    [registerId, setRegisterId] = useState(''),
    [customerId, setCustomerId] = useState(''),
    [search, setSearch] = useState(''),
    [catalogView, setCatalogView] = useState<'TABLE' | 'CARDS'>('TABLE'),
    [payments, setPayments] = useState<PaymentInput[]>([{ method: 'CASH', amount: '' }]),
    [splitMode, setSplitMode] = useState(false),
    [setup, setSetup] = useState<'REGISTER' | 'SHIFT' | 'CUSTOMER' | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sale, setSale] = useState<PosSale | null>(null),
    [recentSales, setRecentSales] = useState<PosSale[]>([]);
  useEffect(() => {
    void Promise.all([
      operationsApi.products({ status: 'active' }),
      salesApi.customers(),
      posApi.registers(),
      operationsApi.warehouses({ status: 'active' }),
      posApi.currentShift(),
      posApi.sales({ limit: '10' }),
    ])
      .then(([p, c, r, w, s, recent]) => {
        setProducts(p.filter((x) => x.isActive));
        setCustomers(c.data.filter((x) => x.isActive));
        setRegisters(r);
        setWarehouses(w);
        setShift(s);
        setRegisterId(s?.registerId || r[0]?.id || '');
        setRecentSales(recent.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load POS data'));
  }, []);
  useEffect(() => {
    const register = registers.find((item) => item.id === registerId);
    if (!register) return;
    void operationsApi
      .products({ status: 'active', warehouseId: register.warehouseId })
      .then((items) => setProducts(items.filter((item) => item.isActive)))
      .catch((requestError) =>
        setError(
          requestError instanceof Error ? requestError.message : 'Unable to load available stock',
        ),
      );
  }, [registerId, registers]);
  const visible = useMemo(
      () =>
        products.filter((x) => `${x.name} ${x.sku}`.toLowerCase().includes(search.toLowerCase())),
      [products, search],
    ),
    subtotal = cart.reduce((s, x) => s + Number(x.salePrice) * x.quantity, 0),
    tax = cart.reduce(
      (s, x) => s + (Number(x.salePrice) * x.quantity * Number(x.taxRate)) / 100,
      0,
    ),
    total = subtotal + tax,
    paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    change = Math.max(0, paid - total),
    remaining = Math.max(0, total - paid);
  useEffect(() => {
    if (!splitMode)
      setPayments((current) =>
        current.length === 1 ? [{ ...current[0], amount: total > 0 ? String(total) : '' }] : current,
      );
  }, [splitMode, total]);
  const available = (product: Product) =>
    product.type === 'SERVICE' ? Infinity : Number(product.stockQuantity);
  const cartQuantity = (productId: string) =>
    cart.find((item) => item.id === productId)?.quantity ?? 0;
  const canAdd = (product: Product) => cartQuantity(product.id) < available(product);
  const add = (product: Product) => {
    if (!canAdd(product)) {
      setError(
        `${product.name}: only ${quantity(product.stockQuantity)} available in this register's warehouse.`,
      );
      return;
    }
    setError('');
    setCart((current) =>
      current.some((item) => item.id === product.id)
        ? current.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { ...product, quantity: 1 }],
    );
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (setup === 'REGISTER') {
        const r = await posApi.createRegister({
          code: f.get('code'),
          name: f.get('name'),
          warehouseId: f.get('warehouseId'),
        });
        setRegisters((x) => [...x, r]);
        setRegisterId(r.id);
        setSetup('SHIFT');
      } else if (setup === 'SHIFT') {
        const s = await posApi.openShift({
          registerId,
          openingCash: Number(f.get('openingCash') || 0),
        });
        setShift(s);
        setSetup(null);
      } else {
        const c = await salesApi.createCustomer({
          displayName: String(f.get('name')),
          phone: String(f.get('phone') || '') || undefined,
        });
        setCustomers((x) => [c, ...x]);
        setCustomerId(c.id);
        setSetup(null);
      }
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  };
  const complete = async () => {
    if (!registerId) return setError('Set up a register first.');
    if (!shift) return setError('Open a cashier shift first.');
    if (!cart.length) return setError('Add an item to the sale.');
    const settledPayments = payments
      .map((payment) => ({ ...payment, amount: Number(payment.amount || 0) }))
      .filter((payment) => payment.amount > 0);
    if (!settledPayments.length) return setError('Enter a payment amount.');
    if (paid < total) return setError(`Outstanding amount: ${money(remaining)}.`);
    if (change > 0 && !settledPayments.some((payment) => payment.method === 'CASH'))
      return setError('Only cash payments can exceed the amount due.');
    if (settledPayments.some((payment) => payment.method === 'CREDIT') && !customerId)
      return setError('Select a customer before using customer credit.');
    setBusy(true);
    try {
      const s = await posApi.complete({
        registerId,
        customerId: customerId || undefined,
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((x) => ({ productId: x.id, quantity: x.quantity })),
        payments: settledPayments,
      });
      setSale(s);
      setRecentSales((current) => [s, ...current.filter((item) => item.id !== s.id)].slice(0, 10));
      setCart([]);
      setPayments([{ method: 'CASH', amount: '' }]);
      setSplitMode(false);
      setCustomerId('');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Unable to complete sale');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pos-layout">
      <section className="panel pos-catalog">
        <label className="pos-search">
          <Search size={18} />
          <input
            placeholder="Scan barcode or search product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="pos-catalog__toolbar">
          <small>
            {registerId ? 'Stock for selected register' : 'Select a register to see stock'}
          </small>
          <div className="pos-view-toggle" aria-label="Product display">
            <button
              type="button"
              className={catalogView === 'TABLE' ? 'active' : ''}
              onClick={() => setCatalogView('TABLE')}
              aria-label="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={catalogView === 'CARDS' ? 'active' : ''}
              onClick={() => setCatalogView('CARDS')}
              aria-label="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
        {catalogView === 'TABLE' ? (
          <div className="pos-product-table">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Available</th>
                  <th>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>{product.sku}</td>
                    <td>
                      {product.type === 'SERVICE'
                        ? '—'
                        : `${quantity(product.stockQuantity)} ${product.unit}`}
                    </td>
                    <td>{money(Number(product.salePrice))}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => add(product)}
                        disabled={!canAdd(product)}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pos-products">
            {visible.map((product) => (
              <button key={product.id} onClick={() => add(product)} disabled={!canAdd(product)}>
                <strong>{product.name}</strong>
                <small>{product.sku}</small>
                <small>
                  {product.type === 'SERVICE'
                    ? 'Service'
                    : `${quantity(product.stockQuantity)} ${product.unit} available`}
                </small>
                <b>{money(Number(product.salePrice))}</b>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel pos-recent-sales">
        <header>
          <div>
            <h2>Recent sales</h2>
            <small>Latest 10 completed POS transactions</small>
          </div>
          <button type="button" onClick={() => onNavigate('pos-history')}>
            View history
          </button>
        </header>
        <div className="pos-recent-list">
          {recentSales.map((recentSale) => (
            <button type="button" key={recentSale.id} onClick={() => setSale(recentSale)}>
              <span><strong>{recentSale.receiptNumber}</strong><small>{recentSale.customer?.displayName ?? 'Walk-in customer'}</small></span>
              <span><strong>{money(Number(recentSale.total))}</strong><small>{new Date(recentSale.createdAt).toLocaleDateString()}</small></span>
            </button>
          ))}
          {!recentSales.length && <p className="pos-empty">No completed sales yet.</p>}
        </div>
      </section>
      <section className="panel pos-cart">
        <header>
          <h2>
            <ShoppingCart size={18} /> New sale
          </h2>
          <button onClick={() => setCart([])}>Clear</button>
        </header>
        <div className="pos-customer">
          <div>
            <select
              value={registerId}
              onChange={(e) => {
                setRegisterId(e.target.value);
                setShift(null);
                setCart([]);
                setError('');
              }}
            >
              <option value="">Select register</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
            {!registers.length && ['OWNER', 'ADMIN'].includes(role) && (
              <button className="button button--secondary" onClick={() => setSetup('REGISTER')}>
                Set up
              </button>
            )}
          </div>
          {registerId && !shift && (
            <button className="button button--secondary" onClick={() => setSetup('SHIFT')}>
              Open cashier shift
            </button>
          )}
          {shift && <small className="pos-status">Shift open on {shift.register.code}</small>}
          <div>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <button className="button button--secondary" onClick={() => setSetup('CUSTOMER')}>
              <UserPlus size={15} /> New
            </button>
          </div>
        </div>
        {cart.map((x) => (
          <div className="pos-cart-lines" key={x.id}>
            <span>
              {x.name}
              <small>
                {x.type === 'SERVICE'
                  ? 'Service'
                  : `${quantity(x.stockQuantity)} ${x.unit} available`}
              </small>
            </span>
            <div className="pos-qty">
              <button
                onClick={() =>
                  setCart((c) =>
                    c.map((y) =>
                      y.id === x.id ? { ...y, quantity: Math.max(1, y.quantity - 1) } : y,
                    ),
                  )
                }
              >
                <Minus size={13} />
              </button>
              <b>{x.quantity}</b>
              <button
                disabled={x.quantity >= available(x)}
                onClick={() =>
                  setCart((c) =>
                    c.map((y) => (y.id === x.id ? { ...y, quantity: y.quantity + 1 } : y)),
                  )
                }
              >
                <Plus size={13} />
              </button>
            </div>
            <b>{money(Number(x.salePrice) * x.quantity)}</b>
            <button onClick={() => setCart((c) => c.filter((y) => y.id !== x.id))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="pos-summary">
          <span>
            Subtotal <b>{money(subtotal)}</b>
          </span>
          <span>
            Tax <b>{money(tax)}</b>
          </span>
          <strong>
            Total <b>{money(total)}</b>
          </strong>
        </div>
        <div className="pos-payment">
          <div className="pos-payment__heading">
            <strong>Payment</strong>
            <button
              type="button"
              onClick={() => {
                setSplitMode(true);
                setPayments((current) => [
                  ...current.map((payment) => ({ ...payment, amount: '' })),
                  { method: 'CASH', amount: '' },
                ]);
              }}
            >
              + Split payment
            </button>
          </div>
          {payments.map((payment, index) => (
            <div className="pos-payment__row" key={index}>
              <select
                aria-label={`Payment method ${index + 1}`}
                value={payment.method}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, method: event.target.value as PaymentMethod }
                        : item,
                    ),
                  )
                }
              >
                <option value="CASH">Cash</option>
                <option value="CARD">POS / Card</option>
                <option value="TRANSFER">Bank transfer</option>
                <option value="CREDIT">Customer credit</option>
              </select>
              <input
                aria-label={`${paymentLabel(payment.method)} amount`}
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={payment.amount}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, amount: event.target.value } : item,
                    ),
                  )
                }
              />
              {payments.length > 1 && (
                <button
                  className="pos-payment__remove"
                  type="button"
                  aria-label={`Remove payment ${index + 1}`}
                  onClick={() =>
                    setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="pos-payment__totals">
            <span>
              Paid <b>{money(paid)}</b>
            </span>
            {remaining > 0 ? (
              <span>
                Outstanding <b>{money(remaining)}</b>
              </span>
            ) : (
              <span>
                Change <b>{money(change)}</b>
              </span>
            )}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="button pos-pay" onClick={() => void complete()} disabled={busy}>
          Pay {money(total)}
        </button>
        {sale && (
          <Modal open={true} onClose={() => setSale(null)} title="Sale completed" footer={null}>
            <div className="receipt-card">
              <div className="receipt-card__heading"><strong>Cephas Books</strong><small>{sale.receiptNumber}</small><small>{new Date(sale.createdAt).toLocaleString()}</small></div>
              {sale.items.map((item) => <div className="receipt-card__row" key={`${item.description}-${item.quantity}`}><span>{item.description}<small>{item.quantity} item(s)</small></span><strong>{money(Number(item.lineTotal))}</strong></div>)}
              <div className="receipt-card__total"><span>Total</span><strong>{money(Number(sale.total))}</strong></div>
              <div className="receipt-card__actions"><button className="button button--secondary" onClick={() => printReceipt(sale)}><Printer size={16} /> Print</button><button className="button" onClick={() => printReceipt(sale, true)}><Download size={16} /> Download PDF</button></div>
            </div>
          </Modal>
        )}
      </section>
      <Modal
        open={!!setup}
        title={
          setup === 'REGISTER'
            ? 'Set up register'
            : setup === 'SHIFT'
              ? 'Open cashier shift'
              : 'Add customer'
        }
        onClose={() => setSetup(null)}
        footer={null}
      >
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          {setup === 'REGISTER' ? (
            <>
              <label>
                Register code
                <input name="code" required />
              </label>
              <label>
                Name
                <input name="name" required />
              </label>
              <label className="full">
                Warehouse
                <select name="warehouseId" required>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : setup === 'SHIFT' ? (
            <label className="full">
              Opening cash
              <input name="openingCash" type="number" min="0" defaultValue="0" required />
            </label>
          ) : (
            <>
              <label className="full">
                Customer name
                <input name="name" required />
              </label>
              <label className="full">
                Phone
                <input name="phone" />
              </label>
            </>
          )}
          <div className="form-actions full">
            <button className="button" disabled={busy}>
              {busy ? 'Saving…' : setup === 'SHIFT' ? 'Open shift' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

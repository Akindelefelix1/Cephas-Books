import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingCart,
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
export function PosPage({ role }: { role: string }) {
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
    [setup, setSetup] = useState<'REGISTER' | 'SHIFT' | 'CUSTOMER' | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sale, setSale] = useState<PosSale | null>(null);
  useEffect(() => {
    void Promise.all([
      operationsApi.products({ status: 'active' }),
      salesApi.customers(),
      posApi.registers(),
      operationsApi.warehouses({ status: 'active' }),
      posApi.currentShift(),
    ])
      .then(([p, c, r, w, s]) => {
        setProducts(p.filter((x) => x.isActive));
        setCustomers(c.data.filter((x) => x.isActive));
        setRegisters(r);
        setWarehouses(w);
        setShift(s);
        setRegisterId(s?.registerId || r[0]?.id || '');
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
      setCart([]);
      setPayments([{ method: 'CASH', amount: '' }]);
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
              onClick={() => setPayments((current) => [...current, { method: 'CASH', amount: '' }])}
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
          <div className="pos-receipt">
            <strong>Sale completed: {sale.receiptNumber}</strong>
            {sale.payments.map((payment) => (
              <small key={`${payment.method}-${payment.reference ?? 'cash'}`}>
                {paymentLabel(payment.method)}{' '}
                {payment.reference && `reference: ${payment.reference}`}
              </small>
            ))}
          </div>
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

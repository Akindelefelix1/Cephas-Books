import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Minus, Plus, Search, ShoppingCart, Trash2, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { operationsApi, type Product, type Warehouse } from '@/services/operations';
import { posApi, type PosRegister, type PosSale, type PosShift } from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';
const money = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(v);
const paymentLabel = (method: string) =>
  ({ CASH: 'Cash', CARD: 'POS / Card', TRANSFER: 'Bank transfer', CREDIT: 'Customer credit' })[
    method
  ] ?? method;
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
    [method, setMethod] = useState('CASH'),
    [received, setReceived] = useState(''),
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
    paid = Number(received || 0);
  const add = (p: Product) =>
    setCart((x) =>
      x.some((y) => y.id === p.id)
        ? x.map((y) => (y.id === p.id ? { ...y, quantity: y.quantity + 1 } : y))
        : [...x, { ...p, quantity: 1 }],
    );
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
    if (method === 'CASH' && paid < total)
      return setError('Amount received is less than total due.');
    setBusy(true);
    try {
      const s = await posApi.complete({
        registerId,
        customerId: customerId || undefined,
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((x) => ({ productId: x.id, quantity: x.quantity })),
        payments: [{ method, amount: method === 'CASH' ? paid : total }],
      });
      setSale(s);
      setCart([]);
      setReceived('');
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
        <div className="pos-products">
          {visible.map((p) => (
            <button key={p.id} onClick={() => add(p)}>
              <strong>{p.name}</strong>
              <small>{p.sku}</small>
              <b>{money(Number(p.salePrice))}</b>
            </button>
          ))}
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
            <span>{x.name}</span>
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
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CARD">POS / Card</option>
            <option value="TRANSFER">Bank transfer</option>
            <option value="CREDIT">Customer credit</option>
          </select>
          {method === 'CASH' && (
            <input
              type="number"
              placeholder="Amount received"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />
          )}
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
              {paymentLabel(payment.method)} {payment.reference && `reference: ${payment.reference}`}
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

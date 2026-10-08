import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  ReceiptText,
  Trash2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Power,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/LoadingState';
import { SalesReceipt } from '@/components/ui/SalesReceipt';
import {
  INVENTORY_CHANGED_EVENT,
  operationsApi,
  type Product,
  type Warehouse,
} from '@/services/operations';
import {
  posApi,
  type PosBranch,
  type PosRegister,
  type PosSale,
  type PosShiftCloseResult,
  type PosShift,
} from '@/services/pos';
import { salesApi, type Customer } from '@/services/sales';
import { organizationApi, type OrganizationMember } from '@/services/organization';
import { bankingApi, type BankAccount } from '@/services/banking';
import { getDefaultCurrency } from '@/utils/currency';
import { confirmAction } from '@/utils/actions';
const money = (v: number, currency = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(v);
const quantity = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 }).format(Number(value));
const productUnit = (unit?: string) =>
  unit && /[A-Za-z]/.test(unit.trim()) ? unit.trim() : 'units';
const paymentLabel = (method: string) =>
  ({ CASH: 'Cash', CARD: 'POS / Card', TRANSFER: 'Bank transfer', CREDIT: 'Customer credit' })[
    method
  ] ?? method;
type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
type PaymentInput = { method: PaymentMethod; amount: string };
type Line = Product & { quantity: number; discount: number };
const CATALOG_PAGE_SIZE = 15;
export function PosPage({
  canConfigurePos,
  onNavigate,
  salesperson,
}: {
  canConfigurePos: boolean;
  onNavigate: (id: string) => void;
  salesperson: string;
}) {
  const [products, setProducts] = useState<Product[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [registers, setRegisters] = useState<PosRegister[]>([]),
    [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [branches, setBranches] = useState<PosBranch[]>([]),
    [staff, setStaff] = useState<OrganizationMember[]>([]),
    [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]),
    [shift, setShift] = useState<PosShift | null>(null),
    [cart, setCart] = useState<Line[]>([]),
    [branchId, setBranchId] = useState(''),
    [registerId, setRegisterId] = useState(''),
    [customerId, setCustomerId] = useState(''),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [catalogPage, setCatalogPage] = useState(1),
    [registerManagementExpanded, setRegisterManagementExpanded] = useState(true),
    [catalogView, setCatalogView] = useState<'TABLE' | 'CARDS'>(() =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
        ? 'CARDS'
        : 'TABLE',
    ),
    [pressedProductId, setPressedProductId] = useState<string | null>(null),
    [payments, setPayments] = useState<PaymentInput[]>([{ method: 'CASH', amount: '' }]),
    [splitMode, setSplitMode] = useState(false),
    [setup, setSetup] = useState<
      'REGISTER' | 'EDIT' | 'ASSIGN' | 'HANDOVER' | 'SHIFT' | 'CLOSE_SHIFT' | 'CUSTOMER' | null
    >(null),
    [editingRegister, setEditingRegister] = useState<PosRegister | null>(null),
    [shiftCloseResult, setShiftCloseResult] = useState<PosShiftCloseResult | null>(null),
    [error, setError] = useState(''),
    [productsLoading, setProductsLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [sale, setSale] = useState<PosSale | null>(null),
    [recentSales, setRecentSales] = useState<PosSale[]>([]);
  useEffect(() => {
    void Promise.all([
      salesApi.customers(),
      posApi.registers(),
      canConfigurePos ? operationsApi.warehouses({ status: 'active' }) : Promise.resolve([]),
      posApi.currentShift(),
      posApi.sales({ limit: '10' }),
      canConfigurePos ? organizationApi.users() : Promise.resolve([]),
      posApi.branches(),
      canConfigurePos ? bankingApi.accounts() : Promise.resolve([]),
    ])
      .then(([c, r, w, s, recent, members, accessibleBranches, accounts]) => {
        setCustomers(c.data.filter((x) => x.isActive));
        setRegisters(r);
        setWarehouses(w);
        setShift(s);
        const shiftRegister = s ? r.find((register) => register.id === s.registerId) : undefined;
        const initialBranchId =
          shiftRegister?.branchId ||
          (accessibleBranches.length === 1 ? accessibleBranches[0].id : '');
        const branchRegisters = initialBranchId
          ? r.filter((register) => register.branchId === initialBranchId && register.isActive)
          : [];
        setBranchId(initialBranchId);
        setRegisterId(
          s?.registerId ||
            (!canConfigurePos || branchRegisters.length === 1 ? branchRegisters[0]?.id || '' : ''),
        );
        setRecentSales(recent.data);
        setStaff(members.filter((member) => member.user.isActive));
        setBranches(accessibleBranches);
        setBankAccounts(accounts);
        if (!r.length) setProductsLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Unable to load POS data');
        setProductsLoading(false);
      });
  }, [canConfigurePos]);
  useEffect(() => {
    const register = registers.find((item) => item.id === registerId);
    if (!register) return;
    let current = true;
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const items = await operationsApi.posProducts(register.warehouseId);
        if (current) setProducts(items);
      } catch (requestError) {
        if (current)
          setError(
            requestError instanceof Error ? requestError.message : 'Unable to load available stock',
          );
      } finally {
        if (current) setProductsLoading(false);
      }
    };
    void loadProducts();
    return () => {
      current = false;
    };
  }, [registerId, registers]);
  const selectedRegister = registers.find((register) => register.id === registerId),
    isProductsLoading = productsLoading && Boolean(selectedRegister),
    availableRegisters = useMemo(
      () => registers.filter((register) => register.branchId === branchId && register.isActive),
      [branchId, registers],
    ),
    visible = useMemo(
      () =>
        selectedRegister
          ? products.filter(
              (x) =>
                `${x.name} ${x.sku}`.toLowerCase().includes(search.toLowerCase()) &&
                (!category || (x.category || 'Uncategorised') === category),
            )
          : [],
      [category, products, search, selectedRegister],
    ),
    categories = useMemo(
      () =>
        [...new Set(products.map((product) => product.category || 'Uncategorised'))].sort((a, b) =>
          a.localeCompare(b),
        ),
      [products],
    ),
    catalogPages = Math.max(1, Math.ceil(visible.length / CATALOG_PAGE_SIZE)),
    pagedProducts = visible.slice(
      (catalogPage - 1) * CATALOG_PAGE_SIZE,
      catalogPage * CATALOG_PAGE_SIZE,
    ),
    subtotal = cart.reduce((s, x) => s + Number(x.salePrice) * x.quantity, 0),
    discountTotal = cart.reduce((s, x) => s + x.discount * x.quantity, 0),
    tax = cart.reduce(
      (s, x) => s + ((Number(x.salePrice) - x.discount) * x.quantity * Number(x.taxRate)) / 100,
      0,
    ),
    total = subtotal - discountTotal + tax,
    paymentRows =
      !splitMode && payments.length === 1
        ? [{ ...payments[0], amount: total > 0 ? String(total) : '' }]
        : payments,
    paid = paymentRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    change = Math.max(0, paid - total),
    remaining = Math.max(0, total - paid);
  const available = (product: Product) =>
    product.type === 'SERVICE' ? Infinity : Number(product.stockQuantity);
  const cartQuantity = (productId: string) =>
    cart.find((item) => item.id === productId)?.quantity ?? 0;
  const saleStep = (product: Product) => (product.allowFractionalSale ? 0.5 : 1);
  const canAdd = (product: Product) =>
    cartQuantity(product.id) + saleStep(product) <= available(product);
  const updateCartQuantity = (product: Line, nextQuantity: number) => {
    const step = saleStep(product);
    const increments = nextQuantity / step;
    const maximum = available(product);
    if (
      !Number.isFinite(nextQuantity) ||
      Math.abs(increments - Math.round(increments)) > 1e-9 ||
      nextQuantity < step ||
      nextQuantity > maximum
    )
      return false;
    setError('');
    setCart((current) =>
      current.map((item) => (item.id === product.id ? { ...item, quantity: nextQuantity } : item)),
    );
    return true;
  };
  const add = (product: Product) => {
    if (!canAdd(product)) {
      setError(
        `${product.name}: only ${quantity(product.stockQuantity)} available in this register's warehouse.`,
      );
      return;
    }
    setError('');
    setPressedProductId(product.id);
    window.setTimeout(
      () => setPressedProductId((current) => (current === product.id ? null : current)),
      180,
    );
    setCart((current) =>
      current.some((item) => item.id === product.id)
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + saleStep(product) }
              : item,
          )
        : [...current, { ...product, quantity: saleStep(product), discount: 0 }],
    );
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (setup === 'REGISTER' || setup === 'EDIT') {
        const registerData = {
          code: String(f.get('code') || ''),
          name: String(f.get('name') || ''),
          warehouseId: String(f.get('warehouseId') || ''),
          assignedStaffId: String(f.get('assignedStaffId') || ''),
          branchId: String(f.get('branchId') || ''),
          terminalId: String(f.get('terminalId') || '') || null,
          defaultCashAccountId: String(f.get('defaultCashAccountId') || '') || null,
          defaultCardAccountId: String(f.get('defaultCardAccountId') || '') || null,
          defaultBankAccountId: String(f.get('defaultBankAccountId') || '') || null,
        };
        const saved =
          setup === 'REGISTER'
            ? await posApi.createRegister(registerData)
            : editingRegister
              ? await posApi.updateRegister(editingRegister.id, registerData)
              : null;
        if (!saved) throw new Error('Select a register to edit');
        setRegisters((current) =>
          setup === 'REGISTER'
            ? [...current, saved]
            : current.map((register) => (register.id === saved.id ? saved : register)),
        );
        if (setup === 'REGISTER') {
          setBranchId(saved.branchId || '');
          setRegisterId(saved.id);
        } else if (registerId === saved.id && !saved.isActive) {
          setRegisterId('');
          setShift(null);
          setCart([]);
          setProducts([]);
        }
        setEditingRegister(null);
        setSetup(null);
      } else if (setup === 'ASSIGN') {
        const updated = await posApi.assignRegisterStaff(
          registerId,
          String(f.get('assignedStaffId')),
          String(f.get('branchId')),
        );
        setRegisters((current) =>
          current.map((register) => (register.id === updated.id ? updated : register)),
        );
        setBranchId(updated.branchId || '');
        setSetup(null);
      } else if (setup === 'HANDOVER' && editingRegister) {
        const updated = await posApi.handoverRegister(editingRegister.id, {
          assignedStaffId: String(f.get('assignedStaffId')),
          branchId: String(f.get('branchId')),
          closingCash: Number(f.get('closingCash') || 0),
          notes: String(f.get('notes') || '').trim() || undefined,
        });
        setRegisters((current) =>
          current.map((register) => (register.id === updated.id ? updated : register)),
        );
        if (shift?.registerId === updated.id) setShift(null);
        const nextCashierName = updated.assignedStaff
          ? [updated.assignedStaff.firstName, updated.assignedStaff.lastName]
              .filter(Boolean)
              .join(' ') || updated.assignedStaff.email
          : 'the selected cashier';
        confirmAction(`Register ${updated.code} was switched to ${nextCashierName}.`);
        setEditingRegister(null);
        setSetup(null);
      } else if (setup === 'SHIFT') {
        const s = await posApi.openShift({
          registerId,
          openingCash: Number(f.get('openingCash') || 0),
        });
        setShift(s);
        setShiftCloseResult(null);
        setSetup(null);
      } else if (setup === 'CLOSE_SHIFT' && shift) {
        const result = await posApi.closeShift(shift.id, {
          closingCash: Number(f.get('closingCash') || 0),
          notes: String(f.get('notes') || '').trim() || undefined,
        });
        setShiftCloseResult(result);
        setShift(null);
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
    if (!cart.length) return setError('Add an item to the sale.');
    const settledPayments = paymentRows
      .map((payment) => ({ ...payment, amount: Number(payment.amount || 0) }))
      .filter((payment) => payment.amount > 0);
    if (!settledPayments.length) return setError('Enter a payment amount.');
    if (paid < total) return setError(`Outstanding amount: ${money(remaining)}.`);
    if (change > 0 && !settledPayments.some((payment) => payment.method === 'CASH'))
      return setError('Only cash payments can exceed the amount due.');
    if (settledPayments.some((payment) => payment.method === 'CREDIT') && !customerId)
      return setError('Select a customer before using customer credit.');
    const soldQuantities = new Map(
      cart.filter((item) => item.type === 'PRODUCT').map((item) => [item.id, item.quantity]),
    );
    setBusy(true);
    try {
      const completed = await posApi.complete({
        registerId,
        customerId: customerId || undefined,
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((x) => ({
          productId: x.id,
          quantity: x.quantity,
          discount: x.discount,
        })),
        payments: settledPayments,
      });
      const [s, activeShift] = await Promise.all([
        posApi.receipt(completed.id),
        shift ? Promise.resolve(shift) : posApi.currentShift(),
      ]);
      setShift(activeShift);
      setSale(s);
      setProducts((current) => {
        const updated = current.map((product) => {
          const soldQuantity = soldQuantities.get(product.id);
          return soldQuantity === undefined
            ? product
            : {
                ...product,
                stockQuantity: String(Math.max(0, Number(product.stockQuantity) - soldQuantity)),
              };
        });
        const register = registers.find((item) => item.id === registerId);
        if (register) operationsApi.savePosProducts(register.warehouseId, updated);
        return updated;
      });
      window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT));
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
  const toggleRegisterStatus = async (register: PosRegister) => {
    setBusy(true);
    setError('');
    try {
      const updated = await posApi.updateRegister(register.id, { isActive: !register.isActive });
      setRegisters((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (!updated.isActive && registerId === updated.id) {
        setRegisterId('');
        setShift(null);
        setCart([]);
        setProducts([]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update register status',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pos-page">
      {canConfigurePos && (
        <section className="panel pos-register-management">
          <header>
            <div>
              <h2>Register management</h2>
              <small>Configure devices, payment accounts, assignments, and availability.</small>
            </div>
            <div className="pos-register-management__header-actions">
              {registerManagementExpanded && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditingRegister(null);
                    setSetup('REGISTER');
                  }}
                >
                  <Plus size={15} /> Set up register
                </button>
              )}
              <button
                type="button"
                className="button button--secondary pos-register-management__toggle"
                aria-expanded={registerManagementExpanded}
                aria-controls="pos-register-management-content"
                onClick={() => setRegisterManagementExpanded((expanded) => !expanded)}
              >
                <ChevronDown
                  size={16}
                  className={registerManagementExpanded ? 'is-expanded' : ''}
                />
                {registerManagementExpanded ? 'Hide' : 'Show'}
              </button>
            </div>
          </header>
          {registerManagementExpanded && (
            <div id="pos-register-management-content">
              {registers.length ? (
                <div className="pos-register-grid">
                  {registers.map((register) => {
                    const cashier = register.shifts?.[0]?.cashier;
                    const displayName = (person?: {
                      firstName?: string;
                      lastName?: string;
                      email?: string;
                    }) =>
                      person
                        ? [person.firstName, person.lastName].filter(Boolean).join(' ') ||
                          person.email ||
                          'Unknown'
                        : 'Not assigned';
                    return (
                      <article className="pos-register-card" key={register.id}>
                        <div className="pos-register-card__heading">
                          <div>
                            <strong>
                              {register.code} · {register.name}
                            </strong>
                            <small>
                              {branches.find((branch) => branch.id === register.branchId)?.name ||
                                'Branch unavailable'}
                              {' · '}
                              {register.warehouse?.name ||
                                warehouses.find(
                                  (warehouse) => warehouse.id === register.warehouseId,
                                )?.name ||
                                'Warehouse unavailable'}
                            </small>
                          </div>
                          <span
                            className={`badge ${register.isActive ? 'badge--success' : 'badge--danger'}`}
                          >
                            <i /> {register.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="pos-register-card__details">
                          <span>
                            <small>Primary staff</small>
                            {displayName(register.assignedStaff || undefined)}
                          </span>
                          <span>
                            <small>Terminal / device</small>
                            {register.terminalId || 'Not assigned'}
                          </span>
                          <span>
                            <small>{cashier ? 'Active cashier' : 'Current cashier'}</small>
                            {cashier ? (
                              <strong className="pos-current-cashier">
                                <i aria-hidden="true" /> {displayName(cashier)}
                              </strong>
                            ) : (
                              'No open shift'
                            )}
                          </span>
                          <span>
                            <small>Cash account</small>
                            {bankAccounts.find(
                              (account) => account.id === register.defaultCashAccountId,
                            )?.name || 'Not set'}
                          </span>
                          <span>
                            <small>Card account</small>
                            {bankAccounts.find(
                              (account) => account.id === register.defaultCardAccountId,
                            )?.name || 'Not set'}
                          </span>
                          <span>
                            <small>Bank / transfer account</small>
                            {bankAccounts.find(
                              (account) => account.id === register.defaultBankAccountId,
                            )?.name || 'Not set'}
                          </span>
                        </div>
                        <div className="pos-register-card__actions">
                          <button
                            type="button"
                            className="button button--secondary button--small"
                            onClick={() => {
                              setError('');
                              setEditingRegister(register);
                              setSetup('HANDOVER');
                            }}
                          >
                            <ArrowRightLeft size={14} /> Switch cashier
                          </button>
                          <button
                            type="button"
                            className="button button--secondary button--small"
                            onClick={() => {
                              setEditingRegister(register);
                              setSetup('EDIT');
                            }}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="button button--secondary button--small"
                            disabled={busy}
                            onClick={() => void toggleRegisterStatus(register)}
                          >
                            <Power size={14} /> {register.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="pos-register-empty">No registers yet. Set one up to get started.</p>
              )}
            </div>
          )}
        </section>
      )}
      {error && canConfigurePos && <p className="form-error">{error}</p>}
      <div className="pos-layout">
        <section className="panel pos-catalog" aria-busy={isProductsLoading}>
          <label className="pos-search">
            <Search size={18} />
            <input
              placeholder="Scan barcode or search product"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCatalogPage(1);
              }}
            />
          </label>
          <div className="pos-catalog__toolbar">
            <div className="pos-catalog__filters">
              <select
                aria-label="Product category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setCatalogPage(1);
                }}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
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
                  {isProductsLoading ? (
                    <tr>
                      <td colSpan={5}>
                        <LoadingState compact label="Loading available products…" />
                      </td>
                    </tr>
                  ) : (
                    pagedProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                        </td>
                        <td>{product.sku}</td>
                        <td>
                          {product.type === 'SERVICE' ? '—' : quantity(product.stockQuantity)}
                        </td>
                        <td>{money(Number(product.salePrice))}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => add(product)}
                            disabled={!canAdd(product)}
                            aria-pressed={pressedProductId === product.id}
                            className={pressedProductId === product.id ? 'is-pressed' : ''}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="pos-products">
              {isProductsLoading ? (
                <LoadingState compact label="Loading available products…" />
              ) : (
                pagedProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => add(product)}
                    disabled={!canAdd(product)}
                    aria-pressed={pressedProductId === product.id}
                    className={pressedProductId === product.id ? 'is-pressed' : ''}
                  >
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                    <small>
                      {product.type === 'SERVICE'
                        ? 'Service'
                        : `${quantity(product.stockQuantity)} available`}
                    </small>
                    <b>{money(Number(product.salePrice))}</b>
                  </button>
                ))
              )}
            </div>
          )}
          {!isProductsLoading && !visible.length && (
            <p className="pos-empty">
              {registerId
                ? 'No available products were found for this register warehouse.'
                : 'Select a register to load its available products.'}
            </p>
          )}
          {!isProductsLoading && visible.length > 0 && (
            <div className="table-pagination pos-catalog__pagination">
              <p>
                Showing{' '}
                <strong>
                  {(catalogPage - 1) * CATALOG_PAGE_SIZE + 1}–
                  {Math.min(catalogPage * CATALOG_PAGE_SIZE, visible.length)}
                </strong>{' '}
                of {visible.length}
              </p>
              <div>
                <button
                  type="button"
                  aria-label="Previous product page"
                  disabled={catalogPage === 1}
                  onClick={() => setCatalogPage((page) => page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {catalogPage} of {catalogPages}
                </span>
                <button
                  type="button"
                  aria-label="Next product page"
                  disabled={catalogPage >= catalogPages}
                  onClick={() => setCatalogPage((page) => page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
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
          <div className="pos-recent-table">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="is-right">Total</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {recentSales.map((recentSale) => (
                  <tr key={recentSale.id}>
                    <td>
                      <strong>{recentSale.receiptNumber}</strong>
                    </td>
                    <td>{new Date(recentSale.createdAt).toLocaleDateString()}</td>
                    <td>{recentSale.customer?.displayName ?? 'Walk-in customer'}</td>
                    <td className="is-right">
                      <strong>{money(Number(recentSale.total))}</strong>
                    </td>
                    <td className="is-right">
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        onClick={() => setSale(recentSale)}
                      >
                        <ReceiptText size={15} /> View receipt
                      </button>
                    </td>
                  </tr>
                ))}
                {!recentSales.length && (
                  <tr>
                    <td className="pos-empty" colSpan={5}>
                      No completed sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                aria-label="Branch"
                value={branchId}
                disabled={Boolean(shift)}
                onChange={(event) => {
                  const nextBranchId = event.target.value;
                  const nextRegisters = registers.filter(
                    (register) => register.branchId === nextBranchId && register.isActive,
                  );
                  setBranchId(nextBranchId);
                  setRegisterId(
                    !canConfigurePos || nextRegisters.length === 1
                      ? nextRegisters[0]?.id || ''
                      : '',
                  );
                  setCatalogPage(1);
                  setShift(null);
                  setProducts([]);
                  setCart([]);
                  setError('');
                }}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            {canConfigurePos && (
              <div>
                <select
                  aria-label="Register"
                  value={registerId}
                  disabled={!branchId}
                  onChange={(e) => {
                    setRegisterId(e.target.value);
                    setCatalogPage(1);
                    setShift(null);
                    setCart([]);
                    setError('');
                  }}
                >
                  <option value="">Select register</option>
                  {availableRegisters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                      {r.assignedStaff
                        ? ` · ${[r.assignedStaff.firstName, r.assignedStaff.lastName].filter(Boolean).join(' ') || r.assignedStaff.email}`
                        : ' · Staff not assigned'}
                    </option>
                  ))}
                </select>
                {!availableRegisters.length && (
                  <button className="button button--secondary" onClick={() => setSetup('REGISTER')}>
                    Set up
                  </button>
                )}
              </div>
            )}
            {!canConfigurePos && branchId && !availableRegisters.length && (
              <small className="pos-helper">No POS register is configured for this branch.</small>
            )}
            {registerId && !shift && (
              <>
                {canConfigurePos && (
                  <button className="button button--secondary" onClick={() => setSetup('ASSIGN')}>
                    Assign staff
                  </button>
                )}
                <button className="button button--secondary" onClick={() => setSetup('SHIFT')}>
                  Open shift (optional)
                </button>
                <small className="pos-helper">
                  Otherwise, a zero-cash shift opens automatically with the first sale.
                </small>
              </>
            )}
            {shift && (
              <div className="pos-shift-status">
                <small className="pos-status">Shift open on {shift.register.code}</small>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setSetup('CLOSE_SHIFT')}
                >
                  Close shift
                </button>
              </div>
            )}
            {shiftCloseResult && (
              <div className="pos-shift-summary" role="status">
                <strong>Shift closed</strong>
                <span>Expected cash: {money(Number(shiftCloseResult.expectedCash))}</span>
                <span>Counted cash: {money(Number(shiftCloseResult.closingCash))}</span>
                <span>Variance: {money(Number(shiftCloseResult.variance))}</span>
              </div>
            )}
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
                    : `${quantity(x.stockQuantity)} ${productUnit(x.unit)} available`}
                </small>
              </span>
              <div className="pos-qty">
                <button
                  disabled={x.quantity <= saleStep(x)}
                  onClick={() => updateCartQuantity(x, x.quantity - saleStep(x))}
                  aria-label={`Reduce ${x.name} quantity by ${saleStep(x)}`}
                >
                  <Minus size={13} />
                </button>
                <input
                  key={`${x.id}-${x.quantity}`}
                  aria-label={`${x.name} quantity`}
                  type="number"
                  min={saleStep(x)}
                  max={Number.isFinite(available(x)) ? available(x) : undefined}
                  step={saleStep(x)}
                  defaultValue={x.quantity}
                  onBlur={(event) => {
                    if (!updateCartQuantity(x, Number(event.currentTarget.value))) {
                      setError(
                        x.allowFractionalSale
                          ? `${x.name} must be sold in half-unit increments.`
                          : `${x.name} must be sold in whole units.`,
                      );
                      event.currentTarget.value = String(x.quantity);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                <button
                  disabled={x.quantity + saleStep(x) > available(x)}
                  onClick={() => updateCartQuantity(x, x.quantity + saleStep(x))}
                  aria-label={`Increase ${x.name} quantity by ${saleStep(x)}`}
                >
                  <Plus size={13} />
                </button>
              </div>
              <label className="pos-line-discount">
                <span>Discount / unit</span>
                <input
                  aria-label={`${x.name} discount per unit`}
                  type="number"
                  min="0"
                  max={Number(x.salePrice)}
                  step=".01"
                  value={x.discount}
                  onChange={(event) => {
                    const next = Math.max(
                      0,
                      Math.min(Number(x.salePrice), Number(event.target.value || 0)),
                    );
                    setCart((current) =>
                      current.map((item) =>
                        item.id === x.id ? { ...item, discount: next } : item,
                      ),
                    );
                  }}
                />
              </label>
              <b>
                {money((Number(x.salePrice) - x.discount) * x.quantity)}
                {x.discount > 0 && <small>Saved {money(x.discount * x.quantity)}</small>}
              </b>
              <button onClick={() => setCart((c) => c.filter((y) => y.id !== x.id))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="pos-summary">
            <span>
              Subtotal <b>{money(subtotal)}</b>
            </span>
            {discountTotal > 0 && (
              <span>
                Discount <b>−{money(discountTotal)}</b>
              </span>
            )}
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
            {paymentRows.map((payment, index) => (
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
                      setPayments((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
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
            <Modal
              open={true}
              onClose={() => setSale(null)}
              title="Sale completed"
              footer={null}
              wide
            >
              <SalesReceipt
                key={sale.id}
                sale={sale}
                salesperson={salesperson}
                onSaleChange={(updatedSale) => {
                  setSale(updatedSale);
                  setRecentSales((current) =>
                    current.map((recent) => (recent.id === updatedSale.id ? updatedSale : recent)),
                  );
                }}
              />
            </Modal>
          )}
        </section>
      </div>
      <Modal
        open={!!setup}
        title={
          setup === 'REGISTER'
            ? 'Set up register'
            : setup === 'EDIT'
              ? 'Edit register'
              : setup === 'ASSIGN'
                ? 'Assign register staff'
                : setup === 'HANDOVER'
                  ? 'Switch cashier'
                  : setup === 'SHIFT'
                    ? 'Open cashier shift'
                    : setup === 'CLOSE_SHIFT'
                      ? 'Close cashier shift'
                      : 'Add customer'
        }
        onClose={() => {
          setSetup(null);
          setEditingRegister(null);
        }}
        footer={null}
      >
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          {setup === 'REGISTER' || setup === 'EDIT' ? (
            <>
              <label>
                Register code
                <input name="code" required defaultValue={editingRegister?.code || ''} />
              </label>
              <label>
                Name
                <input name="name" required defaultValue={editingRegister?.name || ''} />
              </label>
              <label className="full">
                Assigned staff
                <select
                  name="assignedStaffId"
                  required
                  defaultValue={editingRegister?.assignedStaffId || ''}
                >
                  <option value="" disabled>
                    Select existing staff
                  </option>
                  {staff.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {[member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                        member.user.email}{' '}
                      — {member.role}
                    </option>
                  ))}
                </select>
                {!staff.length && <small>No active staff accounts are available.</small>}
              </label>
              <label className="full">
                Branch
                <select name="branchId" required defaultValue={editingRegister?.branchId || ''}>
                  <option value="" disabled>
                    Select branch
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Warehouse
                <select
                  name="warehouseId"
                  required
                  defaultValue={
                    editingRegister?.warehouseId ||
                    warehouses.find((warehouse) => warehouse.isDefault)?.id ||
                    ''
                  }
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Terminal / device ID
                <input
                  name="terminalId"
                  maxLength={128}
                  placeholder="Serial number or device label"
                  defaultValue={editingRegister?.terminalId || ''}
                />
              </label>
              <label className="full">
                Default cash account
                <select
                  name="defaultCashAccountId"
                  defaultValue={editingRegister?.defaultCashAccountId || ''}
                >
                  <option value="">No default</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.accountType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Default card account
                <select
                  name="defaultCardAccountId"
                  defaultValue={editingRegister?.defaultCardAccountId || ''}
                >
                  <option value="">No default</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.accountType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Default bank / transfer account
                <select
                  name="defaultBankAccountId"
                  defaultValue={editingRegister?.defaultBankAccountId || ''}
                >
                  <option value="">No default</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.accountType}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : setup === 'ASSIGN' ? (
            <>
              <label className="full">
                Primary staff
                <select name="assignedStaffId" required defaultValue="">
                  <option value="" disabled>
                    Select existing staff
                  </option>
                  {staff.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {[member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                        member.user.email}{' '}
                      — {member.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Branch
                <select name="branchId" required defaultValue="">
                  <option value="" disabled>
                    Select branch
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : setup === 'HANDOVER' ? (
            <>
              <p className="full pos-helper">
                {editingRegister?.shifts?.[0]
                  ? 'This closes the current cashier shift, records the cash variance, and assigns the register to the selected staff member.'
                  : 'This register has no open shift. The selected staff member will become its primary cashier.'}
              </p>
              <label className="full">
                New cashier
                <select
                  name="assignedStaffId"
                  required
                  defaultValue={editingRegister?.assignedStaffId || ''}
                >
                  <option value="" disabled>
                    Select existing staff
                  </option>
                  {staff.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {[member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                        member.user.email}{' '}
                      — {member.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Branch
                <select name="branchId" required defaultValue={editingRegister?.branchId || ''}>
                  <option value="" disabled>
                    Select branch
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              {editingRegister?.shifts?.[0] && (
                <>
                  <label className="full">
                    Counted closing cash
                    <input
                      name="closingCash"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label className="full">
                    Handover notes
                    <textarea name="notes" maxLength={1000} />
                  </label>
                </>
              )}
            </>
          ) : setup === 'SHIFT' ? (
            <label className="full">
              Opening cash
              <input name="openingCash" type="number" min="0" defaultValue="0" required />
            </label>
          ) : setup === 'CLOSE_SHIFT' ? (
            <>
              <label className="full">
                Counted closing cash
                <input name="closingCash" type="number" min="0" step="0.01" required />
              </label>
              <label className="full">
                Notes
                <textarea name="notes" maxLength={1000} />
              </label>
            </>
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
          {error && <p className="form-error full">{error}</p>}
          <div className="form-actions full">
            <button className="button" disabled={busy}>
              {busy
                ? 'Saving…'
                : setup === 'SHIFT'
                  ? 'Open shift'
                  : setup === 'CLOSE_SHIFT'
                    ? 'Close shift'
                    : setup === 'HANDOVER'
                      ? 'Switch cashier'
                      : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

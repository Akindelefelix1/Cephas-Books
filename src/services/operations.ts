import { authorizedRequest, getAuthCacheIdentity } from './auth';
import { getOfflineQueue, isWorkingOffline, replaceOfflineWrite } from './offline';

export type OperationsView =
  'products' | 'warehouses' | 'branch-inventory' | 'stock-movements' | 'stock-adjustments' | 'projects' | 'project-ai';
export interface Product {
  id: string;
  sku: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE';
  category?: string;
  description?: string;
  unit: string;
  salePrice: string;
  costPrice: string;
  taxRate: string;
  taxRateId?: string | null;
  taxRateVersion?: number | null;
  taxRateName?: string;
  reorderLevel: string;
  allowFractionalSale: boolean;
  stockQuantity: string;
  stockValue: string;
  defaultWarehouseId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pendingOffline?: boolean;
  offlineQueueId?: string;
}
export interface ProductDetails extends Product {
  offlineHistoryLimited?: boolean;
  createdBy: { email: string; firstName?: string; lastName?: string } | null;
  activity: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { email: string; firstName?: string; lastName?: string } | null;
  }>;
  salesSummary: {
    unitsSold: string;
    grossSales: string;
    returnedUnits: string;
    returnsValue: string;
    netSales: string;
  };
  movements: Array<Omit<StockMovement, 'product'>>;
  adjustments: Array<Omit<StockAdjustment, 'product'>>;
  sales: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    lineTotal: string;
    sale: {
      id: string;
      receiptNumber: string;
      status: string;
      currency: string;
      createdAt: string;
    };
    cashier: { email: string; firstName?: string; lastName?: string } | null;
  }>;
}
export interface ProductCategory {
  id: string;
  name: string;
}
export interface TaxRate {
  id: string;
  name: string;
  rate: string;
  version: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  manager?: string;
  branchId?: string | null;
  isDefault: boolean;
  isActive: boolean;
}
export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  address?: string;
  manager?: string;
  isActive: boolean;
  warehouse: Warehouse | null;
}
export interface BranchInventory {
  pendingOfflineChanges?: number;
  branches: Array<{
    id: string;
    warehouseId: string;
    code: string;
    name: string;
    address?: string;
    manager?: string;
    isActive: boolean;
    isDefault: boolean;
    inventoryValue: string;
    lowStock: number;
    outOfStock: number;
  }>;
  products: Array<{
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    reorderLevel: string;
    totalQuantity: string;
    locations: Array<{
      branchId: string;
      branchName: string;
      code: string;
      quantity: string;
      status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    }>;
  }>;
}
export interface StockMovement {
  id: string;
  type: string;
  quantity: string;
  unitCost: string;
  movementDate: string;
  reference: string;
  transferGroupId?: string | null;
  notes?: string;
  product: Product;
  warehouse: Warehouse;
  performedBy?: { id: string; email: string; firstName?: string; lastName?: string } | null;
}
export interface StockAdjustment {
  id: string;
  reference: string;
  adjustmentDate: string;
  quantityDelta: string;
  unitCost: string;
  reason: string;
  status: string;
  notes?: string;
  product: Product;
  warehouse: Warehouse;
}
export interface Project {
  id: string;
  code: string;
  name: string;
  client?: string;
  owner: string;
  startDate: string;
  endDate?: string;
  budget: string;
  actualCost: string;
  revenue: string;
  actualRevenue: string;
  costVariance: string;
  costVariancePercent: number;
  costVarianceType: 'FAVORABLE' | 'UNFAVORABLE';
  revenueVariance: string;
  revenueVariancePercent: number;
  revenueVarianceType: 'FAVORABLE' | 'UNFAVORABLE';
  status: string;
  description?: string;
  tasks: Array<{ title?: string; phase?: string; priority?: string }>;
}
export interface ProjectVarianceReport {
  project: Project;
  summary: {
    budgetedCost: string; actualCost: string; costVariance: string;
    costVarianceSigned: string; costVariancePercent: number; costVarianceType: string;
    expectedRevenue: string; actualRevenue: string; revenueVariance: string;
    revenueVarianceSigned: string; revenueVariancePercent: number; revenueVarianceType: string;
  };
  expenses: Array<{ id: string; reference: string; expenseDate: string; merchant: string; category: string; amount: string; taxAmount: string; status: string }>;
  payments: Array<{ id: string; reference: string; paymentDate: string; amount: string; invoice: { number: string }; customer: { displayName: string } }>;
}
export interface OperationsSummary {
  baseCurrency: string;
  inventoryValue: string;
  products: number;
  warehouses: number;
  lowStock: number;
  outOfStock: number;
  activeProjects: number;
}
export interface ProductPage {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface ProjectPlan {
  name: string;
  objective: string;
  summary: string;
  risks: string[];
  tasks: Array<{ title: string; phase: string; priority: string }>;
}
const query = (filters: Record<string, string> = {}) =>
  new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
const req = <T>(path: string, method = 'GET', body?: object) =>
  authorizedRequest<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const productWrites = () => getOfflineQueue().filter((write) =>
  write.path === '/operations/products' ||
  /^\/operations\/products\/[^/]+(?:\/status|\/restock)?$/.test(write.path),
);
const queuedProductId = (writeId: string) => `offline-product:${writeId}`;
const applyQueuedProductWrites = (serverProducts: Product[]): Product[] => {
  const products = serverProducts.map((product) => ({ ...product }));
  for (const write of productWrites()) {
    const id = write.path === '/operations/products'
      ? queuedProductId(write.id)
      : decodeURIComponent(write.path.match(/^\/operations\/products\/([^/]+)/)?.[1] ?? '');
    let product = products.find((item) => item.id === id);
    let body: Record<string, unknown>;
    try { body = JSON.parse(write.body || '{}') as Record<string, unknown>; } catch { continue; }
    if (write.path === '/operations/products') {
      const quantity = Number(body.openingQuantity ?? 0);
      product = {
        id, sku: String(body.sku ?? ''), name: String(body.name ?? ''),
        type: body.type === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
        category: typeof body.category === 'string' ? body.category : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        unit: String(body.unit ?? 'unit'), salePrice: String(body.salePrice ?? 0),
        costPrice: String(body.costPrice ?? 0), taxRate: String(body.taxRate ?? 0),
        taxRateId: typeof body.taxRateId === 'string' ? body.taxRateId : null,
        reorderLevel: String(body.reorderLevel ?? 0), allowFractionalSale: Boolean(body.allowFractionalSale),
        stockQuantity: String(body.type === 'SERVICE' ? 0 : quantity),
        stockValue: String(body.type === 'SERVICE' ? 0 : quantity * Number(body.salePrice ?? 0)),
        defaultWarehouseId: typeof body.defaultWarehouseId === 'string' ? body.defaultWarehouseId : undefined,
        isActive: true, createdAt: write.queuedAt, updatedAt: write.queuedAt,
        pendingOffline: true, offlineQueueId: write.id,
      };
      products.unshift(product);
      continue;
    }
    if (!product) continue;
    if (write.path.endsWith('/restock')) {
      const delta = Number(body.quantity ?? 0);
      product.stockQuantity = String(Number(product.stockQuantity) + delta);
      product.stockValue = String(Number(product.stockQuantity) * Number(product.salePrice));
    } else if (write.path.endsWith('/status')) {
      product.isActive = Boolean(body.isActive);
    } else {
      Object.assign(product, body);
      if ('salePrice' in body) product.salePrice = String(body.salePrice);
      if ('costPrice' in body) product.costPrice = String(body.costPrice);
      if ('taxRate' in body) product.taxRate = String(body.taxRate);
      if ('reorderLevel' in body) product.reorderLevel = String(body.reorderLevel);
      if ('salePrice' in body) product.stockValue = String(Number(product.stockQuantity) * Number(product.salePrice));
    }
    product.pendingOffline = true;
    product.updatedAt = write.queuedAt;
  }
  return products;
};
export const INVENTORY_CHANGED_EVENT = 'cephas:inventory-changed';
const POS_CATALOG_TTL_MS = 10 * 60 * 1000;
const posCatalogKey = (warehouseId: string) =>
  `cephas:pos-catalog:${getAuthCacheIdentity()}:${warehouseId}`;
const readPosCatalog = (warehouseId: string): Product[] | null => {
  try {
    const raw = sessionStorage.getItem(posCatalogKey(warehouseId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as { savedAt: number; products: Product[] };
    if (Date.now() - cached.savedAt > POS_CATALOG_TTL_MS) {
      sessionStorage.removeItem(posCatalogKey(warehouseId));
      return null;
    }
    return Array.isArray(cached.products) ? cached.products : null;
  } catch {
    return null;
  }
};
const savePosCatalog = (warehouseId: string, products: Product[]) => {
  try {
    sessionStorage.setItem(
      posCatalogKey(warehouseId),
      JSON.stringify({ savedAt: Date.now(), products }),
    );
  } catch {
    // Storage may be unavailable or full; the in-memory request cache still works.
  }
};
export const operationsApi = {
  summary: async () => {
    const summary = await req<OperationsSummary>('/operations/summary');
    if (!productWrites().length) return summary;
    const products = applyQueuedProductWrites(await req<Product[]>('/operations/products?'))
      .filter((product) => product.isActive);
    const stockedProducts = products.filter((product) => product.type === 'PRODUCT');
    return {
      ...summary,
      products: products.length,
      inventoryValue: String(stockedProducts.reduce(
        (total, product) => total + Number(product.stockQuantity) * Number(product.salePrice), 0,
      )),
      lowStock: stockedProducts.filter((product) => Number(product.stockQuantity) > 0 && Number(product.stockQuantity) <= Number(product.reorderLevel)).length,
      outOfStock: stockedProducts.filter((product) => Number(product.stockQuantity) <= 0).length,
    };
  },
  taxRates: (includeInactive = false) => req<TaxRate[]>(`/operations/tax-rates${includeInactive ? '?includeInactive=true' : ''}`),
  createTaxRate: (data: { name: string; rate: number; description?: string }) => req<TaxRate>('/operations/tax-rates', 'POST', data),
  updateTaxRate: (id: string, data: { name: string; rate: number; description?: string }) => req<TaxRate>(`/operations/tax-rates/${id}`, 'PATCH', data),
  taxRateStatus: (id: string, isActive: boolean) => req<TaxRate>(`/operations/tax-rates/${id}/status`, 'PATCH', { isActive }),
  branchInventory: async () => {
    const savedReport = await req<BranchInventory>('/operations/branch-inventory');
    // Never apply outbox projections to the cached snapshot object itself: a
    // repeated render would otherwise apply the same transfer or receipt twice.
    const report = JSON.parse(JSON.stringify(savedReport)) as BranchInventory;
    const productCosts = new Map(
      applyQueuedProductWrites(await req<Product[]>('/operations/products?').catch(() => []))
        .map((product) => [product.id, Number(product.costPrice)]),
    );
    const queued = getOfflineQueue().filter(
      (write) => write.method === 'POST' && (
        ['/operations/transfers', '/operations/movements'].includes(write.path) ||
        /^\/operations\/products\/[^/]+\/restock$/.test(write.path) ||
        write.path === '/operations/products'
      ),
    );
    for (const write of queued) {
      try {
        const body = JSON.parse(write.body || '{}') as Record<string, unknown>;
        if (write.path === '/operations/products') {
          const quantity = Number(body.type === 'SERVICE' ? 0 : body.openingQuantity ?? 0);
          const warehouseId = typeof body.defaultWarehouseId === 'string' ? body.defaultWarehouseId : '';
          const branch = report.branches.find((row) => row.warehouseId === warehouseId);
          if (body.type === 'PRODUCT' && Number.isFinite(quantity)) {
            const productId = queuedProductId(write.id);
            if (!report.products.some((row) => row.productId === productId)) {
              const reorderLevel = Number(body.reorderLevel ?? 0);
              report.products.push({
                productId, sku: String(body.sku ?? ''), productName: String(body.name ?? ''),
                unit: String(body.unit ?? 'unit'), reorderLevel: String(reorderLevel),
                totalQuantity: String(quantity),
                locations: report.branches.map((locationBranch) => {
                  const locationQuantity = locationBranch.id === branch?.id ? quantity : 0;
                  const status = locationQuantity <= 0 ? 'OUT_OF_STOCK' :
                    locationQuantity <= reorderLevel ? 'LOW_STOCK' : 'IN_STOCK';
                  return {
                    branchId: locationBranch.id, branchName: locationBranch.name,
                    code: locationBranch.code, quantity: String(locationQuantity), status,
                  };
                }),
              });
              if (branch && quantity > 0)
                branch.inventoryValue = String(Number(branch.inventoryValue) + quantity * Number(body.costPrice ?? 0));
            }
          }
          continue;
        }
        const productId = typeof body.productId === 'string'
          ? body.productId
          : write.path.match(/^\/operations\/products\/([^/]+)\/restock$/)?.[1];
        const product = report.products.find((row) => row.productId === productId);
        const applyDelta = (warehouseId: string, delta: number) => {
          const branch = report.branches.find((row) => row.warehouseId === warehouseId);
          const location = product?.locations.find((row) => row.branchId === branch?.id);
          if (!product || !location || !Number.isFinite(delta)) return;
          if (branch) branch.inventoryValue = String(
            Number(branch.inventoryValue) + delta * (productCosts.get(productId ?? '') ?? 0),
          );
          location.quantity = String(Number(location.quantity) + delta);
          product.totalQuantity = String(Number(product.totalQuantity) + delta);
          location.status = Number(location.quantity) <= 0
            ? 'OUT_OF_STOCK'
            : Number(location.quantity) <= Number(product.reorderLevel)
              ? 'LOW_STOCK'
              : 'IN_STOCK';
        };
        const quantity = Number(body.quantity);
        if (write.path === '/operations/transfers') {
          if (typeof body.fromWarehouseId === 'string') applyDelta(body.fromWarehouseId, -quantity);
          if (typeof body.toWarehouseId === 'string') applyDelta(body.toWarehouseId, quantity);
        } else if (typeof body.warehouseId === 'string') {
          const negative = ['ISSUE', 'TRANSFER_OUT'].includes(String(body.type));
          applyDelta(body.warehouseId, negative ? -quantity : quantity);
        }
      } catch {
        // Keep the saved server snapshot if an outbox row cannot be interpreted.
      }
    }
    for (const branch of report.branches) {
      const locations = report.products.flatMap((product) =>
        product.locations
          .filter((location) => location.branchId === branch.id)
          .map((location) => ({ location, reorderLevel: Number(product.reorderLevel) })),
      );
      branch.lowStock = locations.filter(
        ({ location, reorderLevel }) => location.branchId === branch.id && Number(location.quantity) > 0 && Number(location.quantity) <= reorderLevel,
      ).length;
      branch.outOfStock = locations.filter(({ location }) => location.branchId === branch.id && Number(location.quantity) <= 0).length;
    }
    return { ...report, pendingOfflineChanges: queued.length };
  },
  products: async (filters: Record<string, string> = {}) => {
    const hasPendingWrites = productWrites().length > 0;
    const serverFilters = hasPendingWrites && !filters.warehouseId ? {} : filters;
    const products = applyQueuedProductWrites(await req<Product[]>(`/operations/products?${query(serverFilters)}`));
    const search = String(filters.search ?? '').trim().toLowerCase();
    const status = String(filters.status ?? '');
    const category = String(filters.category ?? '').trim().toLowerCase();
    return products.filter((product) =>
      (!search || `${product.name} ${product.sku} ${product.category ?? ''}`.toLowerCase().includes(search)) &&
      (!category || (product.category ?? '').toLowerCase() === category) &&
      (!filters.warehouseId || !product.id.startsWith('offline-product:') || product.defaultWarehouseId === filters.warehouseId) &&
      (status === 'active' ? product.isActive : status === 'archived' ? !product.isActive :
        status === 'low_stock' ? Number(product.stockQuantity) > 0 && Number(product.stockQuantity) <= Number(product.reorderLevel) :
        status === 'out_of_stock' ? Number(product.stockQuantity) <= 0 : true),
    );
  },
  productsPage: async (filters: Record<string, string> = {}) => {
    if (isWorkingOffline() || productWrites().length) {
      const all = await operationsApi.products();
      const search = String(filters.search ?? '').toLowerCase();
      const status = String(filters.status ?? '');
      const category = String(filters.category ?? '').toLowerCase();
      const filtered = all.filter((product) =>
        (!search || `${product.name} ${product.sku} ${product.category ?? ''}`.toLowerCase().includes(search)) &&
        (!category || (product.category ?? '').toLowerCase() === category) &&
        (status === 'active' ? product.isActive : status === 'archived' ? !product.isActive :
          status === 'low_stock' ? Number(product.stockQuantity) > 0 && Number(product.stockQuantity) <= Number(product.reorderLevel) :
          status === 'out_of_stock' ? Number(product.stockQuantity) <= 0 : true),
      );
      const page = Math.max(1, Number(filters.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 15)));
      return { data: filtered.slice((page - 1) * limit, page * limit), meta: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) } };
    }
    return req<ProductPage>(`/operations/products-page?${query(filters)}`);
  },
  posProducts: async (warehouseId: string) => {
    const cached = readPosCatalog(warehouseId);
    if (cached) return cached;
    const products = await req<Product[]>(
      `/operations/products?${query({ status: 'active', warehouseId })}`,
    );
    const activeProducts = products.filter((product) => product.isActive);
    savePosCatalog(warehouseId, activeProducts);
    return activeProducts;
  },
  savePosProducts: (warehouseId: string, products: Product[]) =>
    savePosCatalog(warehouseId, products),
  product: async (id: string) => {
    if (!isWorkingOffline()) return req<ProductDetails>(`/operations/products/${id}`);
    const product = (await operationsApi.products()).find((item) => item.id === id);
    if (!product) throw new Error('This product is not available in the saved offline workspace.');
    const [movements, adjustments] = await Promise.all([
      operationsApi.movements().catch(() => []), operationsApi.adjustments().catch(() => []),
    ]);
    const zero = '0';
    return {
      ...product, createdBy: null, activity: [],
      movements: movements.filter((row) => row.product.id === id).map(({ product: _product, ...row }) => row),
      adjustments: adjustments.filter((row) => row.product.id === id).map(({ product: _product, ...row }) => row),
      salesSummary: { unitsSold: zero, grossSales: zero, returnedUnits: zero, returnsValue: zero, netSales: zero },
      sales: [], offlineHistoryLimited: true,
    } as ProductDetails;
  },
  categories: async () => {
    const categories = [...await req<ProductCategory[]>('/operations/product-categories')];
    for (const write of getOfflineQueue().filter((item) => item.path === '/operations/product-categories' && item.method === 'POST')) {
      try {
        const body = JSON.parse(write.body || '{}') as { name?: string };
        const name = String(body.name ?? '').trim();
        if (name && !categories.some((category) => category.name.toLowerCase() === name.toLowerCase()))
          categories.push({ id: `offline-category:${write.id}`, name });
      } catch { /* Preserve the saved categories if a queued row is malformed. */ }
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },
  createCategory: async (name: string) => {
    const result = await req<ProductCategory | { queuedOffline: true }>('/operations/product-categories', 'POST', { name });
    if ('queuedOffline' in result) {
      const queued = getOfflineQueue().filter((write) => write.path === '/operations/product-categories').at(-1);
      return { id: `offline-category:${queued?.id ?? crypto.randomUUID()}`, name };
    }
    return result;
  },
  createProduct: (data: object) => req<Product>('/operations/products', 'POST', data),
  updateProduct: (id: string, data: object) => {
    if (id.startsWith('offline-product:')) {
      const queueId = id.slice('offline-product:'.length);
      const create = getOfflineQueue().find((write) => write.id === queueId && write.path === '/operations/products');
      if (!create) throw new Error('This pending item is no longer in the offline queue. Sync before editing it.');
      let original: Record<string, unknown> = {};
      try { original = JSON.parse(create.body || '{}') as Record<string, unknown>; } catch { /* preserve queue validation */ }
      replaceOfflineWrite(queueId, create.path, create.method, JSON.stringify({ ...original, ...data }));
      return Promise.resolve({ queuedOffline: true } as unknown as Product);
    }
    return req<Product>(`/operations/products/${id}`, 'PATCH', data);
  },
  productStatus: (id: string, isActive: boolean) =>
    req<Product>(`/operations/products/${id}/status`, 'PATCH', { isActive }),
  deleteProduct: (id: string) => req<{ deleted: boolean }>(`/operations/products/${id}`, 'DELETE'),
  restockProduct: (id: string, data: object) =>
    req<StockMovement>(`/operations/products/${id}/restock`, 'POST', data),
  warehouses: (filters = {}) => req<Warehouse[]>(`/operations/warehouses?${query(filters)}`),
  branches: () => req<BranchRecord[]>('/operations/branches'),
  createBranch: (data: object) => req<BranchRecord>('/operations/branches', 'POST', data),
  updateBranch: (id: string, data: object) => req<BranchRecord>(`/operations/branches/${id}`, 'PATCH', data),
  branchStatus: (id: string, isActive: boolean) => req<BranchRecord>(`/operations/branches/${id}/status`, 'PATCH', { isActive }),
  createWarehouse: (data: object) => req<Warehouse>('/operations/warehouses', 'POST', data),
  updateWarehouse: (id: string, data: object) =>
    req<Warehouse>(`/operations/warehouses/${id}`, 'PATCH', data),
  warehouseStatus: (id: string, isActive: boolean) =>
    req<Warehouse>(`/operations/warehouses/${id}/status`, 'PATCH', { isActive }),
  makeDefaultWarehouse: (id: string) =>
    req<Warehouse>(`/operations/warehouses/${id}/default`, 'PATCH'),
  movements: (filters = {}) => req<StockMovement[]>(`/operations/movements?${query(filters)}`),
  createMovement: (data: object) => req<StockMovement>('/operations/movements', 'POST', data),
  transfer: (data: object) => req<StockMovement[]>('/operations/transfers', 'POST', data),
  adjustments: (filters = {}) =>
    req<StockAdjustment[]>(`/operations/adjustments?${query(filters)}`),
  createAdjustment: (data: object) => req<StockAdjustment>('/operations/adjustments', 'POST', data),
  adjustmentStatus: (id: string, status: string) =>
    req<StockAdjustment>(`/operations/adjustments/${id}/status`, 'PATCH', { status }),
  projects: (filters = {}) => req<Project[]>(`/operations/projects?${query(filters)}`),
  projectVariance: (id: string) => req<ProjectVarianceReport>(`/operations/projects/${id}/variance`),
  createProject: (data: object) => req<Project>('/operations/projects', 'POST', data),
  updateProject: (id: string, data: object) =>
    req<Project>(`/operations/projects/${id}`, 'PATCH', data),
  projectStatus: (id: string, status: string) =>
    req<Project>(`/operations/projects/${id}/status`, 'PATCH', { status }),
  planProject: (data: object) => req<ProjectPlan>('/operations/project-ai/plan', 'POST', data),
};

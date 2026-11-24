import { authorizedRequest, getAuthCacheIdentity } from './auth';
import { getOfflineQueue } from './offline';

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
  reorderLevel: string;
  allowFractionalSale: boolean;
  stockQuantity: string;
  stockValue: string;
  defaultWarehouseId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ProductDetails extends Product {
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
  status: string;
  description?: string;
  tasks: Array<{ title?: string; phase?: string; priority?: string }>;
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
  summary: () => req<OperationsSummary>('/operations/summary'),
  branchInventory: async () => {
    const report = await req<BranchInventory>('/operations/branch-inventory');
    const queued = getOfflineQueue().filter(
      (write) => write.method === 'POST' && (
        ['/operations/transfers', '/operations/movements'].includes(write.path) ||
        /^\/operations\/products\/[^/]+\/restock$/.test(write.path)
      ),
    );
    for (const write of queued) {
      try {
        const body = JSON.parse(write.body || '{}') as Record<string, unknown>;
        const productId = typeof body.productId === 'string'
          ? body.productId
          : write.path.match(/^\/operations\/products\/([^/]+)\/restock$/)?.[1];
        const product = report.products.find((row) => row.productId === productId);
        const applyDelta = (warehouseId: string, delta: number) => {
          const branch = report.branches.find((row) => row.warehouseId === warehouseId);
          const location = product?.locations.find((row) => row.branchId === branch?.id);
          if (!product || !location || !Number.isFinite(delta)) return;
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
  products: (filters = {}) => req<Product[]>(`/operations/products?${query(filters)}`),
  productsPage: (filters = {}) => req<ProductPage>(`/operations/products-page?${query(filters)}`),
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
  product: (id: string) => req<ProductDetails>(`/operations/products/${id}`),
  categories: () => req<ProductCategory[]>('/operations/product-categories'),
  createCategory: (name: string) =>
    req<ProductCategory>('/operations/product-categories', 'POST', { name }),
  createProduct: (data: object) => req<Product>('/operations/products', 'POST', data),
  updateProduct: (id: string, data: object) =>
    req<Product>(`/operations/products/${id}`, 'PATCH', data),
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
  createProject: (data: object) => req<Project>('/operations/projects', 'POST', data),
  updateProject: (id: string, data: object) =>
    req<Project>(`/operations/projects/${id}`, 'PATCH', data),
  projectStatus: (id: string, status: string) =>
    req<Project>(`/operations/projects/${id}/status`, 'PATCH', { status }),
  planProject: (data: object) => req<ProjectPlan>('/operations/project-ai/plan', 'POST', data),
};

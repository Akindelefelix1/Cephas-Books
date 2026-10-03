import { authorizedRequest, getAuthCacheIdentity } from './auth';

export type OperationsView =
  'products' | 'warehouses' | 'stock-movements' | 'stock-adjustments' | 'projects' | 'project-ai';
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
  isDefault: boolean;
  isActive: boolean;
}
export interface StockMovement {
  id: string;
  type: string;
  quantity: string;
  unitCost: string;
  movementDate: string;
  reference: string;
  notes?: string;
  product: Product;
  warehouse: Warehouse;
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

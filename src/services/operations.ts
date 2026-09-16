import { authorizedRequest } from './auth';

export type OperationsView =
  'products' | 'warehouses' | 'stock-movements' | 'stock-adjustments' | 'projects' | 'project-ai';
export interface Product {
  id: string;
  sku: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE';
  category?: string;
  unit: string;
  salePrice: string;
  costPrice: string;
  taxRate: string;
  reorderLevel: string;
  stockQuantity: string;
  stockValue: string;
  isActive: boolean;
}
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  manager?: string;
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
  inventoryValue: string;
  products: number;
  warehouses: number;
  lowStock: number;
  outOfStock: number;
  activeProjects: number;
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
export const operationsApi = {
  summary: () => req<OperationsSummary>('/operations/summary'),
  products: (filters = {}) => req<Product[]>(`/operations/products?${query(filters)}`),
  createProduct: (data: object) => req<Product>('/operations/products', 'POST', data),
  updateProduct: (id: string, data: object) =>
    req<Product>(`/operations/products/${id}`, 'PATCH', data),
  productStatus: (id: string, isActive: boolean) =>
    req<Product>(`/operations/products/${id}/status`, 'PATCH', { isActive }),
  warehouses: (filters = {}) => req<Warehouse[]>(`/operations/warehouses?${query(filters)}`),
  createWarehouse: (data: object) => req<Warehouse>('/operations/warehouses', 'POST', data),
  updateWarehouse: (id: string, data: object) =>
    req<Warehouse>(`/operations/warehouses/${id}`, 'PATCH', data),
  warehouseStatus: (id: string, isActive: boolean) =>
    req<Warehouse>(`/operations/warehouses/${id}/status`, 'PATCH', { isActive }),
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

import { authorizedRequest } from './auth';
export type PurchaseView =
  | 'suppliers'
  | 'purchase-requests'
  | 'purchase-orders'
  | 'goods-received-notes'
  | 'bills'
  | 'supplier-payments'
  | 'payables'
  | 'expenses';
export interface Supplier {
  id: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  paymentTermsDays?: number;
  bankDetails?: string;
  isActive: boolean;
}
export interface PurchaseRow {
  id: string;
  number?: string;
  reference?: string;
  requestedBy?: string;
  requiredDate?: string;
  orderDate?: string;
  deliveryDate?: string;
  issueDate?: string;
  dueDate?: string;
  paymentDate?: string;
  expenseDate?: string;
  merchant?: string;
  category?: string;
  status?: string;
  currency: string;
  total?: string;
  paidAmount?: string;
  amount?: string;
  taxAmount?: string;
  method?: string;
  notes?: string;
  reversedAt?: string;
  isActive?: boolean;
  supplier?: Supplier;
  project?: { id: string; code: string; name: string } | null;
  bill?: PurchaseRow;
  items?: Array<Line | GoodsReceivedLine>;
  branchId?: string | null;
  goodsReceivedNotes?: Array<{ items: Array<Record<string, unknown>> }>;
  supplierReference?: string;
  receivedDate?: string;
  warehouse?: { id: string; code: string; name: string };
  purchaseOrder?: { id: string; number: string; currency?: string; items?: Line[] };
  recordedBy?: { firstName?: string; lastName?: string; email: string } | null;
}
export interface GoodsReceivedLine {
  orderLineIndex: number;
  productId?: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  notes?: string;
  itemName?: string;
  itemDescription?: string;
  orderedQuantity?: number;
  outstandingQuantity?: number;
  unitCost?: number;
}
export interface GoodsReceivedNote {
  id: string;
  reference: string;
  supplierReference?: string;
  receivedDate: string;
  notes?: string;
  items: GoodsReceivedLine[];
  supplier: Supplier;
  purchaseOrder: { id: string; number: string; currency?: string };
  warehouse: { id: string; code: string; name: string };
  recordedBy?: { firstName?: string; lastName?: string; email: string } | null;
}
export interface GoodsReceivedOptions {
  products: Array<{ id: string; sku: string; name: string; unit: string }>;
  warehouses: Array<{
    id: string;
    branchId?: string | null;
    code: string;
    name: string;
    isDefault: boolean;
  }>;
}
export interface Line {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}
export interface PurchaseSummary {
  suppliers: number;
  pendingRequests: number;
  openOrders: string;
  payable: string;
  expenses: string;
}
export interface PurchaseProjectOption { id: string; code: string; name: string }
const query = (search: string, status = '') => new URLSearchParams({ search, status }).toString();
const post = (path: string, data: object, method = 'POST') =>
  authorizedRequest<PurchaseRow>(path, { method, body: JSON.stringify(data) });
export const purchasesApi = {
  summary: () => authorizedRequest<PurchaseSummary>('/purchases/summary'),
  suppliers: (s = '') => authorizedRequest<Supplier[]>(`/purchases/suppliers?${query(s)}`),
  createSupplier: (d: object) => post('/purchases/suppliers', d),
  updateSupplier: (id: string, d: object) => post(`/purchases/suppliers/${id}`, d, 'PATCH'),
  archiveSupplier: (id: string) =>
    authorizedRequest(`/purchases/suppliers/${id}`, { method: 'DELETE' }),
  deleteSupplier: (id: string) =>
    authorizedRequest<{ deleted: true }>(`/purchases/suppliers/${id}/permanent`, {
      method: 'DELETE',
    }),
  restoreSupplier: (id: string) =>
    authorizedRequest<Supplier>(`/purchases/suppliers/${id}/restore`, { method: 'PATCH' }),
  list: (view: PurchaseView, s = '', status = '') =>
    authorizedRequest<PurchaseRow[]>(
      `/purchases/${view === 'purchase-requests' ? 'requests' : view === 'purchase-orders' ? 'orders' : view === 'supplier-payments' ? 'payments' : view}?${query(s, status)}`,
    ),
  create: (view: PurchaseView, d: object) =>
    post(
      `/purchases/${view === 'purchase-requests' ? 'requests' : view === 'purchase-orders' ? 'orders' : view === 'supplier-payments' || view === 'payables' ? 'payments' : view}`,
      d,
    ),
  status: (kind: 'requests' | 'orders' | 'bills' | 'expenses', id: string, status: string) =>
    post(`/purchases/${kind}/${id}/status`, { status }, 'PATCH'),
  reversePayment: (id: string) => post(`/purchases/payments/${id}/reverse`, {}),
  orderToBill: (id: string, d: object) => post(`/purchases/orders/${id}/convert`, d),
  grns: (s = '') =>
    authorizedRequest<GoodsReceivedNote[]>(`/purchases/goods-received-notes?${query(s)}`),
  grnOptions: () =>
    authorizedRequest<GoodsReceivedOptions>('/purchases/goods-received-notes/options'),
  projects: () => authorizedRequest<PurchaseProjectOption[]>('/purchases/projects'),
  createGrn: (d: object) => post('/purchases/goods-received-notes', d),
};

import { authorizedRequest } from './auth';
export type PurchaseView =
  | 'suppliers'
  | 'purchase-requests'
  | 'purchase-orders'
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
  method?: string;
  reversedAt?: string;
  isActive?: boolean;
  supplier?: Supplier;
  bill?: PurchaseRow;
  items?: Line[];
}
export interface Line {
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
};

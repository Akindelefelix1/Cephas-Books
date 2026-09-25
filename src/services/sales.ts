import { authorizedRequest } from './auth';
export interface Customer {
  id: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  billingAddress?: string;
  notes?: string;
  isActive: boolean;
}
export interface Line {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal?: string;
}
export interface Invoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  creditedAmount: string;
  notes?: string;
  customer: Customer;
  customerId: string;
  items?: Line[];
}
export interface Quotation {
  id: string;
  number: string;
  status: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  notes?: string;
  customer: Customer;
  customerId: string;
  items: Line[];
}
export interface Payment {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  paymentDate: string;
  method: string;
  notes?: string;
  customer: Customer;
  invoice: Invoice;
}
export interface CreditNote {
  id: string;
  number: string;
  amount: string;
  currency: string;
  issueDate: string;
  reason: string;
  isVoid: boolean;
  customer: Customer;
  invoice: Invoice;
}
export interface SalesSummary {
  customers: number;
  openQuotations: number;
  invoiced: string;
  received: string;
  credited: string;
  receivable: string;
}
const q = (input: Record<string, string>) => {
  const p = new URLSearchParams(input);
  return p.toString();
};
export const salesApi = {
  summary: () => authorizedRequest<SalesSummary>('/sales/summary'),
  customers: (search = '') =>
    authorizedRequest<{ data: Customer[] }>(
      `/customers?limit=100&search=${encodeURIComponent(search)}`,
    ),
  customerPurchaseHistory: (id: string) =>
    authorizedRequest<Invoice[]>(`/customers/${id}/purchase-history`),
  createCustomer: (data: Partial<Customer>) =>
    authorizedRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    authorizedRequest<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  archiveCustomer: (id: string) =>
    authorizedRequest<Customer>(`/customers/${id}`, { method: 'DELETE' }),
  invoices: () => authorizedRequest<Invoice[]>('/invoices'),
  nextInvoiceNumber: () => authorizedRequest<{ number: string }>('/invoices/next-number'),
  createInvoice: (data: object) =>
    authorizedRequest<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  sendInvoice: (id: string) =>
    authorizedRequest<{ sent: true }>(`/invoices/${id}/send`, { method: 'POST' }),
  quotations: (filters: Record<string, string>) =>
    authorizedRequest<Quotation[]>(`/sales/quotations?${q(filters)}`),
  createQuotation: (data: object) =>
    authorizedRequest<Quotation>('/sales/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  quotationStatus: (id: string, status: string) =>
    authorizedRequest<Quotation>(`/sales/quotations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  convertQuotation: (id: string) =>
    authorizedRequest<Invoice>(`/sales/quotations/${id}/convert`, { method: 'POST' }),
  payments: (filters: Record<string, string>) =>
    authorizedRequest<Payment[]>(`/sales/payments?${q(filters)}`),
  createPayment: (data: object) =>
    authorizedRequest<Payment>('/sales/payments', { method: 'POST', body: JSON.stringify(data) }),
  reversePayment: (id: string) =>
    authorizedRequest<{ reversed: true }>(`/sales/payments/${id}/reverse`, { method: 'POST' }),
  credits: (filters: Record<string, string>) =>
    authorizedRequest<CreditNote[]>(`/sales/credit-notes?${q(filters)}`),
  createCredit: (data: object) =>
    authorizedRequest<CreditNote>('/sales/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  voidCredit: (id: string) =>
    authorizedRequest<{ voided: true }>(`/sales/credit-notes/${id}/void`, { method: 'POST' }),
  receivables: (filters: Record<string, string>) =>
    authorizedRequest<Invoice[]>(`/sales/receivables?${q(filters)}`),
};

import { authorizedRequest } from './auth';
export interface Customer {
  id: string;
  name?: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  billingAddress?: string;
  notes?: string;
  paymentTermsDays?: number;
  creditLimit?: string;
  isActive: boolean;
}
export interface CustomerCreditStatus {
  customerId: string; creditLimit: string; outstandingBalance: string; availableCredit: string;
  currency: string; usagePercent: number; nearLimit: boolean; exceeded: boolean;
}
export interface CustomerCreditLimitAdjustment {
  id: string; previousLimit: string; newLimit: string; reason: string; createdAt: string;
  actor?: { firstName?: string; lastName?: string; email?: string };
}
export interface CustomerCreditOverride {
  id: string; targetType: string; targetId: string; creditLimit: string; existingExposure: string;
  requestedAmount: string; reason: string; createdAt: string;
  approver?: { firstName?: string; lastName?: string; email?: string };
}
export interface CustomerPosCreditPayment {
  id: string; reference: string; amount: string; currency: string; method: string;
  paymentDate: string; sale: { id: string; receiptNumber: string };
  receivedBy?: { firstName?: string; lastName?: string; email?: string } | null;
}
export interface Line {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxRateId?: string | null;
  taxRateVersion?: number | null;
  taxName?: string;
  taxAmount?: string | number;
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
  shippingAmount: string;
  total: string;
  paidAmount: string;
  creditedAmount: string;
  notes?: string;
  shippingAddress?: string;
  customer: Customer;
  customerId: string;
  projectId?: string | null;
  project?: { id: string; code: string; name: string } | null;
  items?: Line[];
  payments?: CustomerStatementPayment[];
  creditNotes?: CustomerStatementCredit[];
  organization?: { name: string; countryCode: string };
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
export interface CustomerStatementPayment {
  id: string;
  reference: string;
  amount: string;
  paymentDate: string;
  method: string;
}
export interface CustomerStatementCredit {
  id: string;
  number: string;
  amount: string;
  issueDate: string;
  isVoid: boolean;
}
export interface SalesSummary {
  customers: number;
  openQuotations: number;
  invoiced: string;
  received: string;
  projectReceived: string;
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
  customerCreditStatus: (id: string) => authorizedRequest<CustomerCreditStatus>(`/customers/${id}/credit-status`),
  customerCreditLimitHistory: (id: string) => authorizedRequest<CustomerCreditLimitAdjustment[]>(`/customers/${id}/credit-limit-history`),
  customerCreditOverrideHistory: (id: string) => authorizedRequest<CustomerCreditOverride[]>(`/customers/${id}/credit-override-history`),
  customerPosCreditPayments: (id: string) => authorizedRequest<CustomerPosCreditPayment[]>(`/customers/${id}/pos-credit-payments`),
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
  projects: () => authorizedRequest<Array<{ id: string; code: string; name: string }>>('/invoices/projects'),
  nextInvoiceNumber: () => authorizedRequest<{ number: string }>('/invoices/next-number'),
  createInvoice: (data: object) =>
    authorizedRequest<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  sendInvoice: (id: string, approval?: { creditLimitOverride?: boolean; creditLimitOverrideReason?: string }) =>
    authorizedRequest<{ sent: true }>(`/invoices/${id}/send`, { method: 'POST', body: JSON.stringify(approval ?? {}) }),
  quotations: (filters: Record<string, string>) =>
    authorizedRequest<Quotation[]>(`/sales/quotations?${q(filters)}`),
  nextQuotationNumber: () => authorizedRequest<{ number: string }>('/sales/quotations/next-number'),
  createQuotation: (data: object) =>
    authorizedRequest<Quotation>('/sales/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendQuotation: (id: string) =>
    authorizedRequest<{ sent: true }>(`/sales/quotations/${id}/send`, { method: 'POST' }),
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

import { authorizedRequest } from './auth';
export interface PosSale {
  id: string;
  receiptNumber: string;
  status: 'COMPLETED' | 'VOIDED' | 'HELD' | 'REFUNDED';
  currency: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  createdAt: string;
  subtotal?: string;
  discountTotal?: string;
  taxTotal?: string;
  customerSignature?: string | null;
  salesManagerSignature?: string | null;
  customer?: { id: string; displayName: string; email?: string; phone?: string } | null;
  receipt?: {
    organizationName: string;
    logoUrl?: string;
    organizationPhone?: string;
    organizationAddress?: string;
    organizationWebsite?: string;
    returnPolicy?: string;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    register?: { id: string; code: string; name: string } | null;
    cashier?: { name: string; email: string } | null;
    verificationCode: string;
    digitalUrl: string;
  };
  items: Array<{
    id?: string;
    productId?: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    lineTotal: string;
    product?: { allowFractionalSale: boolean };
  }>;
  payments: Array<{
    id?: string;
    method: string;
    status?: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVERSED';
    amount: string;
    reference?: string;
  }>;
  returns?: Array<{
    id: string;
    productId: string;
    quantity: string;
    amount: string;
    reason: string;
    createdAt: string;
  }>;
}
export interface PosRegister {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string };
  assignedStaffId?: string | null;
  branchId?: string;
  defaultCashAccountId?: string | null;
  defaultCardAccountId?: string | null;
  defaultBankAccountId?: string | null;
  terminalId?: string | null;
  isActive: boolean;
  assignedStaff?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  shifts?: Array<{
    id: string;
    cashier: { id: string; email: string; firstName?: string; lastName?: string };
    openedAt: string;
  }>;
}
export type PosRegisterWrite = {
  code: string;
  name: string;
  warehouseId: string;
  assignedStaffId: string;
  branchId: string;
  defaultCashAccountId?: string | null;
  defaultCardAccountId?: string | null;
  defaultBankAccountId?: string | null;
  terminalId?: string | null;
};
export type PosRegisterUpdate = Partial<PosRegisterWrite> & { isActive?: boolean };
export interface PosBranch {
  id: string;
  name: string;
  address?: string;
}
export interface PosShift {
  id: string;
  registerId: string;
  openingCash: string;
  register: PosRegister;
}
export interface PosShiftCloseResult {
  id: string;
  status: 'CLOSED';
  openingCash: string;
  closingCash: string;
  expectedCash: string;
  variance: string;
  closedAt: string;
}
export interface PosAuditEntry {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
export const posApi = {
  sales: (filters: Record<string, string> = {}) => {
    const query = new URLSearchParams(filters).toString();
    return authorizedRequest<{
      data: PosSale[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/pos/sales${query ? `?${query}` : ''}`);
  },
  registers: () => authorizedRequest<PosRegister[]>('/pos/registers'),
  branches: () => authorizedRequest<PosBranch[]>('/pos/branches'),
  currentShift: () => authorizedRequest<PosShift | null>('/pos/shifts/current'),
  closeShift: (id: string, data: { closingCash: number; notes?: string }) =>
    authorizedRequest<PosShiftCloseResult>(`/pos/shifts/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  returnItem: (saleId: string, data: { productId: string; quantity: number; reason: string }) =>
    authorizedRequest<{
      id: string;
      productId: string;
      quantity: string;
      amount: string;
      reason: string;
      createdAt: string;
    }>(`/pos/sales/${saleId}/returns`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  voidSale: (saleId: string, reason: string) =>
    authorizedRequest<{ id: string; status: 'VOIDED' }>(`/pos/sales/${saleId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  audit: (saleId: string) => authorizedRequest<PosAuditEntry[]>(`/pos/sales/${saleId}/audit`),
  auditLog: () => authorizedRequest<PosAuditEntry[]>('/pos/audit'),
  receipt: (saleId: string) => authorizedRequest<PosSale>(`/pos/sales/${saleId}/receipt`),
  recordReprint: (saleId: string) =>
    authorizedRequest<PosSale>(`/pos/sales/${saleId}/receipt/reprint`, { method: 'POST' }),
  emailReceipt: (saleId: string) =>
    authorizedRequest<{ sent: true }>(`/pos/sales/${saleId}/receipt/email`, { method: 'POST' }),
  smsReceipt: (saleId: string) =>
    authorizedRequest<{ sent: true }>(`/pos/sales/${saleId}/receipt/sms`, { method: 'POST' }),
  createRegister: (data: PosRegisterWrite) =>
    authorizedRequest<PosRegister>('/pos/registers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRegister: (id: string, data: PosRegisterUpdate) =>
    authorizedRequest<PosRegister>(`/pos/registers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  assignRegisterStaff: (id: string, assignedStaffId: string, branchId: string) =>
    authorizedRequest<PosRegister>(`/pos/registers/${id}/staff`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedStaffId, branchId }),
    }),
  handoverRegister: (
    id: string,
    data: { assignedStaffId: string; branchId: string; closingCash: number; notes?: string },
  ) =>
    authorizedRequest<PosRegister>(`/pos/registers/${id}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  openShift: (data: object) =>
    authorizedRequest<PosShift>('/pos/shifts', { method: 'POST', body: JSON.stringify(data) }),
  complete: (data: object) =>
    authorizedRequest<PosSale>('/pos/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateReceiptSignatures: (
    saleId: string,
    data: { customerSignature: string | null; salesManagerSignature: string | null },
  ) =>
    authorizedRequest<PosSale>(`/pos/sales/${saleId}/receipt-signatures`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

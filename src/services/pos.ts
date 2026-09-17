import { authorizedRequest } from './auth';
export interface PosSale { id: string; receiptNumber: string; total: string; paidAmount: string; changeAmount: string; createdAt: string; items: Array<{ description: string; quantity: string; lineTotal: string }>; payments: Array<{ method: string; amount: string }> }
export interface PosRegister { id: string; code: string; name: string; warehouseId: string }
export interface PosShift { id: string; registerId: string; openingCash: string; register: PosRegister }
export const posApi = {
  sales: () => authorizedRequest<PosSale[]>('/pos/sales'),
  registers: () => authorizedRequest<PosRegister[]>('/pos/registers'),
  currentShift: () => authorizedRequest<PosShift | null>('/pos/shifts/current'),
  createRegister: (data: object) => authorizedRequest<PosRegister>('/pos/registers', { method: 'POST', body: JSON.stringify(data) }),
  openShift: (data: object) => authorizedRequest<PosShift>('/pos/shifts', { method: 'POST', body: JSON.stringify(data) }),
  complete: (data: object) => authorizedRequest<PosSale>('/pos/sales', { method: 'POST', body: JSON.stringify(data) }),
};

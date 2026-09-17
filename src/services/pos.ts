import { authorizedRequest } from './auth';
export interface PosSale { id: string; receiptNumber: string; total: string; paidAmount: string; changeAmount: string; createdAt: string; items: Array<{ description: string; quantity: string; lineTotal: string }>; payments: Array<{ method: string; amount: string }> }
export const posApi = {
  sales: () => authorizedRequest<PosSale[]>('/pos/sales'),
  complete: (data: object) => authorizedRequest<PosSale>('/pos/sales', { method: 'POST', body: JSON.stringify(data) }),
};

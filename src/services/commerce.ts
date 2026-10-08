import { authorizedRequest } from './auth';

export type CommerceView =
  | 'commerce-dashboard'
  | 'sales-channels'
  | 'channel-orders'
  | 'fulfillment'
  | 'payouts'
  | 'product-channel-mapping'
  | 'commerce-analytics'
  | 'commerce-settings';

export interface CommerceSummary {
  currency: string;
  todaySales: string;
  todayOrders: number;
  todayUnits: string;
  monthSales: string;
  averageOrderValue: string;
  pendingOrders: number;
  inventoryValue: string;
  products: number;
  lowStock: number;
  outOfStock: number;
  activeChannels: number;
  channelCount: number;
}

export interface CommerceChannel {
  id: string;
  name: string;
  type: 'POS' | 'B2B' | 'ONLINE_STORE' | 'MARKETPLACE' | 'SOCIAL' | 'CUSTOM_API';
  branchId?: string | null;
  warehouseId: string;
  status: 'ACTIVE' | 'PAUSED';
  syncInventory: boolean;
  syncOrders: boolean;
  syncCustomers: boolean;
  lastSyncedAt?: string | null;
  warehouse: { id: string; code: string; name: string };
}

export type CommerceChannelWrite = Pick<
  CommerceChannel,
  'name' | 'type' | 'warehouseId' | 'syncInventory' | 'syncOrders' | 'syncCustomers'
> & { branchId?: string | null; status?: 'ACTIVE' | 'PAUSED' };

export interface CommerceOrder {
  id: string;
  reference: string;
  source: string;
  customer: string;
  total: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface CommerceCatalogItem {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  unit: string;
  salePrice: string;
  stockQuantity: string;
  channelCount: number;
}

export const commerceApi = {
  summary: () => authorizedRequest<CommerceSummary>('/commerce/summary'),
  channels: () => authorizedRequest<CommerceChannel[]>('/commerce/channels'),
  createChannel: (data: CommerceChannelWrite) =>
    authorizedRequest<CommerceChannel>('/commerce/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateChannel: (id: string, data: CommerceChannelWrite) =>
    authorizedRequest<CommerceChannel>(`/commerce/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  syncChannel: (id: string) =>
    authorizedRequest<CommerceChannel>(`/commerce/channels/${id}/sync`, { method: 'POST' }),
  orders: () => authorizedRequest<CommerceOrder[]>('/commerce/orders'),
  catalog: () => authorizedRequest<CommerceCatalogItem[]>('/commerce/catalog'),
};

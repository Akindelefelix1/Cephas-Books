export interface PermissionIdentity {
  customRoleId?: string;
  permissions: string[];
}

const routePermissions: Record<string, string> = {
  dashboard: 'dashboard.view',
  banking: 'banking.accounts.view',
  transactions: 'banking.transactions.view',
  reconciliation: 'banking.reconciliation.view',
  pos: 'sales.view',
  'pos-history': 'sales.view',
  customers: 'sales.view',
  quotations: 'sales.view',
  invoices: 'sales.view',
  payments: 'sales.view',
  'credit-notes': 'sales.view',
  receivables: 'sales.view',
  suppliers: 'purchases.view',
  'purchase-requests': 'purchases.view',
  'purchase-orders': 'purchases.view',
  'goods-received-notes': 'purchases.view',
  bills: 'purchases.view',
  'supplier-payments': 'purchases.view',
  payables: 'purchases.view',
  expenses: 'purchases.view',
  'chart-of-accounts': 'accounting.view',
  journals: 'accounting.view',
  'general-ledger': 'accounting.view',
  'trial-balance': 'accounting.view',
  assets: 'accounting.view',
  budgets: 'accounting.view',
  tax: 'accounting.view',
  payroll: 'accounting.view',
  products: 'inventory.view',
  warehouses: 'inventory.view',
  'branch-inventory': 'inventory.view',
  'stock-movements': 'inventory.view',
  'stock-adjustments': 'inventory.view',
  projects: 'inventory.view',
  'project-ai': 'inventory.view',
  'commerce-dashboard': 'inventory.view',
  'sales-channels': 'inventory.view',
  'channel-orders': 'sales.view',
  fulfillment: 'inventory.view',
  payouts: 'banking.view',
  'product-channel-mapping': 'inventory.view',
  'commerce-analytics': 'sales.view',
  'commerce-settings': 'settings.manage',
  reports: 'reports.view',
  'custom-reports': 'reports.view',
  analytics: 'reports.view',
  'ai-assistant': 'reports.view',
  'excel-sync': 'reports.view',
  approvals: 'approvals.review',
  notifications: 'dashboard.view',
  branches: 'settings.manage',
  currencies: 'settings.manage',
  users: 'users.view',
  'audit-logs': 'users.view',
  integrations: 'settings.manage',
  security: 'settings.manage',
  settings: 'settings.manage',
};

const legacyPermission: Record<string, string> = {
  'banking.accounts.view': 'banking.view',
  'banking.transactions.view': 'banking.view',
  'banking.reconciliation.view': 'banking.view',
};

const permissionImplies: Record<string, string[]> = {
  'banking.accounts.view': ['banking.manage', 'banking.accounts.manage'],
  'banking.transactions.view': ['banking.manage', 'banking.transactions.manage'],
  'banking.reconciliation.view': ['banking.manage', 'banking.reconciliation.manage'],
};

export const can = (identity: PermissionIdentity, permission: string) =>
  !identity.customRoleId ||
  identity.permissions.includes(permission) ||
  Boolean(
    legacyPermission[permission] && identity.permissions.includes(legacyPermission[permission]),
  ) ||
  Boolean(permissionImplies[permission]?.some((implied) => identity.permissions.includes(implied)));

export const canAccessRoute = (identity: PermissionIdentity, route: string) =>
  !routePermissions[route] || can(identity, routePermissions[route]);

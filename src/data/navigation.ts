import {
  Activity,
  BookOpen,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import type { NavItem } from '@/types/app';

export const primaryNavigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'money-group',
    label: 'Money & banking',
    icon: Landmark,
    children: [
      { id: 'banking', label: 'Bank accounts' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'reconciliation', label: 'Reconciliation' },
    ],
  },
  {
    id: 'sales-group',
    label: 'Sales & income',
    icon: ShoppingCart,
    children: [
      { id: 'customers', label: 'Customers' },
      { id: 'quotations', label: 'Quotations' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'payments', label: 'Payments received' },
      { id: 'credit-notes', label: 'Credit notes' },
      { id: 'receivables', label: 'Receivables' },
    ],
  },
  {
    id: 'spending-group',
    label: 'Purchases & spending',
    icon: ShoppingCart,
    children: [
      { id: 'suppliers', label: 'Suppliers' },
      { id: 'purchase-requests', label: 'Purchase requests' },
      { id: 'purchase-orders', label: 'Purchase orders' },
      { id: 'bills', label: 'Bills' },
      { id: 'supplier-payments', label: 'Supplier payments' },
      { id: 'payables', label: 'Payables' },
      { id: 'expenses', label: 'Expenses' },
    ],
  },
  {
    id: 'accounting-group',
    label: 'Accounting & finance',
    icon: BookOpen,
    children: [
      { id: 'chart-of-accounts', label: 'Chart of accounts' },
      { id: 'journals', label: 'Journal entries' },
      { id: 'general-ledger', label: 'General ledger' },
      { id: 'trial-balance', label: 'Trial balance' },
      { id: 'assets', label: 'Fixed assets' },
      { id: 'budgets', label: 'Budgeting' },
      { id: 'tax', label: 'Tax' },
      { id: 'payroll', label: 'Payroll' },
    ],
  },
  {
    id: 'operations-group',
    label: 'Inventory & operations',
    icon: FolderKanban,
    children: [
      { id: 'products', label: 'Products & services' },
      { id: 'warehouses', label: 'Warehouses' },
      { id: 'stock-movements', label: 'Stock movements' },
      { id: 'stock-adjustments', label: 'Adjustments' },
      { id: 'projects', label: 'Projects' },
    ],
  },
];

export const secondaryNavigation: NavItem[] = [
  {
    id: 'insights-group',
    label: 'Insights & automation',
    icon: Activity,
    children: [
      { id: 'reports', label: 'Reports' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'ai-assistant', label: 'Cephas AI' },
    ],
  },
  {
    id: 'workflow-group',
    label: 'Workflow & records',
    icon: FolderKanban,
    children: [
      { id: 'documents', label: 'Documents' },
      { id: 'approvals', label: 'Approvals' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'organisation-group',
    label: 'Organisation & settings',
    icon: Settings,
    children: [
      { id: 'branches', label: 'Branches & centres' },
      { id: 'currencies', label: 'Currencies' },
      { id: 'users', label: 'Users & roles' },
      { id: 'audit-logs', label: 'Audit logs' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'security', label: 'Security' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

export const allNavigation = [...primaryNavigation, ...secondaryNavigation];

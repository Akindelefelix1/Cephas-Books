import type { ModuleDefinition } from '@/types/app';

const labels: Record<string, [string, string, string]> = {
  transactions: [
    'Bank transactions',
    'Import, categorise, match, split, exclude, and post bank activity.',
    'Record transaction',
  ],
  receivables: [
    'Accounts receivable',
    'Monitor customer balances, ageing buckets, credit limits, and collection reminders.',
    'Send reminders',
  ],
  payables: [
    'Accounts payable',
    'Plan supplier payments using ageing, due dates, balances, and cash availability.',
    'Schedule payment',
  ],
  inventory: [
    'Inventory overview',
    'Control inventory value, stock levels, movements, transfers, receipts, and deductions.',
    'New item',
  ],
  warehouses: [
    'Warehouses',
    'Manage stock locations, available quantities, transfers, and branch ownership.',
    'Add warehouse',
  ],
  'stock-movements': [
    'Stock movements',
    'Trace purchase receipts, sales deductions, transfers, returns, and adjustments.',
    'Record movement',
  ],
  'stock-adjustments': [
    'Stock adjustments',
    'Correct counted stock with controlled reasons, approvals, and ledger impact.',
    'New adjustment',
  ],
  analytics: [
    'Financial analytics',
    'Explore revenue, profit, cash, customers, products, expenses, and scenario forecasts.',
    'Create analysis',
  ],
};

export function getFallbackModule(id: string): ModuleDefinition {
  const [title, description, action] = labels[id] ?? [
    id
      .split('-')
      .map((x) => x[0]?.toUpperCase() + x.slice(1))
      .join(' '),
    'Manage records, workflows, financial controls, and reporting for this module.',
    'Create record',
  ];
  return {
    title,
    description,
    action,
    stats: [
      { label: 'Total value', value: '₦24.84m', change: '+8.4%', tone: 'positive' },
      { label: 'Active records', value: '248', change: '+18 this month' },
      { label: 'Pending review', value: '12', change: 'Needs attention', tone: 'warning' },
      { label: 'Completed', value: '94.2%', change: '+2.1%', tone: 'positive' },
    ],
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'name', label: 'Description' },
      { key: 'date', label: 'Date / location' },
      { key: 'amount', label: 'Amount / quantity', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    rows: [
      {
        reference: 'REC-00482',
        name: 'Lagos Head Office',
        date: '17 Aug 2026',
        amount: '₦2,500,000',
        status: 'Completed',
      },
      {
        reference: 'REC-00481',
        name: 'Abuja Operations',
        date: '16 Aug 2026',
        amount: '₦1,280,000',
        status: 'Pending review',
      },
      {
        reference: 'REC-00480',
        name: 'Main Warehouse',
        date: '15 Aug 2026',
        amount: '₦945,000',
        status: 'Active',
      },
      {
        reference: 'REC-00479',
        name: 'Marketing department',
        date: '14 Aug 2026',
        amount: '₦680,000',
        status: 'Approved',
      },
      {
        reference: 'REC-00478',
        name: 'Port Harcourt Branch',
        date: '12 Aug 2026',
        amount: '₦420,000',
        status: 'Draft',
      },
    ],
    filters: ['All records', 'This month', 'All branches'],
  };
}

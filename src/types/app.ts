import type { LucideIcon } from 'lucide-react';

export type MarketingView = 'platform' | 'solutions' | 'pricing' | 'security' | 'resources';

export type View =
  'landing' | MarketingView | 'login' | 'register' | 'forgot' | 'mfa' | 'onboarding' | 'app';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{ id: string; label: string }>;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export type TableRow = Record<string, string | number>;

export interface ModuleDefinition {
  title: string;
  description: string;
  action: string;
  stats: Array<{
    label: string;
    value: string;
    change?: string;
    tone?: 'positive' | 'warning' | 'danger';
  }>;
  columns: TableColumn[];
  rows: TableRow[];
  filters?: string[];
  tabs?: string[];
  emptyAction?: string;
}

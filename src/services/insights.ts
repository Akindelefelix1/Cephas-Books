import { authorizedRequest } from './auth';

export type InsightsView =
  'reports' | 'custom-reports' | 'analytics' | 'ai-assistant' | 'excel-sync';
export interface InsightMetrics {
  revenue: string;
  expenses: string;
  profit: string;
  receivables: string;
  payables: string;
  cash: string;
  inventoryValue: string;
  activeProjects: number;
}
export interface InsightReport {
  currency: string;
  range: { from: string | null; to: string | null };
  metrics: InsightMetrics;
  cashFlow: { moneyIn: string; moneyOut: string };
  invoiceStatus: Array<{ label: string; value: number }>;
  expenseCategories: Array<{ label: string; value: string }>;
  projects: { budget: string; actualCost: string; revenue: string };
}
export interface InsightAnalytics extends InsightReport {
  trend: Array<{ month: string; revenue: string; expenses: string }>;
}
export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  type: string;
  dateFrom?: string;
  dateTo?: string;
  isArchived: boolean;
  updatedAt: string;
}
export interface AiInsight {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}
export interface WorkbookConnection {
  id: string;
  name: string;
  dataSource: string;
  fileName?: string;
  direction: 'IMPORT' | 'EXPORT' | 'TWO_WAY';
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  rowsSynced: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}
const query = (filters: Record<string, string> = {}) =>
  new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
const req = <T>(path: string, method = 'GET', body?: object) =>
  authorizedRequest<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
export const insightsApi = {
  reports: (filters = {}) => req<InsightReport>(`/insights/reports?${query(filters)}`),
  analytics: (filters = {}) => req<InsightAnalytics>(`/insights/analytics?${query(filters)}`),
  savedReports: (archived = '') =>
    req<SavedReport[]>(`/insights/saved-reports?${query({ archived })}`),
  createReport: (data: object) => req<SavedReport>('/insights/saved-reports', 'POST', data),
  reportStatus: (id: string, isArchived: boolean) =>
    req<SavedReport>(`/insights/saved-reports/${id}`, 'PATCH', { isArchived }),
  deleteReport: (id: string) =>
    req<{ deleted: boolean }>(`/insights/saved-reports/${id}`, 'DELETE'),
  aiHistory: () => req<AiInsight[]>('/insights/ai/history'),
  askAi: (question: string) => req<AiInsight>('/insights/ai/query', 'POST', { question }),
  clearAi: () => req<{ deleted: number }>('/insights/ai/history', 'DELETE'),
  workbooks: () => req<WorkbookConnection[]>('/insights/workbooks'),
  createWorkbook: (data: object) => req<WorkbookConnection>('/insights/workbooks', 'POST', data),
  workbookStatus: (id: string, status: string) =>
    req<WorkbookConnection>(`/insights/workbooks/${id}/status`, 'PATCH', { status }),
  runSync: (id: string, data: object = {}) =>
    req<WorkbookConnection>(`/insights/workbooks/${id}/run`, 'POST', data),
  deleteWorkbook: (id: string) => req<{ deleted: boolean }>(`/insights/workbooks/${id}`, 'DELETE'),
};

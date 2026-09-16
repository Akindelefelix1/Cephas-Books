import { authorizedRequest } from './auth';
export type WorkflowView = 'documents' | 'approvals' | 'notifications' | 'workflows';
export interface WorkflowSummary {
  documents: number;
  pendingApprovals: number;
  unreadNotifications: number;
  activeRules: number;
  runs: number;
  failures: number;
}
export interface DocumentRecord {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  linkedType?: string;
  linkedReference?: string;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}
export interface ApprovalRequest {
  id: string;
  title: string;
  entityType: string;
  entityId?: string;
  reference: string;
  amount?: string;
  requestedBy: string;
  assignedRole: string;
  status: string;
  notes?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
}
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  relatedType?: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}
export interface WorkflowRule {
  id: string;
  name: string;
  event: string;
  condition: string;
  action: string;
  status: 'ACTIVE' | 'PAUSED';
  runCount: number;
  failureCount: number;
  lastRunAt?: string;
}
const query = (filters: Record<string, string> = {}) =>
  new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
const req = <T>(path: string, method = 'GET', body?: object) =>
  authorizedRequest<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
export const workflowApi = {
  summary: () => req<WorkflowSummary>('/workflow/summary'),
  documents: (filters = {}) => req<DocumentRecord[]>(`/workflow/documents?${query(filters)}`),
  createDocument: (data: object) => req<DocumentRecord>('/workflow/documents', 'POST', data),
  downloadDocument: (id: string) =>
    req<{ name: string; mimeType: string; contentBase64: string }>(
      `/workflow/documents/${id}/download`,
    ),
  documentStatus: (id: string, status: string) =>
    req<{ id: string; status: string }>(`/workflow/documents/${id}/status`, 'PATCH', { status }),
  deleteDocument: (id: string) => req<{ deleted: boolean }>(`/workflow/documents/${id}`, 'DELETE'),
  approvals: (filters = {}) => req<ApprovalRequest[]>(`/workflow/approvals?${query(filters)}`),
  createApproval: (data: object) => req<ApprovalRequest>('/workflow/approvals', 'POST', data),
  decideApproval: (id: string, data: object) =>
    req<ApprovalRequest>(`/workflow/approvals/${id}/decision`, 'PATCH', data),
  notifications: (filters = {}) =>
    req<AppNotification[]>(`/workflow/notifications?${query(filters)}`),
  createNotification: (data: object) =>
    req<AppNotification>('/workflow/notifications', 'POST', data),
  readNotification: (id: string, isRead = true) =>
    req<AppNotification>(`/workflow/notifications/${id}/read`, 'PATCH', { isRead }),
  readAll: () => req<{ updated: number }>('/workflow/notifications/read-all', 'PATCH'),
  rules: (filters = {}) => req<WorkflowRule[]>(`/workflow/rules?${query(filters)}`),
  createRule: (data: object) => req<WorkflowRule>('/workflow/rules', 'POST', data),
  ruleStatus: (id: string, status: string) =>
    req<WorkflowRule>(`/workflow/rules/${id}/status`, 'PATCH', { status }),
  runRule: (id: string) => req<WorkflowRule>(`/workflow/rules/${id}/run`, 'POST'),
  deleteRule: (id: string) => req<{ deleted: boolean }>(`/workflow/rules/${id}`, 'DELETE'),
};

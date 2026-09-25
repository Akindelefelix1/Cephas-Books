import { authorizedRequest } from './auth';

export type OrganizationView =
  'branches' | 'currencies' | 'users' | 'audit-logs' | 'integrations' | 'security' | 'settings';

export type OrganizationSection =
  'profile' | 'branches' | 'currencies' | 'security' | 'integrations' | 'preferences';

export interface OrganizationAdmin {
  organization: {
    id: string;
    name: string;
    baseCurrency: string;
    countryCode: string;
    updatedAt: string;
  };
  settings: Record<string, unknown>;
}

export interface OrganizationMember {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    verifiedAt?: string;
  };
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  actor?: { email: string; firstName?: string; lastName?: string };
}

export interface LocationActivity {
  kind: string;
  branchIds: string[];
  total: number;
  data: Array<{
    id: string;
    label?: string;
    description?: string;
    displayName?: string;
    recordType?: string;
    amount?: string;
    status?: string;
    type?: string;
    date?: string;
  }>;
}

const request = <T>(path: string, method = 'GET', body?: object) =>
  authorizedRequest<T>(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

export const organizationApi = {
  admin: () => request<OrganizationAdmin>('/organizations/current/admin'),
  updateOrganization: (data: { name?: string; baseCurrency?: string; countryCode?: string }) =>
    request<OrganizationAdmin['organization']>('/organizations/current', 'PATCH', data),
  updateSection: (section: OrganizationSection, data: Record<string, unknown>) =>
    request<{ section: string; data: Record<string, unknown>; updatedAt: string }>(
      `/organizations/current/admin/${section}`,
      'PATCH',
      { data },
    ),
  users: () => request<OrganizationMember[]>('/organizations/current/users'),
  inviteUser: (data: { email: string; role: string }) =>
    request<OrganizationMember>('/organizations/current/users', 'POST', data),
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) =>
    request<OrganizationMember>(`/organizations/current/users/${id}`, 'PATCH', data),
  auditLogs: (search = '') =>
    request<AuditEntry[]>(
      `/organizations/current/audit-logs?${new URLSearchParams(search ? { search } : {})}`,
    ),
  locationActivity: (type: 'state' | 'region' | 'branch', id: string, kind: string) =>
    request<LocationActivity>(
      `/organizations/current/locations/${type}/${id}/activity?${new URLSearchParams({ kind })}`,
    ),
};

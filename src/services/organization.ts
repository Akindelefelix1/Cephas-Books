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
  customRoleId?: string;
  customRole?: CustomRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    isActive: boolean;
    verifiedAt?: string;
  };
}

export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  baseRole: string;
  permissions: string[];
  _count?: { memberships: number };
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
  inviteUser: (data: {
    email: string;
    role: string;
    customRoleId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
  }) => request<OrganizationMember>('/organizations/current/users', 'POST', data),
  updateUser: (
    id: string,
    data: {
      role?: string;
      customRoleId?: string;
      isActive?: boolean;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
    },
  ) => request<OrganizationMember>(`/organizations/current/users/${id}`, 'PATCH', data),
  roles: () => request<CustomRole[]>('/organizations/current/roles'),
  createRole: (data: Omit<CustomRole, 'id' | '_count'>) =>
    request<CustomRole>('/organizations/current/roles', 'POST', data),
  updateRole: (id: string, data: Omit<CustomRole, 'id' | '_count'>) =>
    request<CustomRole>(`/organizations/current/roles/${id}`, 'PATCH', data),
  deleteRole: (id: string) =>
    request<{ deleted: true }>(`/organizations/current/roles/${id}`, 'DELETE'),
  auditLogs: (search = '') =>
    request<AuditEntry[]>(
      `/organizations/current/audit-logs?${new URLSearchParams(search ? { search } : {})}`,
    ),
  locationActivity: (type: 'state' | 'region' | 'branch', id: string, kind: string) =>
    request<LocationActivity>(
      `/organizations/current/locations/${type}/${id}/activity?${new URLSearchParams({ kind })}`,
    ),
};

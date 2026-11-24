import { notifyError } from '@/utils/actions';
import { activateOfflineMode, cacheBulkWorkspace, clearOfflineApiSnapshots, deactivateOfflineMode, enqueueOfflineWrite, getOfflineBulkSnapshot, getOfflineQueue, getOfflineSnapshot, isWorkingOffline, removeOfflineWrite, saveOfflineSnapshot, type OfflineSnapshot } from './offline';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'https://cephasbooks-be.onrender.com/api'
).replace(/\/$/, '');

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  organizationName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface VerificationPending {
  email: string;
  verificationRequired: true;
  expiresIn: number;
}

export interface CurrentUserProfile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  createdAt: string;
  isActive: boolean;
  role: string;
  customRoleId?: string;
  permissions: string[];
  organization: {
    name: string;
    baseCurrency: string;
    countryCode: string;
  };
}

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
    // Transport/offline errors are commonly handled by the calling screen
    // (for example, POS stores a local receipt). Showing a global toast here
    // reports those handled fallbacks as failures.
    if (status !== 0) notifyError(message);
  }
}

function formatApiMessage(message: string): string {
  const unsupported = message.match(/^property (.+) should not exist$/i);
  if (unsupported) return `The request included an unsupported field: ${unsupported[1]}.`;
  const normalized = message.trim();
  if (!normalized) return '';
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function errorMessage(body?: ApiErrorBody): string | undefined {
  const messages = Array.isArray(body?.message)
    ? body.message
    : body?.message
      ? [body.message]
      : [];
  const formatted = messages.map(formatApiMessage).filter(Boolean).join(' ');
  return formatted || (body?.error ? formatApiMessage(body.error) : undefined);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
  }

  const payload = (await response.json().catch(() => null)) as ApiErrorBody | T | null;
  if (!response.ok) {
    const errorBody =
      payload && typeof payload === 'object' ? (payload as ApiErrorBody) : undefined;
    const message = errorMessage(errorBody);
    throw new ApiError(message || 'Something went wrong. Please try again.', response.status);
  }

  return payload as T;
}

export const authApi = {
  register: (input: RegisterInput) => post<VerificationPending>('/auth/register', input),
  login: (input: LoginInput) => post<AuthTokens>('/auth/login', input),
  verifyEmail: (email: string, code: string) =>
    post<AuthTokens>('/auth/verify-email', { email, code }),
  resendVerification: (email: string) =>
    post<{ message: string; expiresIn: number }>('/auth/resend-verification', { email }),
  refresh: (refreshToken: string) => post<AuthTokens>('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => post<void>('/auth/logout', { refreshToken }),
  me: () => authorizedRequest<CurrentUserProfile>('/auth/me'),
  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    authorizedRequest<CurrentUserProfile>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    authorizedRequest<{ changed: true; passwordChangedAt: string }>('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

const TOKEN_KEY = 'cephas:auth';
export const AUTH_EXPIRED_EVENT = 'cephas:auth-expired';
let refreshPromise: Promise<AuthTokens> | null = null;
const responseCache = new Map<string, unknown>();
const pendingRequests = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;
let cacheIdentity = '';

export function clearApiCache(): void {
  cacheGeneration += 1;
  responseCache.clear();
  pendingRequests.clear();
}

function sessionIdentity(accessToken: string): string {
  try {
    const payload = accessToken.split('.')[1];
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    const organization = claims.organizationId ?? claims.organization ?? claims.orgId ?? '';
    return `${String(organization)}:${String(claims.sub ?? '')}`;
  } catch {
    return accessToken;
  }
}

function synchronizeCacheIdentity(accessToken: string): void {
  const identity = sessionIdentity(accessToken);
  if (cacheIdentity && cacheIdentity !== identity) clearApiCache();
  cacheIdentity = identity;
}

function expireSession(): void {
  clearAuthTokens();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function saveAuthTokens(tokens: AuthTokens, remember: boolean): void {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  target.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  deactivateOfflineMode();
  clearStoredPosCatalogs();
  cacheIdentity = '';
  clearApiCache();
}

function clearStoredPosCatalogs(): void {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith('cephas:pos-catalog:')) sessionStorage.removeItem(key);
  }
}

export function getAuthCacheIdentity(): string {
  const tokens = getAuthTokens();
  if (!tokens) return '';
  synchronizeCacheIdentity(tokens.accessToken);
  return cacheIdentity;
}

export async function logoutSession(): Promise<void> {
  if (!navigator.onLine || localStorage.getItem('cephas:offline-active') === 'true') {
    clearAuthTokens();
    return;
  }
  const refreshToken = getAuthTokens()?.refreshToken;
  try {
    if (refreshToken) await authApi.logout(refreshToken);
  } finally {
    clearAuthTokens();
  }
}

function refreshSession(refreshToken: string): Promise<AuthTokens> {
  if (!refreshPromise) {
    refreshPromise = authApi.refresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function getAuthTokens(): AuthTokens | null {
  const raw = sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    clearAuthTokens();
    return null;
  }
}

export function hasAuthTokens(): boolean {
  return getAuthTokens() !== null;
}

async function performAuthorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let tokens = getAuthTokens();
  if (!tokens) {
    expireSession();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const activeBranchId = localStorage.getItem('cephas:active-branch');
  const branchScopedCreate =
    init.method === 'POST' &&
    /^\/(customers|invoices|sales\/(quotations|payments|credit-notes)|pos\/sales|banking\/transactions(?:\/bulk)?|purchases\/(suppliers|requests|orders|bills|payments|expenses))$/.test(
      path,
    );
  let requestBody = init.body;
  if (activeBranchId && branchScopedCreate && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      requestBody = JSON.stringify({
        ...body,
        branchId: typeof body.branchId === 'string' ? body.branchId : activeBranchId,
      });
    } catch {
      requestBody = init.body;
    }
  }
  const send = (accessToken: string) =>
    fetch(`${API_BASE_URL}/v1${path}`, {
      ...init,
      body: requestBody,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    }).catch(() => {
      throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
    });

  let response = await send(tokens.accessToken);
  if (response.status === 401) {
    try {
      const remember = localStorage.getItem(TOKEN_KEY) !== null;
      tokens = await refreshSession(tokens.refreshToken);
      saveAuthTokens(tokens, remember);
      response = await send(tokens.accessToken);
    } catch {
      expireSession();
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
  }

  // A successful refresh can still be rejected when the user or organisation was
  // disabled while the session was open. Treat that as an expired session too.
  if (response.status === 401) {
    expireSession();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const payload = (await response.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!response.ok) {
    const errorBody =
      payload && typeof payload === 'object' ? (payload as ApiErrorBody) : undefined;
    const message = errorMessage(errorBody);
    throw new ApiError(message || 'Something went wrong. Please try again.', response.status);
  }
  return payload as T;
}

async function resolveOfflineRead<T>(
  path: string,
  key: string,
  identity: string,
): Promise<{ found: true; value: T } | { found: false }> {
  const snapshotKey = `api:${key}`;
  const savedKey = `cephas:offline:${snapshotKey}`;
  const savedRaw = localStorage.getItem(savedKey);
  if (savedRaw !== null) {
    try {
      return { found: true, value: JSON.parse(savedRaw) as T };
    } catch {
      localStorage.removeItem(savedKey);
    }
  }

  const bulk = await getOfflineBulkSnapshot();
  if (
    !bulk || bulk.version !== 1 || !bulk.resources ||
    `${bulk.organizationId}:${bulk.userId}` !== identity
  ) return { found: false };

  const basePath = path.split('?')[0];
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  const page = Math.max(1, Number(query.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 100));
  const pageResponse = (rows: unknown[]) => ({
    data: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
  });

  if (basePath === '/customers') {
    const source = bulk.resources['/customers?limit=100&search='] as { data?: Array<Record<string, unknown>> } | undefined;
    if (source && Array.isArray(source.data)) {
      const search = query.get('search')?.toLowerCase() ?? '';
      const filtered = source.data.filter((row) => !search || String(row.displayName ?? '').toLowerCase().includes(search));
      const response = pageResponse(filtered);
      return { found: true, value: { data: response.data, meta: { page, limit, total: filtered.length, pages: response.meta.totalPages } } as T };
    }
  }

  if (basePath === '/pos/sales') {
    const sourcePath = query.get('includeVoided') === 'true'
      ? '/pos/sales?includeVoided=true&limit=100&page=1'
      : '/pos/sales?limit=100&page=1';
    const source = bulk.resources[sourcePath] as { data?: Array<Record<string, unknown>> } | undefined;
    if (source && Array.isArray(source.data)) {
      const from = query.get('from');
      const to = query.get('to');
      const customerId = query.get('customerId');
      const search = query.get('search')?.toLowerCase() ?? '';
      const filtered = source.data.filter((sale) => {
        const createdAt = new Date(String(sale.createdAt ?? '')).getTime();
        const customer = sale.customer as Record<string, unknown> | null;
        return (!from || createdAt >= new Date(from).getTime()) &&
          (!to || createdAt < new Date(`${to}T23:59:59.999`).getTime() + 1) &&
          (!customerId || sale.customerId === customerId) &&
          (!search || `${sale.receiptNumber ?? ''} ${customer?.displayName ?? ''}`.toLowerCase().includes(search));
      });
      return { found: true, value: pageResponse(filtered) as T };
    }
  }

  if (basePath === '/banking/transactions' || basePath === '/banking/transactions/export') {
    const source = bulk.resources['/banking/transactions?'] as { data?: Array<Record<string, unknown>> } | undefined;
    if (source && Array.isArray(source.data)) {
      const filtered = source.data.filter((transaction) => {
        const account = transaction.bankAccount as Record<string, unknown> | undefined;
        const search = query.get('search')?.toLowerCase() ?? '';
        const date = new Date(String(transaction.transactionDate ?? '')).getTime();
        const to = query.get('to');
        return (!query.get('accountId') || transaction.bankAccountId === query.get('accountId')) &&
          (!query.get('type') || transaction.type === query.get('type')) &&
          (!query.get('status') || transaction.reconciliationStatus === query.get('status')) &&
          (!query.get('from') || date >= new Date(query.get('from')!).getTime()) &&
          (!to || date < new Date(`${to}T23:59:59.999`).getTime() + 1) &&
          (!search || `${transaction.name ?? ''} ${transaction.description ?? ''} ${transaction.reference ?? ''} ${account?.name ?? ''}`.toLowerCase().includes(search));
      });
      if (basePath === '/banking/transactions/export') {
        const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = filtered.map((transaction) => {
          const account = transaction.bankAccount as Record<string, unknown> | undefined;
          return [
            String(transaction.transactionDate ?? '').slice(0, 10),
            account?.name,
            transaction.description,
            transaction.reference,
            transaction.type,
            transaction.amount,
            transaction.balanceAfter,
            transaction.reconciliationStatus,
          ].map(escape).join(',');
        });
        return {
          found: true,
          value: {
            filename: `bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
            csv: ['Date,Account,Description,Reference,Type,Amount,Balance,Status', ...rows].join('\n'),
          } as T,
        };
      }
      const response = pageResponse(filtered);
      return { found: true, value: { data: response.data, meta: { page, limit, total: filtered.length, pages: response.meta.totalPages } } as T };
    }
  }

  if (basePath === '/operations/products-page') {
    const source = bulk.resources['/operations/products?'];
    const rows = Array.isArray(source) ? source as Array<Record<string, unknown>> : [];
    const search = query.get('search')?.toLowerCase() ?? '';
    const status = query.get('status') ?? '';
    const category = query.get('category')?.toLowerCase() ?? '';
    const filtered = rows.filter((row) => {
      const matchesSearch = !search || [row.name, row.sku, row.category].some((value) => String(value ?? '').toLowerCase().includes(search));
      const matchesStatus = status === 'active' ? row.isActive === true : status === 'archived' ? row.isActive === false : status === 'low_stock' ? Number(row.stockQuantity) > 0 && Number(row.stockQuantity) <= Number(row.reorderLevel) : status === 'out_of_stock' ? Number(row.stockQuantity) <= 0 : true;
      const matchesCategory = !category || String(row.category ?? '').toLowerCase() === category;
      return matchesSearch && matchesStatus && matchesCategory;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    return { found: true, value: { data: filtered.slice((page - 1) * limit, page * limit), meta: { page, limit, total: filtered.length, totalPages } } as T };
  }

  if (Object.prototype.hasOwnProperty.call(bulk.resources, path))
    return { found: true, value: bulk.resources[path] as T };

  const receiptMatch = basePath.match(/^\/pos\/sales\/([^/]+)\/receipt$/);
  if (receiptMatch) {
    const sales = bulk.resources['/pos/sales?limit=100&page=1'] as { data?: Array<Record<string, unknown>> } | undefined;
    const sale = sales?.data?.find((row) => row.id === decodeURIComponent(receiptMatch[1]));
    if (sale) return { found: true, value: sale as T };
  }

  const auditMatch = basePath.match(/^\/pos\/sales\/([^/]+)\/audit$/);
  if (auditMatch) {
    const sales = bulk.resources['/pos/sales?limit=100&page=1'] as { data?: Array<Record<string, unknown>> } | undefined;
    const saleId = decodeURIComponent(auditMatch[1]);
    const sale = sales?.data?.find((row) => row.id === saleId);
    const audit = bulk.resources['/pos/audit'];
    if (sale && Array.isArray(audit)) {
      const returnIds = Array.isArray(sale.returns)
        ? sale.returns.map((item) => String((item as Record<string, unknown>).id ?? ''))
        : [];
      return {
        found: true,
        value: audit.filter((entry) => {
          const row = entry as Record<string, unknown>;
          return (row.entityType === 'PosSale' && row.entityId === saleId) ||
            (row.entityType === 'PosReturn' && returnIds.includes(String(row.entityId ?? '')));
        }) as T,
      };
    }
  }

  const activityMatch = basePath.match(/^\/organizations\/current\/locations\/(state|region|branch)\/([^/]+)\/activity$/);
  if (activityMatch) {
    const locationType = activityMatch[1];
    const locationId = decodeURIComponent(activityMatch[2]);
    const kind = query.get('kind') || 'transactions';
    const admin = bulk.resources['/organizations/current/admin'] as {
      settings?: { branches?: Record<string, unknown> };
    } | undefined;
    const structure = admin?.settings?.branches;
    const hierarchy = structure?.hierarchy as { levels?: number } | undefined;
    if (structure) {
      const states = Array.isArray(structure.states) ? structure.states as Array<Record<string, unknown>> : [];
      const regions = Array.isArray(structure.regions) ? structure.regions as Array<Record<string, unknown>> : [];
      const branches = Array.isArray(structure.items) ? structure.items as Array<Record<string, unknown>> : [];
      const exists = locationType === 'state'
        ? states.some((row) => row.id === locationId)
        : locationType === 'region'
          ? regions.some((row) => row.id === locationId)
          : branches.some((row) => row.id === locationId);
      if (exists) {
        const regionIds = locationType === 'state'
          ? hierarchy?.levels === 2
            ? [locationId]
            : regions.filter((row) => row.stateId === locationId).map((row) => String(row.id))
          : locationType === 'region' ? [locationId] : [];
        const branchIds = locationType === 'branch'
          ? [locationId]
          : branches.filter((row) => regionIds.includes(String(row.regionId))).map((row) => String(row.id));
        const sourceRows = (resourcePath: string): Array<Record<string, unknown>> | null => {
          const resource = bulk.resources[resourcePath] as unknown;
          if (Array.isArray(resource)) return resource as Array<Record<string, unknown>>;
          if (resource && typeof resource === 'object' && Array.isArray((resource as { data?: unknown }).data))
            return (resource as { data: Array<Record<string, unknown>> }).data;
          return null;
        };
        const resourcePath = kind === 'transactions' ? '/banking/transactions?'
          : kind === 'sales' ? '/pos/sales?includeVoided=true&limit=100&page=1'
            : kind === 'customers' ? '/customers?limit=100&search='
              : kind === 'purchases' ? '/purchases/orders?search=&status='
                : kind === 'invoices' ? '/invoices' : '';
        const rows = resourcePath ? sourceRows(resourcePath) : null;
        if (rows) {
          let data = rows.filter((row) => branchIds.includes(String(row.branchId ?? '')));
          if (kind === 'transactions') data = data.map((row) => ({ ...row, date: row.transactionDate }));
          else if (kind === 'sales') data = data.map((row) => ({ ...row, label: row.receiptNumber, amount: row.total, date: row.createdAt }));
          else if (kind === 'customers') data = data.map((row) => ({ ...row, label: row.displayName, date: row.createdAt }));
          else if (kind === 'purchases') {
            const expenses = sourceRows('/purchases/expenses?search=&status=') ?? [];
            data = [
              ...data.map((row) => ({ ...row, label: row.number, amount: row.total, date: row.orderDate, recordType: 'Purchase order' })),
              ...expenses.filter((row) => branchIds.includes(String(row.branchId ?? ''))).map((row) => ({ ...row, label: row.reference, date: row.expenseDate, recordType: 'Expense' })),
            ];
          } else if (kind === 'invoices') data = data.map((row) => ({ ...row, label: row.number, amount: row.total, date: row.issueDate }));
          data.sort((a, b) => new Date(String(b.date ?? '')).getTime() - new Date(String(a.date ?? '')).getTime());
          return {
            found: true,
            value: { kind, branchIds, total: data.length, data: data.slice(0, 100) } as T,
          };
        }
      }
    }
  }

  const compatiblePath = Object.keys(bulk.resources).find((resourcePath) =>
    resourcePath === basePath || resourcePath.startsWith(`${basePath}?`),
  );
  if (compatiblePath) {
    const resource = bulk.resources[compatiblePath];
    if (Array.isArray(resource)) {
      const search = query.get('search')?.toLowerCase() ?? '';
      const status = query.get('status') ?? '';
      const type = query.get('type') ?? '';
      const unread = query.get('unread');
      const archived = query.get('archived');
      const filtered = resource.filter((value) => {
        const row = value as Record<string, unknown>;
        return (!search || JSON.stringify(row).toLowerCase().includes(search)) &&
          (!status || row.status === status || (status === 'active' && row.isActive === true) || (status === 'archived' && row.isActive === false)) &&
          (!type || row.type === type) &&
          (!unread || row.isRead === (unread !== 'true')) &&
          (!archived || row.isArchived === (archived === 'true'));
      });
      return { found: true, value: filtered as T };
    }
    return { found: true, value: resource as T };
  }
  return { found: false };
}

export async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const tokens = getAuthTokens();
  if (tokens) synchronizeCacheIdentity(tokens.accessToken);

  if (method !== 'GET') {
    if (isWorkingOffline()) {
      // POS has an idempotent sale outbox and builds a local receipt. Let its
      // screen own this fallback instead of placing the sale in the generic
      // write queue as well.
      if (path === '/pos/sales')
        throw new ApiError('Sale saved on this device and will sync when you are online.', 0);
      let queuedBody = typeof init.body === 'string' ? init.body : undefined;
      if (
        queuedBody &&
        method === 'POST' &&
        /^\/(customers|invoices|sales\/(quotations|payments|credit-notes)|pos\/sales|banking\/transactions(?:\/bulk)?|purchases\/(suppliers|requests|orders|bills|payments|expenses))$/.test(path)
      ) {
        try {
          const body = JSON.parse(queuedBody) as Record<string, unknown>;
          const branchId = localStorage.getItem('cephas:active-branch');
          if (branchId && typeof body.branchId !== 'string') {
            body.branchId = branchId;
            queuedBody = JSON.stringify(body);
          }
        } catch {
          // Keep the original request body so the regular sync path can surface
          // any validation error without losing the queued write.
        }
      }
      enqueueOfflineWrite(path, method, queuedBody);
      return { queuedOffline: true } as T;
    }
    const payload = await performAuthorizedRequest<T>(path, init);
    if (
      /^\/operations\/(products|movements|transfers|adjustments)(?:\/|\?|$)/.test(path) ||
      /^\/pos\/sales\/[^/]+\/(returns|void)(?:\/|\?|$)/.test(path)
    )
      clearStoredPosCatalogs();
    clearApiCache();
    // A cached GET may otherwise resurrect pre-mutation data when the device
    // later loses connectivity. Keep the consented bulk snapshot as the
    // offline baseline, but discard exact responses that are now stale.
    clearOfflineApiSnapshots();
    return payload;
  }

  const branchId = localStorage.getItem('cephas:active-branch') ?? '';
  const key = `${cacheIdentity}:${branchId}:${path}`;
  if (isWorkingOffline()) {
    const local = await resolveOfflineRead<T>(path, key, cacheIdentity);
    if (local.found) return local.value;
    const savedKey = `cephas:offline:api:${key}`;
    const savedRaw = localStorage.getItem(savedKey);
    if (savedRaw !== null) {
      try {
        return JSON.parse(savedRaw) as T;
      } catch {
        localStorage.removeItem(savedKey);
      }
    }
    const bulk = await getOfflineBulkSnapshot();
    if (
      bulk?.version === 1 &&
      bulk.resources &&
      `${bulk.organizationId}:${bulk.userId}` === cacheIdentity
    ) {
      const basePath = path.split('?')[0];
      const query = new URLSearchParams(path.split('?')[1] ?? '');
      const page = Math.max(1, Number(query.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 100));
      const pageResponse = (rows: unknown[]) => ({
        data: rows.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
      });

      if (basePath === '/customers') {
        const source = bulk.resources['/customers?limit=100&search='] as { data?: Array<Record<string, unknown>> } | undefined;
        const search = query.get('search')?.toLowerCase() ?? '';
        if (source && Array.isArray(source.data)) {
          const filtered = source.data.filter((row) => !search || String(row.displayName ?? '').toLowerCase().includes(search));
          const response = pageResponse(filtered);
          return { data: response.data, meta: { page, limit, total: filtered.length, pages: response.meta.totalPages } } as T;
        }
      }

      if (basePath === '/pos/sales') {
        const sourcePath = query.get('includeVoided') === 'true'
          ? '/pos/sales?includeVoided=true&limit=100&page=1'
          : '/pos/sales?limit=100&page=1';
        const source = bulk.resources[sourcePath] as { data?: Array<Record<string, unknown>> } | undefined;
        if (source && Array.isArray(source.data)) {
          const from = query.get('from');
          const to = query.get('to');
          const customerId = query.get('customerId');
          const search = query.get('search')?.toLowerCase() ?? '';
          const filtered = source.data.filter((sale) => {
            const createdAt = new Date(String(sale.createdAt ?? '')).getTime();
            const customer = sale.customer as Record<string, unknown> | null;
            return (!from || createdAt >= new Date(from).getTime()) &&
              (!to || createdAt < new Date(`${to}T23:59:59.999`).getTime() + 1) &&
              (!customerId || sale.customerId === customerId) &&
              (!search || `${sale.receiptNumber ?? ''} ${customer?.displayName ?? ''}`.toLowerCase().includes(search));
          });
          return pageResponse(filtered) as T;
        }
      }

      if (basePath === '/banking/transactions') {
        const status = query.get('status');
        const sourcePath = status === 'UNRECONCILED'
          ? '/banking/transactions?status=UNRECONCILED'
          : '/banking/transactions?';
        const source = (bulk.resources[sourcePath] ?? bulk.resources['/banking/transactions?']) as { data?: Array<Record<string, unknown>> } | undefined;
        if (source && Array.isArray(source.data)) {
          const filtered = source.data.filter((transaction) => {
            const account = transaction.bankAccount as Record<string, unknown> | undefined;
            const search = query.get('search')?.toLowerCase() ?? '';
            const date = new Date(String(transaction.transactionDate ?? '')).getTime();
            const to = query.get('to');
            return (!query.get('accountId') || transaction.bankAccountId === query.get('accountId')) &&
              (!query.get('type') || transaction.type === query.get('type')) &&
              (!query.get('status') || transaction.reconciliationStatus === query.get('status')) &&
              (!query.get('from') || date >= new Date(query.get('from')!).getTime()) &&
              (!to || date < new Date(`${to}T23:59:59.999`).getTime() + 1) &&
              (!search || `${transaction.name ?? ''} ${transaction.description ?? ''} ${transaction.reference ?? ''} ${account?.name ?? ''}`.toLowerCase().includes(search));
          });
          const response = pageResponse(filtered);
          return { data: response.data, meta: { page, limit, total: filtered.length, pages: response.meta.totalPages } } as T;
        }
      }

      if (basePath === '/operations/products-page') {
        const source = bulk.resources['/operations/products?'];
        const rows = Array.isArray(source) ? source as Array<Record<string, unknown>> : [];
        const search = query.get('search')?.toLowerCase() ?? '';
        const status = query.get('status') ?? '';
        const category = query.get('category')?.toLowerCase() ?? '';
        const filtered = rows.filter((row) => {
          const matchesSearch = !search || [row.name, row.sku, row.category].some((value) => String(value ?? '').toLowerCase().includes(search));
          const matchesStatus = status === 'active' ? row.isActive === true : status === 'archived' ? row.isActive === false : status === 'low_stock' ? Number(row.stockQuantity) > 0 && Number(row.stockQuantity) <= Number(row.reorderLevel) : status === 'out_of_stock' ? Number(row.stockQuantity) <= 0 : true;
          const matchesCategory = !category || String(row.category ?? '').toLowerCase() === category;
          return matchesSearch && matchesStatus && matchesCategory;
        });
        const page = Math.max(1, Number(query.get('page')) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 15));
        const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
        return {
          data: filtered.slice((page - 1) * limit, page * limit),
          meta: { page, limit, total: filtered.length, totalPages },
        } as T;
      }
      if (Object.prototype.hasOwnProperty.call(bulk.resources, path))
        return bulk.resources[path] as T;
      const compatiblePath = Object.keys(bulk.resources).find((resourcePath) =>
        resourcePath === basePath || resourcePath.startsWith(`${basePath}?`),
      );
      if (compatiblePath) {
        const resource = bulk.resources[compatiblePath];
        if (Array.isArray(resource)) {
          const search = query.get('search')?.toLowerCase() ?? '';
          const status = query.get('status') ?? '';
          const type = query.get('type') ?? '';
          const unread = query.get('unread');
          const archived = query.get('archived');
          return resource.filter((value) => {
            const row = value as Record<string, unknown>;
            return (!search || JSON.stringify(row).toLowerCase().includes(search)) &&
              (!status || row.status === status || (status === 'active' && row.isActive === true) || (status === 'archived' && row.isActive === false)) &&
              (!type || row.type === type) &&
              (!unread || row.isRead === (unread !== 'true')) &&
              (!archived || row.isArchived === (archived === 'true'));
          }) as T;
        }
        return resource as T;
      }
    }
    const saved = getOfflineSnapshot<T>(`api:${key}`);
    if (saved !== null) return saved;
    throw new ApiError('This section has not been saved for offline use on this device yet.', 0);
  }
  if (responseCache.has(key)) return responseCache.get(key) as T;

  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;

  const generation = cacheGeneration;
  const request = performAuthorizedRequest<T>(path, init)
    .then((payload) => {
      if (generation === cacheGeneration) responseCache.set(key, payload);
      if (path !== '/offline/snapshot') saveOfflineSnapshot(`api:${key}`, payload);
      return payload;
    })
    .catch(async (caught) => {
      if (caught instanceof ApiError && caught.status === 0) {
        activateOfflineMode();
        const local = await resolveOfflineRead<T>(path, key, cacheIdentity);
        if (local.found) return local.value;
      }
      throw caught;
    })
    .finally(() => {
      if (pendingRequests.get(key) === request) pendingRequests.delete(key);
    });
  pendingRequests.set(key, request);
  return request;
}

export async function syncOfflineChanges(): Promise<void> {
  for (const item of getOfflineQueue()) {
    await performAuthorizedRequest(item.path, { method: item.method, body: item.body });
    removeOfflineWrite(item.id);
  }
  deactivateOfflineMode();
  clearApiCache();
  clearOfflineApiSnapshots();
}

export async function refreshOfflineWorkspace(): Promise<void> {
  clearApiCache();
  const snapshot = await authorizedRequest<OfflineSnapshot>('/offline/snapshot');
  await cacheBulkWorkspace(snapshot);
  clearOfflineApiSnapshots();
}

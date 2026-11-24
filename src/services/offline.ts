const PREFIX = 'cephas:offline:';
const QUEUE_PREFIX = 'cephas:offline-write-queue:';
const LEGACY_QUEUE_KEY = 'cephas:offline-write-queue';

export type OfflineWrite = { id: string; path: string; method: string; body?: string; queuedAt: string };
export interface OfflineSnapshot {
  version: number;
  exportedAt: string;
  organizationId: string;
  userId: string;
  resourceCount: number;
  resources: Record<string, unknown>;
}
export interface OfflineAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Common workspace reads used by the dashboard and every business area. */
export const OFFLINE_WORKSPACE_READS = [
  '/organizations/current/onboarding', '/organizations/current/admin',
  '/organizations/current/users', '/organizations/current/roles',
  '/organizations/current/audit-logs', '/sales/summary',
  '/customers?limit=100&search=', '/invoices', '/invoices/next-number',
  '/sales/quotations?', '/sales/quotations/next-number', '/sales/payments?',
  '/sales/credit-notes?', '/sales/receivables?', '/purchases/summary',
  '/purchases/suppliers?search=&status=', '/purchases/requests?search=&status=',
  '/purchases/orders?search=&status=', '/purchases/bills?search=&status=',
  '/purchases/goods-received-notes?search=&status=',
  '/purchases/payments?search=&status=', '/purchases/payables?search=&status=',
  '/purchases/expenses?search=&status=', '/operations/summary', '/operations/branch-inventory',
  '/operations/products?', '/operations/products-page?', '/operations/product-categories',
  '/operations/warehouses?', '/operations/movements?', '/operations/adjustments?',
  '/operations/projects?', '/accounting/accounts?includeArchived=false',
  '/accounting/accounts?includeArchived=true', '/accounting/journals?search=',
  '/accounting/ledger?accountId=', '/accounting/trial-balance',
  '/accounting/records/ASSET?search=', '/accounting/records/BUDGET?search=',
  '/accounting/records/TAX?search=', '/accounting/records/PAYROLL?search=',
  '/banking/summary', '/banking/accounts?includeArchived=false',
  '/banking/accounts?includeArchived=true',
  '/banking/transactions?', '/banking/transactions/reversals', '/commerce/summary',
  '/banking/transactions?status=UNRECONCILED',
  '/commerce/channels', '/commerce/orders', '/commerce/catalog',
  '/workflow/summary', '/workflow/documents?', '/workflow/approvals?',
  '/workflow/notifications?', '/workflow/rules?', '/insights/reports?',
  '/insights/analytics?', '/insights/saved-reports?archived=',
  '/insights/saved-reports?archived=true', '/insights/saved-reports?archived=all', '/insights/ai/history',
  '/insights/workbooks', '/pos/registers', '/pos/branches', '/pos/shifts/current',
  '/pos/sales?limit=100&page=1', '/pos/sales?includeVoided=true&limit=100&page=1', '/pos/audit',
] as const;

const DB_NAME = 'cephas-books-offline';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE))
        request.result.createObjectStore(SNAPSHOT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

function expectedOfflineReads(profile?: { role?: string; customRoleId?: string; permissions?: string[] }) {
  const role = profile?.role ?? 'OWNER';
  const custom = Boolean(profile?.customRoleId);
  const permissions = new Set(profile?.permissions ?? []);
  const can = (permission: string) => !custom || permissions.has(permission);
  return OFFLINE_WORKSPACE_READS.filter((path) => {
    if (path === '/organizations/current/onboarding') return true;
    if (path.startsWith('/organizations/current/admin') || path === '/workflow/rules?') return can('settings.manage');
    if (['/organizations/current/users', '/organizations/current/roles', '/organizations/current/audit-logs'].includes(path))
      return custom ? can('users.view') : ['OWNER', 'ADMIN', 'AUDITOR'].includes(role);
    if (path === '/pos/audit') return !custom && ['OWNER', 'ADMIN'].includes(role);
    if (path.startsWith('/sales/') || path.startsWith('/customers') || path.startsWith('/invoices') || path.startsWith('/pos/'))
      return can('sales.view');
    if (path.startsWith('/purchases/')) return can('purchases.view');
    if (path === '/banking/summary' || path.startsWith('/banking/accounts'))
      return can('banking.view') || can('banking.accounts.view') || can('banking.manage');
    if (path === '/banking/transactions?status=UNRECONCILED')
      return can('banking.view') || can('banking.reconciliation.view') || can('banking.manage');
    if (path.startsWith('/banking/transactions'))
      return can('banking.view') || can('banking.transactions.view') || can('banking.manage');
    if (path.startsWith('/accounting/')) return can('accounting.view');
    if (path.startsWith('/operations/')) {
      if (['/operations/products?', '/operations/warehouses?'].includes(path))
        return can('inventory.view') || can('sales.view');
      return can('inventory.view');
    }
    if (path.startsWith('/commerce/')) {
      if (path === '/commerce/orders') return can('sales.view');
      return can('inventory.view');
    }
    if (path.startsWith('/workflow/')) {
      if (path === '/workflow/approvals?') return can('approvals.review');
      if (path === '/workflow/summary' || path === '/workflow/documents?' || path === '/workflow/notifications?')
        return can('dashboard.view');
    }
    if (path.startsWith('/insights/')) return can('reports.view');
    return true;
  });
}

export async function cacheBulkWorkspace(
  snapshot: OfflineSnapshot,
  profile?: { role?: string; customRoleId?: string; permissions?: string[] },
): Promise<{ saved: number; failed: number }> {
  const snapshotKey = `bulk:${snapshot.organizationId}:${snapshot.userId}`;
  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOT_STORE, 'readwrite');
      transaction.objectStore(SNAPSHOT_STORE).put(snapshot, snapshotKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the offline workspace.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save the offline workspace.'));
    });
  } finally {
    db.close();
  }
  const expected = expectedOfflineReads(profile ?? getOfflineSnapshot('profile') ?? undefined);
  const saved = expected.filter((path) => Object.prototype.hasOwnProperty.call(snapshot.resources, path)).length;
  return { saved, failed: expected.length - saved };
}

export async function getOfflineBulkSnapshot(): Promise<OfflineSnapshot | null> {
  if (!('indexedDB' in window)) return null;
  const identity = getOfflineSnapshotIdentity();
  if (!identity) return null;
  try {
    const db = await openOfflineDb();
    try {
      return await new Promise<OfflineSnapshot | null>((resolve, reject) => {
        const request = db.transaction(SNAPSHOT_STORE, 'readonly').objectStore(SNAPSHOT_STORE).get(`bulk:${identity}`);
        request.onsuccess = () => {
          const value = request.result as OfflineSnapshot | undefined;
          resolve(value && value.version === 1 && value.resources && typeof value.resources === 'object' ? value : null);
        };
        request.onerror = () => reject(request.error ?? new Error('Could not read the offline workspace.'));
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export function getOfflineSnapshotIdentity(): string {
  const raw = localStorage.getItem('cephas:auth') ?? sessionStorage.getItem('cephas:auth');
  if (!raw) return '';
  try {
    const tokens = JSON.parse(raw) as { accessToken?: string };
    const payload = tokens.accessToken?.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>;
    const organization = decoded.organizationId ?? decoded.organization ?? decoded.orgId ?? '';
    return `${String(organization)}:${String(decoded.sub ?? '')}`;
  } catch {
    return '';
  }
}

export function isOfflineEnabledForCurrentAccount(): boolean {
  return localStorage.getItem('cephas:offline-enabled') === 'true' &&
    localStorage.getItem('cephas:offline-owner') === getOfflineSnapshotIdentity();
}

export function isWorkingOffline(): boolean {
  return !navigator.onLine || localStorage.getItem('cephas:offline-active') === 'true';
}

export function activateOfflineMode(): void {
  localStorage.setItem('cephas:offline-active', 'true');
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function deactivateOfflineMode(): void {
  localStorage.removeItem('cephas:offline-active');
  window.dispatchEvent(new Event('cephas:sync-state'));
}

function queueKey(): string {
  const identity = getOfflineSnapshotIdentity();
  const scopedKey = `${QUEUE_PREFIX}${identity || 'unbound'}`;
  const legacyQueue = localStorage.getItem(LEGACY_QUEUE_KEY);
  if (identity && legacyQueue && localStorage.getItem('cephas:offline-owner') === identity) {
    const current = localStorage.getItem(scopedKey);
    if (!current) localStorage.setItem(scopedKey, legacyQueue);
    else {
      try {
        const merged = [...JSON.parse(current), ...JSON.parse(legacyQueue)] as OfflineWrite[];
        localStorage.setItem(scopedKey, JSON.stringify([...new Map(merged.map((item) => [item.id, item])).values()]));
      } catch { /* leave malformed legacy data for manual cleanup */ }
    }
    localStorage.removeItem(LEGACY_QUEUE_KEY);
  }
  return scopedKey;
}

export function getOfflineSnapshot<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export function saveOfflineSnapshot(key: string, value: unknown): void {
  try { localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value)); } catch { /* storage quota */ }
}

export function getOfflineQueue(): OfflineWrite[] {
  try {
    const value = JSON.parse(localStorage.getItem(queueKey()) ?? '[]') as OfflineWrite[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function enqueueOfflineWrite(path: string, method: string, body?: string): void {
  const queue = getOfflineQueue();
  if (queueKey().endsWith(':unbound')) throw new Error('Cannot queue an offline change without an account session.');
  queue.push({ id: crypto.randomUUID(), path, method, body, queuedAt: new Date().toISOString() });
  localStorage.setItem(queueKey(), JSON.stringify(queue));
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function removeOfflineWrite(id: string): void {
  localStorage.setItem(queueKey(), JSON.stringify(getOfflineQueue().filter((item) => item.id !== id)));
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function replaceOfflineWrite(id: string, path: string, method: string, body?: string): void {
  const queue = getOfflineQueue().map((item) =>
    item.id === id ? { ...item, path, method, body, queuedAt: new Date().toISOString() } : item,
  );
  localStorage.setItem(queueKey(), JSON.stringify(queue));
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function clearOfflineQueue(): void {
  localStorage.setItem(queueKey(), '[]');
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export async function createOfflineLogin(
  email: string,
  password: string,
  profile: unknown,
  tokens: OfflineAuthTokens,
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, key, 512));
  const toHex = (data: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(data)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const cryptoKey = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedTokens = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(JSON.stringify(tokens)),
  );
  localStorage.setItem(`${PREFIX}credential`, JSON.stringify({
    email: email.trim().toLowerCase(),
    salt: toHex(salt),
    verifier: toHex(bits.slice(0, 32)),
    encryptedTokens: Array.from(new Uint8Array(encryptedTokens)),
    iv: Array.from(iv),
  }));
  saveOfflineSnapshot('profile', profile);
}

export async function restoreOfflineTokens(email: string, password: string): Promise<OfflineAuthTokens | null> {
  const saved = getOfflineSnapshot<{
    email: string; salt: string; verifier: string; encryptedTokens?: number[]; iv?: number[];
  }>('credential');
  if (!saved || saved.email !== email.trim().toLowerCase() || !saved.encryptedTokens || !saved.iv)
    return null;
  const salt = new Uint8Array(saved.salt.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, passwordKey, 512));
  const verifier = Array.from(bits.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (verifier !== saved.verifier) return null;
  const cryptoKey = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(saved.iv) },
    cryptoKey,
    new Uint8Array(saved.encryptedTokens),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as OfflineAuthTokens;
}

export function clearOfflineData(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
  localStorage.removeItem(LEGACY_QUEUE_KEY);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(QUEUE_PREFIX)) localStorage.removeItem(key);
  }
  localStorage.removeItem('cephas:offline-enabled');
  localStorage.removeItem('cephas:offline-active');
  localStorage.removeItem('cephas:offline-owner');
  localStorage.removeItem('cephas:offline-prepared-at');
  localStorage.removeItem('cephas:offline-prepared-counts');
  if ('indexedDB' in window) indexedDB.deleteDatabase(DB_NAME);
}

export function clearOfflineApiSnapshots(): void {
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith(`${PREFIX}api:`)) localStorage.removeItem(key);
  }
}

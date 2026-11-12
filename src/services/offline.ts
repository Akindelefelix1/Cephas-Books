const PREFIX = 'cephas:offline:';
const QUEUE_KEY = 'cephas:offline-write-queue';

export type OfflineWrite = { id: string; path: string; method: string; body?: string; queuedAt: string };

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
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as OfflineWrite[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function enqueueOfflineWrite(path: string, method: string, body?: string): void {
  const queue = getOfflineQueue();
  queue.push({ id: crypto.randomUUID(), path, method, body, queuedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function removeOfflineWrite(id: string): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(getOfflineQueue().filter((item) => item.id !== id)));
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export function clearOfflineQueue(): void {
  localStorage.setItem(QUEUE_KEY, '[]');
  window.dispatchEvent(new Event('cephas:sync-state'));
}

export async function createOfflineLogin(email: string, password: string, profile: unknown): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, key, 256);
  const toHex = (data: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(data)).map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(`${PREFIX}credential`, JSON.stringify({ email: email.toLowerCase(), salt: toHex(salt), verifier: toHex(bits) }));
  saveOfflineSnapshot('profile', profile);
}

export async function verifyOfflineLogin(email: string, password: string): Promise<boolean> {
  const saved = getOfflineSnapshot<{ email: string; salt: string; verifier: string }>('credential');
  if (!saved || saved.email !== email.trim().toLowerCase()) return false;
  const salt = new Uint8Array(saved.salt.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, key, 256);
  const actual = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return actual === saved.verifier;
}

export function clearOfflineData(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
  localStorage.removeItem(QUEUE_KEY);
}

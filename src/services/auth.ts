import { notifyError } from '@/utils/actions';

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
  createdAt: string;
  isActive: boolean;
  role: string;
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
    notifyError(message);
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
};

const TOKEN_KEY = 'cephas:auth';
export const AUTH_EXPIRED_EVENT = 'cephas:auth-expired';
let refreshPromise: Promise<AuthTokens> | null = null;

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
}

export async function logoutSession(): Promise<void> {
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

export async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let tokens = getAuthTokens();
  if (!tokens) {
    expireSession();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const activeBranchId = localStorage.getItem('cephas:active-branch');
  const branchScopedCreate =
    init.method === 'POST' &&
    /^\/(customers|invoices|sales\/(quotations|payments|credit-notes)|pos\/sales|banking\/transactions|purchases\/(suppliers|requests|orders|bills|payments|expenses))$/.test(
      path,
    );
  let requestBody = init.body;
  if (activeBranchId && branchScopedCreate && typeof init.body === 'string') {
    try {
      requestBody = JSON.stringify({
        ...(JSON.parse(init.body) as object),
        branchId: activeBranchId,
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

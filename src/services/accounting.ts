import { authorizedRequest } from './auth';
export type AccountingView =
  | 'chart-of-accounts'
  | 'journals'
  | 'general-ledger'
  | 'trial-balance'
  | 'assets'
  | 'budgets'
  | 'tax'
  | 'payroll';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type RecordKind = 'ASSET' | 'BUDGET' | 'TAX' | 'PAYROLL';
export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
}
export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
}
export interface Journal {
  id: string;
  number: string;
  journalDate: string;
  description: string;
  status: string;
  lines: JournalLine[];
  total: string;
}
export interface LedgerRow {
  id: string;
  number: string;
  date: string;
  description: string;
  accountId: string;
  account?: Pick<LedgerAccount, 'id' | 'code' | 'name'>;
  debit: number;
  credit: number;
  memo?: string;
}
export interface TrialRow {
  account: LedgerAccount;
  debit: string;
  credit: string;
  balance: string;
}
export interface FinanceRecord {
  id: string;
  kind: RecordKind;
  reference: string;
  name: string;
  startDate: string;
  endDate?: string;
  amount: string;
  status: string;
  data: Record<string, unknown>;
}
export interface AssetDepreciationPeriod {
  period: number;
  periodStart: string;
  periodEnd: string;
  openingCarryingAmount: string;
  depreciationAmount: string;
  accumulatedDepreciation: string;
  carryingAmount: string;
  status: string;
  journalId: string | null;
}
export interface AssetDepreciationHistory {
  id: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  accumulatedDepreciation: string;
  carryingAmount: string;
  status: string;
  journal?: { id: string; number: string; status: string } | null;
  createdAt: string;
}
export interface AssetDepreciationSummary {
  asset: FinanceRecord;
  configured: boolean;
  settings: {
    residualValue: number;
    usefulLifeYears: number;
    method: 'STRAIGHT_LINE' | 'REDUCING_BALANCE';
    frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    reducingBalanceRate?: number;
  } | null;
  cost: string;
  accumulatedDepreciation: string;
  carryingAmount: string;
  throughDate: string;
  nextDue: AssetDepreciationPeriod | null;
  schedule: AssetDepreciationPeriod[];
  history: AssetDepreciationHistory[];
}
const req = <T>(path: string, method = 'GET', body?: object) =>
  authorizedRequest<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
export const accountingApi = {
  accounts: (all = false) => req<LedgerAccount[]>(`/accounting/accounts?includeArchived=${all}`),
  createAccount: (d: object) => req<LedgerAccount>('/accounting/accounts', 'POST', d),
  accountStatus: (id: string, status: string) =>
    req(`/accounting/accounts/${id}/status`, 'PATCH', { status }),
  journals: (search = '') =>
    req<Journal[]>(`/accounting/journals?search=${encodeURIComponent(search)}`),
  createJournal: (d: object) => req<Journal>('/accounting/journals', 'POST', d),
  postJournal: (id: string) => req(`/accounting/journals/${id}/post`, 'POST'),
  reverseJournal: (id: string) => req<Journal & { depreciationAssetId?: string }>(`/accounting/journals/${id}/reverse`, 'POST'),
  ledger: (accountId = '') => req<LedgerRow[]>(`/accounting/ledger?accountId=${accountId}`),
  trial: () =>
    req<{ rows: TrialRow[]; totalDebit: string; totalCredit: string }>('/accounting/trial-balance'),
  records: (kind: RecordKind, search = '') =>
    req<FinanceRecord[]>(`/accounting/records/${kind}?search=${encodeURIComponent(search)}`),
  createRecord: (d: object) => req<FinanceRecord>('/accounting/records', 'POST', d),
  recordStatus: (id: string, status: string) =>
    req(`/accounting/records/${id}/status`, 'PATCH', { status }),
  assetDepreciation: (id: string) =>
    req<AssetDepreciationSummary>(`/accounting/assets/${id}/depreciation`),
  configureAssetDepreciation: (id: string, data: NonNullable<AssetDepreciationSummary['settings']>) =>
    req<FinanceRecord>(`/accounting/assets/${id}/depreciation/settings`, 'PATCH', data),
  runAssetDepreciation: (id: string, throughDate: string) =>
    req<AssetDepreciationSummary>(`/accounting/assets/${id}/depreciation`, 'POST', { throughDate }),
};

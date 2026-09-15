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
  reverseJournal: (id: string) => req(`/accounting/journals/${id}/reverse`, 'POST'),
  ledger: (accountId = '') => req<LedgerRow[]>(`/accounting/ledger?accountId=${accountId}`),
  trial: () =>
    req<{ rows: TrialRow[]; totalDebit: string; totalCredit: string }>('/accounting/trial-balance'),
  records: (kind: RecordKind, search = '') =>
    req<FinanceRecord[]>(`/accounting/records/${kind}?search=${encodeURIComponent(search)}`),
  createRecord: (d: object) => req<FinanceRecord>('/accounting/records', 'POST', d),
  recordStatus: (id: string, status: string) =>
    req(`/accounting/records/${id}/status`, 'PATCH', { status }),
};

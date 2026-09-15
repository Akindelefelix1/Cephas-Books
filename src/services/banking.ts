import { authorizedRequest } from './auth';

export type AccountType = 'CURRENT' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'OTHER';
export type TransactionType = 'MONEY_IN' | 'MONEY_OUT';
export type ReconciliationStatus = 'UNRECONCILED' | 'RECONCILED' | 'EXCLUDED';
export interface BankAccount {
  id: string;
  name: string;
  bankName?: string;
  accountType: AccountType;
  accountNumberLast4?: string;
  currency: string;
  openingBalance: string;
  currentBalance: string;
  isActive: boolean;
  _count: { transactions: number };
}
export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  reference?: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  reconciliationStatus: ReconciliationStatus;
  notes?: string;
  bankAccount: Pick<BankAccount, 'id' | 'name' | 'currency'>;
}
export interface BankingSummary {
  baseCurrency: string;
  totalCash: string;
  totalsByCurrency: Array<{ currency: string; amount: string }>;
  moneyIn: string;
  moneyOut: string;
  unreconciledCount: number;
  unreconciledAmount: string;
}
export interface TransactionFilters {
  accountId?: string;
  status?: ReconciliationStatus;
  type?: TransactionType;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
const query = (filters: TransactionFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(
    ([key, value]) => value !== undefined && value !== '' && params.set(key, String(value)),
  );
  return params.toString();
};
export const bankingApi = {
  summary: () => authorizedRequest<BankingSummary>('/banking/summary'),
  accounts: () => authorizedRequest<BankAccount[]>('/banking/accounts'),
  createAccount: (data: {
    name: string;
    bankName?: string;
    accountType: AccountType;
    accountNumberLast4?: string;
    currency: string;
    openingBalance: number;
  }) =>
    authorizedRequest<BankAccount>('/banking/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAccount: (
    id: string,
    data: Partial<
      Pick<BankAccount, 'name' | 'bankName' | 'accountType' | 'accountNumberLast4' | 'isActive'>
    >,
  ) =>
    authorizedRequest<BankAccount>(`/banking/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  transactions: (filters: TransactionFilters = {}) =>
    authorizedRequest<{
      data: BankTransaction[];
      meta: { page: number; limit: number; total: number; pages: number };
    }>(`/banking/transactions?${query(filters)}`),
  createTransaction: (data: {
    bankAccountId: string;
    transactionDate: string;
    description: string;
    reference?: string;
    type: TransactionType;
    amount: number;
    notes?: string;
  }) =>
    authorizedRequest<BankTransaction>('/banking/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTransaction: (
    id: string,
    data: Partial<{
      transactionDate: string;
      description: string;
      reference: string;
      type: TransactionType;
      amount: number;
      notes: string;
    }>,
  ) =>
    authorizedRequest<BankTransaction>(`/banking/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  reverseTransaction: (id: string) =>
    authorizedRequest<{ reversed: true }>(`/banking/transactions/${id}/reverse`, {
      method: 'POST',
    }),
  transfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    transactionDate: string;
    amount: number;
    reference?: string;
    notes?: string;
  }) =>
    authorizedRequest<{ transferGroupId: string }>('/banking/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reconcile: (id: string, status: ReconciliationStatus) =>
    authorizedRequest<BankTransaction>(`/banking/transactions/${id}/reconciliation`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  importCsv: (bankAccountId: string, csv: string) =>
    authorizedRequest<{ imported: number }>('/banking/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ bankAccountId, csv }),
    }),
  exportCsv: (filters: TransactionFilters = {}) =>
    authorizedRequest<{ filename: string; csv: string }>(
      `/banking/transactions/export?${query(filters)}`,
    ),
};

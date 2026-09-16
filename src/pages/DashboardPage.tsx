import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileUp,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  bankingApi,
  type BankAccount,
  type BankingSummary,
  type BankTransaction,
} from '@/services/banking';
import { salesApi, type SalesSummary } from '@/services/sales';
import { purchasesApi, type PurchaseSummary } from '@/services/purchases';
import { insightsApi, type AiInsight, type InsightAnalytics } from '@/services/insights';
import { accountingApi, type FinanceRecord } from '@/services/accounting';
import { workflowApi, type WorkflowSummary } from '@/services/workflow';
import type { Invoice } from '@/services/sales';

const dateUntil = (value: string | undefined, now: number) => {
  if (!value) return 'No end date';
  const days = Math.ceil((new Date(value).getTime() - now) / 86400000);
  return days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`;
};

export function DashboardPage({
  onNavigate,
  onCreate,
  onboardingComplete,
  onResumeOnboarding,
  companyName,
}: {
  onNavigate: (id: string) => void;
  onCreate: () => void;
  onboardingComplete: boolean;
  onResumeOnboarding: () => void;
  companyName: string;
}) {
  const [bankSummary, setBankSummary] = useState<BankingSummary | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentBankTransactions, setRecentBankTransactions] = useState<BankTransaction[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary | null>(null);
  const [analytics, setAnalytics] = useState<InsightAnalytics | null>(null);
  const [taxRecords, setTaxRecords] = useState<FinanceRecord[]>([]);
  const [budgetRecords, setBudgetRecords] = useState<FinanceRecord[]>([]);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aiHistory, setAiHistory] = useState<AiInsight[]>([]);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardNow] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      bankingApi.summary(),
      bankingApi.accounts(),
      bankingApi.transactions({ limit: 5 }),
      salesApi.summary(),
      purchasesApi.summary(),
      insightsApi.analytics(),
      accountingApi.records('TAX'),
      accountingApi.records('BUDGET'),
      workflowApi.summary(),
      salesApi.invoices(),
      insightsApi.aiHistory(),
    ]).then(
      ([
        summary,
        accounts,
        transactions,
        sales,
        purchases,
        insightData,
        tax,
        budgets,
        workflow,
        invoiceData,
        ai,
      ]) => {
        if (active) {
          if (summary.status === 'fulfilled') setBankSummary(summary.value);
          if (accounts.status === 'fulfilled') setBankAccounts(accounts.value);
          if (transactions.status === 'fulfilled')
            setRecentBankTransactions(transactions.value.data);
          if (sales.status === 'fulfilled') setSalesSummary(sales.value);
          if (purchases.status === 'fulfilled') setPurchaseSummary(purchases.value);
          if (insightData.status === 'fulfilled') setAnalytics(insightData.value);
          if (tax.status === 'fulfilled') setTaxRecords(tax.value);
          if (budgets.status === 'fulfilled') setBudgetRecords(budgets.value);
          if (workflow.status === 'fulfilled') setWorkflowSummary(workflow.value);
          if (invoiceData.status === 'fulfilled') setInvoices(invoiceData.value);
          if (ai.status === 'fulfilled') setAiHistory(ai.value);
          const failed = [
            summary,
            accounts,
            transactions,
            sales,
            purchases,
            insightData,
            tax,
            budgets,
            workflow,
            invoiceData,
            ai,
          ].filter((result) => result.status === 'rejected').length;
          if (failed)
            setDashboardError(
              `${failed} dashboard data source${failed === 1 ? '' : 's'} could not be loaded.`,
            );
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const bankingFeatures = [
    ['Bank accounts', 'Balances and account details', 'banking', Landmark],
    ['Transactions', 'Review money in and out', 'transactions', CreditCard],
    ['Reconciliation', 'Match and resolve entries', 'reconciliation', Sparkles],
    ['Capture receipt', 'Attach proof of payment', 'expenses', FileUp],
  ] as const;
  const today = new Intl.DateTimeFormat('en-NG', { dateStyle: 'full' }).format(new Date());
  const hour = new Date().getHours();
  const dayPeriod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const displayCompany = companyName || 'your company';
  const formatMoney = (value: string, currency: string) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  const currency = analytics?.currency ?? bankSummary?.baseCurrency ?? 'NGN';
  const revenue = Number(analytics?.metrics.revenue ?? salesSummary?.invoiced ?? 0);
  const expenses = Number(analytics?.metrics.expenses ?? purchaseSummary?.expenses ?? 0);
  const trend = analytics?.trend.slice(-6) ?? [];
  const latestTax = taxRecords[0];
  const latestBudget = budgetRecords[0];
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'OVERDUE');
  const overdueAmount = overdueInvoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(
        0,
        Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount),
      ),
    0,
  );
  const budgetTotal = Number(latestBudget?.amount ?? 0);
  const budgetSpent = Number(latestBudget?.data.spent ?? expenses);
  const budgetPercent =
    budgetTotal > 0 ? Math.min(100, Math.round((budgetSpent / budgetTotal) * 100)) : 0;
  const ageing = invoices.reduce(
    (buckets, invoice) => {
      const outstanding = Math.max(
        0,
        Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount),
      );
      if (!outstanding) return buckets;
      const days = Math.floor((dashboardNow - new Date(invoice.dueDate).getTime()) / 86400000);
      const index = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
      buckets[index] += outstanding;
      return buckets;
    },
    [0, 0, 0, 0, 0],
  );
  const margins = trend.map((item) =>
    Number(item.revenue) > 0
      ? ((Number(item.revenue) - Number(item.expenses)) / Number(item.revenue)) * 100
      : 0,
  );
  const currentMargin = margins.at(-1) ?? 0;
  const previousMargin = margins.at(-2) ?? currentMargin;
  return (
    <>
      {!onboardingComplete && (
        <div className="onboarding-resume">
          <div>
            <strong>Finish setting up your organisation</strong>
            <p>Your progress is saved. Continue from the next incomplete setup step anytime.</p>
          </div>
          <button className="button" onClick={onResumeOnboarding}>
            Resume setup
          </button>
        </div>
      )}
      <div className="dashboard-heading">
        <div>
          <p>{today}</p>
          <h1>
            Good {dayPeriod}, {displayCompany}.
          </h1>
          <span>Here’s how {displayCompany} is performing.</span>
        </div>
        <div>
          <div className="period-button">
            <CalendarDays size={17} />
            <span>All records</span>
          </div>
          <button className="button" onClick={onCreate}>
            + Quick create
          </button>
        </div>
      </div>
      {dashboardError && (
        <div className="banking-alert" role="alert">
          {dashboardError}
        </div>
      )}
      <div className="kpi-grid">
        {[
          {
            label: 'Total revenue',
            value: formatMoney(String(revenue), currency),
            delta: salesSummary ? `${salesSummary.customers} customers` : 'Loading',
            up: true,
            icon: TrendingUp,
          },
          {
            label: 'Total expenses',
            value: formatMoney(String(expenses), currency),
            delta: purchaseSummary ? `${purchaseSummary.suppliers} suppliers` : 'Loading',
            up: false,
            icon: ReceiptText,
          },
          {
            label: 'Net profit',
            value: formatMoney(String(revenue - expenses), currency),
            delta: revenue
              ? `${(((revenue - expenses) / revenue) * 100).toFixed(1)}% margin`
              : 'No revenue',
            up: revenue - expenses >= 0,
            icon: CircleDollarSign,
          },
          {
            label: 'Cash balance',
            value: formatMoney(bankSummary?.totalCash ?? '0', currency),
            delta: bankSummary ? `${bankSummary.unreconciledCount} unreconciled` : 'Loading',
            up: true,
            icon: Wallet,
          },
        ].map((k) => (
          <article className="kpi-card" key={k.label}>
            <header>
              <span>{k.label}</span>
              <i>
                <k.icon size={19} />
              </i>
            </header>
            <strong>{k.value}</strong>
            <footer>
              <b className={k.up ? 'up' : 'down'}>
                {k.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {k.delta}
              </b>
              <span>live records</span>
            </footer>
          </article>
        ))}
      </div>
      <section className="dashboard-feature-section" aria-labelledby="banking-tools-title">
        <header className="panel-header">
          <div>
            <h2 id="banking-tools-title">Banking tools</h2>
            <p>Features available to your role</p>
          </div>
        </header>
        <div className="dashboard-feature-grid">
          {bankingFeatures.map(([title, description, id, Icon]) => (
            <button key={title} onClick={() => onNavigate(id)}>
              <i>
                <Icon size={19} />
              </i>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ChevronDown className="feature-arrow" size={16} />
            </button>
          ))}
        </div>
      </section>
      <div className="dashboard-grid">
        <article className="panel chart-panel">
          <header className="panel-header">
            <div>
              <h2>Revenue & expenses</h2>
              <p>Income and spending over time</p>
            </div>
            <span className="select-button account-filter">Live monthly trend</span>
          </header>
          <div className="chart-legend">
            <span>
              <i className="blue" />
              Revenue <b>{formatMoney(analytics?.metrics.revenue ?? '0', currency)}</b>
            </span>
            <span>
              <i className="cyan" />
              Expenses <b>{formatMoney(analytics?.metrics.expenses ?? '0', currency)}</b>
            </span>
          </div>
          {trend.length ? (
            <div className="dashboard-trend-bars">
              {trend.map((item) => {
                const maximum = Math.max(
                  ...trend.flatMap((point) => [Number(point.revenue), Number(point.expenses)]),
                  1,
                );
                return (
                  <div key={item.month}>
                    <span>
                      <i
                        className="revenue"
                        style={{
                          height: `${Math.max(3, (Number(item.revenue) / maximum) * 100)}%`,
                        }}
                      />
                      <i
                        className="expense"
                        style={{
                          height: `${Math.max(3, (Number(item.expenses) / maximum) * 100)}%`,
                        }}
                      />
                    </span>
                    <small>
                      {new Date(`${item.month}-01`).toLocaleDateString('en-NG', { month: 'short' })}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="banking-state">No revenue or expense activity recorded yet.</div>
          )}
        </article>
        <article className="panel cash-panel">
          <header className="panel-header">
            <div>
              <h2>Cash position</h2>
              <p>Across all bank accounts</p>
            </div>
            <button
              className="icon-button"
              aria-label="Open banking"
              onClick={() => onNavigate('banking')}
            >
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="cash-total">
            <span>Available cash</span>
            <strong>
              {bankSummary ? formatMoney(bankSummary.totalCash, bankSummary.baseCurrency) : '—'}
            </strong>
            <small>
              {Number(bankSummary?.moneyIn ?? 0) - Number(bankSummary?.moneyOut ?? 0) >= 0 ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              {formatMoney(
                String(Number(bankSummary?.moneyIn ?? 0) - Number(bankSummary?.moneyOut ?? 0)),
                currency,
              )}{' '}
              net movement
            </small>
          </div>
          {bankAccounts.slice(0, 3).map((account, index) => (
            <div className="account-row" key={account.id}>
              <i className={`account-marker account-marker--${index + 1}`} />
              <span>
                <strong>{account.name}</strong>
                <small>{account.currency} account</small>
              </span>
              <b>{formatMoney(account.currentBalance, account.currency)}</b>
            </div>
          ))}
          {!bankAccounts.length && (
            <div className="dashboard-empty-inline">No bank accounts have been added.</div>
          )}
          <button className="panel-link" onClick={() => onNavigate('banking')}>
            View all bank accounts →
          </button>
        </article>
        <article className="panel receivable-panel">
          <header className="panel-header">
            <div>
              <h2>Money in & out</h2>
              <p>Receivables and payables</p>
            </div>
          </header>
          <div className="money-split">
            <div>
              <span>
                <i className="blue" />
                Receivable
              </span>
              <strong>{formatMoney(salesSummary?.receivable ?? '0', currency)}</strong>
              <small>{salesSummary?.openQuotations ?? 0} open quotations</small>
            </div>
            <div>
              <span>
                <i className="cyan" />
                Payable
              </span>
              <strong>{formatMoney(purchaseSummary?.payable ?? '0', currency)}</strong>
              <small>{purchaseSummary?.pendingRequests ?? 0} requests awaiting approval</small>
            </div>
          </div>
          <div className="ageing">
            {ageing.map((amount, index) => (
              <div
                key={index}
                className={
                  ['ageing-current', 'ageing-30', 'ageing-60', 'ageing-90', 'ageing-older'][index]
                }
                style={{ flex: amount || 0.05 }}
                title={formatMoney(String(amount), currency)}
              />
            ))}
          </div>
          <div className="ageing-labels">
            <span>Current</span>
            <span>1–30d</span>
            <span>31–60d</span>
            <span>61–90d</span>
            <span>90+d</span>
          </div>
        </article>
        <article className="panel tax-panel">
          <header className="panel-header">
            <div>
              <h2>Tax liability</h2>
              <p>Current filing period</p>
            </div>
            {latestTax && <Badge>{latestTax.status}</Badge>}
          </header>
          <div className="tax-amount">
            <span>Estimated payable</span>
            <strong>{latestTax ? formatMoney(latestTax.amount, currency) : '—'}</strong>
          </div>
          <div className="tax-lines">
            <span>
              Output VAT <b>{formatMoney(String(latestTax?.data.outputVat ?? 0), currency)}</b>
            </span>
            <span>
              Input VAT <b>{formatMoney(String(latestTax?.data.inputVat ?? 0), currency)}</b>
            </span>
            <span>
              WHT credit <b>{formatMoney(String(latestTax?.data.whtCredit ?? 0), currency)}</b>
            </span>
          </div>
          <button className="panel-link" onClick={() => onNavigate('tax')}>
            Review tax position →
          </button>
        </article>
        <article className="panel profitability-panel">
          <header className="panel-header">
            <div>
              <h2>Gross margin trend</h2>
              <p>Profitability after direct costs</p>
            </div>
            <Badge>{currentMargin >= 0 ? 'Positive' : 'Negative'}</Badge>
          </header>
          <div className="profitability-summary">
            <strong>{currentMargin.toFixed(1)}%</strong>
            <span>
              {currentMargin >= previousMargin ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}{' '}
              {(currentMargin - previousMargin).toFixed(1)} pts vs prior month
            </span>
          </div>
          <div
            className="margin-chart"
            aria-label="Gross margin trend from live monthly revenue and expense records"
          >
            {margins.map((value, index) => (
              <i
                key={value}
                style={{ height: `${Math.max(3, Math.min(100, value))}%` }}
                className={index === margins.length - 1 ? 'active' : ''}
              >
                <span>{value}%</span>
              </i>
            ))}
          </div>
          <div className="margin-months">
            {trend.map((item) => (
              <span key={item.month}>
                {new Date(`${item.month}-01`).toLocaleDateString('en-NG', { month: 'short' })}
              </span>
            ))}
          </div>
        </article>
        <article className="panel budget-panel">
          <header className="panel-header">
            <div>
              <h2>Operating budget</h2>
              <p>{latestBudget?.name ?? 'No active operating budget'}</p>
            </div>
          </header>
          <div
            className="budget-ring"
            aria-label={`${budgetPercent} percent of operating budget used`}
            style={{ background: `conic-gradient(#1233cc ${budgetPercent}%, #edf0f6 0)` }}
          >
            <div>
              <strong>{budgetPercent}%</strong>
              <small>used</small>
            </div>
          </div>
          <div className="budget-values">
            <span>
              Spent <b>{formatMoney(String(budgetSpent), currency)}</b>
            </span>
            <span>
              Remaining{' '}
              <b>{formatMoney(String(Math.max(0, budgetTotal - budgetSpent)), currency)}</b>
            </span>
          </div>
          <small className="budget-status">
            {latestBudget
              ? `${latestBudget.status} · ${dateUntil(latestBudget.endDate, dashboardNow)}`
              : 'Create a budget to track utilisation'}
          </small>
        </article>
        <article className="panel activity-panel">
          <header className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Latest transactions across your business</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('transactions')}>
              View all
            </button>
          </header>
          <div className="activity-list">
            {recentBankTransactions.map((transaction) => (
              <div key={transaction.id}>
                <i className={transaction.type === 'MONEY_IN' ? 'is-green' : 'is-red'}>
                  {transaction.type === 'MONEY_IN' ? <CreditCard /> : <ReceiptText />}
                </i>
                <span>
                  <strong>{transaction.description}</strong>
                  <small>
                    {transaction.reference || 'No reference'} · {transaction.bankAccount.name}
                  </small>
                </span>
                <b>
                  {transaction.type === 'MONEY_OUT' ? '−' : '+'}
                  {formatMoney(transaction.amount, transaction.bankAccount.currency)}
                </b>
                <Badge>{transaction.reconciliationStatus.toLowerCase()}</Badge>
              </div>
            ))}
            {!recentBankTransactions.length && (
              <div className="dashboard-empty-inline">No bank transactions have been recorded.</div>
            )}
          </div>
        </article>
        <article className="panel ai-insight">
          <header>
            <span>
              <Sparkles size={16} />
              CEPHAS AI INSIGHT
            </span>
            <button
              className="icon-button"
              aria-label="Open AI assistant"
              onClick={() => onNavigate('ai-assistant')}
            >
              <MoreHorizontal size={18} />
            </button>
          </header>
          <h3>{aiHistory[0]?.question ?? 'Live financial overview'}</h3>
          <p>
            {aiHistory[0]?.answer ??
              (analytics
                ? `Revenue is ${formatMoney(analytics.metrics.revenue, currency)}, expenses are ${formatMoney(analytics.metrics.expenses, currency)}, and available cash is ${formatMoney(analytics.metrics.cash, currency)}.`
                : 'Ask Cephas AI a question to create your first business insight.')}
          </p>
          <button onClick={() => onNavigate('ai-assistant')}>Explore forecast →</button>
          <div className="ai-decoration" />
        </article>
        <article className="panel tasks-panel">
          <header className="panel-header">
            <div>
              <h2>Needs your attention</h2>
              <p>Tasks and exceptions to resolve</p>
            </div>
          </header>
          {[
            [
              Clock3,
              `${overdueInvoices.length} invoices are overdue`,
              `${formatMoney(String(overdueAmount), currency)} outstanding`,
              'Review invoices',
            ],
            [
              ReceiptText,
              `${workflowSummary?.pendingApprovals ?? 0} requests need approval`,
              `${workflowSummary?.unreadNotifications ?? 0} unread notifications`,
              'Review approvals',
            ],
            [
              Wallet,
              'Bank reconciliation',
              `${bankSummary?.unreconciledCount ?? 0} unmatched items`,
              'Reconcile now',
            ],
          ].map(([Icon, a, b, c], index) => (
            <div className="task-row" key={String(a)}>
              <i>
                <Icon size={18} />
              </i>
              <span>
                <strong>{String(a)}</strong>
                <small>{String(b)}</small>
              </span>
              <button
                onClick={() => onNavigate(['invoices', 'approvals', 'reconciliation'][index])}
              >
                {String(c)}
              </button>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}

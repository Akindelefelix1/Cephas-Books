import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  MoreHorizontal,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function DashboardPage({
  onNavigate,
  onCreate,
}: {
  onNavigate: (id: string) => void;
  onCreate: () => void;
}) {
  const transactions = [
    ['INV-00245', 'Apex Retail Limited', 'Invoice', '₦2,500,000', 'Partially paid'],
    ['PAY-00831', 'Northstar Schools', 'Payment', '₦1,280,000', 'Paid'],
    ['EXP-00194', 'Meta Platforms', 'Marketing', '−₦420,000', 'Approved'],
    ['BILL-00482', 'Cloud Systems Ltd', 'Software', '−₦680,000', 'Pending'],
    ['TRF-00072', 'GTBank → Access Bank', 'Transfer', '−₦2,000,000', 'Completed'],
  ];
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p>Monday, 17 August 2026</p>
          <h1>Good morning, Tobi.</h1>
          <span>Here’s how Acme Holdings is performing.</span>
        </div>
        <div>
          <button className="period-button">
            <CalendarDays size={17} />
            This month
            <ChevronDown size={15} />
          </button>
          <button className="button" onClick={onCreate}>
            + Quick create
          </button>
        </div>
      </div>
      <div className="kpi-grid">
        {[
          {
            label: 'Total revenue',
            value: '₦48,240,000',
            delta: '12.8%',
            up: true,
            icon: TrendingUp,
          },
          {
            label: 'Total expenses',
            value: '₦29,860,000',
            delta: '5.2%',
            up: false,
            icon: ReceiptText,
          },
          {
            label: 'Net profit',
            value: '₦14,620,000',
            delta: '8.4%',
            up: true,
            icon: CircleDollarSign,
          },
          { label: 'Cash balance', value: '₦26,945,200', delta: 'Healthy', up: true, icon: Wallet },
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
              <span>vs last month</span>
            </footer>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <article className="panel chart-panel">
          <header className="panel-header">
            <div>
              <h2>Revenue & expenses</h2>
              <p>Income and spending over time</p>
            </div>
            <button className="select-button">
              Last 6 months
              <ChevronDown size={14} />
            </button>
          </header>
          <div className="chart-legend">
            <span>
              <i className="blue" />
              Revenue <b>₦94.3m</b>
            </span>
            <span>
              <i className="cyan" />
              Expenses <b>₦62.1m</b>
            </span>
          </div>
          <div className="main-chart">
            <div className="y-labels">
              <span>₦25m</span>
              <span>₦20m</span>
              <span>₦15m</span>
              <span>₦10m</span>
              <span>₦5m</span>
              <span>₦0</span>
            </div>
            <div className="chart-canvas">
              <svg viewBox="0 0 700 260" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revarea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1233cc" stopOpacity=".18" />
                    <stop offset="1" stopColor="#1233cc" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="grid-lines"
                  d="M0 10H700 M0 58H700 M0 106H700 M0 154H700 M0 202H700 M0 250H700"
                />
                <path
                  fill="url(#revarea)"
                  d="M0 208 C55 190 80 125 140 152 S220 185 280 103 S370 143 420 76 S510 122 560 62 S645 82 700 25 V260 H0Z"
                />
                <path
                  className="revenue-line"
                  d="M0 208 C55 190 80 125 140 152 S220 185 280 103 S370 143 420 76 S510 122 560 62 S645 82 700 25"
                />
                <path
                  className="expense-line"
                  d="M0 224 C55 210 90 183 140 196 S225 205 280 164 S360 186 420 145 S510 175 560 132 S655 151 700 115"
                />
              </svg>
              <div className="x-labels">
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
              </div>
            </div>
          </div>
        </article>
        <article className="panel cash-panel">
          <header className="panel-header">
            <div>
              <h2>Cash position</h2>
              <p>Across all bank accounts</p>
            </div>
            <button className="icon-button">
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="cash-total">
            <span>Available cash</span>
            <strong>₦26,945,200</strong>
            <small>
              <ArrowUpRight size={14} /> ₦2.4m this month
            </small>
          </div>
          {[
            ['GTBank Current', '₦18,450,200'],
            ['Access Operations', '₦6,820,000'],
            ['Petty Cash', '₦1,675,000'],
          ].map((account, index) => (
            <div className="account-row" key={account[0]}>
              <i className={`account-marker account-marker--${index + 1}`} />
              <span>
                <strong>{account[0]}</strong>
                <small>NGN account</small>
              </span>
              <b>{account[1]}</b>
            </div>
          ))}
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
              <strong>₦8.42m</strong>
              <small>₦3.12m overdue</small>
            </div>
            <div>
              <span>
                <i className="cyan" />
                Payable
              </span>
              <strong>₦5.68m</strong>
              <small>₦1.24m overdue</small>
            </div>
          </div>
          <div className="ageing">
            <div className="ageing-current" />
            <div className="ageing-30" />
            <div className="ageing-60" />
            <div className="ageing-90" />
            <div className="ageing-older" />
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
            <Badge>Due in 12 days</Badge>
          </header>
          <div className="tax-amount">
            <span>Estimated payable</span>
            <strong>₦2,184,500</strong>
          </div>
          <div className="tax-lines">
            <span>
              Output VAT <b>₦3,420,000</b>
            </span>
            <span>
              Input VAT <b>−₦1,235,500</b>
            </span>
            <span>
              WHT credit <b>₦420,000</b>
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
            <Badge>Healthy</Badge>
          </header>
          <div className="profitability-summary">
            <strong>38.6%</strong>
            <span>
              <ArrowUpRight size={14} /> 4.2 pts vs last quarter
            </span>
          </div>
          <div
            className="margin-chart"
            aria-label="Gross margin increased from 29 to 38.6 percent over six months"
          >
            {[29, 31, 30, 34, 36, 39].map((value, index) => (
              <i
                key={value}
                style={{ height: `${value * 2}%` }}
                className={index === 5 ? 'active' : ''}
              >
                <span>{value}%</span>
              </i>
            ))}
          </div>
          <div className="margin-months">
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
          </div>
        </article>
        <article className="panel budget-panel">
          <header className="panel-header">
            <div>
              <h2>Operating budget</h2>
              <p>August budget utilisation</p>
            </div>
          </header>
          <div className="budget-ring" aria-label="68 percent of operating budget used">
            <div>
              <strong>68%</strong>
              <small>used</small>
            </div>
          </div>
          <div className="budget-values">
            <span>
              Spent <b>â‚¦18.4m</b>
            </span>
            <span>
              Remaining <b>â‚¦8.6m</b>
            </span>
          </div>
          <small className="budget-status">On track · 14 days remaining</small>
        </article>
        <article className="panel activity-panel">
          <header className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Latest transactions across your business</p>
            </div>
            <button className="text-button">View all</button>
          </header>
          <div className="activity-list">
            {transactions.map((t) => (
              <div key={t[0]}>
                <i
                  className={t[2] === 'Payment' ? 'is-green' : t[3].startsWith('−') ? 'is-red' : ''}
                >
                  {t[2] === 'Payment' ? <CreditCard /> : <ReceiptText />}
                </i>
                <span>
                  <strong>{t[1]}</strong>
                  <small>
                    {t[0]} · {t[2]}
                  </small>
                </span>
                <b>{t[3]}</b>
                <Badge>{t[4]}</Badge>
              </div>
            ))}
          </div>
        </article>
        <article className="panel ai-insight">
          <header>
            <span>
              <Sparkles size={16} />
              CEPHAS AI INSIGHT
            </span>
            <button className="icon-button">
              <MoreHorizontal size={18} />
            </button>
          </header>
          <h3>Your cash runway improved by 18 days.</h3>
          <p>
            Faster customer collections and lower operating spend added an estimated ₦4.2m to your
            90-day cash position.
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
            [Clock3, '6 invoices are overdue', '₦3.12m outstanding', 'Review invoices'],
            [ReceiptText, '8 expenses need approval', 'Oldest waiting 3 days', 'Review approvals'],
            [Wallet, 'Bank reconciliation due', '42 unmatched items', 'Reconcile now'],
          ].map(([Icon, a, b, c]) => (
            <div className="task-row" key={String(a)}>
              <i>
                <Icon size={18} />
              </i>
              <span>
                <strong>{String(a)}</strong>
                <small>{String(b)}</small>
              </span>
              <button>{String(c)}</button>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}

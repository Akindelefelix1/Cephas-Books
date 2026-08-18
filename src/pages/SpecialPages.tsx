import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileBarChart,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { confirmAction, downloadText } from '@/utils/actions';

const ledgerRows = [
  {
    date: '17 Aug 2026',
    reference: 'INV-00245',
    description: 'Apex Retail Limited · Sales invoice',
    debit: '₦2,500,000',
    credit: '—',
    balance: '₦8,420,000',
  },
  {
    date: '16 Aug 2026',
    reference: 'PAY-00831',
    description: 'Northstar Schools · Payment received',
    debit: '—',
    credit: '₦1,280,000',
    balance: '₦5,920,000',
  },
  {
    date: '14 Aug 2026',
    reference: 'INV-00243',
    description: 'Cedar & Stone · Sales invoice',
    debit: '₦945,000',
    credit: '—',
    balance: '₦7,200,000',
  },
  {
    date: '11 Aug 2026',
    reference: 'CN-00008',
    description: 'Credit note · Kora Foods',
    debit: '—',
    credit: '₦320,000',
    balance: '₦6,255,000',
  },
];

export function BankingPage({ reconciliation = false }: { reconciliation?: boolean }) {
  const [upload, setUpload] = useState(false);
  if (reconciliation)
    return (
      <>
        <PageHeader
          title="Bank reconciliation"
          description="Match your bank statement to Cephas transactions and resolve exceptions."
          action="Import statement"
          onAction={() => setUpload(true)}
        />
        <StatsGrid
          stats={[
            { label: 'Statement balance', value: '₦26.98m', change: '17 Aug 2026' },
            {
              label: 'Book balance',
              value: '₦26.95m',
              change: '₦34,800 difference',
              tone: 'warning',
            },
            { label: 'Matched', value: '284', change: '94.7%', tone: 'positive' },
            { label: 'Unmatched', value: '16', change: 'Needs review', tone: 'danger' },
          ]}
        />
        <section className="reconcile-grid">
          <div className="panel">
            <header className="panel-header">
              <div>
                <h2>Bank statement</h2>
                <p>GTBank Current · August 2026</p>
              </div>
              <Badge>16 unmatched</Badge>
            </header>
            {[
              ['POS/WEB PAYSTACK SETTLEMENT', '16 Aug', '+₦680,000', 'Suggested match'],
              ['TRANSFER TO MAINLAND LOGISTICS', '15 Aug', '−₦420,000', 'Unmatched'],
              ['NIP/APEX RETAIL LIMITED', '14 Aug', '+₦2,500,000', 'Matched'],
              ['SMS ALERT CHARGE', '13 Aug', '−₦4,800', 'Create expense'],
            ].map((x) => (
              <div className="match-row" key={x[0]}>
                <input type="checkbox" />
                <span>
                  <strong>{x[0]}</strong>
                  <small>{x[1]}</small>
                </span>
                <b>{x[2]}</b>
                <Badge>{x[3]}</Badge>
              </div>
            ))}
          </div>
          <div className="panel match-detail">
            <div className="match-icon">
              <WandSparkles />
            </div>
            <h2>Smart match found</h2>
            <p>This bank entry appears to match a payment recorded in Cephas.</p>
            <div className="match-card">
              <span>
                <small>PAYMENT</small>
                <Badge>98% confidence</Badge>
              </span>
              <strong>PAY-00829 · Apex Retail</strong>
              <p>₦2,500,000 · 14 Aug 2026</p>
            </div>
            <div className="journal-preview">
              <span>
                <b>Debit</b> GTBank Current <strong>₦2,500,000</strong>
              </span>
              <span>
                <b>Credit</b> Accounts Receivable <strong>₦2,500,000</strong>
              </span>
              <footer>
                <CheckCircle2 size={15} />
                Debits and credits are balanced
              </footer>
            </div>
            <button
              className="button"
              onClick={() => confirmAction('Bank transaction matched and reconciled')}
            >
              Confirm match
            </button>
            <button
              className="button button--secondary"
              onClick={() => confirmAction('Showing alternative transaction matches')}
            >
              Find another match
            </button>
          </div>
        </section>
        <Modal
          open={upload}
          onClose={() => setUpload(false)}
          title="Import bank statement"
          subtitle="Upload a supported statement to start reconciliation."
          footer={
            <button className="button" onClick={() => setUpload(false)}>
              Import transactions
            </button>
          }
        >
          <div className="upload-zone">
            <Upload />
            <strong>Drop your bank statement here</strong>
            <p>CSV, OFX, QIF, CAMT.053 or PDF up to 25 MB</p>
            <button
              className="button button--secondary"
              onClick={() => confirmAction('Select a statement using the upload field')}
            >
              Choose file
            </button>
          </div>
        </Modal>
      </>
    );
  return (
    <>
      <PageHeader
        title="Banking"
        description="See cash across every account, import feeds, transfer funds, and reconcile."
        action="Add bank account"
      />
      <StatsGrid
        stats={[
          { label: 'Total cash', value: '₦26.95m', change: '+₦2.4m this month', tone: 'positive' },
          { label: 'Money in', value: '₦12.82m', change: 'This month' },
          { label: 'Money out', value: '₦8.64m', change: 'This month' },
          { label: 'Unreconciled', value: '42', change: '₦1.38m', tone: 'warning' },
        ]}
      />
      <div className="bank-accounts">
        {[
          ['GTBank Current', '**** 4821', '₦18,450,200', 'Reconciled to 15 Aug'],
          ['Access Operations', '**** 9034', '₦6,820,000', '12 items to reconcile'],
          ['Petty Cash', 'Cash account', '₦1,675,000', 'Up to date'],
        ].map((x, i) => (
          <article className="bank-card" key={x[0]}>
            <header>
              <span className={`bank-logo bank-logo--${i}`}>{x[0].slice(0, 2)}</span>
              <button
                className="icon-button"
                aria-label={`Open ${x[0]} account`}
                onClick={() => confirmAction(`${x[0]} selected`)}
              >
                <MoreHorizontal />
              </button>
            </header>
            <p>
              {x[0]} <small>{x[1]}</small>
            </p>
            <strong>{x[2]}</strong>
            <footer>
              <i className={i === 1 ? 'warning' : ''} />
              {x[3]}
              <ArrowRight size={15} />
            </footer>
          </article>
        ))}
      </div>
      <section className="panel register-panel">
        <div className="table-toolbar">
          <h2>Recent bank transactions</h2>
          <button
            className="filter-button"
            onClick={() => confirmAction('Showing transactions from all accounts')}
          >
            All accounts <ChevronDown />
          </button>
        </div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'description', label: 'Description' },
            { key: 'reference', label: 'Reference' },
            { key: 'debit', label: 'Money in', align: 'right' },
            { key: 'credit', label: 'Money out', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right' },
          ]}
          rows={ledgerRows}
        />
      </section>
    </>
  );
}

export function AccountingPage({ type }: { type: string }) {
  const [modal, setModal] = useState(false);
  if (type === 'chart-of-accounts')
    return (
      <>
        <PageHeader
          title="Chart of accounts"
          description="The structure behind your general ledger and every financial statement."
          action="New account"
          onAction={() => setModal(true)}
        />
        <div className="coa-summary">
          {[
            ['Assets', '₦184.6m'],
            ['Liabilities', '₦46.8m'],
            ['Equity', '₦92.1m'],
            ['Income', '₦48.2m'],
            ['Expenses', '₦29.9m'],
          ].map((account, index) => (
            <article key={account[0]}>
              <i className={`account-type-marker account-type-marker--${index + 1}`} />
              <span>{account[0]}</span>
              <strong>{account[1]}</strong>
            </article>
          ))}
        </div>
        <section className="panel account-tree">
          <div className="table-toolbar">
            <div className="table-search">
              <Search />
              <input placeholder="Search accounts by name or code…" />
            </div>
            <button
              className="filter-button"
              onClick={() => confirmAction('Showing active accounts')}
            >
              Active accounts <ChevronDown />
            </button>
          </div>
          {[
            ['1000', 'Assets', 'Header', '₦184,620,000'],
            ['1100', 'Cash and bank', 'Sub-header', '₦26,945,200'],
            ['1110', 'GTBank Current', 'Bank', '₦18,450,200'],
            ['1120', 'Access Operations', 'Bank', '₦6,820,000'],
            ['1200', 'Accounts Receivable', 'Receivable', '₦8,420,000'],
            ['1300', 'Inventory Asset', 'Inventory', '₦18,620,000'],
            ['2000', 'Liabilities', 'Header', '₦46,810,000'],
            ['2100', 'Accounts Payable', 'Payable', '₦5,680,000'],
          ].map((x, i) => (
            <div
              className={`account-line depth-${i === 0 || i === 6 ? 0 : i === 1 || i === 4 || i === 5 || i === 7 ? 1 : 2}`}
              key={x[0]}
            >
              <span>
                {i === 0 || i === 6 ? <ChevronDown /> : <i />}
                <b>{x[0]}</b>
                <strong>{x[1]}</strong>
                <small>{x[2]}</small>
              </span>
              <b>{x[3]}</b>
              <button
                className="row-action"
                aria-label={`Open ${x[1]}`}
                onClick={() => confirmAction(`${x[1]} account selected`)}
              >
                <MoreHorizontal />
              </button>
            </div>
          ))}
        </section>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Create account"
          footer={
            <button className="button" onClick={() => setModal(false)}>
              Create account
            </button>
          }
        >
          <div className="form-grid">
            <label>
              Account type
              <select>
                <option>Bank</option>
                <option>Current asset</option>
                <option>Liability</option>
                <option>Income</option>
                <option>Expense</option>
              </select>
            </label>
            <label>
              Account code
              <input placeholder="e.g. 1130" />
            </label>
            <label className="full">
              Account name
              <input placeholder="e.g. Zenith Bank Current" />
            </label>
            <label>
              Parent account
              <select>
                <option>1100 · Cash and bank</option>
              </select>
            </label>
            <label>
              Opening balance
              <input placeholder="₦0.00" />
            </label>
          </div>
        </Modal>
      </>
    );
  if (type === 'journals')
    return (
      <>
        <PageHeader
          title="Journal entries"
          description="Review, approve, post, reverse, and adjust balanced double-entry journals."
          action="New journal"
          onAction={() => setModal(true)}
        />
        <StatsGrid
          stats={[
            { label: 'Draft', value: '8', change: '₦4.2m' },
            { label: 'Awaiting review', value: '5', change: 'Oldest 2 days', tone: 'warning' },
            { label: 'Posted this month', value: '142', change: '₦86.4m', tone: 'positive' },
            { label: 'Reversed', value: '3', change: 'This month' },
          ]}
        />
        <section className="panel register-panel">
          <DataTable
            columns={[
              { key: 'reference', label: 'Journal no.' },
              { key: 'date', label: 'Date' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit', align: 'right' },
              { key: 'credit', label: 'Credit', align: 'right' },
              { key: 'status', label: 'Status' },
            ]}
            rows={ledgerRows.map((x, i) => ({
              ...x,
              status: ['Posted', 'Awaiting review', 'Draft', 'Posted'][i],
            }))}
          />
        </section>
        <Modal
          wide
          open={modal}
          onClose={() => setModal(false)}
          title="New journal entry"
          subtitle="Total debits must equal total credits before this journal can be posted."
          footer={
            <>
              <button
                className="button button--secondary"
                onClick={() => confirmAction('Journal saved as draft')}
              >
                Save draft
              </button>
              <button className="button" onClick={() => setModal(false)}>
                Submit for review
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Journal number
              <input defaultValue="JRN-00682" />
            </label>
            <label>
              Posting date
              <input type="date" defaultValue={new Date().toLocaleDateString('en-CA')} />
            </label>
            <label>
              Reference
              <input placeholder="Optional reference" />
            </label>
            <label>
              Branch
              <select>
                <option>Lagos Head Office</option>
                <option>Abuja Branch</option>
              </select>
            </label>
            <label className="full">
              Description
              <input placeholder="What is this journal for?" />
            </label>
          </div>
          <div className="journal-lines">
            <header>
              <span>Account</span>
              <span>Description</span>
              <span>Debit</span>
              <span>Credit</span>
            </header>
            {[1, 2].map((x) => (
              <div key={x}>
                <select>
                  <option>
                    {x === 1 ? '1110 · GTBank Current' : '1200 · Accounts Receivable'}
                  </option>
                </select>
                <input placeholder="Line description" />
                <input defaultValue={x === 1 ? '100,000.00' : ''} />
                <input defaultValue={x === 2 ? '100,000.00' : ''} />
              </div>
            ))}
            <button onClick={() => confirmAction('A new journal line was added')}>
              + Add line
            </button>
            <footer>
              <span>Total</span>
              <b>₦100,000.00</b>
              <b>₦100,000.00</b>
              <strong>
                <Check />
                Balanced
              </strong>
            </footer>
          </div>
        </Modal>
      </>
    );
  const isTrial = type === 'trial-balance';
  return (
    <>
      <PageHeader
        title={isTrial ? 'Trial balance' : 'General ledger'}
        description={
          isTrial
            ? 'Validate debit and credit balances across every account.'
            : 'A complete, filterable record of all posted accounting transactions.'
        }
      />
      <section className="report-controls">
        <button onClick={() => confirmAction('Date range selector opened')}>
          1 Aug – 17 Aug 2026 <ChevronDown />
        </button>
        <button onClick={() => confirmAction('Branch filter opened')}>
          All branches <ChevronDown />
        </button>
        <button onClick={() => confirmAction('Department filter opened')}>
          All departments <ChevronDown />
        </button>
        <button onClick={() => confirmAction('Additional filters opened')}>
          More filters <Settings2 />
        </button>
        <span />
        <button
          onClick={() => downloadText('financial-report.pdf.txt', 'Cephas Books financial report')}
        >
          Export PDF
        </button>
        <button onClick={() => downloadText('financial-report.csv', 'Account,Debit,Credit')}>
          Export Excel
        </button>
      </section>
      {isTrial ? (
        <FinancialStatement type="trial" />
      ) : (
        <section className="panel register-panel">
          <div className="ledger-account">
            <span>Account</span>
            <strong>1200 · Accounts Receivable</strong>
            <b>Closing balance: ₦8,420,000</b>
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'reference', label: 'Reference' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit', align: 'right' },
              { key: 'credit', label: 'Credit', align: 'right' },
              { key: 'balance', label: 'Balance', align: 'right' },
            ]}
            rows={ledgerRows}
          />
        </section>
      )}
    </>
  );
}

export function FinancialStatement({
  type,
}: {
  type: 'trial' | 'profit-loss' | 'balance-sheet' | 'cash-flow';
}) {
  const configs = {
    trial: {
      title: 'Trial Balance',
      groups: [
        [
          'Assets',
          [
            ['Cash and bank', '26,945,200', '—'],
            ['Accounts receivable', '8,420,000', '—'],
            ['Inventory asset', '18,620,000', '—'],
          ],
        ],
        [
          'Liabilities',
          [
            ['Accounts payable', '—', '5,680,000'],
            ['VAT payable', '—', '2,184,500'],
          ],
        ],
        ['Income', [['Sales revenue', '—', '48,240,000']]],
        ['Expenses', [['Operating expenses', '29,860,000', '—']]],
      ],
    },
    'profit-loss': {
      title: 'Profit & Loss',
      groups: [
        [
          'Revenue',
          [
            ['Sales revenue', '48,240,000', ''],
            ['Service revenue', '6,420,000', ''],
            ['Total revenue', '54,660,000', ''],
          ],
        ],
        [
          'Cost of goods sold',
          [
            ['Opening inventory', '8,420,000', ''],
            ['Purchases', '12,640,000', ''],
            ['Cost of goods sold', '14,820,000', ''],
          ],
        ],
        ['Gross profit', [['Gross profit', '39,840,000', '72.9%']]],
        [
          'Operating expenses',
          [
            ['Salaries and wages', '12,460,000', ''],
            ['Marketing', '3,280,000', ''],
            ['Rent and utilities', '4,620,000', ''],
            ['Total operating expenses', '24,280,000', ''],
          ],
        ],
        ['Net profit', [['Net profit', '14,620,000', '26.7%']]],
      ],
    },
    'balance-sheet': {
      title: 'Balance Sheet',
      groups: [
        [
          'Assets',
          [
            ['Cash and bank', '26,945,200', ''],
            ['Accounts receivable', '8,420,000', ''],
            ['Inventory', '18,620,000', ''],
            ['Fixed assets, net', '104,620,000', ''],
            ['Total assets', '158,605,200', ''],
          ],
        ],
        [
          'Liabilities',
          [
            ['Accounts payable', '5,680,000', ''],
            ['Tax payable', '2,184,500', ''],
            ['Long-term loans', '38,945,000', ''],
            ['Total liabilities', '46,809,500', ''],
          ],
        ],
        [
          'Equity',
          [
            ['Share capital', '50,000,000', ''],
            ['Retained earnings', '47,175,700', ''],
            ['Current year profit', '14,620,000', ''],
            ['Total equity', '111,795,700', ''],
          ],
        ],
      ],
    },
    'cash-flow': {
      title: 'Cash Flow Statement',
      groups: [
        [
          'Operating activities',
          [
            ['Cash received from customers', '42,860,000', ''],
            ['Payments to suppliers', '−18,420,000', ''],
            ['Operating expenses paid', '−12,640,000', ''],
            ['Net cash from operations', '11,800,000', ''],
          ],
        ],
        [
          'Investing activities',
          [
            ['Purchase of fixed assets', '−3,420,000', ''],
            ['Asset disposal proceeds', '680,000', ''],
            ['Net cash used in investing', '−2,740,000', ''],
          ],
        ],
        [
          'Financing activities',
          [
            ['Loan repayment', '−2,000,000', ''],
            ['Owner contribution', '5,000,000', ''],
            ['Net cash from financing', '3,000,000', ''],
          ],
        ],
      ],
    },
  }[type];
  return (
    <section className="statement panel">
      <header>
        <div className="statement-logo">C</div>
        <div>
          <strong>ACME HOLDINGS LIMITED</strong>
          <h2>{configs.title}</h2>
          <p>For the period ended 17 August 2026 · NGN</p>
        </div>
      </header>
      <div className="statement-cols">
        <span>Account</span>
        <span>{type === 'trial' ? 'Debit' : 'Current period'}</span>
        <span>{type === 'trial' ? 'Credit' : 'Variance'}</span>
      </div>
      {configs.groups.map(([name, rows]) => (
        <div className="statement-group" key={String(name)}>
          <h3>{String(name)}</h3>
          {(rows as string[][]).map((r, i) => (
            <div className={i === rows.length - 1 ? 'total' : ''} key={r[0]}>
              <span>{r[0]}</span>
              <b>{r[1] && `₦${r[1]}`}</b>
              <b>{r[2] ? (type === 'trial' ? `₦${r[2]}` : r[2]) : '—'}</b>
            </div>
          ))}
        </div>
      ))}
      <footer>
        <span>{type === 'trial' ? 'Total' : 'Statement generated from posted ledger entries'}</span>
        {type === 'trial' && (
          <>
            <b>₦83,845,200</b>
            <b>₦83,845,200</b>
          </>
        )}
        <small>
          <CheckCircle2 />
          Balanced and verified
        </small>
      </footer>
    </section>
  );
}

export function ReportsPage({ initial }: { initial?: string }) {
  const [report, setReport] = useState(initial ?? 'centre');
  const [reportCategory, setReportCategory] = useState('All reports');
  const statements = ['profit-loss', 'balance-sheet', 'cash-flow'];
  if (statements.includes(report))
    return (
      <>
        <PageHeader
          title={
            report === 'profit-loss'
              ? 'Profit & Loss'
              : report === 'balance-sheet'
                ? 'Balance Sheet'
                : 'Cash Flow Statement'
          }
          description="Generated from posted accounting transactions in the general ledger."
        />
        <section className="report-controls">
          <button onClick={() => confirmAction('Report date range opened')}>
            1 Jan – 17 Aug 2026 <ChevronDown />
          </button>
          <button onClick={() => confirmAction('Consolidation scope opened')}>
            Consolidated <ChevronDown />
          </button>
          <span />
          <button onClick={() => setReport('centre')}>Back to reports</button>
          <button onClick={() => downloadText(`${report}.pdf.txt`, `${report} report`)}>
            Export PDF
          </button>
          <button onClick={() => downloadText(`${report}.csv`, 'Account,Amount')}>
            Export Excel
          </button>
        </section>
        <FinancialStatement type={report as 'profit-loss' | 'balance-sheet' | 'cash-flow'} />
      </>
    );
  const groups = [
    [
      'Financial statements',
      [
        [FileBarChart, 'Profit & Loss', 'Revenue, costs, and profitability', 'profit-loss'],
        [Building2, 'Balance Sheet', 'Assets, liabilities, and equity', 'balance-sheet'],
        [
          CircleDollarSign,
          'Cash Flow Statement',
          'Operating, investing, and financing cash',
          'cash-flow',
        ],
      ],
    ],
    [
      'Accounting',
      [
        [FileText, 'General Ledger', 'Every posted account movement', ''],
        [FileText, 'Trial Balance', 'Debit and credit account balances', ''],
        [FileText, 'Journal Report', 'Posted, reversed, and draft journals', ''],
      ],
    ],
    [
      'Sales & receivables',
      [
        [FileText, 'Sales Summary', 'Sales performance by period', ''],
        [Users, 'Sales by Customer', 'Customer revenue and contribution', ''],
        [FileText, 'Invoice Report', 'Invoice status and collections', ''],
      ],
    ],
    [
      'Purchases & expenses',
      [
        [FileText, 'Purchase Summary', 'Purchasing patterns and totals', ''],
        [Users, 'Supplier Report', 'Supplier spend and balances', ''],
        [FileText, 'Expense by Department', 'Department spend and variance', ''],
      ],
    ],
    [
      'Tax & inventory',
      [
        [FileText, 'VAT Report', 'Input, output, and net VAT', ''],
        [FileText, 'Withholding Tax', 'WHT deductions and credits', ''],
        [FileText, 'Stock Valuation', 'FIFO or weighted average value', ''],
        [FileText, 'Stock Movement', 'Item-level stock activity', ''],
      ],
    ],
  ];
  return (
    <>
      <PageHeader
        title="Reports centre"
        description="Professional financial, operational, tax, inventory, and custom reporting."
        action="Build custom report"
      />
      <div className="report-feature">
        <div>
          <span>
            <Sparkles />
            REPORT INSIGHT
          </span>
          <h2>July gross margin improved by 3.2%</h2>
          <p>
            Higher service revenue and better inventory purchasing contributed ₦2.8m additional
            gross profit.
          </p>
          <button onClick={() => confirmAction('AI report analysis opened')}>
            View analysis <ArrowRight />
          </button>
        </div>
        <div className="report-chart">
          {[42, 68, 55, 82, 74, 93].map((_height, index) => (
            <i className={`report-bar-${index + 1}`} key={index}>
              <span />
            </i>
          ))}
        </div>
      </div>
      <div className="reports-layout">
        <aside>
          <div className="table-search">
            <Search />
            <input placeholder="Find a report…" />
          </div>
          {[
            'All reports',
            'Favourites',
            'Recently viewed',
            'Custom reports',
            'Scheduled reports',
          ].map((x, i) => (
            <button
              className={reportCategory === x ? 'active' : ''}
              key={x}
              onClick={() => setReportCategory(x)}
            >
              {x}
              <span>{[24, 5, 8, 3, 4][i]}</span>
            </button>
          ))}
        </aside>
        <div>
          {groups.map(([title, reports]) => (
            <section className="report-group" key={String(title)}>
              <h2>{String(title)}</h2>
              <div>
                {(reports as unknown as Array<[typeof FileText, string, string, string]>).map(
                  ([Icon, name, desc, id]) => (
                    <button key={name} onClick={() => id && setReport(id)}>
                      <i>
                        <Icon />
                      </i>
                      <span>
                        <strong>{name}</strong>
                        <small>{desc}</small>
                      </span>
                      <ArrowRight />
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export function AIAssistantPage() {
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState('August performance review');
  const conversations = [
    'August performance review',
    'Overdue customer analysis',
    'Q4 cash flow forecast',
    'Marketing spend breakdown',
  ];
  const prompts = [
    [
      CircleDollarSign,
      'Performance',
      'How did we perform this month?',
      'Compare revenue, costs and margin',
    ],
    [Users, 'Receivables', 'Which customers owe us the most?', 'Prioritise overdue collections'],
    [
      FileBarChart,
      'Forecast',
      'Forecast cash for the next 3 months',
      'Model inflows, bills and runway',
    ],
    [WandSparkles, 'Spend', 'Show our five largest expenses', 'Find unusual or avoidable costs'],
  ] as const;
  const ask = (prompt = question) => {
    if (!prompt.trim()) return;
    setQuestion(prompt);
    setSent(true);
  };
  const newConversation = () => {
    setQuestion('');
    setSent(false);
    setHistoryOpen(false);
  };
  return (
    <div className="ai-page ai-page--modern">
      <aside className={historyOpen ? 'is-open' : ''}>
        <div className="ai-history-heading">
          <strong>Conversations</strong>
          <button aria-label="Close conversations" onClick={() => setHistoryOpen(false)}>
            <X />
          </button>
        </div>
        <button className="button" onClick={newConversation}>
          <Plus />
          New conversation
        </button>
        <p>RECENT</p>
        {conversations.map((conversation) => (
          <button
            className={activeConversation === conversation ? 'active' : ''}
            key={conversation}
            onClick={() => {
              setActiveConversation(conversation);
              setQuestion(conversation);
              setSent(false);
              setHistoryOpen(false);
            }}
          >
            <MessageSquare />
            <span>{conversation}</span>
            <MoreHorizontal />
          </button>
        ))}
        <footer>
          <ShieldCheck />
          <span>
            <strong>Private & permission-aware</strong>
            <small>Only uses data you can access.</small>
          </span>
        </footer>
      </aside>
      {historyOpen && (
        <button
          className="ai-history-scrim"
          aria-label="Close conversations"
          onClick={() => setHistoryOpen(false)}
        />
      )}
      <main>
        <header>
          <div>
            <span className="ai-avatar">
              <Bot />
            </span>
            <div>
              <h1>Cephas AI</h1>
              <p>
                <i />
                Ready to analyse your finances
              </p>
            </div>
          </div>
          <span className="ai-context-pill">
            <ShieldCheck />
            Acme Holdings data
          </span>
          <button className="ai-history-trigger" onClick={() => setHistoryOpen(true)}>
            <MessageSquare />
            History
          </button>
          <button
            className="icon-button"
            aria-label="Conversation options"
            onClick={() => confirmAction('Conversation options opened')}
          >
            <MoreHorizontal />
          </button>
        </header>
        <div className="ai-chat">
          {!sent && (
            <div className="ai-welcome">
              <span>
                <Sparkles />
              </span>
              <small className="ai-eyebrow">YOUR FINANCIAL COPILOT</small>
              <h2>Turn your numbers into clear decisions.</h2>
              <p>
                Analyse performance, explain changes, find risks, and build forecasts from the
                financial data you are authorised to view.
              </p>
              <div className="ai-prompt-grid">
                {prompts.map(([Icon, label, prompt, detail]) => (
                  <button key={prompt} onClick={() => ask(prompt)}>
                    <i>
                      <Icon />
                    </i>
                    <span>
                      <small>{label}</small>
                      <strong>{prompt}</strong>
                      <em>{detail}</em>
                    </span>
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </div>
          )}
          {sent && (
            <div className="chat-answer">
              <div className="user-message">{question}</div>
              <div className="assistant-message">
                <span className="ai-avatar">
                  <Bot />
                </span>
                <div>
                  <p>
                    Based on your posted transactions, <strong>August revenue is ₦48.24m</strong>,
                    up 12.8% from the comparable period. Net profit is ₦14.62m with a 30.3% margin.
                  </p>
                  <div className="answer-metrics">
                    <span>
                      <small>Revenue</small>
                      <b>₦48.24m</b>
                      <em>↗ 12.8%</em>
                    </span>
                    <span>
                      <small>Expenses</small>
                      <b>₦29.86m</b>
                      <em>↗ 5.2%</em>
                    </span>
                    <span>
                      <small>Net profit</small>
                      <b>₦14.62m</b>
                      <em>↗ 8.4%</em>
                    </span>
                  </div>
                  <small className="answer-source">
                    <FileText />
                    Sources: Profit & Loss, General Ledger · Updated just now
                  </small>
                  <div className="answer-actions">
                    <button onClick={() => confirmAction('Profit & Loss opened')}>
                      Open source report
                    </button>
                    <button onClick={() => downloadText('cephas-ai-insight.txt', question)}>
                      Download insight
                    </button>
                  </div>
                </div>
              </div>
              <div className="ai-follow-ups">
                <span>Continue exploring</span>
                {[
                  'What caused the change?',
                  'Show branch comparison',
                  'What should we do next?',
                ].map((prompt) => (
                  <button key={prompt} onClick={() => ask(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <div>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask about cash flow, sales, expenses…"
              />
              <button
                type="button"
                aria-label="Attach a file"
                onClick={() => confirmAction('Attachment picker opened')}
              >
                <Paperclip />
              </button>
              <button
                className="send"
                type="submit"
                disabled={!question.trim()}
                aria-label="Send message"
              >
                <Send />
              </button>
            </div>
            <p>Cephas AI can make mistakes. Verify important financial decisions.</p>
          </form>
        </div>
      </main>
    </div>
  );
}

export function LegacyAIAssistantPage() {
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="ai-page">
      <aside>
        <button
          className="button"
          onClick={() => {
            setQuestion('');
            setSent(false);
          }}
        >
          <Plus />
          New conversation
        </button>
        <p>RECENT</p>
        {[
          'August performance review',
          'Overdue customer analysis',
          'Q4 cash flow forecast',
          'Marketing spend breakdown',
        ].map((x, i) => (
          <button
            className={i === 0 ? 'active' : ''}
            key={x}
            onClick={() => {
              setQuestion(x);
              setSent(false);
            }}
          >
            <MessageSquare />
            {x}
            <MoreHorizontal />
          </button>
        ))}
        <footer>
          <ShieldCheck />
          <span>
            <strong>Private & permission-aware</strong>
            <small>AI only accesses data you can view.</small>
          </span>
        </footer>
      </aside>
      <main>
        <header>
          <div>
            <span className="ai-avatar">
              <Bot />
            </span>
            <div>
              <h1>Cephas AI</h1>
              <p>
                <i />
                Ready to analyse your finances
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            aria-label="Conversation options"
            onClick={() => confirmAction('Conversation options opened')}
          >
            <MoreHorizontal />
          </button>
        </header>
        <div className="ai-chat">
          <div className="ai-welcome">
            <span>
              <Sparkles />
            </span>
            <h2>What would you like to understand?</h2>
            <p>
              Ask a question about your company’s authorised financial data. I can analyse trends,
              explain reports, and build forecasts.
            </p>
            <div>
              {[
                'How did we perform this month?',
                'Which customers owe us the most?',
                'Forecast cash for the next 3 months',
                'Show our five largest expenses',
              ].map((x) => (
                <button
                  key={x}
                  onClick={() => {
                    setQuestion(x);
                    setSent(true);
                  }}
                >
                  {x}
                  <ArrowRight />
                </button>
              ))}
            </div>
          </div>
          {sent && (
            <div className="chat-answer">
              <div className="user-message">{question}</div>
              <div className="assistant-message">
                <span className="ai-avatar">
                  <Bot />
                </span>
                <div>
                  <p>
                    Based on your posted transactions, <strong>August revenue is ₦48.24m</strong>,
                    up 12.8% from the comparable period. Net profit is ₦14.62m with a 30.3% margin.
                  </p>
                  <div className="answer-metrics">
                    <span>
                      <small>Revenue</small>
                      <b>₦48.24m</b>
                      <em>↗ 12.8%</em>
                    </span>
                    <span>
                      <small>Expenses</small>
                      <b>₦29.86m</b>
                      <em>↗ 5.2%</em>
                    </span>
                    <span>
                      <small>Net profit</small>
                      <b>₦14.62m</b>
                      <em>↗ 8.4%</em>
                    </span>
                  </div>
                  <small className="answer-source">
                    <FileText />
                    Sources: Profit & Loss, General Ledger · Updated just now
                  </small>
                </div>
              </div>
            </div>
          )}
          <div className="ai-composer">
            <div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask Cephas AI about your business…"
              />
              <button
                aria-label="Attach a file"
                onClick={() => confirmAction('Attachment picker opened')}
              >
                <Paperclip />
              </button>
              <button className="send" onClick={() => setSent(true)}>
                <Send />
              </button>
            </div>
            <p>Cephas AI can make mistakes. Verify important financial decisions.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

const simplePageData: Record<
  string,
  {
    title: string;
    description: string;
    action?: string;
    stats: Array<{
      label: string;
      value: string;
      change?: string;
      tone?: 'positive' | 'warning' | 'danger';
    }>;
    rows: string[][];
  }
> = {
  budgets: {
    title: 'Budgeting',
    description:
      'Plan by company, branch, department, project, and account; compare budget to actual.',
    action: 'Create budget',
    stats: [
      { label: 'Annual budget', value: '₦120m', change: 'FY 2026' },
      { label: 'Actual spend', value: '₦78.4m', change: '65.3%' },
      { label: 'Remaining', value: '₦41.6m', change: '34.7%', tone: 'positive' },
      { label: 'Over budget', value: '3', change: 'Cost centres', tone: 'danger' },
    ],
    rows: [
      ['Marketing', '₦10,000,000', '₦8,120,000', '81.2%', 'On track'],
      ['Operations', '₦28,000,000', '₦21,640,000', '77.3%', 'On track'],
      ['IT & Software', '₦12,000,000', '₦11,820,000', '98.5%', 'At risk'],
      ['Travel', '₦5,000,000', '₦5,640,000', '112.8%', 'Over budget'],
    ],
  },
  tax: {
    title: 'Tax management',
    description:
      'Configure jurisdiction-aware VAT, withholding, sales, purchase, and exemption rules.',
    action: 'New tax return',
    stats: [
      { label: 'Net VAT payable', value: '₦2.18m', change: 'Due 29 Aug', tone: 'warning' },
      { label: 'Output VAT', value: '₦3.42m' },
      { label: 'Input VAT', value: '₦1.24m' },
      { label: 'WHT credits', value: '₦420k', change: 'Available' },
    ],
    rows: [
      ['VAT · July 2026', '₦2,184,500', '29 Aug 2026', 'FIRS', 'Ready to file'],
      ['WHT · July 2026', '₦685,200', '21 Aug 2026', 'FIRS', 'Filed'],
      ['VAT · June 2026', '₦1,942,000', '31 Jul 2026', 'FIRS', 'Paid'],
    ],
  },
  payroll: {
    title: 'Payroll integration',
    description:
      'Connect Cephas HR or external payroll and post approved payroll journals to the ledger.',
    action: 'Import payroll',
    stats: [
      { label: 'August payroll', value: '₦12.46m', change: '84 employees' },
      { label: 'PAYE payable', value: '₦1.82m', change: 'Due 10 Sep', tone: 'warning' },
      { label: 'Pension', value: '₦1.24m' },
      { label: 'Status', value: 'Approved', change: 'Ready to post', tone: 'positive' },
    ],
    rows: [
      ['August 2026', '84 employees', '₦12,460,000', 'JRN-00672', 'Approved'],
      ['July 2026', '82 employees', '₦11,980,000', 'JRN-00618', 'Posted'],
      ['June 2026', '81 employees', '₦11,720,000', 'JRN-00582', 'Posted'],
    ],
  },
  approvals: {
    title: 'Approvals',
    description: 'Review transactions routed by amount, department, branch, and transaction type.',
    stats: [
      { label: 'Awaiting you', value: '8', change: '₦6.42m', tone: 'warning' },
      { label: 'Approved today', value: '12', change: '₦8.8m', tone: 'positive' },
      { label: 'Average time', value: '4.2h', change: '−18%', tone: 'positive' },
      { label: 'Escalated', value: '2', change: 'Needs action', tone: 'danger' },
    ],
    rows: [
      [
        'EXP-00194 · Meta Platforms',
        'Marketing · Ada Okafor',
        '₦420,000',
        'Manager → Finance',
        'Awaiting you',
      ],
      [
        'BILL-00482 · Cloud Systems',
        'IT · Emeka Okoro',
        '₦680,000',
        'Manager → Finance',
        'Awaiting you',
      ],
      [
        'PO-00231 · Dell Technologies',
        'Operations · Tobi Adeyemi',
        '₦3,850,000',
        'Finance → CFO',
        'CFO review',
      ],
    ],
  },
  documents: {
    title: 'Documents',
    description:
      'Store and link receipts, contracts, bills, statements, tax files, and spreadsheets.',
    action: 'Upload documents',
    stats: [
      { label: 'Documents', value: '1,842', change: '+86 this month' },
      { label: 'Linked', value: '1,706', change: '92.6%', tone: 'positive' },
      { label: 'Needs review', value: '24', change: 'OCR complete', tone: 'warning' },
      { label: 'Storage', value: '4.8 GB', change: 'of 20 GB' },
    ],
    rows: [
      ['GTBank-Aug-2026.pdf', 'Bank statement', '2.4 MB', 'Banking', '17 Aug 2026'],
      ['Receipt-Meta-1408.jpg', 'Receipt', '860 KB', 'EXP-00194', '14 Aug 2026'],
      ['Apex-Contract-2026.pdf', 'Contract', '4.1 MB', 'Apex Retail', '12 Aug 2026'],
    ],
  },
  audit: {
    title: 'Audit logs',
    description: 'Immutable history of sensitive actions, data changes, access, and exports.',
    stats: [
      { label: 'Events today', value: '284' },
      { label: 'High risk', value: '2', change: 'Investigate', tone: 'danger' },
      { label: 'Users active', value: '36' },
      { label: 'Exports', value: '14', change: 'This week' },
    ],
    rows: [
      [
        'Tobi Adeyemi',
        'Edited invoice INV-00245',
        '₦2.4m → ₦2.5m',
        '102.89.23.14',
        '17 Aug · 10:42',
      ],
      [
        'Ada Okafor',
        'Approved expense EXP-00192',
        'Status changed',
        '105.112.43.8',
        '17 Aug · 09:18',
      ],
      ['System', 'Posted payment journal', 'JRN-00678', 'Automated', '17 Aug · 08:54'],
    ],
  },
};

export function SimpleFeaturePage({ type }: { type: string }) {
  const data = simplePageData[type] ?? simplePageData.budgets;
  return (
    <>
      <PageHeader title={data.title} description={data.description} action={data.action} />
      <StatsGrid stats={data.stats} />
      <section className="panel register-panel">
        <DataTable
          columns={[
            { key: 'a', label: type === 'audit' ? 'User' : 'Name / period' },
            { key: 'b', label: type === 'audit' ? 'Action' : 'Scope / detail' },
            { key: 'c', label: 'Amount / change', align: 'right' },
            { key: 'd', label: 'Reference' },
            { key: 'status', label: 'Status' },
          ]}
          rows={data.rows.map((r) => ({ a: r[0], b: r[1], c: r[2], d: r[3], status: r[4] }))}
        />
      </section>
    </>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Bot, Download, Plus, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { confirmAction, downloadText } from '@/utils/actions';
import {
  insightsApi,
  type AiInsight,
  type InsightAnalytics,
  type InsightReport,
  type InsightsView,
  type SavedReport,
  type WorkbookConnection,
} from '@/services/insights';

const money = (value: string | number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value),
  );
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: value.includes('T') ? 'short' : undefined,
      })
    : 'Never';
const title: Record<InsightsView, string> = {
  reports: 'Reports',
  'custom-reports': 'Custom report builder',
  analytics: 'Analytics',
  'ai-assistant': 'Cephas AI',
  'excel-sync': 'Excel data sync',
};

export function InsightsAutomationPage({ view, role }: { view: InsightsView; role: string }) {
  const canEdit = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  if (view === 'ai-assistant') return <AiPage canManage={canEdit} />;
  if (view === 'custom-reports')
    return <SavedReportsPage canEdit={canEdit} canDelete={['OWNER', 'ADMIN'].includes(role)} />;
  if (view === 'excel-sync')
    return <SyncPage canEdit={canEdit} canDelete={['OWNER', 'ADMIN'].includes(role)} />;
  return <ReportingPage analytics={view === 'analytics'} />;
}

function ReportingPage({ analytics }: { analytics: boolean }) {
  const [data, setData] = useState<InsightReport | InsightAnalytics | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await (analytics ? insightsApi.analytics({ from, to }) : insightsApi.reports({ from, to })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load insights');
    } finally {
      setLoading(false);
    }
  }, [analytics, from, to]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);
  const exportCsv = () =>
    data &&
    downloadText(
      `${analytics ? 'analytics' : 'reports'}.csv`,
      ['Metric,Value', ...Object.entries(data.metrics).map(([k, v]) => `"${k}","${v}"`)].join('\n'),
    );
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{analytics ? 'Analytics' : 'Reports'}</h1>
          <p>
            {analytics
              ? 'Track financial and operating performance from your live records.'
              : 'Review current financial reports from connected business records.'}
          </p>
        </div>
        <button className="button button--secondary" disabled={!data} onClick={exportCsv}>
          <Download size={17} /> Export CSV
        </button>
      </div>
      <section className="panel">
        <div className="banking-filters">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            className="button button--secondary"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            Clear dates
          </button>
        </div>
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
      </section>
      {loading ? (
        <div className="banking-state">
          <RefreshCw className="spin" /> Loading insights…
        </div>
      ) : (
        data && (
          <>
            <StatsGrid
              stats={[
                { label: 'Revenue', value: money(data.metrics.revenue, data.currency) },
                { label: 'Expenses', value: money(data.metrics.expenses, data.currency) },
                {
                  label: 'Profit',
                  value: money(data.metrics.profit, data.currency),
                  tone: Number(data.metrics.profit) >= 0 ? 'positive' : 'danger',
                },
                { label: 'Cash', value: money(data.metrics.cash, data.currency) },
              ]}
            />
            <section className="panel register-panel">
              <header className="panel-header">
                <div>
                  <h2>Financial position</h2>
                  <p>Live balances for the selected period.</p>
                </div>
              </header>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Receivables', data.metrics.receivables],
                      ['Payables', data.metrics.payables],
                      ['Inventory value', data.metrics.inventoryValue],
                      ['Cash in', data.cashFlow.moneyIn],
                      ['Cash out', data.cashFlow.moneyOut],
                      ['Project budget', data.projects.budget],
                      ['Project actual cost', data.projects.actualCost],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{money(value, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {analytics && (
              <section className="panel register-panel">
                <header className="panel-header">
                  <div>
                    <h2>Monthly trend</h2>
                    <p>Revenue and direct expense activity by month.</p>
                  </div>
                </header>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        <th>Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data as InsightAnalytics).trend.map((x) => (
                        <tr key={x.month}>
                          <td>{x.month}</td>
                          <td>{money(x.revenue, data.currency)}</td>
                          <td>{money(x.expenses, data.currency)}</td>
                        </tr>
                      ))}
                      {!(data as InsightAnalytics).trend.length && (
                        <tr>
                          <td colSpan={3} className="table-empty">
                            No activity exists in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )
      )}
    </>
  );
}

function SavedReportsPage({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<SavedReport[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [archived, setArchived] = useState(''),
    [preview, setPreview] = useState<{ report: SavedReport; data: InsightReport } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await insightsApi.savedReports(archived));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load saved reports');
    } finally {
      setLoading(false);
    }
  }, [archived]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load());
    return () => window.clearTimeout(timer);
  }, [load]);
  const run = async (op: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await op();
      setOpen(false);
      confirmAction(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update report');
    } finally {
      setBusy(false);
    }
  };
  const openReport = async (report: SavedReport) => {
    setBusy(true);
    setError('');
    try {
      const data = await insightsApi.reports({
        from: report.dateFrom?.slice(0, 10) ?? '',
        to: report.dateTo?.slice(0, 10) ?? '',
      });
      setPreview({ report, data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open report');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title['custom-reports']}</h1>
          <p>Save reusable report definitions with controlled periods and report types.</p>
        </div>
        {canEdit && (
          <button className="button" onClick={() => setOpen(true)}>
            <Plus size={17} /> New report
          </button>
        )}
      </div>
      <section className="panel register-panel">
        <div className="banking-filters">
          <select
            aria-label="Report status"
            value={archived}
            onChange={(e) => setArchived(e.target.value)}
          >
            <option value="">Active reports</option>
            <option value="true">Archived reports</option>
            <option value="all">All reports</option>
          </select>
        </div>
        {error && (
          <div className="banking-alert" role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="banking-state">
            <RefreshCw className="spin" /> Loading…
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name}
                      <small>{x.description}</small>
                    </td>
                    <td>{x.type.replaceAll('_', ' ')}</td>
                    <td>
                      {x.dateFrom
                        ? `${date(x.dateFrom)} – ${x.dateTo ? date(x.dateTo) : 'Present'}`
                        : 'All time'}
                    </td>
                    <td>{x.isArchived ? 'Archived' : 'Active'}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={busy} onClick={() => void openReport(x)}>
                          Open
                        </button>
                        {canEdit && (
                          <button
                            aria-label={`Delete ${x.name}`}
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => insightsApi.reportStatus(x.id, !x.isArchived),
                                x.isArchived ? 'Report restored' : 'Report archived',
                              )
                            }
                          >
                            {x.isArchived ? 'Restore' : 'Archive'}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              window.confirm(`Delete ${x.name}?`) &&
                              void run(() => insightsApi.deleteReport(x.id), 'Report deleted')
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No saved reports in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ReportModal
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSave={(data) => void run(() => insightsApi.createReport(data), 'Custom report saved')}
      />
      <ReportPreview value={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function ReportPreview({
  value,
  onClose,
}: {
  value: { report: SavedReport; data: InsightReport } | null;
  onClose: () => void;
}) {
  if (!value) return null;
  const { report, data } = value;
  return (
    <Modal
      open
      title={report.name}
      subtitle={`${report.type.replaceAll('_', ' ')} · ${report.dateFrom ? `${date(report.dateFrom)} to ${report.dateTo ? date(report.dateTo) : 'present'}` : 'All time'}`}
      onClose={onClose}
      footer={
        <button className="button" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.metrics).map(([key, metric]) => (
              <tr key={key}>
                <td>{key.replace(/([A-Z])/g, ' $1')}</td>
                <td>{key === 'activeProjects' ? metric : money(metric, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ReportModal({
  open,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave(Object.fromEntries([...f.entries()].filter(([, v]) => v !== '')));
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create custom report"
      subtitle="Save a reusable report definition."
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Report name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Report type
            <select name="type" defaultValue="EXECUTIVE">
              {[
                'EXECUTIVE',
                'PROFIT_LOSS',
                'CASH_FLOW',
                'RECEIVABLES',
                'PAYABLES',
                'INVENTORY',
                'PROJECTS',
              ].map((x) => (
                <option key={x}>{x.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input name="dateFrom" type="date" />
          </label>
          <label>
            To
            <input name="dateTo" type="date" />
          </label>
          <label className="form-grid__full">
            Description
            <textarea name="description" maxLength={300} />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-form-actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AiPage({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<AiInsight[]>([]),
    [question, setQuestion] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await insightsApi.aiHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load AI history');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load());
    return () => window.clearTimeout(timer);
  }, [load]);
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError('');
    try {
      const answer = await insightsApi.askAi(question.trim());
      setRows((r) => [answer, ...r]);
      setQuestion('');
      confirmAction('Insight generated from your live records');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate insight');
    } finally {
      setBusy(false);
    }
  };
  const suggestions = [
    'How profitable are we?',
    'What are our receivables?',
    'Summarise our cash position',
    'What is our inventory value?',
  ];
  return (
    <div className="cephas-ai-page">
      <div className="page-header cephas-ai-header">
        <div>
          <h1>Cephas AI</h1>
          <p>
            Ask questions grounded in your organisation’s current financial and operating records.
          </p>
        </div>
        {canManage && rows.length > 0 && (
          <button
            className="button button--secondary"
            onClick={() =>
              window.confirm('Clear all AI history?') &&
              void insightsApi
                .clearAi()
                .then(() => {
                  setRows([]);
                  confirmAction('AI history cleared');
                })
                .catch((e: Error) => setError(e.message))
            }
          >
            Clear history
          </button>
        )}
      </div>
      <section className="panel cephas-ai-composer">
        <div className="cephas-ai-composer__intro">
          <span>
            <Sparkles size={20} />
          </span>
          <div>
            <h2>Ask Cephas</h2>
            <p>Get a concise answer based on your latest business records.</p>
          </div>
        </div>
        <form onSubmit={ask} className="cephas-ai-form">
          <label htmlFor="cephas-ai-question">
            Your question
            <textarea
              id="cephas-ai-question"
              value={question}
              maxLength={500}
              required
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is our current profitability position?"
            />
          </label>
          {error && (
            <div className="banking-alert" role="alert">
              {error}
            </div>
          )}
          <div className="cephas-ai-form__footer">
            <small>{question.length}/500</small>
            <button className="button" disabled={busy || !question.trim()}>
              {busy ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
              {busy ? 'Analysing…' : 'Ask Cephas AI'}
            </button>
          </div>
        </form>
        <div className="cephas-ai-suggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </section>
      {loading ? (
        <div className="banking-state">
          <RefreshCw className="spin" /> Loading…
        </div>
      ) : (
        <section className="panel cephas-ai-history">
          <div className="cephas-ai-history__heading">
            <div>
              <h2>Recent insights</h2>
              <p>Your organisation’s latest Cephas AI questions.</p>
            </div>
            <span>{rows.length}</span>
          </div>
          {rows.map((x) => (
            <article className="insight-answer" key={x.id}>
              <header>
                <Bot size={20} />
                <strong>{x.question}</strong>
                <small>{date(x.createdAt)}</small>
              </header>
              <p>{x.answer}</p>
            </article>
          ))}
          {!rows.length && (
            <div className="banking-state">
              Ask your first question to create a grounded insight.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SyncPage({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<WorkbookConnection[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await insightsApi.workbooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load sync connections');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load());
    return () => window.clearTimeout(timer);
  }, [load]);
  const run = async (op: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await op();
      setOpen(false);
      confirmAction(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update connection');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Excel data sync</h1>
          <p>Manage CSV-compatible workbook imports and exports for authorised business data.</p>
        </div>
        {canEdit && (
          <button className="button" onClick={() => setOpen(true)}>
            <Plus size={17} /> New connection
          </button>
        )}
      </div>
      <section className="panel register-panel">
        {error && (
          <div className="banking-alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="banking-state">
            <RefreshCw className="spin" /> Loading…
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Connection</th>
                  <th>Source</th>
                  <th>Direction</th>
                  <th>Last sync</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name}
                      <small>{x.fileName}</small>
                    </td>
                    <td>{x.dataSource}</td>
                    <td>{x.direction.replace('_', ' ')}</td>
                    <td>
                      {date(x.lastSyncedAt)} · {x.rowsSynced} rows
                    </td>
                    <td>{x.status}</td>
                    <td>
                      <div className="inline-actions">
                        {canEdit && (
                          <>
                            <button
                              disabled={busy || x.status === 'PAUSED'}
                              onClick={() =>
                                void run(
                                  () => insightsApi.runSync(x.id),
                                  `${x.name} synced successfully`,
                                )
                              }
                            >
                              Sync now
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () =>
                                    insightsApi.workbookStatus(
                                      x.id,
                                      x.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
                                    ),
                                  x.status === 'PAUSED'
                                    ? 'Connection resumed'
                                    : 'Connection paused',
                                )
                              }
                            >
                              {x.status === 'PAUSED' ? 'Resume' : 'Pause'}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              window.confirm(`Delete ${x.name}?`) &&
                              void run(() => insightsApi.deleteWorkbook(x.id), 'Connection deleted')
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No workbook connections yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <WorkbookModal
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSave={(data) =>
          void run(() => insightsApi.createWorkbook(data), 'Workbook connection created')
        }
      />
    </>
  );
}

function WorkbookModal({
  open,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(Object.fromEntries(new FormData(e.currentTarget)));
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New workbook connection"
      subtitle="Configure a CSV-compatible import or export."
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Data source
            <select name="dataSource">
              {['invoices', 'expenses', 'products', 'projects', 'customers', 'suppliers'].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Direction
            <select name="direction">
              <option>EXPORT</option>
              <option>IMPORT</option>
              <option>TWO_WAY</option>
            </select>
          </label>
          <label>
            Workbook filename
            <input name="fileName" placeholder="finance-export.csv" />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-form-actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Creating…' : 'Create connection'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

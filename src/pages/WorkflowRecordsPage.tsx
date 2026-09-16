import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Bell, Download, FileText, Play, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAction } from '@/utils/actions';
import {
  workflowApi,
  type AppNotification,
  type ApprovalRequest,
  type DocumentRecord,
  type WorkflowRule,
  type WorkflowSummary,
  type WorkflowView,
} from '@/services/workflow';

const titles: Record<WorkflowView, string> = {
  documents: 'Documents',
  approvals: 'Approvals',
  notifications: 'Notifications',
  workflows: 'Workflow automation',
};
const descriptions: Record<WorkflowView, string> = {
  documents: 'Securely store and link supporting files to business records.',
  approvals: 'Route real business records for controlled review and decisions.',
  notifications: 'Review workflow, financial, operational, and system updates.',
  workflows: 'Configure and run traceable rules for repeatable business processes.',
};
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';
const money = (value?: string) =>
  value
    ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value))
    : '—';
const bytes = (value: number) =>
  value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
const base64ToBlob = (content: string, mime: string) => {
  const binary = atob(content);
  const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([data.buffer as ArrayBuffer], { type: mime });
};

export function WorkflowRecordsPage({ view, role }: { view: WorkflowView; role: string }) {
  const canManage = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role);
  const canApprove = canManage || role === 'APPROVER';
  const canDelete = ['OWNER', 'ADMIN'].includes(role);
  const canUpload = canManage || role === 'MEMBER';
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);
  const [rows, setRows] = useState<
    Array<DocumentRecord | ApprovalRequest | AppNotification | WorkflowRule>
  >([]);
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const overview = await workflowApi.summary();
      setSummary(overview);
      if (view === 'documents') setRows(await workflowApi.documents({ search, status }));
      else if (view === 'approvals') setRows(await workflowApi.approvals({ search, status }));
      else if (view === 'notifications')
        setRows(await workflowApi.notifications({ category: status, unread: search }));
      else setRows(await workflowApi.rules({ search, status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load workflow records');
    } finally {
      setLoading(false);
    }
  }, [view, search, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setOpen(false);
      setSelected(null);
      confirmAction(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete this action');
    } finally {
      setBusy(false);
    }
  };
  const actionAllowed =
    view === 'documents'
      ? canUpload
      : view === 'approvals'
        ? canUpload
        : view === 'notifications'
          ? canManage
          : canManage;
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{titles[view]}</h1>
          <p>{descriptions[view]}</p>
        </div>
        {actionAllowed && (
          <button className="button" onClick={() => setOpen(true)}>
            <Plus size={17} />
            {view === 'documents'
              ? 'Upload document'
              : view === 'approvals'
                ? 'New request'
                : view === 'notifications'
                  ? 'New notification'
                  : 'Create workflow'}
          </button>
        )}
      </div>
      {summary && (
        <StatsGrid
          stats={[
            { label: 'Documents', value: String(summary.documents) },
            {
              label: 'Pending approvals',
              value: String(summary.pendingApprovals),
              tone: summary.pendingApprovals ? 'warning' : 'positive',
            },
            { label: 'Unread notifications', value: String(summary.unreadNotifications) },
            {
              label: 'Active workflows',
              value: String(summary.activeRules),
              change: `${summary.runs} runs · ${summary.failures} exceptions`,
            },
          ]}
        />
      )}
      <section className="panel register-panel workflow-records-panel">
        <Filters
          view={view}
          search={search}
          status={status}
          onSearch={setSearch}
          onStatus={setStatus}
        />
        {view === 'notifications' && summary?.unreadNotifications ? (
          <div className="workflow-toolbar">
            <span>
              {summary.unreadNotifications} unread notification
              {summary.unreadNotifications === 1 ? '' : 's'}
            </span>
            <button
              disabled={busy}
              onClick={() =>
                void run(() => workflowApi.readAll(), 'All notifications marked as read')
              }
            >
              Mark all read
            </button>
          </div>
        ) : null}
        {error && (
          <div className="banking-alert" role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <LoadingState label="Loading workflow records…" />
        ) : (
          <RecordsTable
            view={view}
            role={role}
            rows={rows}
            busy={busy}
            canManage={canManage}
            canApprove={canApprove}
            canDelete={canDelete}
            onRun={run}
            onSelect={(approval) => {
              setSelected(approval);
              setOpen(true);
            }}
          />
        )}
      </section>
      <CreateModal
        view={view}
        open={open}
        selected={selected}
        busy={busy}
        error={error}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        onRun={run}
      />
    </>
  );
}

function Filters({
  view,
  search,
  status,
  onSearch,
  onStatus,
}: {
  view: WorkflowView;
  search: string;
  status: string;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
}) {
  const options =
    view === 'documents'
      ? ['ACTIVE', 'ARCHIVED']
      : view === 'approvals'
        ? ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
        : view === 'notifications'
          ? ['FINANCIAL', 'APPROVALS', 'OPERATIONS', 'SYSTEM']
          : ['ACTIVE', 'PAUSED'];
  return (
    <div className="banking-filters workflow-filters">
      {view === 'notifications' ? (
        <select aria-label="Read status" value={search} onChange={(e) => onSearch(e.target.value)}>
          <option value="">All notifications</option>
          <option value="true">Unread only</option>
        </select>
      ) : (
        <input
          aria-label="Search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={`Search ${titles[view].toLowerCase()}`}
        />
      )}
      <select aria-label="Filter" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">All {view === 'notifications' ? 'categories' : 'statuses'}</option>
        {options.map((x) => (
          <option key={x}>{x.replaceAll('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}

function RecordsTable({
  view,
  role,
  rows,
  busy,
  canManage,
  canApprove,
  canDelete,
  onRun,
  onSelect,
}: {
  view: WorkflowView;
  role: string;
  rows: Array<DocumentRecord | ApprovalRequest | AppNotification | WorkflowRule>;
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  canDelete: boolean;
  onRun: (op: () => Promise<unknown>, message: string) => Promise<void>;
  onSelect: (row: ApprovalRequest) => void;
}) {
  const download = async (item: DocumentRecord) => {
    const result = await workflowApi.downloadDocument(item.id);
    const url = URL.createObjectURL(base64ToBlob(result.contentBase64, result.mimeType));
    const link = document.createElement('a');
    link.href = url;
    link.download = result.name;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (!rows.length)
    return (
      <div className="banking-state">
        No {titles[view].toLowerCase()} match the selected filters.
      </div>
    );
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns(view).map((x) => (
              <th key={x}>{x}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {cells(view, row).map((x, i) => (
                <td key={i}>{x}</td>
              ))}
              <td>
                <div className="inline-actions">
                  {view === 'documents' && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void onRun(
                            () => download(row as DocumentRecord),
                            `${(row as DocumentRecord).name} downloaded`,
                          )
                        }
                      >
                        <Download size={15} />
                        Download
                      </button>
                      {canManage && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void onRun(
                              () =>
                                workflowApi.documentStatus(
                                  row.id,
                                  (row as DocumentRecord).status === 'ACTIVE'
                                    ? 'ARCHIVED'
                                    : 'ACTIVE',
                                ),
                              (row as DocumentRecord).status === 'ACTIVE'
                                ? 'Document archived'
                                : 'Document restored',
                            )
                          }
                        >
                          {(row as DocumentRecord).status === 'ACTIVE' ? 'Archive' : 'Restore'}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          aria-label="Delete document"
                          disabled={busy}
                          onClick={() =>
                            window.confirm('Permanently delete this document?') &&
                            void onRun(() => workflowApi.deleteDocument(row.id), 'Document deleted')
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  )}
                  {view === 'approvals' &&
                    canApprove &&
                    (['OWNER', 'ADMIN'].includes(role) ||
                      (row as ApprovalRequest).assignedRole === role) &&
                    (row as ApprovalRequest).status === 'PENDING' && (
                      <button disabled={busy} onClick={() => onSelect(row as ApprovalRequest)}>
                        Review
                      </button>
                    )}
                  {view === 'notifications' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void onRun(
                          () =>
                            workflowApi.readNotification(row.id, !(row as AppNotification).isRead),
                          (row as AppNotification).isRead
                            ? 'Notification marked unread'
                            : 'Notification marked read',
                        )
                      }
                    >
                      {(row as AppNotification).isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                  )}
                  {view === 'workflows' && canManage && (
                    <>
                      <button
                        disabled={busy || (row as WorkflowRule).status === 'PAUSED'}
                        onClick={() =>
                          void onRun(
                            () => workflowApi.runRule(row.id),
                            'Workflow completed successfully',
                          )
                        }
                      >
                        <Play size={15} />
                        Run
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void onRun(
                            () =>
                              workflowApi.ruleStatus(
                                row.id,
                                (row as WorkflowRule).status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                              ),
                            (row as WorkflowRule).status === 'ACTIVE'
                              ? 'Workflow paused'
                              : 'Workflow resumed',
                          )
                        }
                      >
                        {(row as WorkflowRule).status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                      {canDelete && (
                        <button
                          aria-label="Delete workflow"
                          disabled={busy}
                          onClick={() =>
                            window.confirm('Delete this workflow?') &&
                            void onRun(() => workflowApi.deleteRule(row.id), 'Workflow deleted')
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const columns = (view: WorkflowView) =>
  view === 'documents'
    ? ['Document', 'Category', 'Linked record', 'Size', 'Uploaded']
    : view === 'approvals'
      ? ['Request', 'Record', 'Amount', 'Requested by', 'Status']
      : view === 'notifications'
        ? ['Notification', 'Category', 'Created', 'Status']
        : ['Workflow', 'Trigger', 'Action', 'Runs', 'Status'];
const cells = (
  view: WorkflowView,
  row: DocumentRecord | ApprovalRequest | AppNotification | WorkflowRule,
): Array<string | ReactNode> => {
  if (view === 'documents') {
    const x = row as DocumentRecord;
    return [
      <span className="workflow-primary">
        <FileText size={16} />
        <span>
          <strong>{x.name}</strong>
          <small>{x.mimeType}</small>
        </span>
      </span>,
      x.category,
      x.linkedReference || 'Not linked',
      bytes(x.size),
      date(x.createdAt),
    ];
  }
  if (view === 'approvals') {
    const x = row as ApprovalRequest;
    return [
      <span className="workflow-primary">
        <strong>{x.title}</strong>
        <small>{x.notes}</small>
      </span>,
      `${x.entityType.replaceAll('_', ' ')} · ${x.reference}`,
      money(x.amount),
      x.requestedBy,
      x.status,
    ];
  }
  if (view === 'notifications') {
    const x = row as AppNotification;
    return [
      <span className="workflow-primary">
        <Bell size={16} />
        <span>
          <strong>{x.title}</strong>
          <small>{x.message}</small>
        </span>
      </span>,
      x.category,
      date(x.createdAt),
      x.isRead ? 'Read' : 'Unread',
    ];
  }
  const x = row as WorkflowRule;
  return [
    <span className="workflow-primary">
      <strong>{x.name}</strong>
      <small>{x.condition}</small>
    </span>,
    x.event.replaceAll('_', ' '),
    x.action.replaceAll('_', ' '),
    `${x.runCount} (${x.failureCount} failed)`,
    x.status,
  ];
};

function CreateModal({
  view,
  open,
  selected,
  busy,
  error,
  onClose,
  onRun,
}: {
  view: WorkflowView;
  open: boolean;
  selected: ApprovalRequest | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onRun: (op: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ''));
    if (view === 'documents') {
      const file = form.get('file') as File;
      if (!file?.size) return;
      if (file.size > 5 * 1024 * 1024)
        return void onRun(() => Promise.reject(new Error('Documents must be 5 MB or smaller')), '');
      const contentBase64 = await readFile(file);
      delete data.file;
      await onRun(
        () =>
          workflowApi.createDocument({
            ...data,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64,
          }),
        'Document uploaded',
      );
    } else if (view === 'approvals') {
      if (selected)
        await onRun(
          () => workflowApi.decideApproval(selected.id, data),
          `Request ${String(data.status).toLowerCase()}`,
        );
      else
        await onRun(
          () =>
            workflowApi.createApproval({
              ...data,
              amount: data.amount ? Number(data.amount) : undefined,
            }),
          'Approval request submitted',
        );
    } else if (view === 'notifications')
      await onRun(() => workflowApi.createNotification(data), 'Notification created');
    else await onRun(() => workflowApi.createRule(data), 'Workflow created');
  };
  const label = selected
    ? 'Review approval'
    : view === 'documents'
      ? 'Upload document'
      : view === 'approvals'
        ? 'Create approval request'
        : view === 'notifications'
          ? 'Create notification'
          : 'Create workflow';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={label}
      subtitle={selected ? `${selected.reference} · ${selected.title}` : descriptions[view]}
    >
      <form onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          {selected ? (
            <DecisionFields />
          ) : view === 'documents' ? (
            <DocumentFields />
          ) : view === 'approvals' ? (
            <ApprovalFields />
          ) : view === 'notifications' ? (
            <NotificationFields />
          ) : (
            <RuleFields />
          )}
        </div>
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <div className="modal-form-actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
const DocumentFields = () => (
  <>
    <label className="form-grid__full">
      File
      <input
        name="file"
        type="file"
        required
        accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
      />
    </label>
    <label>
      Category
      <select name="category">
        <option>Receipt</option>
        <option>Contract</option>
        <option>Statement</option>
        <option>Tax</option>
        <option>Spreadsheet</option>
        <option>Other</option>
      </select>
    </label>
    <label>
      Linked record type
      <select name="linkedType">
        <option value="">Not linked</option>
        <option>INVOICE</option>
        <option>BILL</option>
        <option>EXPENSE</option>
        <option>PROJECT</option>
      </select>
    </label>
    <label>
      Linked reference
      <input name="linkedReference" placeholder="e.g. INV-00245" />
    </label>
    <label className="form-grid__full">
      Notes
      <textarea name="notes" maxLength={500} />
    </label>
  </>
);
const ApprovalFields = () => (
  <>
    <label>
      Title
      <input name="title" required maxLength={140} />
    </label>
    <label>
      Record type
      <select name="entityType">
        <option>INVOICE</option>
        <option>BILL</option>
        <option>EXPENSE</option>
        <option>PURCHASE_ORDER</option>
        <option>PROJECT</option>
        <option>MANUAL</option>
      </select>
    </label>
    <label>
      Record reference
      <input name="reference" required />
    </label>
    <label>
      Amount
      <input name="amount" type="number" min="0" step="0.01" />
    </label>
    <label>
      Assign to
      <select name="assignedRole">
        <option>APPROVER</option>
        <option>ACCOUNTANT</option>
        <option>ADMIN</option>
        <option>OWNER</option>
      </select>
    </label>
    <label className="form-grid__full">
      Notes
      <textarea name="notes" maxLength={500} />
    </label>
  </>
);
const DecisionFields = () => (
  <>
    <label>
      Decision
      <select name="status">
        <option>APPROVED</option>
        <option>REJECTED</option>
        <option>CANCELLED</option>
      </select>
    </label>
    <label className="form-grid__full">
      Decision note
      <textarea name="decisionNote" maxLength={500} />
    </label>
  </>
);
const NotificationFields = () => (
  <>
    <label>
      Title
      <input name="title" required maxLength={120} />
    </label>
    <label>
      Category
      <select name="category">
        <option>FINANCIAL</option>
        <option>APPROVALS</option>
        <option>OPERATIONS</option>
        <option>SYSTEM</option>
      </select>
    </label>
    <label className="form-grid__full">
      Message
      <textarea name="message" required maxLength={500} />
    </label>
  </>
);
const RuleFields = () => (
  <>
    <label>
      Name
      <input name="name" required maxLength={100} />
    </label>
    <label>
      Trigger
      <select name="event">
        <option>INVOICE_CREATED</option>
        <option>BILL_CREATED</option>
        <option>EXPENSE_CREATED</option>
        <option>APPROVAL_DECIDED</option>
        <option>STOCK_LOW</option>
        <option>MANUAL</option>
      </select>
    </label>
    <label className="form-grid__full">
      Condition
      <input
        name="condition"
        required
        placeholder="Always, or: amount exceeds 500000"
        maxLength={300}
      />
    </label>
    <label>
      Action
      <select name="action">
        <option>CREATE_APPROVAL</option>
        <option>SEND_NOTIFICATION</option>
        <option>FLAG_FOR_REVIEW</option>
      </select>
    </label>
  </>
);
const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected document'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });

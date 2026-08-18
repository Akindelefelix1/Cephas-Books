import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  FileText,
  Landmark,
  ReceiptText,
  ShoppingCart,
  WalletCards,
} from 'lucide-react';
import { LandingPage } from '@/pages/LandingPage';
import { MarketingDetailPage } from '@/pages/MarketingDetailPage';
import { AuthPage, OnboardingPage } from '@/pages/AuthPages';
import { AppShell } from '@/layouts/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ModulePage } from '@/pages/ModulePage';
import { modules } from '@/data/modules';
import { getFallbackModule } from '@/data/fallbackModules';
import {
  AccountingPage,
  AIAssistantPage,
  BankingPage,
  ReportsPage,
  SimpleFeaturePage,
} from '@/pages/SpecialPages';
import { NotificationsPage, ProfilePage, SettingsPage, UsersPage } from '@/pages/AdminPages';
import { Modal } from '@/components/ui/Modal';
import type { View } from '@/types/app';
import type { MarketingView } from '@/types/app';

export function App() {
  const [view, setView] = useState<View>('landing');
  const [active, setActive] = useState('dashboard');
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);
  const navigate = (id: string) => {
    setActive(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (view === 'landing') return <LandingPage onView={setView} />;
  if (['platform', 'solutions', 'pricing', 'security', 'resources'].includes(view))
    return <MarketingDetailPage page={view as MarketingView} onView={setView} />;
  if (view === 'login' || view === 'register' || view === 'forgot' || view === 'mfa')
    return <AuthPage mode={view} onView={setView} />;
  if (view === 'onboarding') return <OnboardingPage onComplete={() => setView('app')} />;
  const content = (() => {
    if (active === 'dashboard')
      return <DashboardPage onNavigate={navigate} onCreate={() => setQuick(true)} />;
    if (modules[active]) return <ModulePage key={active} definition={modules[active]} />;
    if (active === 'banking' || active === 'transactions') return <BankingPage />;
    if (active === 'reconciliation') return <BankingPage reconciliation />;
    if (['chart-of-accounts', 'journals', 'general-ledger', 'trial-balance'].includes(active))
      return <AccountingPage type={active} />;
    if (active === 'reports') return <ReportsPage />;
    if (active === 'ai-assistant') return <AIAssistantPage />;
    if (active === 'users') return <UsersPage />;
    if (active === 'notifications') return <NotificationsPage />;
    if (active === 'profile') return <ProfilePage onLogout={() => setView('landing')} />;
    if (['settings', 'security', 'integrations', 'branches', 'currencies'].includes(active))
      return <SettingsPage type={active} />;
    if (['budgets', 'tax', 'payroll', 'approvals', 'documents', 'audit-logs'].includes(active))
      return <SimpleFeaturePage type={active === 'audit-logs' ? 'audit' : active} />;
    return <ModulePage key={active} definition={getFallbackModule(active)} />;
  })();
  return (
    <AppShell active={active} onNavigate={navigate} onQuickCreate={() => setQuick(true)}>
      {content}
      <QuickCreate
        open={quick}
        onClose={() => setQuick(false)}
        onComplete={(id) => {
          setQuick(false);
          navigate(id);
        }}
      />
    </AppShell>
  );
}

function QuickCreate({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const choices = [
    ['Invoice', 'Bill a customer', FileText, 'invoices'],
    ['Expense', 'Record spend or scan receipt', ReceiptText, 'expenses'],
    ['Payment', 'Receive customer payment', WalletCards, 'payments'],
    ['Bill', 'Record a supplier bill', ShoppingCart, 'bills'],
    ['Transaction', 'Deposit, withdrawal or transfer', Landmark, 'transactions'],
    ['Capture receipt', 'Use camera or upload file', Camera, 'expenses'],
  ];
  const selected = choices.find((choice) => choice[0] === selectedId);
  const close = () => {
    setSelectedId(null);
    onClose();
  };
  const complete = () => {
    if (!selected) return;
    setSelectedId(null);
    onComplete(String(selected[3]));
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={selected ? `Create ${String(selected[0]).toLowerCase()}` : 'Quick create'}
      subtitle={selected ? String(selected[1]) : 'What would you like to do?'}
      wide={Boolean(selected)}
      footer={
        selected ? (
          <>
            <button className="button button--secondary" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="button" type="submit" form="quick-action-form">
              Save {String(selected[0]).toLowerCase()}
            </button>
          </>
        ) : undefined
      }
    >
      {selected ? (
        <QuickActionForm action={String(selected[0])} onSubmit={complete} />
      ) : (
        <div className="quick-create-grid">
          {choices.map(([title, desc, Icon]) => (
            <button key={String(title)} onClick={() => setSelectedId(String(title))}>
              <i>
                <Icon />
              </i>
              <span>
                <strong>{String(title)}</strong>
                <small>{String(desc)}</small>
              </span>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function QuickActionForm({ action, onSubmit }: { action: string; onSubmit: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  if (action === 'Capture receipt') {
    return (
      <form id="quick-action-form" className="quick-action-form" onSubmit={submit}>
        <label className="full upload-field">
          <input type="file" accept="image/*,.pdf" required />
          <span>
            Take a photo or <b>choose a receipt</b>
          </span>
          <small>JPG, PNG or PDF · max 10 MB</small>
        </label>
        <label>
          Merchant
          <input placeholder="Merchant name" required />
        </label>
        <label>
          Amount
          <input type="number" min="0.01" step="0.01" placeholder="₦ 0.00" required />
        </label>
        <label className="full">
          Notes
          <textarea placeholder="Add context or notes..." />
        </label>
      </form>
    );
  }

  const isMoneyIn = action === 'Invoice' || action === 'Payment';
  const today = new Date().toLocaleDateString('en-CA');
  return (
    <form id="quick-action-form" className="quick-action-form" onSubmit={submit}>
      <label>
        {isMoneyIn ? 'Customer' : action === 'Transaction' ? 'Account' : 'Supplier / merchant'}
        <input placeholder={isMoneyIn ? 'Select or enter customer' : 'Enter details'} required />
      </label>
      <label>
        Amount
        <input type="number" min="0.01" step="0.01" placeholder="₦ 0.00" required />
      </label>
      <label>
        Date
        <input type="date" defaultValue={today} required />
      </label>
      <label>
        {action === 'Transaction' ? 'Transaction type' : 'Category'}
        <select>
          {action === 'Transaction' ? (
            <>
              <option>Deposit</option>
              <option>Withdrawal</option>
              <option>Transfer</option>
            </>
          ) : (
            <>
              <option>Sales / services</option>
              <option>Operations</option>
              <option>Other</option>
            </>
          )}
        </select>
      </label>
      <label className="full">
        Reference
        <input placeholder={`${action} reference`} />
      </label>
      <label className="full">
        Description
        <textarea placeholder="Add notes or context..." />
      </label>
    </form>
  );
}

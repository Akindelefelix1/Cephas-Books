import { useState } from 'react';
import {
  Camera,
  ChevronRight,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  ShoppingCart,
  WalletCards,
} from 'lucide-react';
import { LandingPage } from '@/pages/LandingPage';
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
import { NotificationsPage, SettingsPage, UsersPage } from '@/pages/AdminPages';
import { Modal } from '@/components/ui/Modal';
import type { View } from '@/types/app';

export function App() {
  const [view, setView] = useState<View>('landing');
  const [active, setActive] = useState('dashboard');
  const [quick, setQuick] = useState(false);
  const navigate = (id: string) => {
    setActive(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (view === 'landing') return <LandingPage onView={setView} />;
  if (view === 'login' || view === 'register' || view === 'forgot' || view === 'mfa')
    return <AuthPage mode={view} onView={setView} />;
  if (view === 'onboarding') return <OnboardingPage onComplete={() => setView('app')} />;
  const content = (() => {
    if (active === 'dashboard')
      return <DashboardPage onNavigate={navigate} onCreate={() => setQuick(true)} />;
    if (modules[active]) return <ModulePage definition={modules[active]} />;
    if (active === 'banking' || active === 'transactions') return <BankingPage />;
    if (active === 'reconciliation') return <BankingPage reconciliation />;
    if (['chart-of-accounts', 'journals', 'general-ledger', 'trial-balance'].includes(active))
      return <AccountingPage type={active} />;
    if (active === 'reports') return <ReportsPage />;
    if (active === 'ai-assistant') return <AIAssistantPage />;
    if (active === 'users') return <UsersPage />;
    if (active === 'notifications') return <NotificationsPage />;
    if (['settings', 'security', 'integrations', 'branches', 'currencies'].includes(active))
      return <SettingsPage type={active} />;
    if (['budgets', 'tax', 'payroll', 'approvals', 'documents', 'audit-logs'].includes(active))
      return <SimpleFeaturePage type={active === 'audit-logs' ? 'audit' : active} />;
    return <ModulePage definition={getFallbackModule(active)} />;
  })();
  return (
    <AppShell active={active} onNavigate={navigate} onQuickCreate={() => setQuick(true)}>
      {content}
      <QuickCreate
        open={quick}
        onClose={() => setQuick(false)}
        onChoose={(id) => {
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
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (id: string) => void;
}) {
  const choices = [
    ['Invoice', 'Bill a customer', FileText, 'invoices'],
    ['Expense', 'Record spend or scan receipt', ReceiptText, 'expenses'],
    ['Payment', 'Receive customer payment', WalletCards, 'payments'],
    ['Bill', 'Record a supplier bill', ShoppingCart, 'bills'],
    ['Transaction', 'Deposit, withdrawal or transfer', Landmark, 'transactions'],
    ['Capture receipt', 'Use camera or upload file', Camera, 'expenses'],
  ];
  return (
    <Modal open={open} onClose={onClose} title="Quick create" subtitle="What would you like to do?">
      <div className="quick-create-grid">
        {choices.map(([title, desc, Icon, id]) => (
          <button key={String(title)} onClick={() => onChoose(String(id))}>
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
      <button className="quick-create-more">
        <Plus />
        Show all create actions
      </button>
    </Modal>
  );
}

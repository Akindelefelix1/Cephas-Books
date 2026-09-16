import { useEffect, useState } from 'react';
import {
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
import { AIAssistantPage, ReportsPage, SimpleFeaturePage } from '@/pages/SpecialPages';
import { BankingPage } from '@/pages/BankingPage';
import { SalesIncomePage } from '@/pages/SalesIncomePage';
import { PurchasesSpendingPage } from '@/pages/PurchasesSpendingPage';
import { AccountingFinancePage } from '@/pages/AccountingFinancePage';
import { InventoryOperationsPage } from '@/pages/InventoryOperationsPage';
import type { AccountingView } from '@/services/accounting';
import type { PurchaseView } from '@/services/purchases';
import type { OperationsView } from '@/services/operations';
import { NotificationsPage, ProfilePage, SettingsPage, UsersPage } from '@/pages/AdminPages';
import { Modal } from '@/components/ui/Modal';
import type { View } from '@/types/app';
import type { MarketingView } from '@/types/app';
import {
  AUTH_EXPIRED_EVENT,
  ApiError,
  authApi,
  clearAuthTokens,
  hasAuthTokens,
  logoutSession,
} from '@/services/auth';
import { onboardingApi } from '@/services/onboarding';

export function App() {
  const [view, setView] = useState<View>(() => (hasAuthTokens() ? 'app' : 'landing'));
  const [active, setActive] = useState('dashboard');
  const [quick, setQuick] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => localStorage.getItem('cephas:onboarding-complete') === 'true',
  );
  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    role: '',
    baseCurrency: 'NGN',
    countryCode: 'NG',
  });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);
  useEffect(() => {
    const handleExpiredSession = () => {
      clearAuthTokens();
      setIdentity({
        firstName: '',
        lastName: '',
        companyName: '',
        role: '',
        baseCurrency: 'NGN',
        countryCode: 'NG',
      });
      setActive('dashboard');
      setQuick(false);
      setView('login');
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'cephas:auth' && event.newValue === null) handleExpiredSession();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  useEffect(() => {
    if (!hasAuthTokens() || (view !== 'app' && view !== 'onboarding')) return;
    Promise.all([onboardingApi.get(), authApi.me()])
      .then(([progress, profile]) => {
        const complete = Boolean(progress.onboardingCompletedAt);
        setOnboardingComplete(complete);
        localStorage.setItem('cephas:onboarding-complete', String(complete));
        setIdentity({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          companyName: profile.organization.name,
          role: profile.role,
          baseCurrency: profile.organization.baseCurrency,
          countryCode: profile.organization.countryCode,
        });
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) setView('login');
      });
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
  if (view === 'onboarding')
    return (
      <OnboardingPage
        onComplete={() => {
          localStorage.setItem('cephas:onboarding-complete', 'true');
          setOnboardingComplete(true);
          setActive('dashboard');
          setView('app');
        }}
        onSaveExit={() => {
          setActive('dashboard');
          setView('app');
        }}
      />
    );
  const content = (() => {
    if (active === 'dashboard')
      return (
        <DashboardPage
          onNavigate={navigate}
          onCreate={() => setQuick(true)}
          onboardingComplete={onboardingComplete}
          onResumeOnboarding={() => setView('onboarding')}
          companyName={identity.companyName}
        />
      );
    if (
      ['customers', 'quotations', 'invoices', 'payments', 'credit-notes', 'receivables'].includes(
        active,
      )
    )
      return (
        <SalesIncomePage
          key={active}
          view={
            active as
              'customers' | 'quotations' | 'invoices' | 'payments' | 'credit-notes' | 'receivables'
          }
          role={identity.role}
        />
      );
    if (
      [
        'suppliers',
        'purchase-requests',
        'purchase-orders',
        'bills',
        'supplier-payments',
        'payables',
        'expenses',
      ].includes(active)
    )
      return (
        <PurchasesSpendingPage key={active} view={active as PurchaseView} role={identity.role} />
      );
    if (
      [
        'chart-of-accounts',
        'journals',
        'general-ledger',
        'trial-balance',
        'assets',
        'budgets',
        'tax',
        'payroll',
      ].includes(active)
    )
      return (
        <AccountingFinancePage key={active} view={active as AccountingView} role={identity.role} />
      );
    if (
      [
        'products',
        'warehouses',
        'stock-movements',
        'stock-adjustments',
        'projects',
        'project-ai',
      ].includes(active)
    )
      return (
        <InventoryOperationsPage
          key={active}
          view={active as OperationsView}
          role={identity.role}
        />
      );
    if (modules[active]) return <ModulePage key={active} definition={modules[active]} />;
    if (active === 'banking' || active === 'transactions' || active === 'reconciliation')
      return <BankingPage key={active} view={active} role={identity.role} />;
    if (active === 'reports') return <ReportsPage />;
    if (active === 'ai-assistant') return <AIAssistantPage />;
    if (active === 'users') return <UsersPage />;
    if (active === 'notifications') return <NotificationsPage />;
    if (active === 'profile')
      return (
        <ProfilePage
          onLogout={() => {
            void logoutSession().finally(() => setView('landing'));
          }}
        />
      );
    if (['settings', 'security', 'integrations', 'branches', 'currencies'].includes(active))
      return (
        <SettingsPage
          type={active}
          onboardingComplete={onboardingComplete}
          onResumeOnboarding={() => setView('onboarding')}
        />
      );
    if (
      [
        'budgets',
        'tax',
        'payroll',
        'approvals',
        'documents',
        'audit-logs',
        'excel-sync',
        'workflows',
        'custom-reports',
      ].includes(active)
    )
      return <SimpleFeaturePage type={active === 'audit-logs' ? 'audit' : active} />;
    return <ModulePage key={active} definition={getFallbackModule(active)} />;
  })();
  return (
    <AppShell
      active={active}
      onNavigate={navigate}
      onQuickCreate={() => setQuick(true)}
      identity={identity}
    >
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
  const choices = [
    ['Invoice', 'Bill a customer', FileText, 'invoices'],
    ['Expense', 'Record spend or scan receipt', ReceiptText, 'expenses'],
    ['Payment', 'Receive customer payment', WalletCards, 'payments'],
    ['Bill', 'Record a supplier bill', ShoppingCart, 'bills'],
    ['Transaction', 'Deposit, withdrawal or transfer', Landmark, 'transactions'],
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick create"
      subtitle="Choose a record to open its complete creation form."
    >
      <div className="quick-create-grid">
        {choices.map(([title, desc, Icon, target]) => (
          <button
            key={String(title)}
            onClick={() => {
              const id = String(target);
              sessionStorage.setItem('cephas:quick-create', id);
              window.dispatchEvent(new CustomEvent('cephas:quick-create', { detail: id }));
              onComplete(id);
            }}
          >
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
    </Modal>
  );
}

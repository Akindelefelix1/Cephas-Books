import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Landmark,
  LoaderCircle,
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
import { allNavigation } from '@/data/navigation';
import { getFallbackModule } from '@/data/fallbackModules';
import { SimpleFeaturePage } from '@/pages/SpecialPages';
import { BankingPage } from '@/pages/BankingPage';
import { SalesIncomePage } from '@/pages/SalesIncomePage';
import { PosPage } from '@/pages/PosPage';
import { PosHistoryPage } from '@/pages/PosHistoryPage';
import { PurchasesSpendingPage } from '@/pages/PurchasesSpendingPage';
import { AccountingFinancePage } from '@/pages/AccountingFinancePage';
import { InventoryOperationsPage } from '@/pages/InventoryOperationsPage';
import type { AccountingView } from '@/services/accounting';
import type { PurchaseView } from '@/services/purchases';
import type { OperationsView } from '@/services/operations';
import type { InsightsView } from '@/services/insights';
import { InsightsAutomationPage } from '@/pages/InsightsAutomationPage';
import { WorkflowRecordsPage } from '@/pages/WorkflowRecordsPage';
import type { WorkflowView } from '@/services/workflow';
import { ProfilePage } from '@/pages/AdminPages';
import { setDefaultCurrency } from '@/utils/currency';
import { OrganizationSettingsPage } from '@/pages/OrganizationSettingsPage';
import type { OrganizationView } from '@/services/organization';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal, type Confirmation } from '@/components/ui/ConfirmModal';
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
import { can, canAccessRoute } from '@/utils/permissions';
import { LoadingState } from '@/components/ui/LoadingState';
import { CommercePage } from '@/pages/CommercePage';
import type { CommerceView } from '@/services/commerce';
import { activateOfflineMode, getOfflineQueue, isOfflineEnabledForCurrentAccount, isWorkingOffline } from '@/services/offline';
import { refreshOfflineWorkspace, syncOfflineChanges } from '@/services/auth';
import { getQueuedPosSales, syncQueuedPosSales } from '@/services/pos';
import { appDialog } from '@/utils/appDialogs';

const marketingViews = ['platform', 'solutions', 'pricing', 'security', 'resources'] as const;
const authViews = ['login', 'register', 'forgot', 'mfa'] as const;
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}
const appPageIds = new Set([
  'profile',
  ...Object.keys(modules),
  ...allNavigation.flatMap((item) => item.children?.map((child) => child.id) ?? [item.id]),
]);

function resolvePage(pathname: string): { view: View | 'not-found'; active: string } {
  const slug = decodeURIComponent(pathname.replace(/^\/+|\/+$/g, ''));
  if (!slug) return { view: hasAuthTokens() ? 'app' : 'landing', active: 'dashboard' };
  if ((marketingViews as readonly string[]).includes(slug))
    return { view: slug as MarketingView, active: 'dashboard' };
  if ((authViews as readonly string[]).includes(slug))
    return { view: slug as View, active: 'dashboard' };
  if (slug === 'onboarding') return { view: 'onboarding', active: 'dashboard' };
  if (slug === 'app' || slug === 'dashboard') return { view: 'app', active: 'dashboard' };
  if (appPageIds.has(slug)) return { view: 'app', active: slug };
  return { view: 'not-found', active: 'dashboard' };
}

export function App() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const { view, active } = resolvePage(location.pathname);
  const setView = (nextView: View) =>
    routerNavigate(
      nextView === 'landing' ? '/' : nextView === 'app' ? '/dashboard' : `/${nextView}`,
    );
  const navigate = (id: string) => routerNavigate(`/${id}`);
  const [quick, setQuick] = useState(false);
  const [logoutConfirmation, setLogoutConfirmation] = useState<Confirmation | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [offlineCount, setOfflineCount] = useState(() => getOfflineQueue().length + getQueuedPosSales().length);
  const [offlineMode, setOfflineMode] = useState(() => isWorkingOffline());
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState(() => {
    if (!isOfflineEnabledForCurrentAccount()) return '';
    try {
      const counts = JSON.parse(localStorage.getItem('cephas:offline-prepared-counts') ?? '{}') as { saved?: number; failed?: number };
      return `Offline workspace ready · ${counts.saved ?? 0} sections saved${counts.failed ? ` · ${counts.failed} unavailable` : ''}`;
    } catch { return 'Offline workspace is enabled on this device.'; }
  });
  const [identityReady, setIdentityReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => localStorage.getItem('cephas:onboarding-complete') === 'true',
  );
  const requestCloudSync = async () => {
    if (!navigator.onLine || syncInProgress.current) return;
    if (!await appDialog(
      'Back up and sync',
      'Send queued changes to your cloud workspace and refresh the saved offline copy? You can keep working locally by cancelling.',
      { confirmLabel: 'Back up and sync', cancelLabel: 'Keep working locally' },
    )) return;
    syncInProgress.current = true;
    setSyncing(true);
    try {
      await syncOfflineChanges();
      await syncQueuedPosSales();
      await refreshOfflineWorkspace();
      setSyncMessage('Your approved changes are backed up and your workspace is up to date.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) activateOfflineMode();
      setSyncMessage(caught instanceof Error ? `Sync paused: ${caught.message}` : 'Sync paused. Try again when connected.');
    } finally {
      syncInProgress.current = false;
      setSyncing(false);
    }
    setOfflineCount(getOfflineQueue().length + getQueuedPosSales().length);
  };
  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    email: '',
    createdAt: '',
    passwordChangedAt: null as string | null,
    isActive: true,
    companyName: '',
    role: '',
    baseCurrency: 'NGN',
    countryCode: 'NG',
    customRoleId: undefined as string | undefined,
    permissions: [] as string[],
  });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useEffect(() => {
    if (location.hash === '#main-content')
      routerNavigate(`${location.pathname}${location.search}`, { replace: true });
  }, [location.hash, location.pathname, location.search, routerNavigate]);
  useEffect(() => {
    if ((view === 'app' || view === 'onboarding') && !hasAuthTokens())
      routerNavigate('/login', { replace: true });
  }, [routerNavigate, view]);
  useEffect(() => {
    const refreshCount = () => {
      setOfflineCount(getOfflineQueue().length + getQueuedPosSales().length);
      setOfflineMode(isWorkingOffline());
    };
    const onOnline = () => {
      refreshCount();
      if (isOfflineEnabledForCurrentAccount() || localStorage.getItem('cephas:offline-active') === 'true' || getOfflineQueue().length || getQueuedPosSales().length)
        void requestCloudSync();
    };
    const onInstall = (event: Event) => {
      event.preventDefault();
      if ('prompt' in event && typeof event.prompt === 'function')
        setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('cephas:sync-state', refreshCount);
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeinstallprompt', onInstall);
    if (navigator.onLine && localStorage.getItem('cephas:offline-active') === 'true') onOnline();
    return () => {
      window.removeEventListener('cephas:sync-state', refreshCount);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);
  useEffect(() => {
    const handleExpiredSession = () => {
      clearAuthTokens();
      setIdentity({
        firstName: '',
        lastName: '',
        email: '',
        createdAt: '',
        passwordChangedAt: null,
        isActive: true,
        companyName: '',
        role: '',
        baseCurrency: 'NGN',
        countryCode: 'NG',
        customRoleId: undefined,
        permissions: [],
      });
      setIdentityReady(false);
      setQuick(false);
      routerNavigate('/login', { replace: true });
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
  }, [routerNavigate]);
  useEffect(() => {
    if (!hasAuthTokens() || (view !== 'app' && view !== 'onboarding')) return;
    Promise.all([onboardingApi.get(), authApi.me()])
      .then(([progress, profile]) => {
        setDefaultCurrency(profile.organization.baseCurrency);
        const complete = Boolean(progress.onboardingCompletedAt);
        setOnboardingComplete(complete);
        localStorage.setItem('cephas:onboarding-complete', String(complete));
        setIdentity({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          email: profile.email,
          createdAt: profile.createdAt,
          passwordChangedAt: profile.passwordChangedAt,
          isActive: profile.isActive,
          companyName: profile.organization.name,
          role: profile.role,
          baseCurrency: profile.organization.baseCurrency,
          countryCode: profile.organization.countryCode,
          customRoleId: profile.customRoleId,
          permissions: profile.permissions,
        });
        setIdentityReady(true);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401)
          routerNavigate('/login', { replace: true });
      });
  }, [routerNavigate, view]);
  if (view === 'landing') return <LandingPage onView={setView} />;
  if (view === 'not-found')
    return (
      <main className="route-not-found" id="main-content" role="main" tabIndex={-1}>
        <p>404</p>
        <h1>Page not found</h1>
        <button className="button" onClick={() => setView('landing')}>
          Return home
        </button>
      </main>
    );
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
          setView('app');
        }}
        onSaveExit={() => {
          setView('app');
        }}
      />
    );
  if (view === 'app' && !identityReady) return <LoadingState label="Loading your workspace…" />;
  const roleFor = (managePermission: string) =>
    identity.customRoleId ? (can(identity, managePermission) ? 'ADMIN' : 'AUDITOR') : identity.role;
  const content = (() => {
    if (!canAccessRoute(identity, active))
      return (
        <section className="route-not-found" role="alert">
          <p>Access restricted</p>
          <h1>You do not have permission to view this page.</h1>
          <button className="button" onClick={() => navigate('dashboard')}>
            Return to dashboard
          </button>
        </section>
      );
    if (active === 'dashboard')
      return (
        <DashboardPage
          onNavigate={navigate}
          onCreate={() => setQuick(true)}
          onboardingComplete={onboardingComplete}
          onResumeOnboarding={() => setView('onboarding')}
          companyName={identity.companyName}
          access={identity}
        />
      );
    if (active === 'pos')
      return (
        <PosPage
          canConfigurePos={!identity.customRoleId && identity.role === 'OWNER'}
          onNavigate={navigate}
          salesperson={
            [identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email
          }
        />
      );
    if (active === 'pos-history')
      return (
        <PosHistoryPage
          canReprint={
            (!identity.customRoleId && ['OWNER', 'ADMIN'].includes(identity.role)) ||
            identity.permissions.includes('sales.manage')
          }
          canReturn={
            (!identity.customRoleId && ['OWNER', 'ADMIN'].includes(identity.role)) ||
            identity.permissions.includes('sales.manage')
          }
          canVoid={
            (!identity.customRoleId && ['OWNER', 'ADMIN'].includes(identity.role)) ||
            identity.permissions.includes('sales.manage')
          }
          canViewAudit={
            (!identity.customRoleId && ['OWNER', 'ADMIN'].includes(identity.role)) ||
            identity.permissions.includes('sales.manage')
          }
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
          role={roleFor('sales.manage')}
          onNavigate={navigate}
        />
      );
    if (
      [
        'commerce-dashboard',
        'sales-channels',
        'channel-orders',
        'fulfillment',
        'payouts',
        'product-channel-mapping',
        'commerce-analytics',
        'commerce-settings',
      ].includes(active)
    )
      return (
        <CommercePage
          key={active}
          view={active as CommerceView}
          canManage={
            (!identity.customRoleId && ['OWNER', 'ADMIN'].includes(identity.role)) ||
            identity.permissions.includes('inventory.manage')
          }
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
        <PurchasesSpendingPage
          key={active}
          view={active as PurchaseView}
          role={roleFor('purchases.manage')}
        />
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
        <AccountingFinancePage
          key={active}
          view={active as AccountingView}
          role={roleFor('accounting.manage')}
        />
      );
    if (
      [
        'products',
        'warehouses',
        'branch-inventory',
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
          role={roleFor('inventory.manage')}
          onNavigate={navigate}
        />
      );
    if (modules[active]) return <ModulePage key={active} definition={modules[active]} />;
    if (active === 'banking' || active === 'transactions' || active === 'reconciliation')
      return <BankingPage key={active} view={active} role={roleFor('banking.manage')} />;
    if (['reports', 'custom-reports', 'analytics', 'ai-assistant', 'excel-sync'].includes(active))
      return (
        <InsightsAutomationPage
          key={active}
          view={active as InsightsView}
          role={roleFor('reports.export')}
        />
      );
    if (['documents', 'approvals', 'notifications', 'workflows'].includes(active))
      return (
        <WorkflowRecordsPage key={active} view={active as WorkflowView} role={identity.role} />
      );
    if (active === 'profile')
      return (
        <ProfilePage
          profile={identity}
          onLogout={() => {
            setLogoutError('');
            setLogoutConfirmation({
              title: 'Log out of Cephas Books?',
              message: 'Your current session will be ended on this device.',
              confirmLabel: 'Log out',
              onConfirm: () => {
                setLogoutBusy(true);
                void logoutSession()
                  .then(() => {
                    setLogoutConfirmation(null);
                    setView('landing');
                  })
                  .catch((caught) =>
                    setLogoutError(caught instanceof Error ? caught.message : 'Unable to log out.'),
                  )
                  .finally(() => setLogoutBusy(false));
              },
            });
          }}
        />
      );
    if (
      [
        'settings',
        'security',
        'integrations',
        'branches',
        'currencies',
        'users',
        'audit-logs',
      ].includes(active)
    )
      return (
        <OrganizationSettingsPage
          key={active}
          view={active as OrganizationView}
          role={
            identity.customRoleId
              ? can(identity, 'settings.manage') || can(identity, 'users.manage')
                ? 'ADMIN'
                : 'AUDITOR'
              : identity.role
          }
          onDeleted={() => {
            clearAuthTokens();
            localStorage.removeItem('cephas:active-branch');
            setView('landing');
          }}
        />
      );
    if (['budgets', 'tax', 'payroll'].includes(active)) return <SimpleFeaturePage type={active} />;
    return <ModulePage key={active} definition={getFallbackModule(active)} />;
  })();
  return (
    <AppShell
      active={active}
      onNavigate={navigate}
      onQuickCreate={() => setQuick(true)}
      identity={identity}
    >
      {(offlineMode || offlineCount > 0 || installPrompt || syncMessage) && (
        <aside className="offline-banner" role="status">
          <span>{offlineMode ? `Offline mode · ${offlineCount} change${offlineCount === 1 ? '' : 's'} waiting to sync` : offlineCount ? `${offlineCount} offline change${offlineCount === 1 ? '' : 's'} waiting to sync` : syncMessage || 'Use Cephas Books as an app on this device.'}</span>
          {navigator.onLine && (offlineMode || offlineCount > 0 || isOfflineEnabledForCurrentAccount()) && <button className="button button--small button--ghost" onClick={() => void requestCloudSync()}>Back up &amp; sync</button>}
          {(installPrompt || (isOfflineEnabledForCurrentAccount() && !window.matchMedia('(display-mode: standalone)').matches)) && <button className="button button--small" onClick={() => setInstallDialogOpen(true)}>Add app shortcut</button>}
          {syncMessage && <button className="button button--small button--ghost" onClick={() => setSyncMessage('')}>Dismiss</button>}
        </aside>
      )}
      {content}
      <QuickCreate
        open={quick}
        onClose={() => setQuick(false)}
        onComplete={(id) => {
          setQuick(false);
          navigate(id);
        }}
        access={identity}
      />
      <ConfirmModal
        confirmation={logoutConfirmation}
        busy={logoutBusy}
        error={logoutError}
        onClose={() => setLogoutConfirmation(null)}
      />
      <Modal
        open={syncing}
        title="Backing up and syncing"
        subtitle="Please keep this window open while we send queued changes and refresh your saved offline workspace."
        onClose={() => undefined}
      >
        <div className="sync-progress" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={22} aria-hidden="true" />
          <span>Sync in progress…</span>
        </div>
      </Modal>
      <Modal
        open={installDialogOpen}
        title="Add Cephas Books to this device?"
        subtitle="Open Cephas Books in its own app window and launch it again from your device."
        onClose={() => setInstallDialogOpen(false)}
        footer={
          <>
            <button className="button button--secondary" onClick={() => setInstallDialogOpen(false)}>
              Cancel
            </button>
            <button
              className="button"
              onClick={async () => {
                const prompt = installPrompt;
                setInstallDialogOpen(false);
                if (prompt) {
                  await prompt.prompt();
                  await prompt.userChoice?.catch(() => undefined);
                  setInstallPrompt(null);
                } else {
                  void appDialog(
                    'Finish adding the shortcut',
                    'Open your browser menu and choose “Install app” or “Add to Home screen”.',
                  );
                }
              }}
            >
              Continue to install
            </button>
          </>
        }
      >
        <p>Your browser will ask you to confirm before it installs the app.</p>
      </Modal>
    </AppShell>
  );
}

function QuickCreate({
  open,
  onClose,
  onComplete,
  access,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  access: { customRoleId?: string; permissions: string[] };
}) {
  const choices = [
    ['Invoice', 'Bill a customer', FileText, 'invoices', 'sales.manage'],
    ['Expense', 'Record spend or scan receipt', ReceiptText, 'expenses', 'purchases.manage'],
    ['Payment', 'Receive customer payment', WalletCards, 'payments', 'sales.manage'],
    ['Bill', 'Record a supplier bill', ShoppingCart, 'bills', 'purchases.manage'],
    ['Transaction', 'Deposit, withdrawal or transfer', Landmark, 'transactions', 'banking.manage'],
  ].filter((choice) => !access.customRoleId || access.permissions.includes(String(choice[4])));
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

import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { confirmAction } from '@/utils/actions';
import type { View } from '@/types/app';

export function AuthPage({
  mode,
  onView,
}: {
  mode: 'login' | 'register' | 'forgot' | 'mfa';
  onView: (v: View) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [flowStep, setFlowStep] = useState<'form' | 'otp' | 'new-password'>('form');
  const [email, setEmail] = useState('');
  const content = {
    login: {
      title: 'Welcome back',
      subtitle: 'Sign in to continue to your financial workspace.',
      button: 'Sign in securely',
    },
    register: {
      title: 'Start your free trial',
      subtitle: 'Set up your business finances in a few simple steps.',
      button: 'Create my account',
    },
    forgot: {
      title: 'Reset your password',
      subtitle: 'Enter your work email and weâ€™ll send a secure reset link.',
      button: 'Send reset link',
    },
    mfa: {
      title: 'Verify itâ€™s you',
      subtitle: 'Enter the six-digit code from your authenticator app.',
      button: 'Verify and continue',
    },
  }[mode];
  const flowContent =
    flowStep === 'otp'
      ? {
          title: 'Verify your email',
          subtitle: `Enter the six-digit code sent to ${email || 'your work email'}.`,
          button: 'Verify code',
        }
      : flowStep === 'new-password'
        ? {
            title: 'Create a new password',
            subtitle: 'Choose a strong password you have not used before.',
            button: 'Update password',
          }
        : content;
  const submit = () => {
    if (mode === 'register') {
      if (flowStep === 'form') setFlowStep('otp');
      else onView('onboarding');
      return;
    }
    if (mode === 'forgot') {
      if (flowStep === 'form') setFlowStep('otp');
      else if (flowStep === 'otp') setFlowStep('new-password');
      else onView('login');
      return;
    }
    if (mode === 'login') onView('app');
    else onView('app');
  };
  return (
    <div className="auth-page">
      <aside>
        <button className="back-link" onClick={() => onView('landing')}>
          <ArrowLeft size={17} />
          Back to website
        </button>
        <div>
          <div className="auth-quote">
            â€œCephas gives our finance team a single source of truth across four branches.â€
          </div>
          <div className="quote-author">
            <span>AO</span>
            <div>
              <strong>Amara Okafor</strong>
              <small>CFO, Kora Foods</small>
            </div>
          </div>
        </div>
        <p>
          <ShieldCheck size={16} />
          Bank-grade security Â· NDPR aligned
        </p>
      </aside>
      <main>
        <div className="auth-card">
          <Logo />
          <div className="auth-heading">
            <h1>{flowContent.title}</h1>
            <p>{flowContent.subtitle}</p>
          </div>
          {mode === 'register' && flowStep === 'form' && (
            <div className="social-buttons">
              <button
                onClick={() => confirmAction('Google sign-in requires an authentication provider')}
              >
                <GoogleLogo /> Continue with Google
              </button>
              <button
                onClick={() =>
                  confirmAction('Microsoft sign-in requires an authentication provider')
                }
              >
                â–¦&nbsp; Microsoft
              </button>
            </div>
          )}
          {mode === 'register' && flowStep === 'form' && (
            <div className="divider">or use work email</div>
          )}
          {mode === 'mfa' || flowStep === 'otp' ? (
            <>
              <label>
                {mode === 'mfa' && useRecoveryCode ? 'Recovery code' : 'Verification code'}
                {mode === 'mfa' && useRecoveryCode ? (
                  <input autoFocus placeholder="Enter your recovery code" />
                ) : (
                  <div className="otp-inputs">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <input
                        key={i}
                        maxLength={1}
                        inputMode="numeric"
                        defaultValue={mode === 'mfa' && i < 3 ? String(i) : ''}
                      />
                    ))}
                  </div>
                )}
              </label>
              <p className="auth-help">
                {mode !== 'mfa'
                  ? 'The code expires in 10 minutes.'
                  : useRecoveryCode
                    ? 'Use one of the recovery codes saved when MFA was configured.'
                    : 'Open your authenticator app to view your code.'}
              </p>
            </>
          ) : flowStep === 'new-password' ? (
            <div className="form-stack">
              <label>
                New password
                <div className="input-icon">
                  <LockKeyhole size={17} />
                  <input type={showPassword ? 'text' : 'password'} autoFocus />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <label>
                Confirm new password
                <div className="input-icon">
                  <LockKeyhole size={17} />
                  <input type={showPassword ? 'text' : 'password'} />
                </div>
              </label>
            </div>
          ) : (
            <div className="form-stack">
              {mode === 'register' && (
                <label>
                  Company name
                  <input placeholder="e.g. Acme Holdings" />
                </label>
              )}
              <label>
                Work email
                <div className="input-icon">
                  <Mail size={17} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
              </label>
              {mode !== 'forgot' && (
                <label>
                  Password
                  <div className="input-icon">
                    <LockKeyhole size={17} />
                    <input type={showPassword ? 'text' : 'password'} />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
              )}
            </div>
          )}
          {mode === 'login' && (
            <div className="form-options">
              <label>
                <input type="checkbox" />
                Remember me
              </label>
              <button onClick={() => onView('forgot')}>Forgot password?</button>
            </div>
          )}
          {mode === 'register' && flowStep === 'form' && (
            <label className="terms">
              <input type="checkbox" defaultChecked />
              <span>I agree to the Terms of Service and Privacy Policy.</span>
            </label>
          )}
          <button className="button auth-submit" onClick={submit}>
            {flowContent.button}
            <ArrowRight size={17} />
          </button>
          {mode === 'login' && (
            <p className="auth-switch">
              New to Cephas? <button onClick={() => onView('register')}>Create an account</button>
            </p>
          )}
          {mode === 'register' && (
            <p className="auth-switch">
              Already have an account? <button onClick={() => onView('login')}>Sign in</button>
            </p>
          )}
          {flowStep === 'otp' && mode !== 'mfa' && (
            <div className="auth-flow-links">
              <button className="link-center" onClick={() => setFlowStep('form')}>
                Change email
              </button>
              <button
                className="link-center"
                onClick={() => confirmAction(`A new verification code was sent to ${email}`)}
              >
                Resend verification code
              </button>
            </div>
          )}
          {mode === 'mfa' && (
            <button
              className="link-center"
              onClick={() => setUseRecoveryCode((enabled) => !enabled)}
            >
              {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.01v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.49l3.34-2.62Z"
      />
      <path
        fill="#ea4335"
        d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.34 2.62C7.18 7.76 9.39 6 12 6Z"
      />
    </svg>
  );
}

const setupSteps = [
  ['Business profile', 'Tell us about your company'],
  ['Financial settings', 'Currency, year & accounting'],
  ['Organisation structure', 'Branches and departments'],
  ['Tax setup', 'Configure local tax rules'],
  ['Invite your team', 'Bring your people in'],
] as const;

const setupHeadings = [
  [
    'Tell us about your business',
    'Weâ€™ll use this to personalise your chart of accounts and reports.',
  ],
  [
    'Set your financial foundations',
    'Choose the defaults used for reporting, posting, and period controls.',
  ],
  ['Shape your organisation', 'Add the structure you use to track performance and responsibility.'],
  [
    'Configure your tax profile',
    'Set sensible local defaults now and refine individual rates later.',
  ],
  ['Bring your team in', 'Invite colleagues and give them an appropriate starting role.'],
] as const;

type SetupData = Record<string, string>;

export function OnboardingPage({
  onComplete,
  onSaveExit,
}: {
  onComplete: () => void;
  onSaveExit: () => void;
}) {
  const [step, setStep] = useState(() => {
    const saved = Number(localStorage.getItem('cephas:onboarding-step') ?? 0);
    return Number.isInteger(saved) && saved >= 0 && saved < setupSteps.length ? saved : 0;
  });
  const [data, setData] = useState<SetupData>(() => {
    try {
      return JSON.parse(localStorage.getItem('cephas:onboarding-data') ?? '{}') as SetupData;
    } catch {
      return {};
    }
  });
  const formRef = useRef<HTMLFormElement>(null);

  const saveForm = () => {
    if (!formRef.current) return;
    const next = { ...data };
    new FormData(formRef.current).forEach((value, key) => (next[key] = String(value)));
    setData(next);
    localStorage.setItem('cephas:onboarding-data', JSON.stringify(next));
    localStorage.setItem('cephas:onboarding-step', String(step));
    localStorage.setItem('cephas:onboarding-complete', 'false');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveForm();
    if (step === setupSteps.length - 1) {
      localStorage.setItem('cephas:onboarding-step', String(setupSteps.length));
      onComplete();
    } else {
      const next = step + 1;
      setStep(next);
      localStorage.setItem('cephas:onboarding-step', String(next));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const back = () => {
    saveForm();
    setStep((current) => {
      const previous = Math.max(0, current - 1);
      localStorage.setItem('cephas:onboarding-step', String(previous));
      return previous;
    });
  };

  return (
    <div className="onboarding">
      <header>
        <Logo />
        <span>
          Need help? <b>Talk to an expert</b>
        </span>
      </header>
      <div className="onboarding-layout">
        <aside>
          <p>SET UP YOUR WORKSPACE</p>
          {setupSteps.map(([title, description], index) => (
            <div className={index === step ? 'active' : index < step ? 'complete' : ''} key={title}>
              <i>{index < step ? <Check size={14} /> : index + 1}</i>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </div>
          ))}
        </aside>
        <main>
          <div className="step-progress">
            <span>
              Step {step + 1} of {setupSteps.length}
            </span>
            <i>
              <b style={{ width: `${((step + 1) / setupSteps.length) * 100}%` }} />
            </i>
          </div>
          <h1>{setupHeadings[step][0]}</h1>
          <p>{setupHeadings[step][1]}</p>
          <form ref={formRef} onSubmit={submit}>
            <div className="form-grid">
              <SetupFields step={step} data={data} />
            </div>
            <div className="onboarding-actions">
              <div className="onboarding-actions__secondary">
                {step > 0 && (
                  <button type="button" className="button button--ghost" onClick={back}>
                    <ArrowLeft size={17} /> Back
                  </button>
                )}
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    saveForm();
                    confirmAction('Progress saved. Resume setup from Organisation Settings.');
                    onSaveExit();
                  }}
                >
                  Save and exit
                </button>
              </div>
              <button className="button" type="submit">
                {step === setupSteps.length - 1
                  ? 'Finish setup'
                  : `Continue to ${setupSteps[step + 1][0].toLowerCase()}`}{' '}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function SetupFields({ step, data }: { step: number; data: SetupData }) {
  if (step === 0)
    return (
      <>
        <label>
          Business name
          <input
            name="businessName"
            defaultValue={data.businessName ?? 'Acme Holdings Limited'}
            required
          />
        </label>
        <label>
          Legal name
          <input
            name="legalName"
            defaultValue={data.legalName}
            placeholder="Registered company name"
          />
        </label>
        <label>
          Registration number
          <input
            name="registrationNumber"
            defaultValue={data.registrationNumber}
            placeholder="RC 1234567"
          />
        </label>
        <label>
          Tax identification number
          <input name="taxId" defaultValue={data.taxId} placeholder="TIN" />
        </label>
        <label>
          Industry
          <select name="industry" defaultValue={data.industry ?? 'Professional services'}>
            <option>Professional services</option>
            <option>Retail</option>
            <option>Manufacturing</option>
            <option>Education</option>
            <option>Non-profit</option>
          </select>
        </label>
        <label>
          Business type
          <select
            name="businessType"
            defaultValue={data.businessType ?? 'Limited liability company'}
          >
            <option>Limited liability company</option>
            <option>Sole proprietorship</option>
            <option>Partnership</option>
            <option>Cooperative</option>
          </select>
        </label>
        <label className="full">
          Business address
          <textarea
            name="businessAddress"
            defaultValue={data.businessAddress}
            placeholder="Street, city, state, country"
          />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={data.phone} placeholder="+234" />
        </label>
        <label>
          Website
          <input name="website" defaultValue={data.website} placeholder="https://" />
        </label>
      </>
    );
  if (step === 1)
    return (
      <>
        <label>
          Base currency
          <select name="baseCurrency" defaultValue={data.baseCurrency ?? 'NGN'}>
            <option value="NGN">NGN â€” Nigerian Naira</option>
            <option value="USD">USD â€” US Dollar</option>
            <option value="GBP">GBP â€” British Pound</option>
            <option value="GHS">GHS â€” Ghanaian Cedi</option>
          </select>
        </label>
        <label>
          Fiscal year starts
          <select name="fiscalYearStart" defaultValue={data.fiscalYearStart ?? 'January'}>
            <option>January</option>
            <option>April</option>
            <option>July</option>
            <option>October</option>
          </select>
        </label>
        <label>
          Accounting method
          <select name="accountingMethod" defaultValue={data.accountingMethod ?? 'Accrual basis'}>
            <option>Accrual basis</option>
            <option>Cash basis</option>
          </select>
        </label>
        <label>
          Invoice payment terms
          <select name="paymentTerms" defaultValue={data.paymentTerms ?? 'Net 30'}>
            <option>Due on receipt</option>
            <option>Net 15</option>
            <option>Net 30</option>
            <option>Net 60</option>
          </select>
        </label>
        <label>
          Inventory valuation
          <select
            name="inventoryValuation"
            defaultValue={data.inventoryValuation ?? 'Weighted average'}
          >
            <option>Weighted average</option>
            <option>FIFO</option>
          </select>
        </label>
        <label>
          Reporting timezone
          <select name="timezone" defaultValue={data.timezone ?? 'Africa/Lagos'}>
            <option>Africa/Lagos</option>
            <option>Africa/Accra</option>
            <option>UTC</option>
          </select>
        </label>
      </>
    );
  if (step === 2)
    return (
      <>
        <label>
          Head office / primary branch
          <input
            name="primaryBranch"
            defaultValue={data.primaryBranch}
            placeholder="e.g. Lagos Head Office"
            required
          />
        </label>
        <label>
          Number of branches
          <select name="branchCount" defaultValue={data.branchCount ?? '1'}>
            <option>1</option>
            <option>2â€“5</option>
            <option>6â€“20</option>
            <option>More than 20</option>
          </select>
        </label>
        <label className="full">
          Departments
          <textarea
            name="departments"
            defaultValue={data.departments}
            placeholder="Finance, Sales, Operations â€” separate with commas"
          />
        </label>
        <label>
          Default cost centre
          <input
            name="defaultCostCentre"
            defaultValue={data.defaultCostCentre}
            placeholder="e.g. Head Office"
          />
        </label>
        <label>
          Track projects separately?
          <select name="projectTracking" defaultValue={data.projectTracking ?? 'Yes'}>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>
      </>
    );
  if (step === 3)
    return (
      <>
        <label>
          Tax country
          <select name="taxCountry" defaultValue={data.taxCountry ?? 'Nigeria'}>
            <option>Nigeria</option>
            <option>Ghana</option>
            <option>Kenya</option>
            <option>South Africa</option>
          </select>
        </label>
        <label>
          VAT registered?
          <select name="vatRegistered" defaultValue={data.vatRegistered ?? 'Yes'}>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>
        <label>
          Default sales VAT rate
          <select name="salesVatRate" defaultValue={data.salesVatRate ?? '7.5%'}>
            <option>7.5%</option>
            <option>0%</option>
            <option>Exempt</option>
          </select>
        </label>
        <label>
          Tax filing frequency
          <select name="taxFrequency" defaultValue={data.taxFrequency ?? 'Monthly'}>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Annually</option>
          </select>
        </label>
        <label className="full">
          Tax notes
          <textarea
            name="taxNotes"
            defaultValue={data.taxNotes}
            placeholder="Exemptions, withholding arrangements, or adviser notes"
          />
        </label>
      </>
    );
  return (
    <>
      <label>
        Colleague email
        <input
          name="inviteEmail"
          type="email"
          defaultValue={data.inviteEmail}
          placeholder="colleague@company.com"
        />
      </label>
      <label>
        Starting role
        <select name="inviteRole" defaultValue={data.inviteRole ?? 'Accountant'}>
          <option>Administrator</option>
          <option>Accountant</option>
          <option>Approver</option>
          <option>Member</option>
          <option>Auditor</option>
        </select>
      </label>
      <label className="full">
        Personal message
        <textarea
          name="inviteMessage"
          defaultValue={data.inviteMessage}
          placeholder="Add an optional note to the invitation"
        />
      </label>
      <div className="onboarding-note full">
        <Check size={18} />
        <span>
          <strong>Invitations are optional.</strong>
          <small>You can add users later from Users & roles.</small>
        </span>
      </div>
    </>
  );
}

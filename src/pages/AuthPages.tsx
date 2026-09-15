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
import { ApiError, authApi, saveAuthTokens } from '@/services/auth';
import { onboardingApi, onboardingSteps } from '@/services/onboarding';
import { useEffect } from 'react';
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
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [remember, setRemember] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (flowStep === 'otp' && (mode === 'register' || mode === 'login')) {
      if (!/^\d{6}$/.test(verificationCode)) {
        setError('Enter the complete six-digit verification code.');
        return;
      }
      setSubmitting(true);
      try {
        const tokens = await authApi.verifyEmail(email.trim(), verificationCode);
        saveAuthTokens(tokens, mode === 'register' || remember);
        const progress = await onboardingApi.get();
        onView(progress.onboardingCompletedAt ? 'app' : 'onboarding');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Email verification failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!acceptedTerms) {
        setError('Please accept the Terms of Service and Privacy Policy.');
        return;
      }
      setSubmitting(true);
      try {
        await authApi.register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          organizationName: organizationName.trim(),
          email: email.trim(),
          password,
        });
        setVerificationCode('');
        setFlowStep('otp');
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 503) {
          setVerificationCode('');
          setFlowStep('otp');
          setError(
            'Your account was created, but the email could not be delivered. Check the address and try resending the code.',
          );
        } else {
          setError(caught instanceof Error ? caught.message : 'Account creation failed.');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mode === 'forgot') {
      if (flowStep === 'form') setFlowStep('otp');
      else if (flowStep === 'otp') setFlowStep('new-password');
      else onView('login');
      return;
    }
    if (mode === 'login') {
      setSubmitting(true);
      try {
        const tokens = await authApi.login({ email: email.trim(), password });
        saveAuthTokens(tokens, remember);
        const progress = await onboardingApi.get();
        onView(progress.onboardingCompletedAt ? 'app' : 'onboarding');
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 403) {
          try {
            await authApi.resendVerification(email.trim());
          } catch {
            // The verification screen still allows a manual retry.
          }
          setVerificationCode('');
          setFlowStep('otp');
        } else {
          setError(caught instanceof Error ? caught.message : 'Sign in failed.');
        }
      } finally {
        setSubmitting(false);
      }
    } else onView('app');
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
          <form onSubmit={submit}>
            {mode === 'mfa' || flowStep === 'otp' ? (
              <>
                <label>
                  {mode === 'mfa' && useRecoveryCode ? 'Recovery code' : 'Verification code'}
                  {mode === 'mfa' && useRecoveryCode ? (
                    <input autoFocus placeholder="Enter your recovery code" />
                  ) : (
                    <div className="otp-inputs">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <input
                          key={i}
                          maxLength={1}
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          value={verificationCode[i] ?? ''}
                          required
                          onPaste={(event) => {
                            const pasted = event.clipboardData
                              .getData('text')
                              .replace(/\D/g, '')
                              .slice(0, 6);
                            if (pasted) {
                              event.preventDefault();
                              setVerificationCode(pasted);
                            }
                          }}
                          onChange={(event) => {
                            const digit = event.target.value.replace(/\D/g, '').slice(-1);
                            setVerificationCode((current) => {
                              const digits = current.padEnd(6, ' ').split('');
                              digits[i] = digit || ' ';
                              return digits.join('').trimEnd();
                            });
                            if (digit) {
                              (
                                event.currentTarget.nextElementSibling as HTMLInputElement | null
                              )?.focus();
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !verificationCode[i]) {
                              (
                                event.currentTarget
                                  .previousElementSibling as HTMLInputElement | null
                              )?.focus();
                            }
                          }}
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
                  <>
                    <div className="auth-name-fields">
                      <label>
                        First name
                        <input
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          autoComplete="given-name"
                          maxLength={80}
                          required
                        />
                      </label>
                      <label>
                        Last name
                        <input
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          autoComplete="family-name"
                          maxLength={80}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Company name
                      <input
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        autoComplete="organization"
                        placeholder="e.g. Acme Holdings"
                        maxLength={120}
                        required
                      />
                    </label>
                  </>
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
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  </div>
                </label>
                {mode !== 'forgot' && (
                  <label>
                    Password
                    <div className="input-icon">
                      <LockKeyhole size={17} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                        minLength={mode === 'register' ? 12 : undefined}
                        maxLength={128}
                        pattern={
                          mode === 'register'
                            ? '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{12,128}'
                            : undefined
                        }
                        title={
                          mode === 'register'
                            ? 'Use at least 12 characters with uppercase, lowercase, and a number.'
                            : undefined
                        }
                        required
                      />
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
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Remember me
                </label>
                <button type="button" onClick={() => onView('forgot')}>
                  Forgot password?
                </button>
              </div>
            )}
            {mode === 'register' && flowStep === 'form' && (
              <label className="terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>I agree to the Terms of Service and Privacy Policy.</span>
              </label>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button className="button auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : flowContent.button}
              <ArrowRight size={17} />
            </button>
          </form>
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
              <button
                type="button"
                className="link-center"
                onClick={() => {
                  setError('');
                  setVerificationCode('');
                  setFlowStep('form');
                }}
              >
                Change email
              </button>
              <button
                type="button"
                className="link-center"
                disabled={submitting}
                onClick={async () => {
                  setError('');
                  setSubmitting(true);
                  try {
                    const result = await authApi.resendVerification(email.trim());
                    setVerificationCode('');
                    confirmAction(result.message);
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : 'Could not resend code.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
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

const setupFieldNames = [
  [
    'businessName',
    'legalName',
    'registrationNumber',
    'taxId',
    'industry',
    'businessType',
    'businessAddress',
    'phone',
    'website',
  ],
  [
    'baseCurrency',
    'fiscalYearStart',
    'accountingMethod',
    'paymentTerms',
    'inventoryValuation',
    'timezone',
  ],
  ['primaryBranch', 'branchCount', 'departments', 'defaultCostCentre', 'projectTracking'],
  ['taxCountry', 'vatRegistered', 'salesVatRate', 'taxFrequency', 'taxNotes'],
  ['inviteEmail', 'inviteRole', 'inviteMessage'],
] as const;

function getStepPayload(step: number, data: SetupData): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of setupFieldNames[step]) {
    const value = data[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    onboardingApi
      .get()
      .then((progress) => {
        if (!active) return;
        const remoteData = Object.assign({}, ...Object.values(progress.onboardingData));
        setData((current) => ({ ...remoteData, ...current }));
        setStep((current) =>
          Math.max(current, Math.min(progress.onboardingStep, setupSteps.length - 1)),
        );
        if (progress.onboardingCompletedAt) onComplete();
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load setup.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onComplete]);

  const saveForm = () => {
    if (!formRef.current) return data;
    const next = { ...data };
    new FormData(formRef.current).forEach((value, key) => (next[key] = String(value)));
    setData(next);
    localStorage.setItem('cephas:onboarding-data', JSON.stringify(next));
    localStorage.setItem('cephas:onboarding-step', String(step));
    localStorage.setItem('cephas:onboarding-complete', 'false');
    return next;
  };
  const saveCurrentStep = (values: SetupData) =>
    onboardingApi.saveStep(onboardingSteps[step], getStepPayload(step, values));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const values = saveForm();
      await saveCurrentStep(values);
      if (step === setupSteps.length - 1) {
        await onboardingApi.complete();
        localStorage.removeItem('cephas:onboarding-data');
        localStorage.removeItem('cephas:onboarding-step');
        onComplete();
      } else {
        const next = step + 1;
        setStep(next);
        localStorage.setItem('cephas:onboarding-step', String(next));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this step.');
    } finally {
      setSaving(false);
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
          {loading && <div className="onboarding-status">Loading your saved setup…</div>}
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <form
            key={`${step}-${loading}`}
            ref={formRef}
            onSubmit={submit}
            aria-busy={saving || loading}
          >
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
                  disabled={saving || loading}
                  onClick={async () => {
                    setError('');
                    setSaving(true);
                    try {
                      const values = saveForm();
                      if (formRef.current?.checkValidity()) {
                        await saveCurrentStep(values);
                        confirmAction('Progress saved. Resume setup from your dashboard.');
                      } else {
                        confirmAction(
                          'Your draft is saved on this device. Resume setup from your dashboard.',
                        );
                      }
                      onSaveExit();
                    } catch {
                      confirmAction(
                        'Your draft is saved on this device and can be resumed from your dashboard.',
                      );
                      onSaveExit();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save and exit
                </button>
              </div>
              <button className="button" type="submit" disabled={saving || loading}>
                {saving
                  ? 'Saving…'
                  : step === setupSteps.length - 1
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
            defaultValue={data.businessName}
            placeholder="e.g. Acme Holdings Limited"
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
            <option value="2-5">2–5</option>
            <option value="6-20">6–20</option>
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
        <select name="inviteRole" defaultValue={data.inviteRole ?? 'ACCOUNTANT'}>
          <option value="ADMIN">Administrator</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="APPROVER">Approver</option>
          <option value="MEMBER">Member</option>
          <option value="AUDITOR">Auditor</option>
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

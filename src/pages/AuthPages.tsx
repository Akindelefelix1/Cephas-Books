import { useState } from 'react';
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
      subtitle: 'Enter your work email and we’ll send a secure reset link.',
      button: 'Send reset link',
    },
    mfa: {
      title: 'Verify it’s you',
      subtitle: 'Enter the six-digit code from your authenticator app.',
      button: 'Verify and continue',
    },
  }[mode];
  const submit = () =>
    mode === 'login'
      ? onView('app')
      : mode === 'register'
        ? onView('onboarding')
        : mode === 'forgot'
          ? onView('login')
          : onView('app');
  return (
    <div className="auth-page">
      <aside>
        <button className="back-link" onClick={() => onView('landing')}>
          <ArrowLeft size={17} />
          Back to website
        </button>
        <div>
          <div className="auth-quote">
            “Cephas gives our finance team a single source of truth across four branches.”
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
          Bank-grade security · NDPR aligned
        </p>
      </aside>
      <main>
        <div className="auth-card">
          <Logo />
          <div className="auth-heading">
            <h1>{content.title}</h1>
            <p>{content.subtitle}</p>
          </div>
          {mode === 'register' && (
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
                ▦&nbsp; Microsoft
              </button>
            </div>
          )}
          {mode === 'register' && <div className="divider">or use work email</div>}
          {mode === 'mfa' ? (
            <>
              <label>
                {useRecoveryCode ? 'Recovery code' : 'Authentication code'}
                {useRecoveryCode ? (
                  <input autoFocus placeholder="Enter your recovery code" />
                ) : (
                  <div className="otp-inputs">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <input
                        key={i}
                        maxLength={1}
                        inputMode="numeric"
                        defaultValue={i < 3 ? String(i) : ''}
                      />
                    ))}
                  </div>
                )}
              </label>
              <p className="auth-help">
                {useRecoveryCode
                  ? 'Use one of the recovery codes saved when MFA was configured.'
                  : 'Open your authenticator app to view your code.'}
              </p>
            </>
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
                  <input type="email" placeholder="you@company.com" />
                </div>
              </label>
              {mode !== 'forgot' && (
                <label>
                  Password
                  <div className="input-icon">
                    <LockKeyhole size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
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
                <input type="checkbox" />
                Remember me
              </label>
              <button onClick={() => onView('forgot')}>Forgot password?</button>
            </div>
          )}
          {mode === 'register' && (
            <label className="terms">
              <input type="checkbox" defaultChecked />
              <span>I agree to the Terms of Service and Privacy Policy.</span>
            </label>
          )}
          <button className="button auth-submit" onClick={submit}>
            {content.button}
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

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
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
          {[
            'Business profile',
            'Financial settings',
            'Organisation structure',
            'Tax setup',
            'Invite your team',
          ].map((x, i) => (
            <div className={i === 0 ? 'active' : ''} key={x}>
              <i>{i === 0 ? <Check size={14} /> : i + 1}</i>
              <span>
                <strong>{x}</strong>
                <small>
                  {
                    [
                      'Tell us about your company',
                      'Currency, year & accounting',
                      'Branches and departments',
                      'Configure local tax rules',
                      'Bring your people in',
                    ][i]
                  }
                </small>
              </span>
            </div>
          ))}
        </aside>
        <main>
          <div className="step-progress">
            <span>Step 1 of 5</span>
            <i>
              <b />
            </i>
          </div>
          <h1>Tell us about your business</h1>
          <p>We’ll use this to personalise your chart of accounts and reports.</p>
          <div className="form-grid">
            <label>
              Business name
              <input defaultValue="Acme Holdings Limited" />
            </label>
            <label>
              Legal name
              <input placeholder="Registered company name" />
            </label>
            <label>
              Registration number
              <input placeholder="RC 1234567" />
            </label>
            <label>
              Tax identification number
              <input placeholder="TIN" />
            </label>
            <label>
              Industry
              <select defaultValue="Professional services">
                <option>Professional services</option>
                <option>Retail</option>
                <option>Manufacturing</option>
                <option>Education</option>
                <option>Non-profit</option>
              </select>
            </label>
            <label>
              Business type
              <select>
                <option>Limited liability company</option>
                <option>Sole proprietorship</option>
                <option>Partnership</option>
                <option>Cooperative</option>
              </select>
            </label>
            <label className="full">
              Business address
              <textarea placeholder="Street, city, state, country" />
            </label>
            <label>
              Phone
              <input placeholder="+234" />
            </label>
            <label>
              Website
              <input placeholder="https://" />
            </label>
          </div>
          <div className="onboarding-actions">
            <button
              className="button button--ghost"
              onClick={() => confirmAction('Onboarding progress saved')}
            >
              Save and exit
            </button>
            <button className="button" onClick={onComplete}>
              Continue to financial settings <ArrowRight size={17} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

import { ArrowLeft, ArrowRight, Check, Eye, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import type { View } from '@/types/app';

export function AuthPage({
  mode,
  onView,
}: {
  mode: 'login' | 'register' | 'forgot' | 'mfa';
  onView: (v: View) => void;
}) {
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
              <button>G&nbsp; Continue with Google</button>
              <button>▦&nbsp; Microsoft</button>
            </div>
          )}
          {mode === 'register' && <div className="divider">or use work email</div>}
          {mode === 'mfa' ? (
            <>
              <label>
                Authentication code
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
              </label>
              <p className="auth-help">Open your authenticator app to view your code.</p>
            </>
          ) : (
            <div className="form-stack">
              {mode === 'register' && (
                <label>
                  Full name
                  <input placeholder="e.g. Tobi Adeyemi" />
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
                    <input type="password" placeholder="At least 8 characters" />
                    <Eye size={17} />
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
              <input type="checkbox" defaultChecked />I agree to the Terms of Service and Privacy
              Policy.
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
          {mode === 'mfa' && <button className="link-center">Use a recovery code instead</button>}
        </div>
      </main>
    </div>
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
            <button className="button button--ghost">Save and exit</button>
            <button className="button" onClick={onComplete}>
              Continue to financial settings <ArrowRight size={17} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

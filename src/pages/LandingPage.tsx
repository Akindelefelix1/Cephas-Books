import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Globe2,
  Landmark,
  Menu,
  Package,
  Play,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import type { View } from '@/types/app';

export function LandingPage({ onView }: { onView: (view: View) => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <Logo />
        <nav className={menu ? 'open' : ''}>
          <a href="#features">Platform</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
          <a href="#security">Security</a>
          <a href="#resources">Resources</a>
          <button className="text-button" onClick={() => onView('login')}>
            Sign in
          </button>
          <button className="button button--small" onClick={() => onView('register')}>
            Start free
          </button>
        </nav>
        <button className="mobile-menu" onClick={() => setMenu(!menu)}>
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <div className="hero-pill">
              <Sparkles size={14} />
              Built for the way Africa does business <ChevronRight size={14} />
            </div>
            <h1>
              Your entire financial operation, <em>finally in sync.</em>
            </h1>
            <p>
              Accounting, cash flow, inventory, tax, payroll, and business intelligence—connected in
              one secure financial operating system.
            </p>
            <div className="landing-actions">
              <button className="button button--large" onClick={() => onView('register')}>
                Start your free trial <ArrowRight size={18} />
              </button>
              <button className="button button--ghost button--large">
                <Play size={17} fill="currentColor" />
                Watch overview
              </button>
            </div>
            <div className="hero-trust">
              <span>
                <Check size={14} />
                No credit card
              </span>
              <span>
                <Check size={14} />
                14-day free trial
              </span>
              <span>
                <Check size={14} />
                Cancel anytime
              </span>
            </div>
          </div>
          <div className="product-preview">
            <div className="preview-glow" />
            <div className="preview-window">
              <div className="preview-bar">
                <span />
                <span />
                <span />
                <div>app.cephas.finance</div>
              </div>
              <div className="preview-app">
                <div className="preview-side">
                  <div className="mini-logo">C</div>
                  {[1, 2, 3, 4, 5, 6].map((x) => (
                    <i className={x === 1 ? 'active' : ''} key={x} />
                  ))}
                </div>
                <div className="preview-main">
                  <div className="preview-heading">
                    <div>
                      <small>FINANCIAL OVERVIEW</small>
                      <strong>Good morning, Tobi</strong>
                    </div>
                    <button>+ Create</button>
                  </div>
                  <div className="preview-stats">
                    <div>
                      <small>Total revenue</small>
                      <strong>₦48.2m</strong>
                      <b>↗ 12.8%</b>
                    </div>
                    <div>
                      <small>Net profit</small>
                      <strong>₦14.6m</strong>
                      <b>↗ 8.4%</b>
                    </div>
                    <div>
                      <small>Cash balance</small>
                      <strong>₦26.9m</strong>
                      <b>Healthy</b>
                    </div>
                  </div>
                  <div className="preview-chart">
                    <div className="chart-title">
                      <span>
                        <strong>Revenue & expenses</strong>
                        <small>Last 6 months</small>
                      </span>
                      <b>•••</b>
                    </div>
                    <svg viewBox="0 0 600 210" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#1233cc" stopOpacity=".24" />
                          <stop offset="1" stopColor="#1233cc" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        className="chart-area"
                        d="M0 170 C60 155 70 90 130 112 S220 145 270 70 S350 110 405 60 S500 92 600 25 V210 H0Z"
                      />
                      <path
                        className="chart-line"
                        d="M0 170 C60 155 70 90 130 112 S220 145 270 70 S350 110 405 60 S500 92 600 25"
                      />
                      <path
                        className="chart-line chart-line--light"
                        d="M0 183 C80 165 100 178 160 148 S250 175 315 130 S400 150 465 112 S550 145 600 100"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="logo-strip">
          <p>Trusted by ambitious businesses across Africa</p>
          <div>
            <span>northstar</span>
            <span>MONO</span>
            <span>paystack</span>
            <span>FLUTTERWAVE</span>
            <span>Reliance</span>
          </div>
        </section>
        <section className="landing-section" id="features">
          <div className="section-kicker">One financial operating system</div>
          <h2>Less busywork. More business.</h2>
          <p className="section-intro">
            Every workflow is connected to one reliable ledger, giving your team clarity from first
            transaction to final report.
          </p>
          <div className="feature-bento">
            <article className="bento-large">
              <div className="feature-icon">
                <BarChart3 />
              </div>
              <h3>Know where you stand. Always.</h3>
              <p>
                Live dashboards, cash-flow forecasts, budgets, and financial statements built
                directly from your ledger.
              </p>
              <div className="mini-analytics">
                <header>
                  <span>Cash flow forecast</span>
                  <b>Next 6 months⌄</b>
                </header>
                <strong>
                  ₦42,850,000 <small>projected balance</small>
                </strong>
                <div className="bars">
                  {[42, 58, 50, 68, 74, 91, 83, 97, 75, 88, 96, 100].map((_height, index) => (
                    <i
                      className={`bar-height-${index + 1} ${index > 8 ? 'future' : ''}`}
                      key={index}
                    />
                  ))}
                </div>
              </div>
            </article>
            <article>
              <div className="feature-icon cyan">
                <Zap />
              </div>
              <h3>Automate the routine</h3>
              <p>
                Smart matching, recurring invoices, reminders, approvals, and categorisation save
                hours every week.
              </p>
              <div className="automation-list">
                <span>
                  <i>
                    <Check />
                  </i>
                  Bank feed reconciled <b>124 matched</b>
                </span>
                <span>
                  <i>
                    <Check />
                  </i>
                  Invoices reminded <b>8 sent</b>
                </span>
                <span>
                  <i>
                    <Check />
                  </i>
                  Receipts captured <b>32 scanned</b>
                </span>
              </div>
            </article>
            <article>
              <div className="feature-icon purple">
                <Bot />
              </div>
              <h3>Ask your business anything</h3>
              <p>
                Cephas AI explains trends and answers financial questions using only authorised
                company data.
              </p>
              <div className="ai-bubble">
                Why did expenses rise in July?
                <span>Marketing spend increased 24%, driven by the Lagos launch campaign.</span>
              </div>
            </article>
          </div>
        </section>
        <section className="platform-band" id="solutions">
          <div>
            <span className="section-kicker">Made for modern businesses</span>
            <h2>From first invoice to consolidated accounts.</h2>
            <p>Start simple and add deeper capabilities as your organisation grows.</p>
            <button className="button button--light" onClick={() => onView('register')}>
              Explore the platform <ArrowRight size={17} />
            </button>
          </div>
          <div className="capability-grid">
            {[
              [Landmark, 'Banking', 'Live feeds & reconciliation'],
              [Package, 'Inventory', 'Stock across every branch'],
              [Globe2, 'Multi-entity', 'Currencies & consolidation'],
              [ShieldCheck, 'Controls', 'Roles, approvals & audit'],
            ].map(([Icon, title, text]) => (
              <article key={String(title)}>
                <Icon />
                <strong>{String(title)}</strong>
                <span>{String(text)}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="pricing-section" id="pricing">
          <span className="section-kicker">Simple, transparent pricing</span>
          <h2>A plan for every stage.</h2>
          <div className="pricing-grid">
            {[
              {
                name: 'Starter',
                price: '₦9,900',
                desc: 'For founders and micro businesses.',
                features: [
                  '1 business · 2 users',
                  'Invoicing & expenses',
                  'Core financial reports',
                ],
              },
              {
                name: 'Professional',
                price: '₦29,900',
                desc: 'For growing SMEs and teams.',
                popular: true,
                features: ['10 users', 'Full accounting & banking', 'Inventory, tax & reports'],
              },
              {
                name: 'Business',
                price: '₦69,900',
                desc: 'For complex organisations.',
                features: [
                  'Unlimited transactions',
                  'Multi-branch & projects',
                  'Budgets, approvals & AI',
                ],
              },
            ].map((plan) => (
              <article className={plan.popular ? 'popular' : ''} key={plan.name}>
                {plan.popular && <b className="popular-label">MOST POPULAR</b>}
                <h3>{plan.name}</h3>
                <p>{plan.desc}</p>
                <strong>
                  {plan.price}
                  <small>/month</small>
                </strong>
                <button
                  className={`button ${plan.popular ? '' : 'button--outline'}`}
                  onClick={() => onView('register')}
                >
                  Start free
                </button>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section className="cta-band">
          <div>
            <span>Ready to understand your business?</span>
            <h2>Take control of your finances today.</h2>
          </div>
          <button className="button button--light button--large" onClick={() => onView('register')}>
            Start your free trial <ArrowRight />
          </button>
        </section>
      </main>
      <footer className="marketing-footer">
        <div>
          <Logo />
          <p>
            Manage money. Control operations.
            <br />
            Understand your business.
          </p>
        </div>
        <div>
          <strong>Product</strong>
          <a>Accounting</a>
          <a>Inventory</a>
          <a>Banking</a>
          <a>AI Assistant</a>
        </div>
        <div>
          <strong>Company</strong>
          <a>About</a>
          <a>Partners</a>
          <a>Contact</a>
          <a>Careers</a>
        </div>
        <div>
          <strong>Resources</strong>
          <a>Help centre</a>
          <a>API docs</a>
          <a>Security</a>
          <a>Status</a>
        </div>
        <small>© 2026 Cephas Technologies. All rights reserved.</small>
      </footer>
    </div>
  );
}

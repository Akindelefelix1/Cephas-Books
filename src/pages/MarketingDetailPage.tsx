import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  FileText,
  Landmark,
  LockKeyhole,
  Package,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingMotion } from '@/components/marketing/MarketingMotion';
import platformHero from '@/assets/marketing/platform-hero.png';
import pricingHero from '@/assets/marketing/pricing-hero.png';
import resourcesHero from '@/assets/marketing/resources-hero.png';
import securityHero from '@/assets/marketing/security-hero.png';
import solutionsHero from '@/assets/marketing/solutions-hero.png';
import type { MarketingView, View } from '@/types/app';

type PageContent = {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  note: string;
  icon: LucideIcon;
  features: Array<{ icon: LucideIcon; title: string; text: string }>;
};

const heroImages: Record<MarketingView, { src: string; alt: string }> = {
  platform: {
    src: platformHero,
    alt: 'Finance leader using the Cephas Books platform in a modern office',
  },
  solutions: {
    src: solutionsHero,
    alt: 'Retail business owner managing her operation with a tablet',
  },
  pricing: {
    src: pricingHero,
    alt: 'Founder comparing business software plans at his desk',
  },
  security: {
    src: securityHero,
    alt: 'Security professional protecting financial data in a secure workspace',
  },
  resources: {
    src: resourcesHero,
    alt: 'Business team learning together in a bright meeting room',
  },
};

const featureMetrics: Record<MarketingView, Array<{ label: string; value: string }>> = {
  platform: [
    { label: 'Match rate', value: '96%' },
    { label: 'Stock accuracy', value: '92%' },
    { label: 'Insights answered', value: '84%' },
  ],
  solutions: [
    { label: 'Hours saved', value: '18h' },
    { label: 'Team adoption', value: '91%' },
    { label: 'Branches online', value: '12' },
  ],
  pricing: [
    { label: 'Essential value', value: '72%' },
    { label: 'Most selected', value: '64%' },
    { label: 'Scale readiness', value: '89%' },
  ],
  security: [
    { label: 'Access protected', value: '98%' },
    { label: 'Reviews cleared', value: '94%' },
    { label: 'Actions logged', value: '100%' },
  ],
  resources: [
    { label: 'Issues resolved', value: '93%' },
    { label: 'Guides completed', value: '24' },
    { label: 'Useful insights', value: '88%' },
  ],
};

const pages: Record<MarketingView, PageContent> = {
  platform: {
    eyebrow: 'The Cephas Books platform',
    title: 'One connected system for',
    accent: 'every financial workflow.',
    description:
      'Run accounting, banking, inventory, tax, payroll, and reporting from a single source of truth built for growing businesses.',
    note: 'Everything connects to one reliable ledger.',
    icon: BarChart3,
    features: [
      {
        icon: Landmark,
        title: 'Connected banking',
        text: 'Match transactions, reconcile accounts, and understand cash flow in real time.',
      },
      {
        icon: Package,
        title: 'Inventory clarity',
        text: 'Track products, stock movement, and value across every location.',
      },
      {
        icon: Sparkles,
        title: 'Practical intelligence',
        text: 'Turn live business data into clear answers and useful next steps.',
      },
    ],
  },
  solutions: {
    eyebrow: 'Solutions for your stage',
    title: 'Built around how your',
    accent: 'business actually works.',
    description:
      'From a founder sending a first invoice to a finance team consolidating branches, Cephas Books grows with your operation.',
    note: 'Start focused. Add capability when you need it.',
    icon: Building2,
    features: [
      {
        icon: Zap,
        title: 'Founders & small teams',
        text: 'Invoice, track expenses, and see the numbers that matter without the busywork.',
      },
      {
        icon: Users,
        title: 'Growing finance teams',
        text: 'Add roles, approvals, reporting, and repeatable processes as the team expands.',
      },
      {
        icon: Building2,
        title: 'Multi-branch businesses',
        text: 'Keep each location visible while maintaining central financial control.',
      },
    ],
  },
  pricing: {
    eyebrow: 'Simple, transparent pricing',
    title: 'A clear plan for',
    accent: 'every stage of growth.',
    description:
      'Begin with the essentials, unlock deeper controls as you grow, and always know exactly what your software costs.',
    note: '14-day free trial. No credit card required.',
    icon: Check,
    features: [
      {
        icon: BookOpen,
        title: 'Starter · ₦9,900/mo',
        text: 'For founders: 2 users, invoicing, expenses, and core financial reports.',
      },
      {
        icon: BarChart3,
        title: 'Professional · ₦29,900/mo',
        text: 'For growing teams: full accounting, banking, inventory, tax, and reporting.',
      },
      {
        icon: Building2,
        title: 'Business · ₦69,900/mo',
        text: 'For complex operations: branches, projects, budgets, approvals, and AI.',
      },
    ],
  },
  security: {
    eyebrow: 'Security by design',
    title: 'Your financial data stays',
    accent: 'protected and in control.',
    description:
      'Cephas Books is designed around clear permissions, accountable actions, and safeguards that help teams work confidently.',
    note: 'Control access without slowing your team down.',
    icon: ShieldCheck,
    features: [
      {
        icon: LockKeyhole,
        title: 'Role-based access',
        text: 'Give every team member only the tools and information their work requires.',
      },
      {
        icon: ShieldCheck,
        title: 'Approvals & controls',
        text: 'Build review steps into sensitive workflows and high-value transactions.',
      },
      {
        icon: FileText,
        title: 'Complete audit trail',
        text: 'Keep a clear record of important actions, changes, and approvals.',
      },
    ],
  },
  resources: {
    eyebrow: 'Resources & guidance',
    title: 'Learn faster. Get more',
    accent: 'from Cephas Books.',
    description:
      'Find practical guides, product documentation, and support designed to help your team work with confidence from day one.',
    note: 'Clear answers for setup, workflows, and growth.',
    icon: BookOpen,
    features: [
      {
        icon: BookOpen,
        title: 'Help centre',
        text: 'Step-by-step guidance for everyday tasks, setup, and troubleshooting.',
      },
      {
        icon: PlayCircle,
        title: 'Product guides',
        text: 'Short walkthroughs that help every member of your team get productive.',
      },
      {
        icon: FileText,
        title: 'Business insights',
        text: 'Useful ideas for stronger financial operations and more informed decisions.',
      },
    ],
  },
};

const navigation: Array<{ id: MarketingView; label: string }> = [
  { id: 'platform', label: 'Platform' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'security', label: 'Security' },
  { id: 'resources', label: 'Resources' },
];

export function MarketingDetailPage({
  page,
  onView,
}: {
  page: MarketingView;
  onView: (view: View) => void;
}) {
  const [menu, setMenu] = useState(false);
  const content = pages[page];
  const HeroIcon = content.icon;
  const heroImage = heroImages[page];

  return (
    <div className="marketing marketing-detail">
      <MarketingMotion />
      <header className="marketing-nav">
        <Logo />
        <nav className={menu ? 'open' : ''}>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`marketing-link ${page === item.id ? 'active' : ''}`}
              onClick={() => {
                setMenu(false);
                onView(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setMenu(false);
              onView('login');
            }}
          >
            Sign in
          </button>
          <button
            className="button button--small"
            onClick={() => {
              setMenu(false);
              onView('register');
            }}
          >
            Start free
          </button>
        </nav>
        <button
          className={`mobile-menu ${menu ? 'is-open' : ''}`}
          onClick={() => setMenu(!menu)}
          aria-label={menu ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menu}
        >
          <span className="hamburger-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </header>

      <main>
        <section className="detail-hero">
          <div className="detail-hero__copy">
            <span className="section-kicker">{content.eyebrow}</span>
            <h1>
              {content.title} <em>{content.accent}</em>
            </h1>
            <p>{content.description}</p>
            <div className="landing-actions">
              <button className="button button--large" onClick={() => onView('register')}>
                Start your free trial <ArrowRight size={18} />
              </button>
              <button
                className="button button--ghost button--large"
                onClick={() => onView('landing')}
              >
                Back to home
              </button>
            </div>
            <span className="detail-note">
              <Check size={15} /> {content.note}
            </span>
          </div>
          <div className="detail-hero__visual">
            <img src={heroImage.src} alt={heroImage.alt} />
            <div className="detail-icon detail-icon--photo">
              <HeroIcon />
            </div>
            <HeroChart page={page} />
          </div>
        </section>

        <section className="detail-features">
          <header>
            <span className="section-kicker">Why Cephas Books</span>
            <h2>Everything you need, without the clutter.</h2>
          </header>
          <div>
            {content.features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title}>
                  <span>
                    <Icon />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  <FeatureChart index={index} metric={featureMetrics[page][index]} />
                  <button onClick={() => onView('register')}>
                    Learn more <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cta-band detail-cta">
          <div>
            <span>Ready when you are</span>
            <h2>Put your finances in one clear place.</h2>
          </div>
          <button className="button button--light button--large" onClick={() => onView('register')}>
            Get started free <ArrowRight />
          </button>
        </section>
      </main>
      <MarketingFooter onView={onView} />
    </div>
  );
}

function FeatureChart({ index, metric }: { index: number; metric: { label: string; value: string } }) {
  if (index === 1) {
    return (
      <div className="feature-chart feature-chart--bars" role="img" aria-label={`${metric.label}: ${metric.value}`}>
        <header><span>{metric.label}</span><strong>{metric.value}</strong></header>
        <div>
          {[42, 58, 51, 73, 68, 91].map((height, barIndex) => (
            <i key={`${height}-${barIndex}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="feature-chart feature-chart--ring" role="img" aria-label={`${metric.label}: ${metric.value}`}>
        <div className="feature-ring"><span>{metric.value}</span></div>
        <p><strong>{metric.label}</strong><small>Live operational data</small></p>
      </div>
    );
  }

  return (
    <div className="feature-chart feature-chart--trend" role="img" aria-label={`${metric.label}: ${metric.value}`}>
      <header><span>{metric.label}</span><strong>{metric.value}</strong></header>
      <svg viewBox="0 0 240 72" preserveAspectRatio="none" aria-hidden="true">
        <path className="feature-chart__area" d="M0 64 C35 59 42 38 74 45 S118 51 142 29 S188 35 240 8 V72 H0Z" />
        <path className="feature-chart__line" d="M0 64 C35 59 42 38 74 45 S118 51 142 29 S188 35 240 8" />
      </svg>
    </div>
  );
}

function HeroChart({ page }: { page: MarketingView }) {
  if (page === 'solutions') {
    return (
      <div className="detail-mini-chart detail-mini-chart--bars">
        <span><small>Branch performance</small><strong>+24%</strong></span>
        <div className="hero-bars" aria-label="Branch performance increasing across six periods">
          {[38, 52, 44, 68, 61, 86].map((height, index) => (
            <i key={height} style={{ height: `${height}%` }} className={index > 3 ? 'accent' : ''} />
          ))}
        </div>
      </div>
    );
  }

  if (page === 'pricing') {
    return (
      <div className="detail-mini-chart detail-mini-chart--plans">
        <span><small>Best value</small><strong>Professional</strong></span>
        <div className="hero-plan-chart" aria-label="Relative value of Starter, Professional and Business plans">
          <i style={{ width: '48%' }}><b>S</b></i>
          <i className="accent" style={{ width: '92%' }}><b>P</b></i>
          <i style={{ width: '72%' }}><b>B</b></i>
        </div>
      </div>
    );
  }

  if (page === 'security') {
    return (
      <div className="detail-mini-chart detail-mini-chart--gauge">
        <span><small>Protection status</small><strong>Secure</strong></span>
        <div className="hero-gauge" aria-label="Protection score 98 percent">
          <div><strong>98%</strong><small>protected</small></div>
        </div>
      </div>
    );
  }

  if (page === 'resources') {
    return (
      <div className="detail-mini-chart detail-mini-chart--activity">
        <span><small>Learning progress</small><strong>12 guides</strong></span>
        <div className="hero-activity" aria-label="Twelve guides completed this month">
          {[35, 62, 48, 78, 56, 88, 72].map((height, index) => (
            <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="detail-mini-chart">
      <span><small>Live cash flow</small><strong>+18.4%</strong></span>
      <svg viewBox="0 0 180 55" aria-label="Cash flow trending upward">
        <path d="M2 48 C28 44 34 29 58 34 S92 27 108 20 S140 23 178 5" />
      </svg>
    </div>
  );
}

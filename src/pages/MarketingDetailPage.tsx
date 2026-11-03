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
    { label: 'Money and accounting', value: 'Core' },
    { label: 'Stock and projects', value: 'Locations' },
    { label: 'Reports and controls', value: 'Reports' },
  ],
  solutions: [
    { label: 'Owner tools', value: 'Sales' },
    { label: 'Team tools', value: 'Shared' },
    { label: 'Location tools', value: 'Branches' },
  ],
  pricing: [
    { label: 'Starter', value: '2 users' },
    { label: 'Professional', value: '10 users' },
    { label: 'Business', value: 'Branches' },
  ],
  security: [
    { label: 'Team access', value: 'Roles' },
    { label: 'Review steps', value: 'Approvals' },
    { label: 'Action history', value: 'Audit log' },
  ],
  resources: [
    { label: 'Getting started', value: '5 steps' },
    { label: 'Business records', value: 'Documents' },
    { label: 'Make sense of results', value: 'Reports' },
  ],
};

const pages: Record<MarketingView, PageContent> = {
  platform: {
    eyebrow: 'The Cephas Books platform',
    title: 'One connected system for',
    accent: 'every financial workflow.',
    description:
      'Handle bank accounts and reconciliation, sales and purchasing, accounting, tax, payroll, stock, online orders, projects, reports, and team access in one workspace.',
    note: 'Everything connects to one reliable ledger.',
    icon: BarChart3,
    features: [
      {
        icon: Landmark,
        title: 'Money in, money out, and accounting',
        text: 'Manage bank accounts and transfers, reconcile transactions, follow invoices and bills, and keep journals, the ledger, trial balance, tax, payroll, fixed assets, and budgets together.',
      },
      {
        icon: Package,
        title: 'Sales, stock, commerce, and projects',
        text: 'Use point of sale, quotations, invoices, and customer payments; manage products, warehouses, stock movements, channel product matching, online orders, fulfilment, payouts, and project planning and costs.',
      },
      {
        icon: Sparkles,
        title: 'Reports, workflows, and team controls',
        text: 'Review financial statements, build reports, explore analytics, sync Excel data, ask Cephas AI, route approvals, manage documents and notifications, and control branch, role, currency, and integration settings.',
      },
    ],
  },
  solutions: {
    eyebrow: 'Solutions for your stage',
    title: 'Built around how your',
    accent: 'business actually works.',
    description:
      'Use the tools that fit your work, from everyday sales and expenses to stock control, finance reviews, and oversight across branches.',
    note: 'Start focused. Add capability when you need it.',
    icon: Building2,
    features: [
      {
        icon: Zap,
        title: 'Owners and small teams',
        text: 'Create quotations and invoices, record payments and expenses, and check cash, income, and bills due.',
      },
      {
        icon: Users,
        title: 'Retail and service teams',
        text: 'Take point-of-sale orders, keep customer and supplier records, track stock, and follow purchases and fulfilment.',
      },
      {
        icon: Building2,
        title: 'Finance teams across branches',
        text: 'Review branch activity, manage access by role, track budgets and approvals, and prepare reports from shared records.',
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
        text: 'For a small business: 1 business, 2 users, invoicing, expenses, and core financial reports.',
      },
      {
        icon: BarChart3,
        title: 'Professional · ₦29,900/mo',
        text: 'For a growing team: 10 users, accounting, banking, inventory, tax, and reports.',
      },
      {
        icon: Building2,
        title: 'Business · ₦69,900/mo',
        text: 'For larger operations: unlimited transactions, branches, projects, budgets, approvals, and AI tools.',
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
        title: 'Roles and permissions',
        text: 'Assign team roles and permissions so people can access the areas needed for their work.',
      },
      {
        icon: ShieldCheck,
        title: 'Approvals and account security',
        text: 'Review transactions through approval workflows and protect sign-in with verification and session controls.',
      },
      {
        icon: FileText,
        title: 'Audit history',
        text: 'Review recorded actions and changes to support financial oversight and accountability.',
      },
    ],
  },
  resources: {
    eyebrow: 'Explore the product',
    title: 'Get a clear view of',
    accent: 'how your business runs.',
    description:
      'See how workspace setup, business records, notifications, financial reports, and Cephas AI fit into everyday work.',
    note: 'Explore the tools available to your team.',
    icon: BookOpen,
    features: [
      {
        icon: BookOpen,
        title: 'Set up your workspace',
        text: 'Enter business details, choose financial defaults, add branches and departments, set tax details, and invite team members.',
      },
      {
        icon: PlayCircle,
        title: 'Keep records and follow up',
        text: 'Store business documents, route approvals, and review notifications for invoices, bills, stock, and other activity.',
      },
      {
        icon: FileText,
        title: 'Review results and ask questions',
        text: 'Use financial statements, custom reports, analytics, Excel sync, and Cephas AI to explore business performance.',
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
                    Get started <ArrowRight size={15} />
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

function FeatureChart({
  index,
  metric,
}: {
  index: number;
  metric: { label: string; value: string };
}) {
  if (index === 1) {
    return (
      <div
        className="feature-chart feature-chart--bars"
        role="img"
        aria-label={`${metric.label}: ${metric.value}`}
      >
        <header>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </header>
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
      <div
        className="feature-chart feature-chart--ring"
        role="img"
        aria-label={`${metric.label}: ${metric.value}`}
      >
        <div className="feature-ring">
          <span>{metric.value}</span>
        </div>
        <p>
          <strong>{metric.label}</strong>
          <small>Available in Cephas Books</small>
        </p>
      </div>
    );
  }

  return (
    <div
      className="feature-chart feature-chart--trend"
      role="img"
      aria-label={`${metric.label}: ${metric.value}`}
    >
      <header>
        <span>{metric.label}</span>
        <strong>{metric.value}</strong>
      </header>
      <svg viewBox="0 0 240 72" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="feature-chart__area"
          d="M0 64 C35 59 42 38 74 45 S118 51 142 29 S188 35 240 8 V72 H0Z"
        />
        <path
          className="feature-chart__line"
          d="M0 64 C35 59 42 38 74 45 S118 51 142 29 S188 35 240 8"
        />
      </svg>
    </div>
  );
}

function HeroChart({ page }: { page: MarketingView }) {
  if (page === 'solutions') {
    return (
      <div className="detail-mini-chart detail-mini-chart--bars">
        <span>
          <small>Branch reporting</small>
          <strong>By location</strong>
        </span>
        <div className="hero-bars" aria-label="Illustration of branch performance by period">
          {[38, 52, 44, 68, 61, 86].map((height, index) => (
            <i
              key={height}
              style={{ height: `${height}%` }}
              className={index > 3 ? 'accent' : ''}
            />
          ))}
        </div>
      </div>
    );
  }

  if (page === 'pricing') {
    return (
      <div className="detail-mini-chart detail-mini-chart--plans">
        <span>
          <small>Available plans</small>
          <strong>Three options</strong>
        </span>
        <div
          className="hero-plan-chart"
          aria-label="Starter, Professional and Business plan options"
        >
          <i style={{ width: '72%' }}>
            <b>S</b>
          </i>
          <i className="accent" style={{ width: '72%' }}>
            <b>P</b>
          </i>
          <i style={{ width: '72%' }}>
            <b>B</b>
          </i>
        </div>
      </div>
    );
  }

  if (page === 'security') {
    return (
      <div className="detail-mini-chart detail-mini-chart--gauge">
        <span>
          <small>Account controls</small>
          <strong>Access</strong>
        </span>
        <div className="hero-gauge" aria-label="Account access and security controls">
          <div>
            <strong>Roles</strong>
            <small>and review</small>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'resources') {
    return (
      <div className="detail-mini-chart detail-mini-chart--activity">
        <span>
          <small>Getting started</small>
          <strong>Five steps</strong>
        </span>
        <div className="hero-activity" aria-label="Five steps to set up a workspace">
          {[35, 62, 48, 78, 56, 88, 72].map((height, index) => (
            <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="detail-mini-chart">
      <span>
        <small>Financial overview</small>
        <strong>At a glance</strong>
      </span>
      <svg viewBox="0 0 180 55" aria-label="Illustrative financial trend chart">
        <path d="M2 48 C28 44 34 29 58 34 S92 27 108 20 S140 23 178 5" />
      </svg>
    </div>
  );
}

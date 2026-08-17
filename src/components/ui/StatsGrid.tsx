import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
  change?: string;
  tone?: 'positive' | 'warning' | 'danger';
}

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
          {stat.change && (
            <span className={`stat-change ${stat.tone ? `is-${stat.tone}` : ''}`}>
              {stat.tone === 'danger' ? (
                <ArrowDownRight size={14} />
              ) : stat.tone === 'positive' ? (
                <ArrowUpRight size={14} />
              ) : null}
              {stat.change}
            </span>
          )}
        </article>
      ))}
    </div>
  );
}

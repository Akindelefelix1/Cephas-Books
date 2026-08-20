interface BadgeProps {
  children: string;
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

function getBadgeTone(label: string): BadgeTone {
  const key = label.trim().toLowerCase();
  const includesAny = (terms: string[]) => terms.some((term) => key.includes(term));

  if (
    includesAny([
      'overdue',
      'rejected',
      'credit hold',
      'out of stock',
      'over budget',
      'expired',
      'failed',
      'cancelled',
      'blocked',
      'high risk',
    ])
  )
    return 'danger';

  if (
    includesAny([
      'partially',
      'pending',
      'review',
      'low stock',
      'at risk',
      'unmatched',
      'awaiting',
      'due',
      'part received',
      'needs action',
    ])
  )
    return 'warning';

  if (
    includesAny([
      'paid',
      'active',
      'approved',
      'matched',
      'in stock',
      'accepted',
      'completed',
      'goods received',
      'applied',
      'on track',
      'up to date',
      'primary',
      'posted',
      'ready',
      'filed',
      'healthy',
      'base currency',
      'balanced',
    ])
  )
    return 'success';

  if (includesAny(['refunded', 'declining balance', 'credit note', 'reversed'])) return 'purple';

  if (
    includesAny([
      'sent',
      'issued',
      'bank transfer',
      'transfer',
      'card',
      'pos',
      'cash',
      'mobile payment',
      'cheque',
      'service',
      'straight-line',
      'forecasting',
      'suggested',
    ])
  )
    return 'info';

  if (key.includes('margin')) {
    const percentage = Number.parseFloat(key);
    if (percentage >= 25) return 'success';
    if (percentage >= 15) return 'info';
    return 'warning';
  }

  return 'neutral';
}

export function Badge({ children }: BadgeProps) {
  const tone = getBadgeTone(children);
  return (
    <span className={`badge badge--${tone}`}>
      <i />
      {children}
    </span>
  );
}

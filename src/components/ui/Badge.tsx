interface BadgeProps {
  children: string;
}

export function Badge({ children }: BadgeProps) {
  const key = children.toLowerCase();
  const tone =
    key.includes('paid') ||
    key.includes('active') ||
    key.includes('approved') ||
    key.includes('matched') ||
    key.includes('stock')
      ? 'success'
      : key.includes('overdue') ||
          key.includes('rejected') ||
          key.includes('hold') ||
          key.includes('out')
        ? 'danger'
        : key.includes('pending') ||
            key.includes('partial') ||
            key.includes('low') ||
            key.includes('review')
          ? 'warning'
          : 'neutral';
  return (
    <span className={`badge badge--${tone}`}>
      <i />
      {children}
    </span>
  );
}

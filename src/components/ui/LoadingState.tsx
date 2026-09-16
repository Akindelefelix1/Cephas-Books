interface LoadingStateProps {
  label?: string;
  compact?: boolean;
}

export function LoadingState({
  label = 'Loading your workspace…',
  compact = false,
}: LoadingStateProps) {
  return (
    <div
      className={`global-loading${compact ? ' global-loading--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="global-loading__spinner" aria-hidden="true">
        <i />
      </span>
      <span className="global-loading__copy">
        <strong>{label}</strong>
        {!compact && <small>Please wait while we prepare the latest information.</small>}
      </span>
    </div>
  );
}

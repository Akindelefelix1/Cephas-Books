interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <a className="logo" href="/" aria-label="Cephas Books home">
      <svg className="logo__mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M5 10.5c7-2.8 13.2-1.8 19 3v27c-5.8-4.8-12-5.8-19-3V10.5Z" />
        <path d="M43 10.5c-7-2.8-13.2-1.8-19 3v27c5.8-4.8 12-5.8 19-3V10.5Z" />
      </svg>
      {!compact && (
        <span>
          Cephas <strong>Books</strong>
        </span>
      )}
    </a>
  );
}

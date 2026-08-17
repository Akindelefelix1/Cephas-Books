import type { PropsWithChildren } from 'react';
import { Logo } from '@/components/brand/Logo';

export function MainLayout({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="#discover">Discover</a>
          <a href="#about">About</a>
        </nav>
      </header>
      <main>{children}</main>
      <footer>© {new Date().getFullYear()} Cephas Books</footer>
    </div>
  );
}

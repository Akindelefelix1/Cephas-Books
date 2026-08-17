import { Logo } from '@/components/brand/Logo';
import type { View } from '@/types/app';

export function MarketingFooter({ onView }: { onView: (view: View) => void }) {
  return (
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
        <button onClick={() => onView('platform')}>Platform</button>
        <button onClick={() => onView('solutions')}>Solutions</button>
        <button onClick={() => onView('pricing')}>Pricing</button>
        <button onClick={() => onView('security')}>Security</button>
      </div>
      <div>
        <strong>Company</strong>
        <button onClick={() => onView('landing')}>Home</button>
        <button onClick={() => onView('register')}>Get started</button>
        <button onClick={() => onView('login')}>Sign in</button>
      </div>
      <div>
        <strong>Resources</strong>
        <button onClick={() => onView('resources')}>Help centre</button>
        <button onClick={() => onView('resources')}>Product guides</button>
        <button onClick={() => onView('security')}>Security</button>
      </div>
      <small>© 2026 Cephas Technologies. All rights reserved.</small>
    </footer>
  );
}

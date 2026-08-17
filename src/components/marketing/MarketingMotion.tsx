import { useEffect } from 'react';

export function MarketingMotion() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(
      '.marketing main > section, .marketing-footer > div',
    );
    elements.forEach((element) => element.classList.add('motion-reveal'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -45px' },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}

import { Button } from '@/components/ui/Button';

export function HomePage() {
  return (
    <section className="hero" id="discover">
      <div className="hero__content">
        <p className="eyebrow">Your next chapter starts here</p>
        <h1>Books that move ideas—and people—forward.</h1>
        <p className="hero__copy">
          Discover thoughtful stories, practical knowledge, and fresh perspectives
          curated for curious readers.
        </p>
        <div className="hero__actions">
          <Button>Explore the collection</Button>
          <a href="#about">Our story <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <div className="hero__art" aria-hidden="true">
        <div className="book book--back"><span>Ideas</span></div>
        <div className="book book--front"><span>Stories<br />worth<br />sharing.</span></div>
        <div className="orb" />
      </div>
    </section>
  );
}

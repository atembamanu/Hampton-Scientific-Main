import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SLIDES = [
  {
    id: 'reagents',
    label: 'Reagents',
    caption: 'Laboratory reagents & kits',
    href: '/products?q=reagents',
    src: '/marketing/hero/reagents.jpg',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    caption: 'Analysers & lab equipment',
    href: '/products?q=equipment',
    src: '/marketing/hero/equipment.jpg',
  },
  {
    id: 'consumables',
    label: 'Consumables',
    caption: 'Gloves, tubes & disposables',
    href: '/products?q=consumables',
    src: '/marketing/hero/consumables.jpg',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    caption: 'Point-of-care diagnostics',
    href: '/products?q=diagnostics',
    src: '/marketing/hero/diagnostics.jpg',
  },
];

export const HeroCategorySlider = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = SLIDES[index];

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative mx-auto aspect-square w-full max-w-[480px]">
        <div className="absolute inset-[6%] overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-ink/5">
          {SLIDES.map((slide, i) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-hidden={i !== index}
            >
              <img
                src={slide.src}
                alt={`${slide.label} — ${slide.caption}`}
                className="h-full w-full object-contain p-[8%]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-3 text-center">
        <Link
          to={active.href}
          className="inline-block text-xs font-medium text-ink hover:text-brand transition-colors"
        >
          {active.label}
          <span className="text-ink-faint font-normal"> · {active.caption}</span>
        </Link>
        <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label="Hero categories">
          {SLIDES.map((slide, i) => {
            const selected = i === index;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={slide.label}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  selected ? 'w-6 bg-brand' : 'w-1.5 bg-ink/20 hover:bg-ink/40'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

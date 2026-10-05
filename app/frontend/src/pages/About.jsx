import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { EditorialSection } from '../components/template/EditorialSection';
import {
  aboutCapabilities,
  aboutHeroImage,
  aboutMission,
  aboutValues,
  aboutVision,
  aboutWhatWeDo,
} from '../data/catalog';
import { useSiteContent } from '../utils/siteContent';

const sections = [
  { id: 'mission-vision', label: 'Mission & Vision' },
  { id: 'what-we-do', label: 'What we do' },
  { id: 'core-values', label: 'Core values' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'our-impact', label: 'Our impact' },
];

const AboutSideNav = ({ activeId, onNavigate }) => (
  <nav aria-label="About page sections">
    <p className="editorial-label mb-4 hidden lg:block">On this page</p>
    <ul className="flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
      {sections.map(({ id, label }) => {
        const isActive = activeId === id;
        return (
          <li key={id} className="flex-shrink-0 lg:flex-shrink">
            <button
              type="button"
              onClick={() => onNavigate(id)}
              className={`ui-nav-chip block text-left text-[11px] font-medium uppercase tracking-[0.15em] whitespace-nowrap px-3 py-2 lg:px-0 lg:py-2.5 rounded-full lg:rounded-none transition-colors border lg:border-0 ${
                isActive
                  ? 'text-copper border-copper/30 bg-copper/5 lg:bg-transparent lg:border-l-2 lg:border-copper lg:pl-3'
                  : 'text-ink-faint border-transparent hover:text-ink lg:hover:border-l-2 lg:hover:border-ink/15 lg:hover:pl-3'
              }`}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export const About = () => {
  const [activeId, setActiveId] = useState(sections[0].id);
  const { impact } = useSiteContent();

  useEffect(() => {
    const elements = sections
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-12 lg:mb-16">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="editorial-label">About us</span>
              <span className="w-8 h-px bg-copper" />
              <span className="editorial-label">Est. 2009</span>
            </div>
            <h1 className="editorial-headline mb-6">
              Connecting Africa with{' '}
              <span className="text-copper">global</span> healthcare innovation.
            </h1>
            <p className="text-ink-muted leading-relaxed max-w-lg mb-8">
              Your trusted partner in linking Africa&apos;s healthcare sector with global scientific innovation —
              supplying certified equipment, consumables, and training.
            </p>
            <Link to="/contact" className="btn-primary">Enquire</Link>
          </div>
          <div className="aspect-[4/5] max-h-[480px] rounded-2xl overflow-hidden bg-cream-dark">
            <img
              src={aboutHeroImage}
              alt="Healthcare professionals at work"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Side nav + content */}
        <div className="section-divider pt-12 lg:pt-16">
          <div className="lg:flex lg:gap-x-20 xl:gap-x-24">
            <aside className="lg:w-36 xl:w-40 flex-shrink-0 lg:sticky lg:top-28 lg:self-start mb-10 lg:mb-0">
              <AboutSideNav activeId={activeId} onNavigate={scrollToSection} />
            </aside>

            <div className="flex-1 min-w-0">
              {/* Mission & vision */}
              <section id="mission-vision" className="scroll-mt-28 pb-12 lg:pb-16">
                <p className="editorial-label mb-8 lg:hidden">Mission & Vision</p>
                <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
                  <div className="editorial-accent-border">
                    <p className="editorial-label mb-5">Mission</p>
                    <p className="text-ink-muted leading-relaxed text-[15px]">{aboutMission}</p>
                  </div>
                  <div className="editorial-accent-border">
                    <p className="editorial-label mb-5">Vision</p>
                    <p className="text-ink-muted leading-relaxed text-[15px]">{aboutVision}</p>
                  </div>
                </div>
              </section>

              <EditorialSection id="what-we-do" label="What we do">
                <p className="editorial-serif text-xl sm:text-2xl max-w-2xl mb-8 leading-snug">
                  {aboutWhatWeDo[0]}
                </p>
                <div className="max-w-2xl space-y-5">
                  {aboutWhatWeDo.slice(1).map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="text-ink-muted leading-relaxed text-[15px]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </EditorialSection>

              <EditorialSection id="core-values" label="Core values">
                <div className="grid sm:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-12 lg:gap-y-14">
                  {aboutValues.map(({ title, description }, i) => (
                    <div key={title} className="max-w-sm">
                      <span className="editorial-label text-copper mb-4 block">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-semibold text-ink text-base mb-3">{title}</h3>
                      <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
                    </div>
                  ))}
                </div>
              </EditorialSection>

              <EditorialSection id="capabilities" label="Capabilities">
                <ul className="grid md:grid-cols-2 gap-x-16 lg:gap-x-20 gap-y-5">
                  {aboutCapabilities.map((item) => (
                    <li key={item} className="flex items-start gap-4 text-[15px] text-ink-muted leading-relaxed pr-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-copper mt-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </EditorialSection>

              <EditorialSection id="our-impact" label="Our impact" className="mb-4">
                <div className="rounded-2xl bg-cream-dark/80 px-8 py-12 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
                  <div className="flex flex-wrap lg:flex-nowrap items-start justify-center gap-x-6 gap-y-10">
                    {impact.map(({ value, label }) => (
                      <div key={label} className="w-[calc(50%-0.75rem)] lg:w-auto lg:flex-1 min-w-0 text-center">
                        <p className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">{value}</p>
                        <p className="editorial-label mt-3 max-w-[10rem] mx-auto">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </EditorialSection>
            </div>
          </div>
        </div>

        {/* Closing quote */}
        <section className="section-divider pt-20 lg:pt-24 text-center">
          <p className="editorial-serif text-2xl sm:text-3xl max-w-2xl mx-auto mb-4">
            Transforming healthcare delivery across the continent.
          </p>
          <p className="text-ink-faint text-sm mb-8">Equipment, training, and support — end to end.</p>
          <Link to="/contact" className="btn-primary">Get in touch</Link>
        </section>
      </div>
    </div>
  );
};

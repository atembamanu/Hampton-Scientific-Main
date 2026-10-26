import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { partnerLogos } from '../data/partnerLogos';

export const Partners = () => (
  <div className="min-h-screen pb-20 bg-cream">
    <section className="relative overflow-hidden bg-brand text-white">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.2), transparent 45%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
          Our Partners
        </h1>
        <nav aria-label="Breadcrumb" className="text-sm text-white/80">
          <ol className="inline-flex items-center gap-2 justify-center flex-wrap">
            <li>
              <Link to="/" className="hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/50">
              »
            </li>
            <li className="text-white font-medium">Our Partners</li>
          </ol>
        </nav>
      </div>
    </section>

    <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <p className="editorial-label mb-4">Manufacturing partners</p>
        <p className="text-ink-muted leading-relaxed text-[15px]">
          Hampton Scientific works with certified global manufacturers so facilities across Africa
          can access reliable equipment, diagnostics, and consumables — with documentation,
          installation, and training support.
        </p>
      </div>

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {partnerLogos.map((partner) => (
          <li key={partner.name}>
            <a
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-36 sm:h-40 flex-col items-center justify-center gap-3 rounded-xl border border-ink/10 bg-white px-5 py-6 transition-colors hover:border-brand/35 hover:bg-brand/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                loading="lazy"
                decoding="async"
                className="max-h-14 sm:max-h-16 max-w-full object-contain opacity-90 transition duration-300 group-hover:opacity-100"
              />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint group-hover:text-brand">
                {partner.name}
                <ExternalLink className="w-3 h-3 opacity-0 -translate-y-0.5 transition group-hover:opacity-100" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <section className="section-divider mt-16 lg:mt-20 pt-12 text-center">
        <p className="editorial-serif text-2xl sm:text-3xl max-w-2xl mx-auto mb-4">
          Looking for a specific brand or analyser?
        </p>
        <p className="text-ink-faint text-sm mb-8 max-w-lg mx-auto">
          Tell us what your facility needs — we will confirm availability and send a tailored quotation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/contact" className="btn-primary">
            Contact us
          </Link>
          <Link to="/products" className="btn-secondary">
            Browse catalogue
          </Link>
        </div>
      </section>
    </div>
  </div>
);

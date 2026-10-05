import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileText, Headphones, MessageCircle, ShieldCheck, Truck } from 'lucide-react';

import { TemplateProductCard, SectionTitle } from '../components/template/TemplateProductCard';
import { featuredProducts, storefrontCategories, useLiveCatalog } from '../utils/liveCatalog';
import { useSiteContent } from '../utils/siteContent';
import { heroSlides } from '../data/catalog';

const TRUST = [
  'Quote-based pricing for facilities — no public checkout',
  'Certified equipment from trusted global manufacturers',
  'Installation, training, and after-sales support',
  'Supplying hospitals and clinics across Africa',
];

const VALUE_STRIP = [
  {
    icon: Truck,
    title: 'Regional delivery',
    body: 'Delivery and installation to facilities across Kenya and East Africa.',
  },
  {
    icon: ShieldCheck,
    title: 'Certified authentic',
    body: 'Sourced from manufacturers you already trust, with documentation on file.',
  },
  {
    icon: Headphones,
    title: 'Specialist support',
    body: 'Speak to Hampton staff who know the catalogue and your facility\'s paperwork.',
  },
  {
    icon: FileText,
    title: 'Facility invoicing',
    body: 'Quotes, invoices, and delivery notes that match how hospitals actually buy.',
  },
];

const WHY = [
  { n: '01', title: 'Built for facilities', body: 'Quotes, invoices, and delivery notes that match how hospitals actually procure — not a consumer cart.' },
  { n: '02', title: 'Certified sources', body: 'Equipment and reagents sourced from manufacturers you already trust, with documentation for your records.' },
  { n: '03', title: 'Training included', body: 'We install, commission, and train your team so the analyser does not sit unused after delivery.' },
  { n: '04', title: 'A specialist, not a bot', body: 'Talk to Hampton staff who know the catalogue, your county, and the paperwork your facility needs.' },
];

export const Home = () => {
  const { products, categories } = useLiveCatalog();
  const { contact, impact, partners } = useSiteContent();
  const featured = featuredProducts(products, 6);
  const heroProduct = featured[0] || products[0];
  const heroSecondary = featured[1] || products[1];
  const fallbackSlide = heroSlides[0];
  const heroImage = heroProduct?.image || fallbackSlide?.image;
  const phoneHref = (contact.phone || '').replace(/\s/g, '');
  const trustBadge = impact[0]?.label
    ? `Trusted by ${impact[0].value} ${String(impact[0].label).toLowerCase()}`
    : 'Trusted by healthcare facilities';
  const categoryCards = storefrontCategories(categories, products, 8);

  return (
    <div className="bg-cream">
      <section className="bg-gradient-to-b from-cream-dark/80 to-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <p className="inline-flex items-center rounded-full bg-white border border-ink/10 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-copper mb-5">
                {trustBadge}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.08] tracking-tight text-ink mb-5">
                Medical equipment,{' '}
                <span className="text-copper italic font-semibold">supplied</span>
                {' '}across Africa.
              </h1>
              <p className="text-ink-muted text-base leading-relaxed mb-7 max-w-lg">
                Laboratory analysers, point-of-care devices, and consumables for hospitals and clinics — quoted to your facility, with training and support.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Link to="/products" className="btn-store">
                  Browse catalogue
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/contact" className="btn-store-outline">
                  <MessageCircle className="w-4 h-4" />
                  Talk to us
                </Link>
              </div>
              <ul className="space-y-2">
                {TRUST.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                    <Check className="w-4 h-4 text-copper flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
                {contact.phone && (
                  <li className="flex items-start gap-2 text-sm text-ink-muted">
                    <Check className="w-4 h-4 text-copper flex-shrink-0 mt-0.5" />
                    <a href={`tel:${phoneHref}`} className="hover:text-copper">Call {contact.phone}</a>
                  </li>
                )}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-6 rounded-full bg-white/80" aria-hidden />
              <div className="relative aspect-square max-h-[500px] mx-auto">
                {heroSecondary?.image && heroSecondary.image !== heroImage && (
                  <img
                    src={heroSecondary.image}
                    alt={heroSecondary.name || ''}
                    className="absolute right-[2%] top-[16%] w-[54%] object-contain drop-shadow-xl rotate-[7deg]"
                  />
                )}
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt={heroProduct?.name || 'Hampton Scientific equipment'}
                    className="absolute left-0 top-[6%] w-[68%] h-[78%] object-contain drop-shadow-2xl -rotate-[3deg]"
                  />
                ) : (
                  <div className="w-full h-full rounded-3xl bg-cream-dark" />
                )}
              </div>
              {heroProduct?.name && (
                <p className="relative text-center text-xs text-ink-faint mt-1">
                  {heroProduct.category ? `${heroProduct.category} · ` : ''}{heroProduct.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-ink/10">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 bg-ink/10 gap-px">
          {VALUE_STRIP.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3 px-5 sm:px-6 py-6 bg-white">
              <span className="w-10 h-10 rounded-full bg-cream flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-copper" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-semibold text-ink text-sm">{title}</p>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-copper-dark/20 bg-copper text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          <p className="text-[11px] font-semibold tracking-wide uppercase text-white/70">Trusted manufacturing partners</p>
          {(partners || []).map((name) => (
            <span key={name} className="text-sm font-medium text-white/90">{name}</span>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-wrap md:flex-nowrap items-start justify-center gap-x-4 gap-y-6">
            {(impact || []).map(({ value, label }) => (
              <div key={label} className="w-[calc(50%-0.5rem)] md:w-auto md:flex-1 min-w-0 text-center">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/75 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {categoryCards.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-14">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-ink tracking-tight">
                Shop by category
              </h2>
              <p className="text-sm text-ink-muted mt-1">Everything you need, organised for the laboratory.</p>
            </div>
            <Link to="/products" className="text-sm font-medium text-copper hover:underline whitespace-nowrap">
              View all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categoryCards.map((category) => (
              <Link
                key={category.category_id}
                to={`/products?category=${category.slug}`}
                className="group bg-white border border-ink/10 rounded-2xl p-5 hover:border-copper/40 hover:shadow-sm transition-colors"
              >
                <p className="font-semibold text-ink group-hover:text-copper">{category.name}</p>
                <p className="text-xs text-ink-faint mt-1">
                  {category.count} {category.count === 1 ? 'product' : 'products'}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 border-t border-ink/10">
        <SectionTitle subtitle="Select items and request a quote — no checkout required.">
          Featured
        </SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
          {featured.map((p) => (
            <TemplateProductCard key={p.id} product={p} />
          ))}
        </div>
        {featured.length === 0 && (
          <p className="text-sm text-ink-muted">Featured catalogue items will appear here.</p>
        )}
        <div className="text-center mt-12">
          <Link to="/products" className="btn-store-outline">Browse all products</Link>
        </div>
      </section>

      <section className="bg-white border-y border-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-3 max-w-xl">
            Why facilities stay with{' '}
            <span className="text-copper italic font-semibold">Hampton</span>.
          </h2>
          <p className="text-sm text-ink-muted mb-10 max-w-xl">
            Equipment, training, and paperwork that fit how African healthcare facilities actually buy.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {WHY.map((item) => (
              <div key={item.n} className="flex gap-4">
                <span className="text-xs font-semibold tracking-widest text-copper mt-1">{item.n}</span>
                <div>
                  <h3 className="font-semibold text-ink mb-1">{item.title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-2xl sm:text-3xl font-serif text-ink leading-snug max-w-2xl mx-auto">
          Maybe expensive is just a matter of perspective.
        </p>
        <p className="text-ink-faint text-sm mt-4">Quality equipment. Competitive quote-based pricing.</p>
        <Link to="/contact" className="inline-block mt-8 btn-store">Talk to us</Link>
      </section>
    </div>
  );
};

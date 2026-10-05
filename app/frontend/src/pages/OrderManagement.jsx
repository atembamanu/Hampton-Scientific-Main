import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Lock,
  MessageSquare,
  Package,
  Percent,
  Receipt,
  ShoppingBag,
} from 'lucide-react';

const PAINS = [
  'Quotes scattered across email, chat, and paper',
  'No single view of what was ordered vs delivered',
  'Branches ordering blindly without shared history',
  'Anyone on a shared inbox seeing prices they should not',
];

const FLOW_SLIDES = [
  {
    src: '/marketing/Facility%20Quotes.png',
    label: 'Quotes',
    title: 'Every request in one queue',
    body: 'Draft to accepted — by branch, status, and amount — with list vs quoted totals visible before you commit.',
    icon: FileText,
  },
  {
    src: '/marketing/Facility%20Facility%20Orders.png',
    label: 'Orders',
    title: 'Fulfilment you can follow',
    body: 'Dispatched, out for delivery, delivered — with dates your team can check without calling Hampton.',
    icon: Package,
  },
  {
    src: '/marketing/Facility%20Facility%20Facility%20Invoices.png',
    label: 'Invoices',
    title: 'Billing stays with authorised eyes',
    body: 'Invoice references, totals, and overdue status in the same portal — not buried in a shared inbox.',
    icon: Receipt,
  },
];

const REPORT_SLIDES = [
  {
    src: '/marketing/Facility%20Reports%20Overview%20Analytics.png',
    label: 'Overview',
    title: 'Fulfilment at a glance',
    body: 'Quotes opened, priced work waiting on you, orders placed, and units in transit — filtered by branch and date.',
  },
  {
    src: '/marketing/Facility%20Activty%20Analytics.png',
    label: 'Trends',
    title: 'Monthly activity and mix',
    body: 'Waiting-on-you quotes, orders by month, and which categories you actually use — not a blank spreadsheet.',
  },
  {
    src: '/marketing/Facility%20Recent%20Orders%20and%20Quote%20History%20Analytics.png',
    label: 'Activity',
    title: 'Orders and quotes side by side',
    body: 'Recent order status next to quote history — so fulfilment never depends on chasing email threads.',
  },
  {
    src: '/marketing/Facility%20Branches%20Analytics.png',
    label: 'Branches',
    title: 'Compare Main and Annex',
    body: 'Quotes, orders, items delivered, and units on the way — per branch, in one report view.',
  },
];

const ProductFrame = ({ src, alt, className = '', priority = false }) => (
  <img
    src={src}
    alt={alt}
    className={`om-shot ${className}`.trim()}
    loading={priority ? 'eager' : 'lazy'}
    decoding={priority ? 'sync' : 'async'}
    draggable={false}
  />
);

const FeatureCarousel = ({ slides, ariaLabel }) => {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = slide.icon;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const go = (next) => {
    setIndex((current) => (current + next + slides.length) % slides.length);
  };

  return (
    <div className="om-carousel">
      <div className="om-carousel-copy">
        <p className="text-copper text-xs font-semibold tracking-[0.2em] uppercase mb-3 inline-flex items-center gap-2">
          {Icon ? <Icon className="w-3.5 h-3.5" aria-hidden /> : null}
          {slide.label}
        </p>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3 om-fade-key" key={`t-${ariaLabel}-${index}`}>
          {slide.title}
        </h3>
        <p className="text-ink-muted leading-relaxed max-w-md om-fade-key" key={`b-${ariaLabel}-${index}`}>
          {slide.body}
        </p>
        <div className="flex items-center gap-3 mt-8">
          <button type="button" className="om-carousel-nav" onClick={() => go(-1)} aria-label={`Previous ${ariaLabel}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-2" role="tablist" aria-label={ariaLabel}>
            {slides.map((item, i) => (
              <button
                key={item.label}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`om-carousel-dot ${i === index ? 'is-active' : ''}`}
                onClick={() => setIndex(i)}
              >
                <span className="sr-only">{item.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="om-carousel-nav" onClick={() => go(1)} aria-label={`Next ${ariaLabel}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="om-carousel-stage">
        {slides.map((item, i) => (
          <div
            key={item.src}
            className={`om-carousel-slide ${i === index ? 'is-active' : ''}`}
            aria-hidden={i !== index}
          >
            <ProductFrame
              src={item.src}
              alt={`${item.label}: ${item.title}`}
              priority={i === 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const OrderManagement = () => (
  <div className="om-page bg-cream text-ink overflow-x-hidden">
    <section className="om-hero relative">
      <div className="absolute inset-0 om-hero-wash" aria-hidden />
      <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 flex flex-col items-center text-center">
        <div className="om-reveal max-w-2xl mb-10 lg:mb-12">
          <p className="editorial-label mb-4 text-copper">Hampton Scientific</p>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-bold leading-[1.06] tracking-tight text-ink mb-5">
            Order management that ends the{' '}
            <span className="text-copper italic font-semibold">procurement hustle</span>.
          </h1>
          <p className="text-ink-muted text-base sm:text-[1.05rem] leading-relaxed mb-8 mx-auto max-w-lg">
            Quote, track, report, and stay connected with Hampton — one facility portal for your whole organisation.
          </p>
          <div className="flex flex-row flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-store">
              Register your facility
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="btn-store-outline">
              Facility sign in
            </Link>
          </div>
        </div>
        <ProductFrame
          className="om-shot-hero"
          src="/marketing/Facility%20Dashboard.png"
          alt="Facility dashboard with branch activity for Riverside Teaching Hospital"
          priority
        />
      </div>
    </section>

    <section className="relative border-t border-ink/10 bg-white">
      <div className="absolute inset-0 om-scarce-dots" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid lg:grid-cols-2 gap-12 lg:gap-20">
        <div>
          <p className="editorial-label mb-3">The hustle</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight mb-4">
            Procurement should not feel like a second job.
          </h2>
          <p className="text-ink-muted leading-relaxed max-w-md">
            We built the portal so facilities stop chasing deliveries and start running the lab.
          </p>
        </div>
        <ul className="space-y-5">
          {PAINS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm sm:text-base text-ink border-b border-ink/10 pb-5 last:border-0 last:pb-0">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-copper flex-shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="relative border-t border-ink/10">
      <div className="absolute inset-0 om-scarce-glow" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-2xl mb-12 lg:mb-16">
          <p className="editorial-label mb-3">Day to day</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
            Quote → order → invoice, without leaving the portal.
          </h2>
        </div>
        <FeatureCarousel slides={FLOW_SLIDES} ariaLabel="Procurement views" />
      </div>
    </section>

    <section className="border-t border-ink/10 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-2xl mb-12 lg:mb-16">
          <p className="editorial-label mb-3">Reporting</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
            Analytics that match how facilities buy.
          </h2>
        </div>
        <FeatureCarousel slides={REPORT_SLIDES} ariaLabel="Report views" />
      </div>
    </section>

    <section className="relative border-t border-ink/10">
      <div className="absolute inset-0 om-scarce-wash" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28 grid lg:grid-cols-[minmax(0,22rem)_minmax(0,51rem)] gap-12 lg:gap-10 xl:gap-14 items-center justify-between">
        <div>
          <p className="editorial-label mb-3">Multi-branch</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight mb-4">
            See what is happening when you are not on site.
          </h2>
          <p className="text-ink-muted leading-relaxed mb-8 max-w-md">
            Manage Main and Annex under one organisation. Filter quotes, orders, and reports by branch — HQ stays informed without phone tag.
          </p>
          <ul className="space-y-3">
            {[
              'Add and deactivate branches from one screen',
              'Branch activity on the dashboard and in reports',
              'Personnel scoped to the locations they serve',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                <Building2 className="w-4 h-4 text-copper flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ProductFrame
          src="/marketing/Facility%20Branches.png"
          alt="Branches list for Main Facility and Riverside Annex"
        />
      </div>
    </section>

    <section className="border-t border-ink/10 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28 grid lg:grid-cols-[minmax(0,51rem)_minmax(0,22rem)] gap-12 lg:gap-10 xl:gap-14 items-center justify-between">
        <ProductFrame
          src="/marketing/Facility%20Users.png"
          alt="Facility users with roles across branches"
        />
        <div>
          <p className="editorial-label mb-3">Access control</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight mb-4">
            Only authorised people see quotes, orders, and invoices.
          </h2>
          <p className="text-ink-muted leading-relaxed mb-8 max-w-md">
            Create branch managers and personnel with logins you control. Permissions keep pricing and billing with the right eyes.
          </p>
          <ul className="space-y-3">
            {[
              'Org admins, branch managers, and branch users',
              'Passwords set and shared by your facility admin',
              'Branch staff see their scope — not the whole organisation',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                <Lock className="w-4 h-4 text-copper flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    <section className="border-t border-ink/10 bg-ink text-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-copper-light mb-3">Connected to Hampton</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
            Catalogue, conversation, and savings — without leaving the portal.
          </h2>
          <p className="text-cream/70 leading-relaxed max-w-lg">
            Browse products in-dashboard, chat on the quote with Sales Support, and see line-level savings before you accept.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-10">
          {[
            { icon: ShoppingBag, title: 'Catalogue in the dashboard', body: 'Browse and add to quote without hopping to a separate storefront.' },
            { icon: MessageSquare, title: 'Chat on the quote', body: 'Clarify specs and delivery with Hampton Sales Support on the same request.' },
            { icon: Percent, title: 'Savings you can see', body: 'Quoted lines show what you save against list before you accept.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-t border-white/15 pt-6">
              <Icon className="w-5 h-5 text-copper-light mb-4" aria-hidden />
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-cream/70 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="relative overflow-hidden border-t border-ink/10">
      <div className="absolute inset-0 om-cta-wash" aria-hidden />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 lg:py-28 text-center">
        <ClipboardList className="w-8 h-8 text-copper mx-auto mb-6" aria-hidden />
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight mb-4">
          Register your facility. Feel the difference on the next order.
        </h2>
        <p className="text-ink-muted leading-relaxed mb-8 max-w-xl mx-auto">
          Invite authorised users across branches and run quotes, orders, chat, and reports from one place — with Hampton connected throughout.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-store">
            Register your facility
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/contact" className="btn-store-outline">
            Talk to Hampton
          </Link>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ink-faint">
          {['Multi-branch visibility', 'Role-based access', 'Quote to invoice', 'Live reporting'].map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-copper" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  </div>
);

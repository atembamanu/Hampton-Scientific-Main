import { Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { formatPrice } from '../../utils/pricing';

export { FilterMultiSelect as FacilityMultiSelect } from '../FilterMultiSelect';

export const FacilityFilterBar = ({ children }) => (
  <div className="filter-bar">{children}</div>
);

export const FacilitySearchInput = ({ className = '', ...props }) => (
  <div className={`filter-search relative flex-1 min-w-[7.5rem] ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
    <input
      type="search"
      className="filter-field h-10 w-full pl-9 pr-3 border border-ink/15 rounded text-sm bg-white/80 text-ink"
      {...props}
    />
  </div>
);

export const FacilitySelect = ({ className = '', children, ...props }) => (
  <select
    className={`h-10 pl-3 pr-12 border border-ink/15 rounded text-sm bg-white/80 text-ink ${className}`}
    {...props}
  >
    {children}
  </select>
);

export const FacilityDateInput = ({ className = '', ...props }) => (
  <input
    type="date"
    className={`filter-field h-10 px-3 border border-ink/15 rounded text-sm bg-white/80 text-ink ${className}`}
    {...props}
  />
);

export const FacilityResetFilters = ({ disabled, onReset }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onReset}
    className="filter-reset inline-flex h-10 items-center gap-2 px-3 rounded-lg border border-ink/15 bg-white text-sm text-ink hover:bg-ink/5 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
  >
    <RotateCcw className="w-4 h-4" />
    Reset
  </button>
);

const MetaStat = ({ label, value }) => (
  <div className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-copper/15 via-copper/10 to-ink/[0.04] border border-copper/25 px-4 py-2 shadow-[0_8px_24px_rgba(139,90,43,0.12)]">
    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-copper">
      {label}
    </span>
    <span className="text-xl font-semibold tabular-nums leading-none text-ink">{value}</span>
  </div>
);

export const FacilityListMeta = ({ total, page, limit, noun, amountTotal = null, amountLabel = 'Amount due' }) => {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const title = noun.charAt(0).toUpperCase() + noun.slice(1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <p className="text-sm text-ink-muted">
        {total === 0
          ? `No ${noun}`
          : `Showing ${from}–${to} of ${total} ${noun}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {amountTotal != null && (
          <MetaStat label={amountLabel} value={formatPrice(amountTotal)} />
        )}
        <MetaStat label={`Total ${title}`} value={total} />
      </div>
    </div>
  );
};

export const FacilityPager = ({ page, pages, total, limit, onPage, onLimit }) => {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-ink/10 text-sm">
      <div className="flex items-center gap-2 text-ink-muted">
        <span>Rows</span>
        <select
          value={limit}
          onChange={(e) => onLimit(Number(e.target.value))}
          className="h-8 px-2 border border-ink/15 rounded-lg bg-white text-ink"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex h-8 items-center gap-1 px-3 rounded-lg border border-ink/15 disabled:opacity-40 hover:bg-ink/5"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-ink-muted px-1">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="inline-flex h-8 items-center gap-1 px-3 rounded-lg border border-ink/15 disabled:opacity-40 hover:bg-ink/5"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

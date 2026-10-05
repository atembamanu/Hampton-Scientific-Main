export const AdminPageHeader = ({ label, title, accent, description, actions }) => (
  <div className="mb-6 w-full">
    {label && <p className="editorial-label mb-2">{label}</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="app-page-title break-words">
          {title}
          {accent && <> <span className="text-copper">{accent}</span></>}
        </h1>
        {description && <p className="text-sm text-ink-muted mt-2 max-w-3xl break-words">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
    </div>
  </div>
);

export const AdminFilterBar = ({ children }) => (
  <div className="filter-bar">{children}</div>
);

export const AdminResetFilters = ({ disabled, onReset }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onReset}
    className="filter-reset inline-flex h-10 items-center gap-2 px-3 rounded-lg border border-ink/15 bg-white text-sm text-ink hover:bg-ink/5 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
  >
    Reset
  </button>
);

export const AdminFilterInput = ({ className = '', type, ...props }) => (
  <input
    type={type}
    {...props}
    className={`filter-field h-10 px-3 border border-ink/15 rounded text-sm bg-white/80 text-ink ${className}`}
  />
);

export { FilterMultiSelect as AdminMultiSelect } from '../FilterMultiSelect';

export const AdminFilterSelect = ({ className = '', children, ...props }) => (
  <select
    {...props}
    className={`h-10 pl-3 pr-12 border border-ink/15 rounded text-sm bg-white/80 text-ink ${className}`}
  >
    {children}
  </select>
);

export const AdminDataTable = ({ children, minWidth = 1100 }) => (
  <div className="editorial-panel p-0 overflow-hidden w-full">
    <div className="table-scroll">
      <table className="w-full text-sm" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </table>
    </div>
  </div>
);

export const AdminTableHead = ({ children }) => (
  <thead>
    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10 bg-cream/50">
      {children}
    </tr>
  </thead>
);

export const AdminTableTh = ({ children, className = '' }) => (
  <th className={`px-5 py-3 font-medium whitespace-nowrap ${className}`}>{children}</th>
);

export const AdminTableBody = ({ children }) => (
  <tbody className="divide-y divide-ink/5">{children}</tbody>
);

export const AdminTableRow = ({ children, className = '' }) => (
  <tr className={`hover:bg-ink/[0.02] ${className}`}>{children}</tr>
);

export const AdminTableTd = ({ children, className = '', nowrap = false }) => (
  <td className={`px-5 py-3.5 align-middle ${nowrap ? 'whitespace-nowrap' : ''} ${className}`}>
    {children}
  </td>
);

export const AdminEmptyState = ({ children }) => (
  <div className="editorial-panel p-12 text-center text-ink-muted w-full">{children}</div>
);

export const AdminLoadingState = () => (
  <div className="py-16 flex justify-center w-full">
    <div className="w-6 h-6 border-2 border-copper border-t-transparent rounded-full animate-spin" />
  </div>
);

export const AdminTableShell = ({ loading, hasRows, empty, children }) => {
  if (loading && !hasRows) return <AdminLoadingState />;
  if (!hasRows) return <AdminEmptyState>{empty}</AdminEmptyState>;
  return (
    <div className={`relative w-full ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {children}
    </div>
  );
};

export const AdminListMeta = ({ total, page, limit, noun }) => {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <p className="text-sm text-ink-muted mb-3">
      {total === 0 ? `No ${noun}` : `Showing ${from}–${to} of ${total} ${noun}`}
    </p>
  );
};

export const AdminPager = ({ page, pages, total, limit, onPage, onLimit }) => {
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
          className="inline-flex h-8 items-center px-3 rounded-lg border border-ink/15 disabled:opacity-40 hover:bg-ink/5"
        >
          Previous
        </button>
        <span className="text-ink-muted px-1">Page {page} of {pages}</span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="inline-flex h-8 items-center px-3 rounded-lg border border-ink/15 disabled:opacity-40 hover:bg-ink/5"
        >
          Next
        </button>
      </div>
    </div>
  );
};

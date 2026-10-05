export const SheetTabs = ({ tabs, value, onChange }) => (
  <div className="flex flex-wrap gap-1 border-b border-ink/10" role="tablist">
    {tabs.map((tab) => {
      const id = typeof tab === 'string' ? tab : tab.id;
      const label = typeof tab === 'string' ? tab : tab.label;
      const active = value === id;
      return (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={`ui-tab-sheet px-4 py-2 text-sm whitespace-nowrap transition-colors ${
            active
              ? 'bg-white border border-ink/10 border-b-white -mb-px font-medium text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

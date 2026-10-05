import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export const SearchableSelect = ({
  value = '',
  options = [],
  onSelect,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  stayOpen = false,
  selectedValues = [],
  disabled = false,
  footer = null,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const selected = new Set(selectedValues.length ? selectedValues : (value ? [value] : []));
  const current = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => (
      (option.label || '').toLowerCase().includes(term)
      || (option.hint || '').toLowerCase().includes(term)
    ));
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(next) => { if (!disabled) setOpen(next); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="form-field flex h-10 w-full items-center justify-between gap-2 border border-ink/15 bg-white px-3 text-left text-sm text-ink outline-none focus:border-brand disabled:bg-cream"
          >
            <span className={`truncate ${current ? '' : 'text-ink-muted'}`}>
              {current?.label || placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="form-select-menu z-[80] w-[var(--radix-popover-trigger-width)] min-w-[16rem] rounded-none border border-ink/15 bg-white p-0 text-ink shadow-lg"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="relative border-b border-ink/10">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-white pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-muted">{emptyText}</p>
            ) : matches.map((option) => {
              const checked = selected.has(option.value);
              return (
                <button
                  key={option.value || 'manual'}
                  type="button"
                  onClick={() => {
                    onSelect(option);
                    if (!stayOpen) setOpen(false);
                  }}
                  className="form-menu-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream/70"
                >
                  {stayOpen && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                        checked ? 'border-copper bg-copper text-white' : 'border-ink/30 bg-white'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? <span className="block truncate text-xs text-ink-muted">{option.hint}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {footer ? <div onClick={() => setOpen(false)}>{footer}</div> : null}
        </PopoverContent>
      </Popover>
    </div>
  );
};

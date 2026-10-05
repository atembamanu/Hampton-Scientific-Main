import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export const FilterMultiSelect = ({
  value = [],
  onChange,
  options = [],
  placeholder = 'All',
  searchPlaceholder = 'Search…',
  className = '',
  triggerClassName = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const selected = new Set(value);
  const labels = options.filter((opt) => selected.has(opt.value)).map((opt) => opt.label);
  let summary = placeholder;
  if (labels.length === 1) summary = labels[0];
  else if (labels.length > 1) summary = `${labels.length} selected`;

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => (opt.label || '').toLowerCase().includes(term));
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const toggle = (optionValue) => {
    const next = selected.has(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onChange(next);
  };

  return (
    <div className={`filter-multi ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`flex h-10 w-full items-center justify-between gap-2 rounded border border-ink/15 bg-white/80 px-3 text-left text-sm text-ink disabled:opacity-60 ${triggerClassName}`}
            title={labels.join(', ') || placeholder}
          >
            <span className={`truncate ${labels.length ? '' : 'text-ink-muted'}`}>{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[12rem] border border-ink/15 bg-white p-0 text-ink shadow-lg rounded"
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
          <div className="max-h-64 overflow-y-auto p-1">
            {options.length === 0 ? (
              <p className="px-2 py-2 text-sm text-ink-muted">No options</p>
            ) : matches.length === 0 ? (
              <p className="px-2 py-2 text-sm text-ink-muted">No matches</p>
            ) : matches.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-ink/[0.04]"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                      checked ? 'border-copper bg-copper text-white' : 'border-ink/30 bg-white'
                    }`}
                    aria-hidden
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

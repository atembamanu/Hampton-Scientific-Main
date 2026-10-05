import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import {
  format,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last year' },
  { id: 'all', label: 'All time' },
];

function parseDay(value) {
  if (!value) return undefined;
  const date = parseISO(String(value).slice(0, 10));
  return Number.isNaN(date.getTime()) ? undefined : startOfDay(date);
}

function toIso(date) {
  return format(date, 'yyyy-MM-dd');
}

function rangeFor(id, today = startOfDay(new Date())) {
  if (id === 'today') return { from: today, to: today };
  if (id === 'yesterday') {
    const day = subDays(today, 1);
    return { from: day, to: day };
  }
  if (id === '7d') return { from: subDays(today, 6), to: today };
  if (id === '30d') return { from: subDays(today, 29), to: today };
  if (id === '6m') return { from: subMonths(today, 6), to: today };
  if (id === '1y') return { from: subYears(today, 1), to: today };
  return undefined;
}

function matchingPreset(range) {
  if (!range?.from && !range?.to) return 'all';
  if (!range?.from || !range?.to) return null;
  const found = PRESETS.find((preset) => {
    const candidate = rangeFor(preset.id);
    if (!candidate) return false;
    return isSameDay(candidate.from, range.from) && isSameDay(candidate.to, range.to);
  });
  return found?.id || null;
}

function triggerLabel(from, to) {
  if (!from && !to) return 'All dates';
  const start = format(from, 'd MMM');
  const end = to ? format(to, 'd MMM') : start;
  return from && to && !isSameDay(from, to) ? `${start} – ${end}` : start;
}

export const FilterDateRange = ({ from = '', to = '', onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState();
  const [month, setMonth] = useState(new Date());

  const appliedFrom = parseDay(from);
  const appliedTo = parseDay(to);
  const appliedLabel = triggerLabel(appliedFrom, appliedTo);

  const openPanel = (next) => {
    if (next) {
      const initial = appliedFrom || appliedTo ? { from: appliedFrom, to: appliedTo || appliedFrom } : undefined;
      setDraft(initial);
      setMonth(initial?.from || new Date());
    }
    setOpen(next);
  };

  const choosePreset = (id) => {
    const range = rangeFor(id);
    setDraft(range);
    if (range?.from) setMonth(range.from);
  };

  const apply = () => {
    if (!draft?.from) {
      onChange({ from: '', to: '' });
    } else {
      onChange({
        from: toIso(draft.from),
        to: toIso(draft.to || draft.from),
      });
    }
    setOpen(false);
  };

  const activePreset = matchingPreset(draft);

  return (
    <div className="filter-date">
      <Popover open={open} onOpenChange={openPanel}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between gap-2 border border-ink/15 bg-white/80 px-3 text-left text-sm text-ink"
          >
            <span className={`truncate ${appliedFrom ? '' : 'text-ink-muted'}`}>{appliedLabel}</span>
            <Calendar className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="date-range-panel z-[80] w-auto max-w-[calc(100vw-1.5rem)] border border-ink/10 bg-white p-0 text-ink shadow-xl"
        >
          <div className="flex max-w-full flex-col sm:flex-row">
            <div className="flex gap-1 overflow-x-auto border-b border-ink/10 p-2 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`date-preset whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${
                    activePreset === preset.id ? 'bg-ink/[0.06] font-medium text-ink' : 'text-ink-muted hover:bg-ink/[0.04]'
                  }`}
                  onClick={() => choosePreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="date-range-calendars min-w-0 p-2 sm:p-3">
              <DayPicker
                mode="range"
                numberOfMonths={2}
                selected={draft}
                onSelect={setDraft}
                month={month}
                onMonthChange={setMonth}
                showOutsideDays
                classNames={{
                  months: 'flex flex-col gap-4 sm:flex-row sm:gap-6',
                  month: 'date-month relative space-y-3',
                  caption: 'relative flex h-8 items-center justify-center',
                  caption_label: 'text-sm font-medium text-ink',
                  nav: 'flex items-center',
                  nav_button: 'date-nav inline-flex h-7 w-7 items-center justify-center text-ink-muted hover:bg-ink/5 hover:text-ink',
                  nav_button_previous: 'date-nav-prev absolute left-0',
                  nav_button_next: 'date-nav-next absolute right-0',
                  table: 'w-full border-collapse',
                  head_row: 'flex',
                  head_cell: 'w-8 text-center text-[11px] font-medium text-ink-faint',
                  row: 'mt-1 flex w-full',
                  cell: 'relative h-8 w-8 p-0 text-center text-sm [&:has([aria-selected])]:bg-copper/15 [&:has(.day-range-start)]:rounded-l-full [&:has(.day-range-end)]:rounded-r-full',
                  day: 'date-day inline-flex h-8 w-8 items-center justify-center text-sm text-ink hover:bg-ink/5',
                  day_selected: 'bg-copper text-white hover:bg-copper hover:text-white',
                  day_range_start: 'day-range-start rounded-full bg-copper text-white',
                  day_range_end: 'day-range-end rounded-full bg-copper text-white',
                  day_range_middle: 'day-range-middle rounded-none bg-copper/15 text-ink',
                  day_today: 'font-semibold',
                  day_outside: 'text-ink-faint/50',
                  day_disabled: 'text-ink-faint opacity-40',
                  day_hidden: 'invisible',
                }}
                components={{
                  IconLeft: ({ className, ...props }) => <ChevronLeft className={`h-4 w-4 ${className || ''}`} {...props} />,
                  IconRight: ({ className, ...props }) => <ChevronRight className={`h-4 w-4 ${className || ''}`} {...props} />,
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={draft?.from ? format(draft.from, 'd MMM') : ''}
                placeholder="Start"
                className="date-range-input h-9 w-24 border border-ink/15 bg-white px-3 text-sm text-ink"
              />
              <span className="text-ink-faint">–</span>
              <input
                readOnly
                value={draft?.to ? format(draft.to, 'd MMM') : ''}
                placeholder="End"
                className="date-range-input h-9 w-24 border border-ink/15 bg-white px-3 text-sm text-ink"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="date-range-action h-9 border border-ink/15 bg-white px-4 text-sm text-ink hover:bg-ink/5"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="date-range-action h-9 bg-copper px-4 text-sm text-white hover:bg-copper/90"
                onClick={apply}
              >
                Apply
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

import { Star } from 'lucide-react';

export const FeaturedStarButton = ({ featured, disabled, onClick, name }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-pressed={Boolean(featured)}
    aria-label={featured ? `Remove ${name} from featured` : `Feature ${name}`}
    title={featured ? 'Featured' : 'Mark as featured'}
    className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-ink/5 disabled:opacity-50"
  >
    <Star className={`w-4 h-4 ${featured ? 'fill-copper text-copper' : 'text-ink-faint'}`} />
  </button>
);

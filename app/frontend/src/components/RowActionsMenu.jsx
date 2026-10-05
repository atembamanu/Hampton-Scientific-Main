import { useNavigate } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const RowActionsMenu = ({ items = [], align = 'end', label = 'More actions' }) => {
  const navigate = useNavigate();
  const visible = items.filter(Boolean);

  if (!visible.length) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side="bottom" sideOffset={6} collisionPadding={12} className="z-[80] min-w-[10.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-ink/10 p-0 shadow-lg">
        {visible.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            className="w-full cursor-pointer rounded-none px-3 py-2 text-sm text-ink hover:bg-copper/15 hover:text-copper focus:bg-copper/15 focus:text-copper"
            onSelect={(event) => {
              if (item.disabled) {
                event.preventDefault();
                return;
              }
              if (item.onSelect) {
                item.onSelect();
                return;
              }
              if (item.to) navigate(item.to);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export const AdminFormModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  className = '',
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={`${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto bg-white border border-ink/10 p-6 sm:rounded-lg ${className}`}
    >
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold text-ink">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="text-sm text-ink-muted">
            {description}
          </DialogDescription>
        ) : null}
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);

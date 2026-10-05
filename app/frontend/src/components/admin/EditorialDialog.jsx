import { useEffect } from 'react';

/**
 * Lightweight modal styled like the session-expiry prompt: soft ink overlay,
 * square white card, editorial label above the title. Use for workflow
 * confirmations where the heavy shadcn dialog feels too dark.
 */
export const EditorialDialog = ({
  open,
  onClose,
  label,
  title,
  description,
  children,
  titleId = 'editorial-dialog-title',
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => onClose?.()}
        className="absolute inset-0 bg-ink/50 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md bg-white border border-ink/10 shadow-xl p-6 sm:p-7"
        style={{ borderRadius: 4 }}
      >
        {label && <p className="editorial-label mb-2">{label}</p>}
        <h2 id={titleId} className="text-xl font-semibold text-ink mb-2">{title}</h2>
        {description && <p className="text-sm text-ink-muted mb-5">{description}</p>}
        {children}
      </div>
    </div>
  );
};

export const QuoteNotesPanel = ({ additionalNotes, items = [] }) => {
  const requestNotes = (additionalNotes || '').trim();
  const lineNotes = items.filter((it) => (it.notes || '').trim());
  const facilityNotes = items.filter((it) => (it.admin_notes || '').trim());

  return (
    <div className="min-w-0 rounded-lg border border-ink/10 bg-cream/40 p-4 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">Additional notes</p>
        {requestNotes ? (
          <p className="text-sm text-ink whitespace-pre-wrap">{requestNotes}</p>
        ) : (
          <p className="text-sm text-ink-muted">None</p>
        )}
        {lineNotes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {lineNotes.map((it, idx) => (
              <li key={it.id || idx} className="text-sm">
                <p className="font-medium text-ink">{it.product_name}</p>
                <p className="text-ink whitespace-pre-wrap">{it.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">Notes to facility</p>
        {facilityNotes.length === 0 ? (
          <p className="text-sm text-ink-muted">None</p>
        ) : (
          <ul className="space-y-2">
            {facilityNotes.map((it, idx) => (
              <li key={it.id || `admin-${idx}`} className="text-sm">
                <p className="font-medium text-ink">{it.product_name}</p>
                <p className="text-ink whitespace-pre-wrap">{it.admin_notes}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

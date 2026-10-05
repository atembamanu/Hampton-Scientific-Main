import { formatPrice, documentPricing } from '../../utils/pricing';

export const DocumentTotals = ({ document: doc, className = '' }) => {
  const summary = documentPricing(doc || {});
  const vatLabel = summary.includeVat
    ? `VAT (${summary.taxRate}%)`
    : `Excl. VAT (${summary.taxRate}%)`;

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <div className="flex justify-between">
        <span className="text-ink-muted">Subtotal</span>
        <span className="text-ink">{formatPrice(summary.listSubtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-muted">Discount</span>
        <span className="text-ink">-{formatPrice(summary.discount)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-muted">{vatLabel}</span>
        <span className="text-ink">{formatPrice(summary.includeVat ? summary.taxAmount : 0)}</span>
      </div>
      {summary.delivery > 0 && (
        <div className="flex justify-between">
          <span className="text-ink-muted">Delivery</span>
          <span className="text-ink">{formatPrice(summary.delivery)}</span>
        </div>
      )}
      <div className="flex justify-between pt-2 border-t border-ink/10">
        <span className="font-semibold text-ink">Total</span>
        <span className="text-lg font-bold text-copper">{formatPrice(summary.total)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-muted">Net</span>
        <span className="text-ink">{formatPrice(Math.max(0, summary.total - (summary.includeVat ? summary.taxAmount : 0)))}</span>
      </div>
    </div>
  );
};

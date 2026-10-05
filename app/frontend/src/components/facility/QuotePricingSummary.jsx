import { formatPrice, savingsPercent, itemListPrice, itemQuotedPrice, itemQuantity, itemSavings } from '../../utils/pricing';
import { DocumentTotals } from './DocumentTotals';

export const QuoteLineSavings = ({ item }) => {
  const list = itemListPrice(item);
  const quoted = itemQuotedPrice(item);
  const pct = savingsPercent(list, quoted);
  const savings = itemSavings(item);

  if (!quoted || !list || quoted >= list || savings <= 0) return null;

  return (
    <p className="text-xs text-emerald-700 mt-1">
      You save: {formatPrice(savings / itemQuantity(item))} ({pct}%)
    </p>
  );
};

export const QuotePricingSummary = ({ quote, prominent = true }) => {
  const isQuoted = (quote?.items || []).some(
    (item) => (Number(item.unit_price ?? item.quoted_unit_price) || 0) > 0,
  );

  return (
    <div className={`editorial-panel p-4 sm:p-6 ${prominent ? '' : ''}`}>
      {isQuoted ? (
        <DocumentTotals document={quote} />
      ) : (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Subtotal</span>
            <span className="text-ink">{formatPrice(quote?.list_subtotal || 0)}</span>
          </div>
          <p className="text-xs text-ink-faint pt-3">
            Quoted prices, discount, VAT and total will appear here once Hampton Scientific completes your quotation.
          </p>
        </>
      )}
    </div>
  );
};

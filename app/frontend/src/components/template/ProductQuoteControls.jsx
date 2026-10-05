import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import { useQuote } from '../../context/QuoteContext';
import { toQuoteProduct } from '../../data/catalog';

const clampQuantity = (value) => Math.max(1, parseInt(value, 10) || 1);

export const ProductQuoteControls = ({ product, compact = false }) => {
  const { addToQuote } = useQuote();
  const [quantity, setQuantity] = useState(1);

  const setQty = (next) => setQuantity(clampQuantity(next));

  const handleAdd = () => {
    addToQuote(toQuoteProduct(product), quantity);
  };

  const btnSize = compact ? 'w-7 h-7' : 'w-8 h-8';
  const inputWidth = compact ? 'w-9' : 'w-10';
  const addBtnClass = compact
    ? 'btn-primary !px-3 !py-1.5 !text-xs whitespace-nowrap'
    : 'btn-primary whitespace-nowrap';

  return (
    <div className="inline-flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <div className="inline-flex items-center h-8 rounded-full border border-ink/15 bg-white/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setQty(quantity - 1)}
          className={`${btnSize} flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors`}
          aria-label="Decrease quantity"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQty(e.target.value)}
          onBlur={(e) => setQty(e.target.value)}
          className={`${inputWidth} h-full text-center text-xs font-medium text-ink bg-transparent border-x border-ink/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none`}
          aria-label="Quantity"
        />
        <button
          type="button"
          onClick={() => setQty(quantity + 1)}
          className={`${btnSize} flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors`}
          aria-label="Increase quantity"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <button type="button" onClick={handleAdd} className={addBtnClass}>
        Add to Quote
      </button>
    </div>
  );
};

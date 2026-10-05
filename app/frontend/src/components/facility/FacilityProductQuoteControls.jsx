import { useState } from 'react';

import { Minus, Plus, Loader2 } from 'lucide-react';



import { useQuote } from '../../context/QuoteContext';

import { toQuoteProduct } from '../../data/catalog';
import { formatPriceWithUnit } from '../../utils/pricing';



const clampQuantity = (value) => Math.max(1, parseInt(value, 10) || 1);



export const FacilityProductQuoteControls = ({ product }) => {

  const { addToQuote, referenceLoading } = useQuote();

  const [quantity, setQuantity] = useState(1);

  const [notes, setNotes] = useState('');

  const [adding, setAdding] = useState(false);



  const setQty = (next) => setQuantity(clampQuantity(next));



  const handleAdd = async () => {

    setAdding(true);

    try {

      await addToQuote(toQuoteProduct(product), quantity, notes);

    } finally {

      setAdding(false);

    }

  };



  const busy = adding || referenceLoading;



  const listPrice = product.listPrice ?? 0;

  return (

    <div className="flex flex-col gap-3 w-full sm:w-auto sm:min-w-[280px]">

      {listPrice > 0 && (
        <p className="text-xs text-ink-muted text-right">
          List Price:{' '}
          <span className="font-medium text-ink">{formatPriceWithUnit(listPrice, product.priceUnit || 'unit')}</span>
        </p>
      )}

      <div className="flex items-center justify-end">

        <div className="inline-flex items-center h-8 rounded-full border border-ink/15 bg-white/70 overflow-hidden">

          <button

            type="button"

            onClick={() => setQty(quantity - 1)}

            className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors"

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

            className="w-10 h-full text-center text-xs font-medium text-ink bg-transparent border-x border-ink/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"

            aria-label="Quantity"

          />

          <button

            type="button"

            onClick={() => setQty(quantity + 1)}

            className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors"

            aria-label="Increase quantity"

          >

            <Plus className="w-3 h-3" />

          </button>

        </div>

      </div>



      <input

          id={`note-${product.slug}`}
          aria-label="Product note"

          type="text"

          value={notes}

          onChange={(e) => setNotes(e.target.value)}

          placeholder="Add a note (e.g. preferred brand or specification)"

          className="w-full bg-white border border-ink/10 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-copper/40"

        />



      <div className="flex justify-end">

        <button

          type="button"

          onClick={handleAdd}

          disabled={busy}

          className="btn-primary whitespace-nowrap flex items-center gap-2 disabled:opacity-60"

        >

          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}

          Add to Quote

        </button>

      </div>

    </div>

  );

};


import { Plus, Check } from 'lucide-react';
import { getFullImageUrl } from '../../utils/imageHelper';

export const ProductCard = ({ product, inCart, onToggle }) => (
  <article
    className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
    data-testid={`product-card-${product.id}`}
  >
    <div className="aspect-[4/3] bg-gray-50 overflow-hidden">
      <img
        src={product.categoryImage || getFullImageUrl(null)}
        alt={product.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = getFullImageUrl(null);
        }}
      />
    </div>

    <div className="flex flex-col flex-1 p-4">
      <p className="text-xs text-gray-500 truncate">{product.categoryName}</p>
      <h3 className="mt-1 font-medium text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
        {product.name}
      </h3>

      <button
        type="button"
        onClick={() => onToggle(product)}
        className={`mt-4 w-full inline-flex items-center justify-center gap-2 text-sm py-2 rounded-lg transition-colors ${
          inCart
            ? 'bg-brand-muted text-brand border border-brand/20'
            : 'bg-gray-900 hover:bg-gray-800 text-white'
        }`}
        data-testid={`add-to-cart-${product.id}`}
      >
        {inCart ? (
          <>
            <Check className="w-4 h-4" />
            In quote
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Add to quote
          </>
        )}
      </button>
    </div>
  </article>
);

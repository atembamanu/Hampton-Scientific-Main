import { Link } from 'react-router-dom';

import { ProductQuoteControls } from './ProductQuoteControls';

export const TemplateProductCard = ({ product, className = '' }) => (
  <article className={`group ${className}`}>
    <Link to={`/products/${product.slug}`} className="block mb-4">
      <div className="aspect-square bg-cream-dark rounded-2xl overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          loading="lazy"
        />
      </div>
    </Link>

    <p className="text-[11px] text-ink-faint uppercase tracking-wider mb-1">{product.category}</p>

    <Link to={`/products/${product.slug}`} className="block mb-3">
      <h3 className="font-semibold text-ink text-sm leading-snug hover:text-copper transition-colors line-clamp-2">
        {product.name}
      </h3>
    </Link>

    <ProductQuoteControls product={product} compact />
  </article>
);

export const SectionTitle = ({ children, subtitle }) => (
  <div className="mb-12">
    <h2 className="text-2xl font-bold text-ink tracking-tight">{children}</h2>
    {subtitle && <p className="text-ink-muted mt-2 text-sm max-w-lg">{subtitle}</p>}
  </div>
);

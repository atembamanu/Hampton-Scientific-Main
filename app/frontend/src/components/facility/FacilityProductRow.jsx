import { Link } from 'react-router-dom';

import { FacilityProductQuoteControls } from './FacilityProductQuoteControls';



export const FacilityProductRow = ({ product, detailBase = '/dashboard/products' }) => (

  <article className="flex flex-col lg:flex-row lg:items-start gap-4 py-4 border-b border-ink/10 last:border-0">

    <Link to={`${detailBase}/${product.slug}`} className="flex items-center gap-4 flex-1 min-w-0 group">

      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-cream-dark overflow-hidden flex-shrink-0">

        <img

          src={product.image}

          alt={product.name}

          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"

          loading="lazy"

        />

      </div>

      <div className="min-w-0 flex-1">

        <p className="text-[10px] text-ink-faint uppercase tracking-wider mb-0.5">{product.category}</p>

        <h3 className="font-semibold text-ink text-sm leading-snug group-hover:text-copper transition-colors line-clamp-2">

          {product.name}

        </h3>

      </div>

    </Link>

    <div className="lg:flex-shrink-0 lg:w-72 lg:ml-auto">

      <FacilityProductQuoteControls product={product} />

    </div>

  </article>

);


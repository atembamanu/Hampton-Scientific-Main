import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';

import { FacilityResetFilters, FacilityListMeta, FacilityPager } from '../../components/facility/FacilityListControls';
import { FacilityProductRow } from '../../components/facility/FacilityProductRow';
import { useQuote } from '../../context/QuoteContext';
import { filterCatalogProducts, useLiveCatalog } from '../../utils/liveCatalog';

export const FacilityProducts = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { hasItems, getTotalItems } = useQuote();
  const { products, categories, loading, error } = useLiveCatalog();
  const totalItems = getTotalItems();

  const activeCategory = categories.find((category) => category.slug === categoryParam);
  const filtered = filterCatalogProducts(products, { categoryId: categoryParam, search });

  useEffect(() => { setPage(1); }, [search, categoryParam]);

  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages);
  const visibleProducts = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  const setCategory = (slug) => {
    if (!slug || slug === 'all') setSearchParams({});
    else setSearchParams({ category: slug });
  };

  return (
    <div>
      <p className="editorial-label mb-2">Procurement</p>
      <h1 className="app-page-title mb-2">Products</h1>
      <p className="text-sm text-ink-muted mb-8">Browse the catalogue and add items to your quote basket.</p>

      <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
        <aside className="lg:w-48 flex-shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <nav className="flex flex-wrap lg:flex-col gap-1 pr-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`text-left text-sm py-2 px-3 rounded-lg ${!searchParams.get('category') ? 'bg-copper/10 text-copper font-medium' : 'text-ink-muted hover:text-ink'}`}
            >
              All products
            </button>
            {categories.map((category) => (
              <button
                key={category.category_id}
                type="button"
                onClick={() => setCategory(category.slug)}
                className={`text-left text-sm py-2 px-3 rounded-lg w-full ${
                  categoryParam === category.slug ? 'text-copper bg-copper/10 font-medium' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {category.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="filter-bar mb-0 flex-1 min-w-0">
              <div className="filter-search relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-ink/10 rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-copper/40"
                />
              </div>
              <FacilityResetFilters
                disabled={!search.trim() && categoryParam === 'all'}
                onReset={() => { setSearch(''); setCategory('all'); }}
              />
            </div>

            {hasItems ? (
              <Link to="/dashboard/quote" className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto">
                <ShoppingBag className="w-4 h-4" />
                View Quote Basket ({totalItems})
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto opacity-40 cursor-not-allowed pointer-events-none select-none"
                title="Add products to your quote basket first"
              >
                <ShoppingBag className="w-4 h-4" />
                View Quote Basket
              </span>
            )}
          </div>

          {filtered.length > 0 && (
            <FacilityListMeta total={filtered.length} page={currentPage} limit={limit} noun="products" />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <p className="text-xs text-ink-faint">{activeCategory?.name || ''}</p>
            <p className="text-xs font-bold text-red-600 text-right sm:text-right">
              * Final price confirmed in your quotation.
            </p>
          </div>

          <div className="editorial-panel px-4 sm:px-6">
            {loading ? (
              <p className="py-12 text-center text-ink-muted text-sm">Loading products…</p>
            ) : error ? (
              <p className="py-12 text-center text-ink-muted text-sm">Could not load the catalogue.</p>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-ink-muted text-sm">No products match your search.</p>
            ) : (
              visibleProducts.map((product) => <FacilityProductRow key={product.id} product={product} />)
            )}
            {filtered.length > 0 && !loading && (
              <FacilityPager
                page={currentPage}
                pages={pages}
                total={filtered.length}
                limit={limit}
                onPage={setPage}
                onLimit={(next) => { setLimit(next); setPage(1); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import { FacilityResetFilters } from '../components/facility/FacilityListControls';
import { TemplateProductCard } from '../components/template/TemplateProductCard';
import { filterCatalogProducts, storefrontCategories, useLiveCatalog } from '../utils/liveCatalog';

export const Products = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const qParam = searchParams.get('q') || '';
  const [search, setSearch] = useState(qParam);
  const { products, categories, loading, error } = useLiveCatalog();

  useEffect(() => { setSearch(qParam); }, [qParam]);

  const activeCategory = categories.find((category) => category.slug === categoryParam);
  const filtered = filterCatalogProducts(products, { categoryId: categoryParam, search });
  const pageTitle = activeCategory?.name || 'Store';
  const sidebarCategories = storefrontCategories(categories, products, 24);

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="editorial-label mb-3">Hampton Scientific</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-2">{pageTitle}</h1>
        <p className="text-ink-muted text-sm mb-10">Browse and add items to request a quote.</p>

        <div className="flex flex-col lg:flex-row gap-12">
          <aside className="lg:w-52 flex-shrink-0">
            <nav className="lg:sticky lg:top-28 space-y-1">
              <Link
                to="/products"
                className={`block text-sm py-2 ${!searchParams.get('category') ? 'text-copper font-semibold' : 'text-ink-muted hover:text-ink'}`}
              >
                All products
              </Link>
              {sidebarCategories.map((category) => (
                <Link
                  key={category.category_id}
                  to={`/products?category=${category.slug}`}
                  className={`block text-sm py-1.5 ${
                    categoryParam === category.slug ? 'text-copper font-semibold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="flex-1">
            <div className="filter-bar mb-8">
              <div className="filter-search relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Search products"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-ink/10 rounded-full pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-copper/40"
                />
              </div>
              <FacilityResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
            </div>

            {loading ? (
              <p className="text-sm text-ink-muted py-12">Loading products…</p>
            ) : error ? (
              <p className="text-sm text-ink-muted py-12">Could not load the catalogue.</p>
            ) : (
              <>
                <p className="text-xs text-ink-faint mb-6">{filtered.length} products</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
                  {filtered.map((product) => (
                    <TemplateProductCard key={product.id} product={product} />
                  ))}
                </div>
                {filtered.length === 0 && (
                  <p className="text-center text-ink-muted py-20">No products match your search.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

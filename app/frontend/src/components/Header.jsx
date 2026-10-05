import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, Search, ShoppingBag, User } from 'lucide-react';

import { useQuote } from '../context/QuoteContext';
import { useAuth } from '../context/AuthContext';
import { HamptonLogo } from './HamptonLogo';
import { useLiveCatalog } from '../utils/liveCatalog';
import { NAV_GROUPS } from '../utils/navGroups';
import { useSiteContent } from '../utils/siteContent';

const HeaderSearchForm = ({
  query,
  onQueryChange,
  onSubmit,
  className = '',
  inputClassName = '',
}) => (
  <form onSubmit={onSubmit} className={`flex items-center ${className}`}>
    <div className="relative flex-1">
      <input
        type="search"
        value={query}
        onChange={onQueryChange}
        placeholder="Search analysers, reagents, consumables…"
        className={`store-search w-full h-10 pl-4 pr-12 border border-ink/10 bg-cream-dark text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-copper/40 focus:bg-white ${inputClassName}`}
        aria-label="Search products"
      />
      <button
        type="submit"
        className="store-search-btn absolute right-1 top-1 h-8 w-8 flex items-center justify-center bg-copper text-white hover:bg-copper-dark"
        aria-label="Search"
      >
        <Search className="w-3.5 h-3.5" />
      </button>
    </div>
  </form>
);

export const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { getItemCount } = useQuote();
  const { isAuthenticated, isFacilityUser, user, hasPermission } = useAuth();
  const { categories, products } = useLiveCatalog();
  const { contact } = useSiteContent();
  const portalPath = user ? (hasPermission('dashboard') ? '/dashboard' : '/dashboard/products') : '/dashboard';
  const portalLabel = hasPermission('dashboard') ? 'Dashboard' : 'Portal';
  const quoteCount = getItemCount();
  const phoneHref = (contact.phone || '').replace(/\s/g, '');
  const menuGroups = useMemo(() => {
    const grouped = new Map();
    (products || []).forEach((product) => {
      const id = String(product.category_id || '');
      if (!id) return;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(product);
    });
    grouped.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    const withProducts = (categories || [])
      .map((category) => ({
        ...category,
        products: grouped.get(String(category.category_id)) || [],
      }))
      .filter((category) => category.products.length > 0);
    return NAV_GROUPS.map((group) => ({
      ...group,
      categories: withProducts.filter((category) => (category.nav_group || 'other') === group.id),
    })).filter((group) => group.categories.length > 0);
  }, [categories, products]);
  const openGroup = menuGroups.find((group) => group.id === openGroupId) || null;

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroupId(null);
    setExpandedGroupId(null);
  }, [location.pathname, location.search]);

  const submitSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setQuery('');
    setMobileOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-ink/10">
      <div className="bg-cream-dark border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-4 text-[11px] font-semibold tracking-wide uppercase text-ink overflow-hidden">
          <span className="hidden sm:inline text-ink-muted truncate">Connecting Africa with global healthcare innovation</span>
          <div className="flex items-center gap-5 ml-auto">
            {contact.phone && (
              <a href={`tel:${phoneHref}`} className="text-copper hover:text-copper-dark whitespace-nowrap">
                Call {contact.phone}
              </a>
            )}
            <Link to="/contact" className="hidden md:inline text-ink hover:text-copper whitespace-nowrap">
              Contact us
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 h-16">
          <Link to="/" className="flex-shrink-0">
            <HamptonLogo size="small" />
          </Link>

          <div className="hidden md:block flex-1 max-w-xl mx-auto">
            <HeaderSearchForm
              query={query}
              onQueryChange={(e) => setQuery(e.target.value)}
              onSubmit={submitSearch}
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            {isAuthenticated && isFacilityUser ? (
              <Link to={portalPath} className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-copper hover:underline">
                <User className="w-4 h-4" />
                {portalLabel}
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-ink hover:text-copper">
                <User className="w-4 h-4" />
                <span>
                  Sign in
                  <span className="hidden lg:inline text-ink-faint font-normal"> / Register</span>
                </span>
              </Link>
            )}
            <Link to="/quote-cart" className="relative text-ink hover:text-copper" aria-label="Quote cart">
              <ShoppingBag className="w-5 h-5" />
              {quoteCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-copper text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                  {quoteCount > 9 ? '9+' : quoteCount}
                </span>
              )}
            </Link>
            <button type="button" className="md:hidden p-1 text-ink" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="md:hidden pb-3">
          <HeaderSearchForm
            query={query}
            onQueryChange={(e) => setQuery(e.target.value)}
            onSubmit={submitSearch}
          />
        </div>
      </div>

      <div
        className="hidden md:block border-t border-ink/5 relative"
        onMouseLeave={() => setOpenGroupId(null)}
      >
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex items-center gap-5 h-11 text-[13px] font-medium">
            <Link
              to="/products"
              onMouseEnter={() => setOpenGroupId(null)}
              className={`hover:text-copper ${location.pathname === '/products' && !location.search ? 'text-copper' : 'text-ink'}`}
            >
              All products
            </Link>
            {menuGroups.map((group) => {
              const active = openGroupId === group.id || group.categories.some((category) => location.search === `?category=${category.slug}`);
              return (
                <button
                  key={group.id}
                  type="button"
                  onMouseEnter={() => setOpenGroupId(group.id)}
                  onFocus={() => setOpenGroupId(group.id)}
                  onClick={() => setOpenGroupId(group.id)}
                  aria-expanded={openGroupId === group.id}
                  className={`inline-flex items-center gap-1 hover:text-copper ${active ? 'text-copper' : 'text-ink-muted'}`}
                >
                  {group.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openGroupId === group.id ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
            <Link to="/order-management" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-copper ${location.pathname === '/order-management' ? 'text-copper' : 'text-ink-muted'}`}>
              Order management
            </Link>
            <Link to="/training" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-copper ${location.pathname === '/training' ? 'text-copper' : 'text-ink-muted'}`}>
              Training & Service
            </Link>
            <Link to="/about" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-copper ${location.pathname === '/about' ? 'text-copper' : 'text-ink-muted'}`}>
              About us
            </Link>
            <Link to="/careers" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-copper ${location.pathname.startsWith('/careers') ? 'text-copper' : 'text-ink-muted'}`}>
              Careers
            </Link>
            <Link to="/contact" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-copper ${location.pathname === '/contact' ? 'text-copper' : 'text-ink-muted'}`}>
              Contact us
            </Link>
          </nav>
        </div>
        {openGroup && (
          <div className="absolute left-0 right-0 top-full z-50 border-b border-ink/10 bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-6 py-5">
              <div className={`grid gap-6 ${openGroup.categories.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
                {openGroup.categories.map((category) => (
                  <div key={category.category_id} className="min-w-0">
                    <Link
                      to={`/products?category=${category.slug}`}
                      className="block text-sm font-semibold text-ink hover:text-copper"
                    >
                      {category.name}
                    </Link>
                    <ul className="mt-2 max-h-64 overflow-y-auto">
                      {category.products.map((product) => (
                        <li key={product.slug}>
                          <Link
                            to={`/products/${product.slug}`}
                            className="block py-1.5 text-sm text-ink-muted hover:text-copper leading-snug"
                          >
                            {product.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-ink/10 max-h-[70vh] overflow-y-auto">
          <nav className="px-4 py-4 space-y-1">
            <Link to="/products" className="block text-sm text-ink py-2">All products</Link>
            {menuGroups.map((group) => {
              const expanded = expandedGroupId === group.id;
              return (
                <div key={group.id} className="border-b border-ink/5">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                    className="w-full flex items-center text-sm text-ink py-2"
                  >
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="pl-3 pb-2 space-y-3">
                      {group.categories.map((category) => (
                        <div key={category.category_id}>
                          <Link to={`/products?category=${category.slug}`} className="block text-sm font-semibold text-ink py-1 hover:text-copper">
                            {category.name}
                          </Link>
                          <div className="max-h-40 overflow-y-auto">
                            {category.products.map((product) => (
                              <Link
                                key={product.slug}
                                to={`/products/${product.slug}`}
                                className="block text-sm text-ink-muted py-1.5 hover:text-copper"
                              >
                                {product.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <Link to="/order-management" className="block text-sm text-ink-muted py-1.5">Order management</Link>
            <Link to="/training" className="block text-sm text-ink-muted py-1.5">Training & Service</Link>
            <Link to="/about" className="block text-sm text-ink-muted py-1.5">About us</Link>
            <Link to="/careers" className="block text-sm text-ink-muted py-1.5">Careers</Link>
            <Link to="/contact" className="block text-sm text-ink-muted py-1.5">Contact us</Link>
            {isAuthenticated && isFacilityUser ? (
              <Link to={portalPath} className="block text-sm text-copper py-2">{portalLabel}</Link>
            ) : (
              <Link to="/login" className="block text-sm text-ink py-2">Sign in / Register</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, Search, ShoppingBag, User } from 'lucide-react';

import { useQuote } from '../context/QuoteContext';
import { useAuth } from '../context/AuthContext';
import { HamptonLogo } from './HamptonLogo';
import { useLiveCatalog } from '../utils/liveCatalog';
import { NAV_GROUPS } from '../utils/navGroups';
import { useSiteContent } from '../utils/siteContent';

const ABOUT_LINKS = [
  { to: '/about', label: 'Our company' },
  { to: '/contact', label: 'Contact us' },
  { to: '/partners', label: 'Our partners' },
  { to: '/careers', label: 'Careers' },
];

const isAboutPath = (pathname) => (
  pathname === '/about'
  || pathname === '/contact'
  || pathname === '/partners'
  || pathname.startsWith('/careers')
);

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
        className={`store-search w-full h-10 pl-4 pr-12 border border-brand bg-white text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 ${inputClassName}`}
        aria-label="Search products"
      />
      <button
        type="submit"
        className="store-search-btn absolute right-1 top-1 h-8 w-8 flex items-center justify-center bg-brand text-white hover:bg-brand-dark"
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
  const aboutOpen = openGroupId === 'about';
  const aboutActive = isAboutPath(location.pathname);

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
      <div className="bg-primary border-b border-primary/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-4 text-[11px] font-semibold tracking-wide uppercase text-primary-foreground overflow-hidden">
          <span className="hidden sm:inline text-white/80 truncate">Connecting Africa with global healthcare innovation</span>
          <div className="flex items-center gap-5 ml-auto">
            {contact.phone && (
              <a href={`tel:${phoneHref}`} className="text-white hover:text-white/90 whitespace-nowrap">
                Call {contact.phone}
              </a>
            )}
            <Link to="/contact" className="hidden md:inline text-white/85 hover:text-white whitespace-nowrap">
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
              <Link to={portalPath} className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                <User className="w-4 h-4" />
                {portalLabel}
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-ink hover:text-brand">
                <User className="w-4 h-4" />
                <span>
                  Sign in
                  <span className="hidden lg:inline text-ink-faint font-normal"> / Register</span>
                </span>
              </Link>
            )}
            <Link to="/quote-cart" className="relative text-ink hover:text-brand" aria-label="Quote cart">
              <ShoppingBag className="w-5 h-5" />
              {quoteCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[10px] font-semibold flex items-center justify-center leading-none">
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
          <nav className="flex items-center justify-center gap-5 h-11 text-[13px] font-medium">
            <Link
              to="/products"
              onMouseEnter={() => setOpenGroupId(null)}
              className={`hover:text-brand ${location.pathname === '/products' && !location.search ? 'text-brand' : 'text-ink'}`}
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
                  className={`inline-flex items-center gap-1 hover:text-brand ${active ? 'text-brand' : 'text-ink-muted'}`}
                >
                  {group.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openGroupId === group.id ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
            <Link to="/order-management" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-brand ${location.pathname === '/order-management' ? 'text-brand' : 'text-ink-muted'}`}>
              Order management
            </Link>
            <Link to="/training" onMouseEnter={() => setOpenGroupId(null)} className={`hover:text-brand ${location.pathname === '/training' ? 'text-brand' : 'text-ink-muted'}`}>
              Training & Service
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setOpenGroupId('about')}
            >
              <button
                type="button"
                onFocus={() => setOpenGroupId('about')}
                onClick={() => setOpenGroupId(aboutOpen ? null : 'about')}
                aria-expanded={aboutOpen}
                className={`inline-flex items-center gap-1 hover:text-brand ${aboutActive || aboutOpen ? 'text-brand' : 'text-ink-muted'}`}
              >
                About us
                <ChevronDown className={`w-3 h-3 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              {aboutOpen && (
                <div className="absolute left-1/2 top-full z-50 mt-0 -translate-x-1/2 pt-2">
                  <ul className="min-w-[11.5rem] rounded-xl border border-ink/10 bg-white py-1 shadow-lg divide-y divide-ink/10">
                    {ABOUT_LINKS.map(({ to, label }) => {
                      const active = to === '/careers'
                        ? location.pathname.startsWith('/careers')
                        : location.pathname === to;
                      return (
                        <li key={to}>
                          <Link
                            to={to}
                            className={`block px-4 py-2.5 text-sm font-medium hover:bg-brand/5 hover:text-brand ${active ? 'text-brand' : 'text-ink-muted'}`}
                          >
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </nav>
        </div>
        {openGroup && (() => {
          const catCount = openGroup.categories.length;
          const cols = Math.min(Math.max(catCount, 1), 4);
          const colClass =
            cols === 1 ? 'grid-cols-1' :
            cols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            cols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
          return (
          <div className="absolute left-0 right-0 top-full z-50 border-b border-ink/10 bg-white shadow-lg overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 py-5">
              <div
                className={`grid w-full gap-y-8 ${colClass} [&>*]:min-w-0 [&>*]:border-ink/[0.08] sm:[&>*:not(:last-child)]:border-r`}
              >
                {openGroup.categories.map((category) => {
                  const visibleProducts = category.products.slice(0, 10);
                  const hasMore = category.products.length > 10;
                  return (
                    <div key={category.category_id} className="text-left px-5 overflow-hidden">
                      <Link
                        to={`/products?category=${category.slug}`}
                        className="block text-sm font-semibold text-ink hover:text-brand truncate pb-2.5 mb-2 border-b border-ink/[0.08]"
                        title={category.name}
                      >
                        {category.name}
                      </Link>
                      <ul className="space-y-0.5">
                        {visibleProducts.map((product) => (
                          <li key={product.slug} className="min-w-0">
                            <Link
                              to={`/products/${product.slug}`}
                              title={product.name}
                              className="block py-1 text-sm text-ink-muted hover:text-brand truncate"
                            >
                              {product.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {hasMore && (
                        <Link
                          to={`/products?category=${category.slug}`}
                          className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
                        >
                          View all {category.products.length} →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          );
        })()}
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
                          <Link to={`/products?category=${category.slug}`} className="block text-sm font-semibold text-ink py-1 hover:text-brand">
                            {category.name}
                          </Link>
                          <div className="max-h-40 overflow-y-auto">
                            {category.products.map((product) => (
                              <Link
                                key={product.slug}
                                to={`/products/${product.slug}`}
                                className="block text-sm text-ink-muted py-1.5 hover:text-brand"
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
            <div className="border-b border-ink/5">
              <button
                type="button"
                aria-expanded={expandedGroupId === 'about'}
                onClick={() => setExpandedGroupId(expandedGroupId === 'about' ? null : 'about')}
                className="w-full flex items-center text-sm text-ink py-2"
              >
                <span className="flex-1 text-left">About us</span>
                <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${expandedGroupId === 'about' ? 'rotate-180' : ''}`} />
              </button>
              {expandedGroupId === 'about' && (
                <div className="pl-3 pb-2 space-y-1">
                  {ABOUT_LINKS.map(({ to, label }) => (
                    <Link key={to} to={to} className="block text-sm text-ink-muted py-1.5 hover:text-brand">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {isAuthenticated && isFacilityUser ? (
              <Link to={portalPath} className="block text-sm text-brand py-2">{portalLabel}</Link>
            ) : (
              <Link to="/login" className="block text-sm text-ink py-2">Sign in / Register</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

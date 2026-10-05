import { useEffect, useState } from 'react';

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import axios from 'axios';

import {

  LayoutDashboard, Package, FileText, ShoppingCart, Building2,

  Users, Receipt, BarChart3, Settings, LogOut, Menu, X, User,

} from 'lucide-react';



import { useAuth } from '../../context/AuthContext';

import { useQuote } from '../../context/QuoteContext';

import { HamptonLogo } from '../HamptonLogo';

import { API_URL } from '../../config/apiBaseUrl';

import { useLiveUpdates } from '../../hooks/useLiveUpdates';



// Day-to-day work first, then organisation administration below a separator.
const NAV_GROUPS = [
  [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
    { path: '/dashboard/products', label: 'Products', icon: Package, permission: 'products' },
    { path: '/dashboard/quotes', label: 'Quotes', icon: FileText, permission: 'quotes' },
    { path: '/dashboard/orders', label: 'Orders', icon: ShoppingCart, permission: 'orders' },
    { path: '/dashboard/invoices', label: 'Invoices', icon: Receipt, permission: 'invoices' },
  ],
  [
    { path: '/dashboard/branches', label: 'Branches', icon: Building2, permission: 'branches' },
    { path: '/dashboard/users', label: 'Users', icon: Users, permission: 'users' },
    { path: '/dashboard/reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
    { path: '/dashboard/profile', label: 'My Profile', icon: User, permission: 'profile' },
    { path: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'org_settings' },
  ],
];



const personName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();



export const FacilityLayout = () => {

  const { user, logout, hasPermission, branches, primaryBranchId, getAuthHeader, token } = useAuth();

  const { getTotalItems, hasItems } = useQuote();

  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [quoteUnread, setQuoteUnread] = useState(0);

  const quoteCount = getTotalItems();



  const loadUnread = () => axios

    .get(`${API_URL}/api/quotes/inbox/unread-count`, { headers: getAuthHeader() })

    .then((res) => setQuoteUnread(res.data?.count || 0))

    .catch(() => {});



  useEffect(() => { loadUnread(); }, [getAuthHeader]);

  useLiveUpdates({

    token,

    types: ['message.created', 'quote.priced'],

    onEvent: () => loadUnread(),

  });



  const branch = branches?.find((b) => b.id === primaryBranchId);

  const visibleNavGroups = NAV_GROUPS
    .map((group) => group.filter((item) => hasPermission(item.permission)))
    .filter((group) => group.length > 0);



  const handleLogout = () => {

    logout();

    navigate('/login');

  };



  const SidebarContent = () => (

    <>

      <div className="px-5 py-6 border-b border-ink/10">

        <Link to={hasPermission('dashboard') ? '/dashboard' : '/dashboard/products'} className="block mb-4">

          <HamptonLogo size="small" />

        </Link>

        <p className="text-xs font-semibold text-ink truncate">{user?.organization?.name || user?.facilityName}</p>
        {branch?.name && (
          <p className="text-[11px] text-copper font-medium truncate mt-0.5">{branch.name}</p>
        )}
        {personName(user) && (
          <p className="text-[11px] text-ink-muted truncate mt-0.5">{personName(user)}</p>
        )}

      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">

        {visibleNavGroups.map((group, groupIndex) => (

          <div key={groupIndex} className={groupIndex > 0 ? 'mt-3 pt-3 border-t border-ink/10 space-y-0.5' : 'space-y-0.5'}>

            {group.map(({ path, label, icon: Icon }) => (

              <NavLink

                key={path}

                to={path}

                end={path === '/dashboard'}

                onClick={() => setSidebarOpen(false)}

                className={({ isActive }) =>

                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${

                    isActive ? 'bg-copper/10 text-copper font-medium' : 'text-ink-muted hover:text-ink hover:bg-ink/5'

                  }`

                }

              >

                <Icon className="w-4 h-4" />

                <span className="flex-1">{label}</span>

                {path === '/dashboard/quotes' && quoteUnread > 0 && (

                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{quoteUnread}</span>

                )}

              </NavLink>

            ))}

          </div>

        ))}

      </nav>

      <div className="px-3 py-4 border-t border-ink/10">

        <button

          type="button"

          onClick={handleLogout}

          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-ink-muted hover:text-red-600 hover:bg-red-50"

        >

          <LogOut className="w-4 h-4" />

          Logout

        </button>

      </div>

    </>

  );



  return (

    <div className="dashboard-shell min-h-screen bg-cream flex">

      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white/80 border-r border-ink/10 fixed inset-y-0 left-0 z-40">

        <SidebarContent />

      </aside>



      {sidebarOpen && (

        <div className="lg:hidden fixed inset-0 z-50 flex">

          <div className="fixed inset-0 bg-ink/30" onClick={() => setSidebarOpen(false)} />

          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col shadow-xl">

            <button type="button" className="absolute top-3 right-3 inline-flex items-center justify-center h-11 w-11" onClick={() => setSidebarOpen(false)} aria-label="Close menu">

              <X className="w-5 h-5" />

            </button>

            <SidebarContent />

          </aside>

        </div>

      )}



      <div className="dashboard-frame flex-1 lg:ml-64 min-w-0 w-full max-w-full">

        <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-ink/10 px-4 lg:px-8 py-3 flex items-center gap-3 min-w-0">

          <button type="button" className="lg:hidden inline-flex items-center justify-center h-11 w-11 shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open menu">

            <Menu className="w-5 h-5" />

          </button>

          <div className="flex-1 min-w-0" />

          {hasPermission('products') && (
            hasItems ? (
              <Link
                to="/dashboard/quote"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-copper hover:underline shrink-0"
              >
                Quote
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-copper text-white text-xs font-semibold flex items-center justify-center">
                  {quoteCount > 99 ? '99+' : quoteCount}
                </span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint cursor-not-allowed select-none shrink-0"
                title="Add products to your quote basket first"
              >
                Quote
              </span>
            )
          )}

        </header>

        <main className="px-4 lg:px-8 py-8 min-w-0 max-w-full">

          <Outlet />

        </main>

      </div>

    </div>

  );

};



import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, FileText, ShoppingCart, Users, Package, FolderOpen,
  Receipt, BarChart3, MessageSquare, Building2, Settings, LogOut, Menu, X,
  Briefcase, ChevronDown, ChevronRight, MapPin, Target,
} from 'lucide-react';
import { toast } from 'sonner';

import { HamptonLogo } from '../HamptonLogo';
import { clearAdminSession, getAdminUser, getAdminHeader, getAdminToken, hasCompanyPermission, COMPANY_ROLE_LABELS } from '../../utils/adminAuth';
import { API_URL } from '../../config/apiBaseUrl';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';

const NAV_GROUPS = [
  {
    id: 'dashboard',
    items: [{ path: '/sysadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true, permission: 'dashboard' }],
  },
  {
    id: 'messages',
    items: [{ path: '/sysadmin/messages', label: 'Messages', icon: MessageSquare, permission: 'messages' }],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { path: '/sysadmin/quote-requests', label: 'Quote Requests', icon: FileText, permission: 'quotes' },
      { path: '/sysadmin/quotes', label: 'Quotes', icon: FileText, permission: 'quotes' },
      { path: '/sysadmin/orders', label: 'Orders', icon: ShoppingCart, permission: 'orders' },
      { path: '/sysadmin/invoices', label: 'Invoices', icon: Receipt, permission: 'invoices' },
      { path: '/sysadmin/sales-targets', label: 'Sales Targets', icon: Target, permission: 'field' },
      { path: '/sysadmin/field', label: 'Field Work', icon: MapPin, permission: 'field' },
    ],
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    items: [
      { path: '/sysadmin/categories', label: 'Categories', icon: FolderOpen, permission: 'catalogue' },
      { path: '/sysadmin/products', label: 'Products', icon: Package, permission: 'catalogue' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { path: '/sysadmin/facilities', label: 'Facilities', icon: Building2, permission: 'facilities' },
      { path: '/sysadmin/users', label: 'Users', icon: Users, permission: 'company_users' },
      { path: '/sysadmin/careers', label: 'Careers', icon: Briefcase, permission: 'careers' },
      { path: '/sysadmin/reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
      { path: '/sysadmin/settings', label: 'Settings', icon: Settings, permission: 'settings' },
    ],
  },
];

export const AdminLayout = () => {
  const navigate = useNavigate();
  const adminUser = getAdminUser();
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasCompanyPermission(adminUser, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openGroups, setOpenGroups] = useState({
    sales: true,
    catalogue: false,
    administration: false,
  });

  const loadUnread = () => axios
    .get(`${API_URL}/api/admin/ops-stats`, { headers: getAdminHeader() })
    .then((res) => setUnreadMessages(res.data?.unread_customer_messages || 0))
    .catch(() => {});

  useEffect(() => { loadUnread(); }, []);
  useLiveUpdates({
    token: getAdminToken(),
    types: ['message.created'],
    onEvent: (event) => {
      if (event?.type === 'poll') return;
      loadUnread();
    },
  });

  const logout = () => {
    clearAdminSession();
    toast.success('Logged out');
    navigate('/sysadmin');
  };

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const SidebarContent = () => (
    <>
      <div className="px-5 py-6 border-b border-ink/10">
        <Link to="/sysadmin/dashboard" className="block mb-4" onClick={() => setMobileOpen(false)}>
          <HamptonLogo size="small" />
        </Link>
        <p className="editorial-label">{COMPANY_ROLE_LABELS[adminUser?.role] || 'Company'}</p>
        {adminUser && (
          <p className="text-xs text-ink-muted mt-2 truncate">
            {adminUser.firstName} {adminUser.lastName}
          </p>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleGroups.map((group) => (
          <div key={group.id} className="mb-2">
            {group.label ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 editorial-label hover:text-ink transition-colors"
              >
                {group.label}
                {openGroups[group.id]
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : null}
            {(group.label ? openGroups[group.id] : true) && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                        isActive
                          ? 'bg-copper/10 text-copper font-medium'
                          : 'text-ink-muted hover:text-ink hover:bg-ink/5'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.path === '/sysadmin/messages' && unreadMessages > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{unreadMessages}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-ink/10">
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="dashboard-shell min-h-screen bg-cream">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white/80 border-r border-ink/10 fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col shadow-xl">
            <button
              type="button"
              className="absolute top-3 right-3 inline-flex items-center justify-center h-11 w-11"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="dashboard-frame lg:pl-64 min-h-screen w-full min-w-0 max-w-full">
        <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-ink/10 px-4 lg:px-6 xl:px-8 py-3 flex items-center gap-3 min-w-0">
          <button type="button" className="lg:hidden inline-flex items-center justify-center h-11 w-11 shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm text-ink-muted lg:hidden truncate min-w-0">Operations</p>
          <div className="flex-1 min-w-0" />
          <Link to="/" className="text-xs text-copper hover:underline hidden sm:inline">
            View site
          </Link>
        </header>
        <main className="px-4 lg:px-6 xl:px-8 py-6 lg:py-8 w-full min-w-0 max-w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

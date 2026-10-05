import { isJwtExpired } from './jwt';

export const COMPANY_ROLES = ['admin', 'operations', 'sales'];

export const COMPANY_PERMISSIONS = {
  admin: [
    'dashboard', 'quotes', 'orders', 'invoices', 'messages',
    'catalogue', 'facilities', 'reports', 'deliveries',
    'company_users', 'settings', 'training', 'contact', 'field', 'careers',
  ],
  operations: [
    'dashboard', 'quotes', 'orders', 'invoices', 'messages',
    'catalogue', 'facilities', 'reports', 'deliveries',
    'training', 'contact', 'field', 'careers',
  ],
  sales: ['dashboard', 'quotes', 'orders', 'messages', 'field'],
};

export const COMPANY_ROLE_LABELS = {
  admin: 'Global Admin',
  operations: 'Operations',
  sales: 'Sales',
};

export const isCompanyStaff = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return COMPANY_ROLES.includes(role);
};

export const hasCompanyPermission = (userOrRole, permission) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return (COMPANY_PERMISSIONS[role] || []).includes(permission);
};

export const canSeeBuyingPrice = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'admin' || role === 'operations';
};

export const canAssignSales = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'admin' || role === 'operations';
};

export const getAdminToken = () => localStorage.getItem('admin_token');

export const getAdminUser = () => {
  try {
    const raw = localStorage.getItem('admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getAdminHeader = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const clearAdminSession = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
};

export const isAdminSession = () => {
  const token = getAdminToken();
  const user = getAdminUser();
  return Boolean(token && isCompanyStaff(user) && !isJwtExpired(token));
};

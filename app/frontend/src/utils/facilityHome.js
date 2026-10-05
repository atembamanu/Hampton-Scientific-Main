export function facilityHomePath(user) {
  const perms = user?.permissions || [];
  if (perms.includes('dashboard')) return '/dashboard';
  if (perms.includes('products')) return '/dashboard/products';
  if (perms.includes('quotes')) return '/dashboard/quotes';
  if (perms.includes('orders')) return '/dashboard/orders';
  if (perms.includes('profile')) return '/dashboard/profile';
  return '/dashboard/products';
}

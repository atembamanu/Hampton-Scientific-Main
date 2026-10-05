import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { facilityHomePath } from '../../utils/facilityHome';

export const Forbidden = () => {
  const { user, hasPermission } = useAuth();
  const home = facilityHomePath(user);
  return (
    <div className="editorial-panel p-10 text-center max-w-md mx-auto mt-12">
      <ShieldX className="w-12 h-12 text-copper mx-auto mb-4" />
      <h1 className="text-xl font-bold text-ink mb-2">Access denied</h1>
      <p className="text-sm text-ink-muted mb-6">
        You don&apos;t have permission to view this page.
      </p>
      <Link to={home} className="btn-primary inline-block">
        {hasPermission('dashboard') ? 'Back to dashboard' : 'Back'}
      </Link>
    </div>
  );
};

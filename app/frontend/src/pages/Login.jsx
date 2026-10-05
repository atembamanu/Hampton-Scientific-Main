import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { isCompanyStaff } from '../utils/adminAuth';
import { facilityHomePath } from '../utils/facilityHome';
import { emailError, liveEmailError, invalidFieldClass } from '../utils/validation';
import { EditorialField } from '../components/template/EditorialSection';
import { Input } from '../components/ui/input';
import { HamptonLogo } from '../components/HamptonLogo';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isCompanyStaff(user)) {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  if (isAuthenticated && !isCompanyStaff(user)) {
    navigate(facilityHomePath(user), { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(email);
    if (invalidEmail) {
      toast.error(invalidEmail);
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      if (isCompanyStaff(result.user)) {
        logout();
        toast.error('This sign-in is for facility users. Company staff should use the operations portal.');
        return;
      }
      toast.success('Welcome back!');
      const requested = location.state?.from;
      const dest = requested && requested !== '/dashboard' ? requested : facilityHomePath(result.user);
      navigate(dest);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-8"><HamptonLogo size="small" /></Link>
        <p className="editorial-label mb-2">Facility portal</p>
        <h1 className="editorial-headline mb-8">Sign <span className="text-copper">in</span></h1>

        <form onSubmit={handleSubmit} className="editorial-panel p-6 sm:p-8 space-y-5">
          <EditorialField label="Email" required error={liveEmailError(email)}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={invalidFieldClass(liveEmailError(email), 'bg-white/80')} required />
          </EditorialField>
          <EditorialField label="Password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/80" required />
          </EditorialField>
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
          <p className="text-center text-sm text-ink-muted">
            <Link to="/forgot-password" className="text-copper hover:underline">Forgot password?</Link>
          </p>
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          New facility? <Link to="/register" className="text-copper hover:underline">Register your facility</Link>
        </p>
        <p className="text-center text-sm text-ink-muted mt-3">
          Company staff? <Link to="/sysadmin" className="text-copper hover:underline">Operations portal</Link>
        </p>
      </div>
    </div>
  );
};

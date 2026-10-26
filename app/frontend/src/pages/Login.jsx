import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { isCompanyStaff } from '../utils/adminAuth';
import { facilityHomePath } from '../utils/facilityHome';
import { emailError, liveEmailError, invalidFieldClass } from '../utils/validation';
import { EditorialField } from '../components/template/EditorialSection';
import { Input } from '../components/ui/input';
import { HamptonLogo } from '../components/HamptonLogo';
import { API_URL } from '../config/apiBaseUrl';

const PORTALS = [
  { id: 'facility', label: 'Facility' },
  { id: 'operations', label: 'Operations' },
];

const PREVIEW = {
  facility: {
    src: '/marketing/Facility%20Quotes.png',
    alt: 'Facility quotes dashboard preview',
    title: 'Quotes, orders, and invoices in one place',
    body: 'Track procurement across your facility — from draft requests to accepted quotes.',
  },
  operations: {
    src: '/marketing/Operations%20Dashboard.png',
    alt: 'Operations dashboard preview',
    title: 'Run quotes, fulfilment, and collections',
    body: 'See what needs action now — quote requests, orders, deliveries, and outstanding invoices.',
  },
};

const portalFromSearch = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'operations' || v === 'company' || v === 'ops' || v === 'admin') return 'operations';
  return 'facility';
};

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, logout, isAuthenticated, user } = useAuth();
  const [portal, setPortal] = useState(() => portalFromSearch(searchParams.get('portal')));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const isFacility = portal === 'facility';
  const preview = PREVIEW[portal] || PREVIEW.facility;

  useEffect(() => {
    setPortal(portalFromSearch(searchParams.get('portal')));
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated && isCompanyStaff(user) && isFacility) {
      logout();
    }
  }, [isAuthenticated, user, logout, isFacility]);

  useEffect(() => {
    if (!isFacility) {
      const token = localStorage.getItem('admin_token');
      const adminUser = localStorage.getItem('admin_user');
      if (token && adminUser) {
        try {
          const parsed = JSON.parse(adminUser);
          if (isCompanyStaff(parsed)) {
            navigate('/sysadmin/dashboard', { replace: true });
          }
        } catch {
          /* ignore */
        }
      }
    }
  }, [isFacility, navigate]);

  if (isFacility && isAuthenticated && !isCompanyStaff(user)) {
    navigate(facilityHomePath(user), { replace: true });
    return null;
  }

  const selectPortal = (next) => {
    setPortal(next);
    setPassword('');
    setSearchParams(next === 'operations' ? { portal: 'operations' } : {}, { replace: true });
  };

  const handleFacilitySubmit = async () => {
    const result = await login(email, password);
    if (result.success) {
      if (isCompanyStaff(result.user)) {
        logout();
        toast.error('This sign-in is for facility users. Switch to the Operations tab.');
        return;
      }
      toast.success('Welcome back!');
      const requested = location.state?.from;
      const dest = requested && requested !== '/dashboard' ? requested : facilityHomePath(result.user);
      navigate(dest);
      return;
    }
    toast.error(result.error);
  };

  const handleOperationsSubmit = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
        portal: 'company',
      });
      const { access_token, user: staffUser } = response.data;
      if (!isCompanyStaff(staffUser)) {
        toast.error('Access denied. Company staff credentials required.');
        return;
      }
      localStorage.setItem('admin_token', access_token);
      localStorage.setItem('admin_user', JSON.stringify(staffUser));
      toast.success('Welcome back');
      navigate('/sysadmin/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(typeof message === 'string' ? message : 'Login failed. Please check your credentials.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(email);
    if (invalidEmail) {
      toast.error(invalidEmail);
      return;
    }
    setLoading(true);
    if (isFacility) {
      await handleFacilitySubmit();
    } else {
      await handleOperationsSubmit();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-2">
      <div className="relative flex items-center justify-center px-6 py-16 lg:py-20 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(26,26,26,0.05) 0.5px, transparent 0.5px), linear-gradient(to bottom, rgba(26,26,26,0.05) 0.5px, transparent 0.5px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="relative w-full max-w-md">
          <Link to="/" className="inline-block mb-8"><HamptonLogo size="small" /></Link>
          <p className="editorial-label mb-2">
            {isFacility ? 'Facility portal' : 'Operations portal'}
          </p>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold leading-tight tracking-tight text-ink uppercase mb-2">
            Sign <span className="text-brand">in</span>
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            {isFacility
              ? 'Access quotes, orders, and invoices for your facility.'
              : 'Manage quotes, orders, and customer operations.'}
          </p>

          <form
            onSubmit={handleSubmit}
            className="editorial-panel p-6 sm:p-8 space-y-5"
            data-testid={isFacility ? 'facility-login-form' : 'admin-login-form'}
          >
            <div
              className="grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1"
              role="tablist"
              aria-label="Sign-in portal"
            >
              {PORTALS.map(({ id, label }) => {
                const active = portal === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectPortal(id)}
                    className={`h-10 rounded-full text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <EditorialField label="Email" required error={liveEmailError(email)}>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isFacility ? undefined : 'admin@hamptonscientific.com'}
                className={invalidFieldClass(liveEmailError(email), 'bg-white/80')}
                required
                disabled={loading}
                data-testid={isFacility ? undefined : 'admin-email-input'}
              />
            </EditorialField>
            <EditorialField label="Password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/80"
                required
                disabled={loading}
                data-testid={isFacility ? undefined : 'admin-password-input'}
              />
            </EditorialField>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
              data-testid={isFacility ? undefined : 'admin-login-btn'}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFacility ? 'Sign in' : 'Access dashboard'}
            </button>
            <p
              className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-muted min-h-5 ${
                isFacility ? '' : 'invisible pointer-events-none'
              }`}
              aria-hidden={!isFacility}
            >
              <Link to="/forgot-password" tabIndex={isFacility ? undefined : -1} className="text-brand hover:underline">Forgot password?</Link>
              <span className="text-ink/20" aria-hidden>|</span>
              <Link to="/register" tabIndex={isFacility ? undefined : -1} className="text-brand hover:underline">Register your facility</Link>
            </p>
          </form>
        </div>
      </div>

      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand text-white px-10 xl:px-14 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/70 mb-3">
            {isFacility ? 'Facility preview' : 'Operations preview'}
          </p>
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight max-w-md">
            {preview.title}
          </h2>
          <p className="mt-3 text-sm text-white/75 max-w-sm leading-relaxed">
            {preview.body}
          </p>
        </div>

        <div className="relative mt-10 flex-1 flex items-center">
          <div className="w-full rounded-2xl bg-white/10 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-white/20">
            <img
              key={preview.src}
              src={preview.src}
              alt={preview.alt}
              className="w-full rounded-xl bg-white object-cover object-top max-h-[min(58vh,520px)]"
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

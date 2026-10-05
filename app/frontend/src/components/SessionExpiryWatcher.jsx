import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/apiBaseUrl';
import { clearAdminSession, getAdminHeader, getAdminToken } from '../utils/adminAuth';
import { isJwtExpired, jwtExpiresAt } from '../utils/jwt';

const AUTH_FREE_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/facilities/register',
];

const WARN_BEFORE_MS = 2 * 60 * 1000;

const requestPath = (config) => {
  const url = config?.url || '';
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split('?')[0];
  }
};

const authHeaderValue = (config) => {
  const headers = config?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get('Authorization') || headers.get('authorization') || '';
  return headers.Authorization || headers.authorization || '';
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const SessionExpiryWatcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, token, refreshSession } = useAuth();
  const busyRef = useRef(false);
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const [warningKind, setWarningKind] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [extending, setExtending] = useState(false);
  const [sessionNonce, setSessionNonce] = useState(0);

  const expireAdmin = useCallback(() => {
    if (!getAdminToken() && !localStorage.getItem('admin_user')) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setWarningKind(null);
    clearAdminSession();
    toast.error('Your session has expired. Please sign in again.');
    if (locationRef.current.startsWith('/sysadmin') && locationRef.current !== '/sysadmin') {
      navigate('/sysadmin', { replace: true });
    }
    window.setTimeout(() => { busyRef.current = false; }, 2000);
  }, [navigate]);

  const expireFacility = useCallback(() => {
    const hasSession = Boolean(localStorage.getItem('auth_token') || localStorage.getItem('auth_user'));
    if (!hasSession) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setWarningKind(null);
    logout();
    toast.error('Your session has expired. Please sign in again.');
    if (locationRef.current.startsWith('/dashboard')) {
      navigate('/login', { replace: true, state: { from: locationRef.current } });
    }
    window.setTimeout(() => { busyRef.current = false; }, 2000);
  }, [logout, navigate]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const path = requestPath(error.config);
        if (status === 401 && !AUTH_FREE_PATHS.some((free) => path.startsWith(free))) {
          const header = authHeaderValue(error.config);
          const adminTok = getAdminToken();
          const facilityTok = localStorage.getItem('auth_token');
          if (adminTok && header === `Bearer ${adminTok}`) {
            expireAdmin();
          } else if (facilityTok && header === `Bearer ${facilityTok}`) {
            expireFacility();
          } else if (locationRef.current.startsWith('/sysadmin')) {
            expireAdmin();
          } else if (locationRef.current.startsWith('/dashboard')) {
            expireFacility();
          }
        }
        return Promise.reject(error);
      },
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [expireAdmin, expireFacility]);

  useEffect(() => {
    const timers = [];
    const arm = (value, kind, onExpire) => {
      if (!value) return;
      if (isJwtExpired(value)) {
        onExpire();
        return;
      }
      const at = jwtExpiresAt(value);
      if (!at) return;
      const remaining = at - Date.now();
      const warnDelay = remaining - WARN_BEFORE_MS;
      if (warnDelay <= 0) {
        setWarningKind(kind);
        setRemainingMs(remaining);
      } else {
        timers.push(window.setTimeout(() => {
          setWarningKind(kind);
          setRemainingMs(Math.max(0, at - Date.now()));
        }, warnDelay));
      }
      timers.push(window.setTimeout(onExpire, Math.max(0, remaining)));
    };

    const path = location.pathname;
    if (path.startsWith('/sysadmin') && path !== '/sysadmin') {
      arm(getAdminToken(), 'admin', expireAdmin);
    } else if (path.startsWith('/dashboard')) {
      arm(token || localStorage.getItem('auth_token'), 'facility', expireFacility);
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [token, expireAdmin, expireFacility, location.pathname, sessionNonce]);

  useEffect(() => {
    if (!warningKind) return undefined;
    const tick = window.setInterval(() => {
      const value = warningKind === 'admin'
        ? getAdminToken()
        : (token || localStorage.getItem('auth_token'));
      const at = jwtExpiresAt(value);
      setRemainingMs(at ? Math.max(0, at - Date.now()) : 0);
    }, 250);
    return () => window.clearInterval(tick);
  }, [warningKind, token]);

  const handleSignOut = () => {
    if (warningKind === 'admin') {
      setWarningKind(null);
      clearAdminSession();
      toast.success('Signed out');
      navigate('/sysadmin', { replace: true });
      return;
    }
    setWarningKind(null);
    logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const handleExtend = async () => {
    const kind = warningKind;
    const headers = kind === 'admin'
      ? getAdminHeader()
      : (token ? { Authorization: `Bearer ${token}` } : {});
    if (!headers.Authorization) {
      if (kind === 'admin') expireAdmin();
      else expireFacility();
      return;
    }
    setExtending(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { headers });
      const accessToken = res.data.access_token;
      const userData = res.data.user;
      if (kind === 'admin') {
        localStorage.setItem('admin_token', accessToken);
        if (userData) localStorage.setItem('admin_user', JSON.stringify(userData));
      } else {
        refreshSession(accessToken, userData);
      }
      setWarningKind(null);
      setSessionNonce((n) => n + 1);
      toast.success('Session extended for 30 minutes');
    } catch {
      if (kind === 'admin') expireAdmin();
      else expireFacility();
    } finally {
      setExtending(false);
    }
  };

  if (!warningKind) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/50" />
      <div
        role="alertdialog"
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-desc"
        className="relative w-full max-w-md bg-white border border-ink/10 shadow-xl p-6 sm:p-7"
        style={{ borderRadius: 4 }}
      >
        <p className="editorial-label mb-2">Session</p>
        <h2 id="session-expiry-title" className="text-xl font-semibold text-ink mb-2">
          This session is about to expire
        </h2>
        <p id="session-expiry-desc" className="text-sm text-ink-muted mb-5">
          You will be signed out in <span className="font-semibold text-ink tabular-nums">{formatCountdown(remainingMs)}</span>.
          Extend now to stay signed in for another 30 minutes.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={extending}
            className="h-10 px-4 text-sm border border-ink/15 rounded bg-white hover:bg-ink/5"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={handleExtend}
            disabled={extending}
            className="btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {extending && <Loader2 className="w-4 h-4 animate-spin" />}
            Extend session
          </button>
        </div>
      </div>
    </div>
  );
};

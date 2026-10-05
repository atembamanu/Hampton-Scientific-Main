import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/apiBaseUrl';
import { isJwtExpired } from '@/utils/jwt';
import { fieldErrorsFromDetail, formatApiError } from '@/utils/apiError';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const FACILITY_ROLES = ['org_admin', 'branch_admin', 'branch_user'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistAuth = useCallback((accessToken, userData) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        if (isJwtExpired(storedToken)) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          try {
            const me = await axios.get(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            setUser(me.data);
            localStorage.setItem('auth_user', JSON.stringify(me.data));
          } catch {
            setToken(null);
            setUser(null);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
        portal: 'facility',
      });

      const { access_token, user: userData } = response.data;
      persistAuth(access_token, userData);
      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: formatApiError(error, 'Login failed. Please check your credentials.'),
      };
    }
  }, [persistAuth]);

  const registerFacility = useCallback(async (payload) => {
    try {
      const response = await axios.post(`${API_URL}/api/facilities/register`, payload);
      const { access_token, user: userData } = response.data;
      persistAuth(access_token, userData);
      return { success: true, user: userData };
    } catch (error) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: formatApiError(error, 'Registration failed. Please try again.'),
        fieldErrors: fieldErrorsFromDetail(detail),
        status: error.response?.status || null,
      };
    }
  }, [persistAuth]);

  const register = useCallback(async (userData) => {
    try {
      await axios.post(`${API_URL}/api/auth/register`, userData);
      return login(userData.email, userData.password);
    } catch (error) {
      return {
        success: false,
        error: formatApiError(error, 'Registration failed.'),
      };
    }
  }, [login]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user');
  }, []);

  const updateProfile = useCallback(async (updateData) => {
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const response = await axios.put(`${API_URL}/api/auth/me`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser((prev) => ({ ...prev, ...response.data }));
      localStorage.setItem('auth_user', JSON.stringify({ ...user, ...response.data }));
      return { success: true, user: response.data };
    } catch (error) {
      return { success: false, error: formatApiError(error, 'Update failed.') };
    }
  }, [token, user]);

  const refreshSession = useCallback(async (accessToken, userData) => {
    persistAuth(accessToken, userData);
  }, [persistAuth]);

  const getAuthHeader = useCallback(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions || []).includes(perm);
  }, [user]);

  const isFacilityUser = FACILITY_ROLES.includes(user?.role);

  const isBranchManager = user?.role === 'branch_admin';

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isFacilityUser,
    isBranchManager,
    login,
    register,
    registerFacility,
    logout,
    updateProfile,
    refreshSession,
    getAuthHeader,
    hasPermission,
    organization: user?.organization || null,
    branches: user?.branches || [],
    primaryBranchId: user?.primaryBranchId || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

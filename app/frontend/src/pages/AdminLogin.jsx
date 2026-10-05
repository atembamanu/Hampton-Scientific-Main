import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { Input } from '../components/ui/input';
import { HamptonLogo } from '../components/HamptonLogo';
import { EditorialField } from '../components/template/EditorialSection';
import { API_URL } from '../config/apiBaseUrl';
import { isCompanyStaff } from '../utils/adminAuth';
import { emailError, liveEmailError, invalidFieldClass } from '../utils/validation';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user');
    if (token && adminUser) {
      try {
        const user = JSON.parse(adminUser);
        if (isCompanyStaff(user)) {
          navigate('/sysadmin/dashboard');
        }
      } catch {
        /* ignore */
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(formData.email);
    if (invalidEmail) {
      toast.error(invalidEmail);
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password,
        portal: 'company',
      });
      const { access_token, user } = response.data;
      if (!isCompanyStaff(user)) {
        toast.error('Access denied. Company staff credentials required.');
        return;
      }
      localStorage.setItem('admin_token', access_token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      toast.success('Welcome back');
      navigate('/sysadmin/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-8">
          <HamptonLogo size="small" />
        </Link>
        <p className="editorial-label mb-2">Operations portal</p>
        <h1 className="editorial-headline mb-2">
          Admin <span className="text-copper">sign in</span>
        </h1>
        <p className="text-sm text-ink-muted mb-8">
          Authorized personnel only. Manage quotes, orders, and customer operations.
        </p>

        <form onSubmit={handleSubmit} className="editorial-panel p-6 sm:p-8 space-y-5" data-testid="admin-login-form">
          <EditorialField label="Email" required error={liveEmailError(formData.email)}>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              placeholder="admin@hamptonscientific.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={invalidFieldClass(liveEmailError(formData.email), 'bg-white/80')}
              required
              disabled={isLoading}
              data-testid="admin-email-input"
            />
          </EditorialField>
          <EditorialField label="Password" required>
            <Input
              id="admin-password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-white/80"
              required
              disabled={isLoading}
              data-testid="admin-password-input"
            />
          </EditorialField>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2"
            data-testid="admin-login-btn"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Access dashboard
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          Facility user?{' '}
          <Link to="/login" className="text-copper hover:underline">
            Sign in to your portal
          </Link>
        </p>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { CheckCircle, Loader2, Lock, XCircle } from 'lucide-react';

import { Input } from '../components/ui/input';
import { EditorialField } from '../components/template/EditorialSection';
import { PasswordStrength, isPasswordValid } from '../components/facility/PasswordStrength';
import { HamptonLogo } from '../components/HamptonLogo';
import { API_URL } from '@/config/apiBaseUrl';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!isPasswordValid(password)) {
      toast.error('Please meet all password requirements');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, { token, password });
      setIsSuccess(true);
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed');
      toast.error('Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !token) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="editorial-panel p-8 text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-ink-muted mb-4">{error}</p>
          <Link to="/forgot-password" className="btn-primary inline-block">Request new link</Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="editorial-panel p-8 text-center max-w-md">
          <CheckCircle className="w-12 h-12 text-copper mx-auto mb-4" />
          <h1 className="editorial-headline mb-2">Password updated</h1>
          <p className="text-sm text-ink-muted">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-6"><HamptonLogo size="small" /></Link>
        <p className="editorial-label mb-2">Account</p>
        <h1 className="editorial-headline mb-8">New <span className="text-copper">password</span></h1>

        <form onSubmit={handleSubmit} className="editorial-panel p-6 space-y-5">
          <div className="flex items-center gap-3 text-ink-muted text-sm">
            <Lock className="w-4 h-4 text-copper" />
            Choose a strong password for your account.
          </div>
          <EditorialField label="New password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/80" />
            <PasswordStrength password={password} />
          </EditorialField>
          <EditorialField label="Confirm password" required>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-white/80" />
          </EditorialField>
          <button type="submit" disabled={isLoading || !token} className="btn-primary w-full flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reset password
          </button>
        </form>
      </div>
    </div>
  );
};

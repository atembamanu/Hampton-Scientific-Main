import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';

import { Input } from '../components/ui/input';
import { EditorialField } from '../components/template/EditorialSection';
import { HamptonLogo } from '../components/HamptonLogo';
import { API_URL } from '@/config/apiBaseUrl';
import { emailError, liveEmailError, invalidFieldClass } from '../utils/validation';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(email);
    if (invalidEmail) {
      toast.error(invalidEmail);
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setIsSubmitted(true);
      toast.success('Check your email for a password reset link');
    } catch (error) {
      const message = error.response?.data?.detail;
      if (error.response?.status === 403 && message) {
        toast.error(typeof message === 'string' ? message : 'Password reset is not available for this account');
        return;
      }
      setIsSubmitted(true);
      toast.success('If an account exists, a reset link has been sent');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md text-center editorial-panel p-8">
          <CheckCircle className="w-12 h-12 text-copper mx-auto mb-4" />
          <h1 className="editorial-headline mb-2">Check your email</h1>
          <p className="text-sm text-ink-muted mb-6">If an account exists for {email}, we sent a reset link.</p>
          <Link to="/login" className="btn-primary inline-block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <Link to="/" className="inline-block mb-6"><HamptonLogo size="small" /></Link>
        <p className="editorial-label mb-2">Account</p>
        <h1 className="editorial-headline mb-8">Reset <span className="text-copper">password</span></h1>

        <form onSubmit={handleSubmit} className="editorial-panel p-6 space-y-5">
          <div className="flex items-center gap-3 text-ink-muted text-sm mb-2">
            <Mail className="w-4 h-4 text-copper" />
            Enter your email and we&apos;ll send a reset link.
          </div>
          <EditorialField label="Email" required error={liveEmailError(email)}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={invalidFieldClass(liveEmailError(email), 'bg-white/80')} />
          </EditorialField>
          <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send reset link
          </button>
        </form>
      </div>
    </div>
  );
};

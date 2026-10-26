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

const PREVIEW = {
  src: '/marketing/Facility%20Quotes.png',
  alt: 'Facility quotes dashboard preview',
  title: 'Quotes, orders, and invoices in one place',
  body: 'Track procurement across your facility — from draft requests to accepted quotes.',
};

const FormGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.35]"
    style={{
      backgroundImage:
        'linear-gradient(to right, rgba(26,26,26,0.05) 0.5px, transparent 0.5px), linear-gradient(to bottom, rgba(26,26,26,0.05) 0.5px, transparent 0.5px)',
      backgroundSize: '28px 28px',
    }}
    aria-hidden
  />
);

const PreviewAside = () => (
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
        Facility preview
      </p>
      <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight max-w-md">
        {PREVIEW.title}
      </h2>
      <p className="mt-3 text-sm text-white/75 max-w-sm leading-relaxed">
        {PREVIEW.body}
      </p>
    </div>
    <div className="relative mt-10 flex-1 flex items-center">
      <div className="w-full rounded-2xl bg-white/10 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-white/20">
        <img
          src={PREVIEW.src}
          alt={PREVIEW.alt}
          className="w-full rounded-xl bg-white object-cover object-top max-h-[min(58vh,520px)]"
        />
      </div>
    </div>
  </aside>
);

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

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-2">
      <div className="relative flex items-center justify-center px-6 py-16 lg:py-20 overflow-hidden">
        <FormGrid />
        <div className="relative w-full max-w-md">
          <Link to="/" className="inline-block mb-8"><HamptonLogo size="small" /></Link>
          <p className="editorial-label mb-2">Facility portal</p>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold leading-tight tracking-tight text-ink uppercase mb-2">
            Reset <span className="text-brand">password</span>
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            Enter your email and we&apos;ll send a reset link.
          </p>

          {isSubmitted ? (
            <div className="editorial-panel p-6 sm:p-8 text-center space-y-5">
              <CheckCircle className="w-12 h-12 text-brand mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
                <p className="text-sm text-ink-muted">
                  If an account exists for {email}, we sent a reset link.
                </p>
              </div>
              <Link to="/login" className="btn-primary inline-flex w-full items-center justify-center">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="editorial-panel p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 text-ink-muted text-sm">
                <Mail className="w-4 h-4 text-brand shrink-0" />
                We&apos;ll email you a secure link to choose a new password.
              </div>
              <EditorialField label="Email" required error={liveEmailError(email)}>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className={invalidFieldClass(liveEmailError(email), 'bg-white/80')}
                />
              </EditorialField>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send reset link
              </button>
              <p className="text-center text-sm text-ink-muted">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-brand hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      <PreviewAside />
    </div>
  );
};

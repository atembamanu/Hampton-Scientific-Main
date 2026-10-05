import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../config/apiBaseUrl';
import { formatApiError } from '../utils/apiError';
import { HamptonLogo } from '../components/HamptonLogo';

export const NewsletterUnsubscribe = () => {
  const [params] = useSearchParams();
  const email = useMemo(() => (params.get('email') || '').trim().toLowerCase(), [params]);
  const token = useMemo(() => (params.get('token') || '').trim(), [params]);
  const linkValid = Boolean(email && token);

  const [status, setStatus] = useState(linkValid ? 'confirm' : 'invalid');
  const [message, setMessage] = useState(
    linkValid ? '' : 'This unsubscribe link is incomplete. Please use the link from your email.',
  );
  const [submitting, setSubmitting] = useState(false);

  const handleUnsubscribe = async () => {
    if (!linkValid || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/newsletter/unsubscribe`, { email, token });
      setStatus('success');
      setMessage(data?.message || "You've been unsubscribed.");
    } catch (err) {
      setStatus('error');
      setMessage(formatApiError(err, 'Could not unsubscribe. The link may be invalid.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link to="/" className="flex justify-center mb-10">
            <HamptonLogo size="small" />
          </Link>

          <div className="rounded-[4px] border border-ink/10 bg-white px-8 py-10 sm:px-10 sm:py-12 shadow-[0_1px_0_rgba(26,26,26,0.04)]">
            {status === 'confirm' && (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-6">
                  Unsubscribe
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed mb-2">
                  Your email address{' '}
                  <span className="font-semibold text-ink break-all">{email}</span>
                </p>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">
                  You will no longer receive Hampton Scientific newsletter updates about equipment,
                  training, and healthcare innovation.
                </p>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={submitting}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Unsubscribing…
                    </span>
                  ) : (
                    'Unsubscribe'
                  )}
                </button>
                <p className="mt-6 text-center text-sm">
                  <Link to="/contact" className="text-ink-muted hover:text-copper transition-colors">
                    Keep my subscription
                  </Link>
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <p className="editorial-label text-brand mb-3">Unsubscribed</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-4">
                  You&apos;re off the list
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed mb-2">
                  <span className="font-semibold text-ink break-all">{email}</span>
                </p>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">{message}</p>
                <Link to="/contact" className="btn-primary w-full inline-flex justify-center">
                  Back to contact
                </Link>
                <p className="mt-6 text-center text-sm text-ink-muted">
                  Changed your mind?{' '}
                  <Link to="/contact" className="text-copper hover:underline">
                    Subscribe again
                  </Link>
                </p>
              </>
            )}

            {(status === 'error' || status === 'invalid') && (
              <>
                <p className="editorial-label text-copper mb-3">Unable to continue</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-4">
                  Link not valid
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">{message}</p>
                <Link to="/contact" className="btn-secondary w-full inline-flex justify-center">
                  Contact us
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

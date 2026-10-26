import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  COOKIE_CONSENT_EVENT,
  hasCookieConsent,
  setCookieConsent,
} from '../utils/cookieConsent';

export const CookieConsent = () => {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  const isAdmin = pathname.startsWith('/sysadmin');

  useEffect(() => {
    if (isAdmin) {
      setVisible(false);
      return undefined;
    }

    const sync = () => {
      const show = !hasCookieConsent();
      setVisible(show);
      if (show) {
        // Allow one frame so the slide-down transition runs
        requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
      }
    };

    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, [isAdmin]);

  if (!visible || isAdmin) return null;

  const dismiss = (choice) => {
    setEntered(false);
    window.setTimeout(() => {
      setCookieConsent(choice);
      setVisible(false);
    }, 220);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className={`fixed inset-x-0 bottom-0 z-[90] border-t border-ink/10 bg-white shadow-[0_-8px_24px_rgba(18,18,18,0.08)] transition-transform duration-300 ease-out ${
        entered ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink mb-1">We use cookies</p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Essential cookies keep the site and facility portal working. Optional cookies help us
            understand how the site is used. See our{' '}
            <Link to="/privacy#cookies" className="text-brand hover:underline underline-offset-2">
              Privacy &amp; cookies
            </Link>{' '}
            page for details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <button
            type="button"
            onClick={() => dismiss('essential')}
            className="btn-secondary text-sm px-4 py-2"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => dismiss('all')}
            className="btn-primary text-sm px-4 py-2"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
};

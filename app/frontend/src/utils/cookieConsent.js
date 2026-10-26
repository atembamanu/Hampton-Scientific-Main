/** Persist cookie preference so the banner shows once per visitor/browser. */

export const COOKIE_CONSENT_KEY = 'hampton_cookie_consent';
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_EVENT = 'hampton-cookie-consent';

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.choice !== 'all' && parsed.choice !== 'essential') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasCookieConsent() {
  return Boolean(getCookieConsent());
}

export function setCookieConsent(choice) {
  const value = {
    version: COOKIE_CONSENT_VERSION,
    choice: choice === 'all' ? 'all' : 'essential',
    at: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
  return value;
}

/** Clears preference so the banner can be shown again (Privacy → Manage cookies). */
export function resetCookieConsent() {
  localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: null }));
}

export function allowsOptionalCookies() {
  return getCookieConsent()?.choice === 'all';
}

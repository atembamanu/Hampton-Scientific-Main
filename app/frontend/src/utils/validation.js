// Rejects leading/trailing dots in the local part and a period immediately before @
const EMAIL_RE = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export const EMAIL_ERROR = 'Enter a valid email address';
export const PHONE_ERROR = 'Enter a valid phone number (e.g. 0712 345 678 or +254712345678)';

export const isValidEmail = (value) => {
  const text = String(value || '').trim();
  return Boolean(text && EMAIL_RE.test(text) && text.length <= 254);
};

export const isValidPhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 24) return false;
  if ((raw.match(/\+/g) || []).length > 1 || (raw.includes('+') && !raw.startsWith('+'))) return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return false;
  if (/^(?:254|0)?[17]\d{8}$/.test(digits)) return true;
  if (/^(?:254|0)?[1-9]\d{7,9}$/.test(digits)) return true;
  return true;
};

export const emailError = (value, { required = true } = {}) => {
  const text = String(value || '').trim();
  if (!text) return required ? 'Email is required' : null;
  return isValidEmail(text) ? null : EMAIL_ERROR;
};

export const phoneError = (value, { required = true } = {}) => {
  const text = String(value || '').trim();
  if (!text) return required ? 'Phone number is required' : null;
  return isValidPhone(text) ? null : PHONE_ERROR;
};

export const liveEmailError = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return isValidEmail(text) ? null : EMAIL_ERROR;
};

export const livePhoneError = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return isValidPhone(text) ? null : PHONE_ERROR;
};

export const invalidFieldClass = (error, base = '') => (
  `${base} ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`.trim()
);

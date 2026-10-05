/** Turn FastAPI / axios error payloads into a safe display string. */

const FIELD_LABELS = {
  email: 'Email',
  password: 'Password',
  phone: 'Phone',
  name: 'Name',
  firstName: 'First name',
  lastName: 'Last name',
  addressLine: 'Address',
  county: 'County',
  facilityType: 'Facility type',
  registrationNumber: 'Registration number',
  taxNumber: 'Tax / KRA PIN',
  website: 'Website',
  jobTitle: 'Job title',
  branchCode: 'Branch code',
  physicalAddress: 'Address',
  deliveryAddress: 'Delivery address',
  organization: 'Facility',
  primaryContact: 'Contact',
  credentials: 'Login',
  firstBranch: 'Branch',
};

const cleanMsg = (msg = '') => String(msg)
  .replace(/^value is not a valid email address:\s*/i, '')
  .replace(/^Value error,\s*/i, '')
  .trim();

const labelForPath = (loc = []) => {
  const parts = loc.filter((part) => part !== 'body' && typeof part === 'string');
  if (!parts.length) return null;
  const labels = parts.map((part) => FIELD_LABELS[part] || part);
  // Prefer the leaf field with a parent context when useful
  if (labels.length >= 2) {
    const parent = labels[labels.length - 2];
    const leaf = labels[labels.length - 1];
    if (parent === 'Login' || parent === 'Contact' || parent === 'Facility' || parent === 'Branch') {
      return `${parent} ${leaf.toLowerCase()}`;
    }
    return leaf;
  }
  return labels[0];
};

export const formatValidationDetail = (detail) => {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (!Array.isArray(detail)) {
    if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
      return cleanMsg(detail.msg) || detail.msg;
    }
    return null;
  }
  const parts = detail.map((item) => {
    if (typeof item === 'string') return item;
    const msg = cleanMsg(item?.msg) || item?.msg;
    if (!msg) return null;
    const label = labelForPath(item?.loc);
    return label ? `${label}: ${msg}` : msg;
  }).filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

/** Extract per-field messages from a FastAPI 422 detail array. */
export const fieldErrorsFromDetail = (detail) => {
  if (!Array.isArray(detail)) return {};
  const errors = {};
  detail.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body') : [];
    if (!loc.length) return;
    const key = loc.join('.');
    const msg = cleanMsg(item.msg) || item.msg || 'Invalid value';
    if (!errors[key]) errors[key] = msg;
  });
  return errors;
};

export const formatApiError = (error, fallback = 'Something went wrong. Please try again.') => {
  const detail = error?.response?.data?.detail ?? error;
  const formatted = formatValidationDetail(detail);
  if (formatted) return formatted;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error?.message && !error?.response) return error.message;
  return fallback;
};

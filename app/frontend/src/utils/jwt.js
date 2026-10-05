export const readJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const jwtExpiresAt = (token) => {
  const payload = readJwtPayload(token);
  if (typeof payload?.exp !== 'number') return null;
  return payload.exp * 1000;
};

export const isJwtExpired = (token) => {
  if (!token) return true;
  const payload = readJwtPayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false;
  return Date.now() >= payload.exp * 1000;
};

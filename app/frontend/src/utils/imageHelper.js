// Centralized Backend URL
// It looks for the env variable, otherwise defaults to your local port
import { API_URL } from "../config/apiBaseUrl";

export { API_URL };
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400';

function safeJoin(base, path) {
  const cleanBase = (base || '').replace(/\/$/, '');
  const cleanPath = (path || '').replace(/^\//, '');
  if (!cleanBase) return `/${cleanPath}`;
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Ensures any image path from the database is converted to a full, valid URL.
 * @param {string} path - The relative path from the DB (e.g., /images/products/img.jpg)
 * @returns {string} - The full URL (e.g., http://localhost:8001/images/products/img.jpg)
 */
export const getFullImageUrl = (path) => {
  if (!path) return FALLBACK_IMAGE;
  
  // If it's already a full URL (like an Unsplash link from your seed data), return it as is
  if (path.startsWith('http')) {
    return path;
  }

  // Normalize older/bad stored paths to the mounted static route:
  // - "routes/uploads/products/<file>" -> "/images/products/<file>"
  // - "/app/routes/uploads/products/<file>" -> "/images/products/<file>"
  // - windows slashes
  let p = String(path).replace(/\\/g, '/').trim();

  const uploadsMatch = p.match(/(?:^|\/)routes\/uploads\/products\/([^/?#]+)$/);
  if (uploadsMatch?.[1]) {
    p = `/images/products/${uploadsMatch[1]}`;
  }

  // Some values might be just a filename
  if (!p.startsWith('/') && /^[a-f0-9-]{10,}\./i.test(p)) {
    p = `/images/products/${p}`;
  }

  return safeJoin(API_URL, p);
};
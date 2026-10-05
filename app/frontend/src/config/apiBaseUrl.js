/** Backend origin for API calls. Prefer REACT_APP_BACKEND_URL (repo-root .env via Craco). */
export const API_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

export const mediaUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const prefix = path.startsWith("/") ? "" : "/";
  return `${API_URL}${prefix}${path}`;
};

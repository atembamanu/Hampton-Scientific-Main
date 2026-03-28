/** Backend origin for API calls. Prefer REACT_APP_BACKEND_URL (repo-root .env via Craco). */
export const API_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

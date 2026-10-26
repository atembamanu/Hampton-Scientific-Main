import { Navigate } from 'react-router-dom';

/** Legacy ops URL — unified login lives at /login with portal tabs. */
export const AdminLogin = () => (
  <Navigate to="/login?portal=operations" replace />
);

import { Link } from 'react-router-dom';

export const NotFound = () => (
  <div className="min-h-screen pb-20 flex items-center justify-center bg-cream">
    <div className="text-center px-6">
      <p className="editorial-label mb-4">404</p>
      <h1 className="text-2xl font-bold text-ink mb-4">Page not found</h1>
      <Link to="/" className="btn-primary">Back to home</Link>
    </div>
  </div>
);

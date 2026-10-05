import { Link } from 'react-router-dom';

import { storefrontCategories, useLiveCatalog } from '../utils/liveCatalog';
import { useSiteContent, websiteHref, websiteLabel } from '../utils/siteContent';

export const Footer = () => {
  const { contact } = useSiteContent();
  const { categories, products } = useLiveCatalog();
  const phoneHref = (contact.phone || '').replace(/\s/g, '');
  const webHref = websiteHref(contact.website);
  const footerCategories = storefrontCategories(categories, products, 6);

  return (
    <footer className="bg-white border-t border-ink/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
          <div className="col-span-2 md:col-span-1">
            <p className="editorial-label mb-3">{contact.companyName || 'Hampton Scientific'}</p>
            <p className="text-ink-muted leading-relaxed">
              Medical equipment and laboratory supplies for healthcare facilities across Africa.
            </p>
          </div>
          <div>
            <p className="editorial-label mb-3">Catalogue</p>
            <ul className="space-y-1.5 text-ink-muted">
              <li><Link to="/products" className="hover:text-copper">All products</Link></li>
              {footerCategories.map((category) => (
                <li key={category.category_id}>
                  <Link to={`/products?category=${category.slug}`} className="hover:text-copper">{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="editorial-label mb-3">Company</p>
            <ul className="space-y-1.5 text-ink-muted">
              <li><Link to="/about" className="hover:text-copper">About us</Link></li>
              <li><Link to="/order-management" className="hover:text-copper">Order management</Link></li>
              <li><Link to="/training" className="hover:text-copper">Training & Service</Link></li>
              <li><Link to="/careers" className="hover:text-copper">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-copper">Contact us</Link></li>
              <li><Link to="/login" className="hover:text-copper">Facility sign in</Link></li>
              <li><Link to="/register" className="hover:text-copper">Register your facility</Link></li>
            </ul>
          </div>
          <div>
            <p className="editorial-label mb-3">Contact</p>
            <ul className="space-y-1.5 text-ink-muted">
              {contact.address && <li>{contact.address}</li>}
              {contact.poBox && <li>{contact.poBox}</li>}
              {contact.phone && (
                <li><a href={`tel:${phoneHref}`} className="hover:text-copper">{contact.phone}</a></li>
              )}
              {contact.email && (
                <li><a href={`mailto:${contact.email}`} className="hover:text-copper">{contact.email}</a></li>
              )}
              {webHref && (
                <li>
                  <a href={webHref} target="_blank" rel="noopener noreferrer" className="hover:text-copper">
                    {websiteLabel(contact.website)}
                  </a>
                </li>
              )}
              {contact.workingHours && <li>{contact.workingHours}</li>}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-[11px] text-ink-faint">
          <p>© {new Date().getFullYear()} {contact.companyName || 'Hampton Scientific'}</p>
        </div>
      </div>
    </footer>
  );
};

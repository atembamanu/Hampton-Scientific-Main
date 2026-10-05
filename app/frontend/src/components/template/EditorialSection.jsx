export const EditorialSection = ({ id, label, title, children, className = '' }) => (
  <section id={id} className={`section-divider pt-16 lg:pt-20 pb-8 scroll-mt-28 ${className}`}>
    {label && <p className="editorial-label mb-8">{label}</p>}
    {title && <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mb-10">{title}</h2>}
    {children}
  </section>
);

export const FieldError = ({ children }) => (
  children ? <p className="text-xs text-red-600 mt-1">{children}</p> : null
);

export const EditorialField = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="editorial-label block">
      {label}
      {required && <span className="text-copper"> *</span>}
    </label>
    {children}
    <FieldError>{error}</FieldError>
  </div>
);

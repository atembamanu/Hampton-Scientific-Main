import { Link } from 'react-router-dom';

import { resetCookieConsent } from '../utils/cookieConsent';
import { useSiteContent } from '../utils/siteContent';

const updatedLabel = '9 October 2026';

export const Privacy = () => {
  const { contact } = useSiteContent();
  const company = contact.companyName || 'Hampton Scientific';
  const email = contact.email || 'info@hamptonscientific.com';
  const phone = contact.phone || '';
  const address = contact.address || '';

  const openCookieBanner = () => {
    resetCookieConsent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="editorial-label">Legal</span>
          <span className="w-8 h-px bg-brand" />
          <span className="editorial-label">Updated {updatedLabel}</span>
        </div>
        <h1 className="editorial-headline mb-4">Privacy &amp; cookies</h1>
        <p className="text-ink-muted leading-relaxed mb-12 max-w-2xl">
          How {company} collects, uses, and protects information when you use our website,
          facility portal, and related services.
        </p>

        <div className="space-y-12 text-[15px] text-ink-muted leading-relaxed">
          <section>
            <h2 className="font-semibold text-ink text-base mb-3">Who we are</h2>
            <p>
              {company} supplies medical equipment, diagnostics, consumables, and training to
              healthcare facilities. This statement covers our public website and facility portal.
            </p>
            {(address || email || phone) && (
              <p className="mt-3">
                {address && <>{address}. </>}
                {email && (
                  <>
                    Email{' '}
                    <a href={`mailto:${email}`} className="text-brand hover:underline">
                      {email}
                    </a>
                    {phone ? '. ' : ''}
                  </>
                )}
                {phone && (
                  <>
                    Phone{' '}
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-brand hover:underline">
                      {phone}
                    </a>
                    .
                  </>
                )}
              </p>
            )}
          </section>

          <section>
            <h2 className="font-semibold text-ink text-base mb-3">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="text-ink font-medium">Contact &amp; enquiry data</span> — name,
                facility, email, phone, and message content when you contact us or request a quote.
              </li>
              <li>
                <span className="text-ink font-medium">Facility accounts</span> — registration and
                portal details needed to quote, order, invoice, and support your organisation.
              </li>
              <li>
                <span className="text-ink font-medium">Newsletter</span> — email address if you
                subscribe (you can unsubscribe at any time).
              </li>
              <li>
                <span className="text-ink font-medium">Careers</span> — application details and CV
                you submit for open roles.
              </li>
              <li>
                <span className="text-ink font-medium">Technical data</span> — basic device and
                browser information needed to run and secure the site (see cookies below).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-ink text-base mb-3">How we use information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Respond to enquiries and prepare quotations</li>
              <li>Operate the facility portal (quotes, orders, invoices, reporting)</li>
              <li>Deliver training, service, and after-sales support</li>
              <li>Send newsletters only when you have subscribed</li>
              <li>Improve site reliability and prevent abuse</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information. We share data with service providers only
              where needed to operate our systems (for example hosting and email delivery), under
              appropriate safeguards.
            </p>
          </section>

          <section id="cookies" className="scroll-mt-28">
            <h2 className="font-semibold text-ink text-base mb-3">Cookies</h2>
            <p className="mb-4">
              We use a small number of cookies and similar browser storage. On your first visit we
              ask for your preference; that choice is remembered so the notice does not appear again
              on this browser.
            </p>
            <div className="rounded-2xl bg-cream-dark/80 px-6 py-6 sm:px-8 space-y-5">
              <div>
                <p className="editorial-label text-brand mb-2">Essential</p>
                <p>
                  Required for the site to work: keeping you signed in to the facility or admin
                  portal, remembering your quote basket, and storing your cookie preference. These
                  cannot be switched off if you use those features.
                </p>
              </div>
              <div>
                <p className="editorial-label text-brand mb-2">Optional</p>
                <p>
                  Help us understand how visitors use the public site so we can improve content and
                  performance. Optional cookies are used only if you choose Accept all.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={openCookieBanner} className="btn-secondary">
                Manage cookie preferences
              </button>
              <Link to="/contact" className="text-sm text-ink-muted hover:text-brand">
                Questions? Contact us
              </Link>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-ink text-base mb-3">Retention &amp; security</h2>
            <p>
              We keep information only as long as needed for the purposes above, including legal and
              accounting requirements for commercial records. We apply reasonable technical and
              organisational measures to protect data against unauthorised access or loss.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink text-base mb-3">Your choices</h2>
            <p>
              You may request access to, correction of, or deletion of personal data we hold about
              you, subject to applicable law (including Kenya’s Data Protection Act, 2019). Contact
              us at{' '}
              <a href={`mailto:${email}`} className="text-brand hover:underline">
                {email}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink text-base mb-3">Updates</h2>
            <p>
              We may update this statement from time to time. The date at the top of this page shows
              when it was last revised.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

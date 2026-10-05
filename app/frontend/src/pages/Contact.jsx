import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

import { EditorialField } from '../components/template/EditorialSection';
import { FilterMultiSelect } from '../components/FilterMultiSelect';
import { API_URL } from '../config/apiBaseUrl';
import { emailError, phoneError, liveEmailError, livePhoneError, invalidFieldClass } from '../utils/validation';
import { formatApiError } from '../utils/apiError';
import { useSiteContent, websiteHref, websiteLabel } from '../utils/siteContent';
import { useLiveCatalog } from '../utils/liveCatalog';
import { SheetTabs } from '../components/ui/SheetTabs';

const inputClass =
  'w-full border border-ink/10 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint/70 focus:outline-none focus:border-copper/40 focus:ring-1 focus:ring-copper/20 bg-white transition-colors';

const categoryTriggerClass =
  'form-field !h-auto min-h-[46px] rounded-[4px] border border-ink/10 px-4 py-3 bg-white focus:outline-none focus:border-copper/40 focus:ring-1 focus:ring-copper/20';

const tabs = [
  { id: 'contact', label: 'General inquiry' },
  { id: 'quote', label: 'Request quote' },
  { id: 'training', label: 'Training' },
];

export const Contact = () => {
  const location = useLocation();
  const { contact: info } = useSiteContent();
  const { categories, loading: categoriesLoading } = useLiveCatalog();
  const [activeTab, setActiveTab] = useState('contact');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterResult, setNewsletterResult] = useState(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const webHref = websiteHref(info.website);
  const phoneHref = (info.phone || '').replace(/\s/g, '');

  const categoryOptions = useMemo(
    () =>
      (categories || []).map((cat) => ({
        value: String(cat.category_id),
        label: cat.name,
      })),
    [categories],
  );

  const [contactForm, setContactForm] = useState({
    name: '', email: '', phone: '', subject: '', message: '',
  });
  const [quoteForm, setQuoteForm] = useState({
    facilityName: '', contactPerson: '', email: '', phone: '', productCategories: [], message: '',
  });
  const [trainingForm, setTrainingForm] = useState({
    facilityName: '', contactPerson: '', email: '', phone: '',
    trainingType: '', numberOfParticipants: '', preferredDate: '', message: '',
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && tabs.some((t) => t.id === tab)) setActiveTab(tab);
  }, [location.search]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(contactForm.email);
    const invalidPhone = phoneError(contactForm.phone, { required: false });
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/contact/inquiry`, contactForm);
      toast.success('Thank you! We will get back to you shortly.');
      setContactForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(quoteForm.email);
    const invalidPhone = phoneError(quoteForm.phone);
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    if (!quoteForm.productCategories.length) {
      toast.error('Select at least one product category');
      return;
    }
    const selectedLabels = categoryOptions
      .filter((opt) => quoteForm.productCategories.includes(opt.value))
      .map((opt) => opt.label);
    const categoryLine = selectedLabels.length
      ? `Categories: ${selectedLabels.join(', ')}`
      : `Categories: ${quoteForm.productCategories.join(', ')}`;
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/quotes`, {
        facility_name: quoteForm.facilityName,
        contact_person: quoteForm.contactPerson,
        email: quoteForm.email,
        phone: quoteForm.phone,
        additional_notes: `${categoryLine}\n${(quoteForm.message || '').trim()}`.trim(),
        items: [],
      });
      toast.success('Quote request received!');
      setQuoteForm({ facilityName: '', contactPerson: '', email: '', phone: '', productCategories: [], message: '' });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to submit quote request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrainingSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(trainingForm.email);
    const invalidPhone = phoneError(trainingForm.phone);
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/training/register`, {
        facility_name: trainingForm.facilityName,
        contact_person: trainingForm.contactPerson,
        email: trainingForm.email,
        phone: trainingForm.phone,
        training_type: trainingForm.trainingType,
        number_of_participants: parseInt(trainingForm.numberOfParticipants, 10) || 1,
        preferred_date: trainingForm.preferredDate,
        message: trainingForm.message,
      });
      toast.success('Training registration received!');
      setTrainingForm({
        facilityName: '', contactPerson: '', email: '', phone: '',
        trainingType: '', numberOfParticipants: '', preferredDate: '', message: '',
      });
    } catch {
      toast.error('Failed to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    const invalidEmail = emailError(newsletterEmail);
    if (invalidEmail) { toast.error(invalidEmail); return; }
    setNewsletterLoading(true);
    setNewsletterResult(null);
    try {
      const { data } = await axios.post(`${API_URL}/api/newsletter/subscribe`, { email: newsletterEmail });
      const status = data?.status || 'created';
      setNewsletterResult({
        status,
        email: data?.email || newsletterEmail,
        message: data?.message || 'Thanks for subscribing.',
        unsubscribeUrl: data?.unsubscribe_url || null,
      });
      if (status !== 'already_subscribed') {
        setNewsletterEmail('');
      }
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to subscribe. Please try again.'));
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Left — contact details */}
          <div className="lg:col-span-2 lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-center gap-3 mb-6">
              <span className="editorial-label">Contact</span>
              <span className="w-8 h-px bg-copper" />
              <span className="editorial-label">We respond within 24h</span>
            </div>
            <h1 className="editorial-headline mb-6">
              Let&apos;s talk about your{' '}
              <span className="text-copper">facility</span>.
            </h1>
            <p className="text-ink-muted text-sm leading-relaxed mb-10 max-w-sm">
              Whether you need equipment, training, or have questions — our team is ready to assist you.
            </p>

            <dl className="space-y-8 text-sm">
              {(info.address || info.poBox) && (
                <div className="editorial-accent-border">
                  <dt className="editorial-label mb-2">Location</dt>
                  <dd className="text-ink-muted leading-relaxed">
                    {info.googleMapsUrl ? (
                      <a href={info.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-copper transition-colors">
                        {info.address}
                      </a>
                    ) : (
                      info.address
                    )}
                    {info.address && info.poBox ? <br /> : null}
                    {info.poBox}
                  </dd>
                </div>
              )}
              {info.phone && (
                <div className="editorial-accent-border">
                  <dt className="editorial-label mb-2">Phone</dt>
                  <dd>
                    <a href={`tel:${phoneHref}`} className="text-ink hover:text-copper transition-colors">
                      {info.phone}
                    </a>
                    {info.workingHours ? (
                      <p className="text-ink-faint text-xs mt-1.5">{info.workingHours}</p>
                    ) : null}
                  </dd>
                </div>
              )}
              {info.email && (
                <div className="editorial-accent-border">
                  <dt className="editorial-label mb-2">Email</dt>
                  <dd>
                    <a href={`mailto:${info.email}`} className="text-ink hover:text-copper transition-colors break-all">
                      {info.email}
                    </a>
                  </dd>
                </div>
              )}
              {webHref && (
                <div className="editorial-accent-border">
                  <dt className="editorial-label mb-2">Website</dt>
                  <dd>
                    <a href={webHref} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-copper transition-colors break-all">
                      {websiteLabel(info.website)}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-10 pt-8 section-divider flex flex-wrap gap-4 text-xs">
              <Link to="/products" className="text-ink-muted hover:text-copper transition-colors">Browse store</Link>
              <Link to="/quote-cart" className="text-ink-muted hover:text-copper transition-colors">Quote cart</Link>
              <Link to="/training" className="text-ink-muted hover:text-copper transition-colors">Training & service</Link>
            </div>
          </div>

          {/* Right — forms */}
          <div className="lg:col-span-3">
            <div className="mb-8">
              <SheetTabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
            </div>

            <div className="editorial-panel">
              {activeTab === 'contact' && (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Full name" required>
                      <input type="text" required value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className={inputClass} />
                    </EditorialField>
                    <EditorialField label="Email" required error={liveEmailError(contactForm.email)}>
                      <input type="email" autoComplete="email" required value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className={invalidFieldClass(liveEmailError(contactForm.email), inputClass)} />
                    </EditorialField>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Phone" error={livePhoneError(contactForm.phone)}>
                      <input type="tel" inputMode="tel" autoComplete="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className={invalidFieldClass(livePhoneError(contactForm.phone), inputClass)} />
                    </EditorialField>
                    <EditorialField label="Subject" required>
                      <input type="text" required value={contactForm.subject} onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })} className={inputClass} />
                    </EditorialField>
                  </div>
                  <EditorialField label="Message" required>
                    <textarea required rows={5} value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} className={`${inputClass} resize-none`} />
                  </EditorialField>
                  <button type="submit" disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              )}

              {activeTab === 'quote' && (
                <form onSubmit={handleQuoteSubmit} className="space-y-5">
                  <p className="text-xs text-ink-muted">
                    Or{' '}
                    <Link to="/quote-cart" className="text-copper hover:underline">review items in your quote cart</Link>.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Facility name" required>
                      <input type="text" required value={quoteForm.facilityName} onChange={(e) => setQuoteForm({ ...quoteForm, facilityName: e.target.value })} className={inputClass} />
                    </EditorialField>
                    <EditorialField label="Contact person" required>
                      <input type="text" required value={quoteForm.contactPerson} onChange={(e) => setQuoteForm({ ...quoteForm, contactPerson: e.target.value })} className={inputClass} />
                    </EditorialField>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Email" required error={liveEmailError(quoteForm.email)}>
                      <input type="email" autoComplete="email" required value={quoteForm.email} onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })} className={invalidFieldClass(liveEmailError(quoteForm.email), inputClass)} />
                    </EditorialField>
                    <EditorialField label="Phone" required error={livePhoneError(quoteForm.phone)}>
                      <input type="tel" inputMode="tel" autoComplete="tel" required value={quoteForm.phone} onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })} className={invalidFieldClass(livePhoneError(quoteForm.phone), inputClass)} />
                    </EditorialField>
                  </div>
                  <EditorialField label="Product category" required>
                    <FilterMultiSelect
                      value={quoteForm.productCategories}
                      onChange={(next) => setQuoteForm({ ...quoteForm, productCategories: next })}
                      options={categoryOptions}
                      placeholder={categoriesLoading ? 'Loading categories…' : 'Select categories'}
                      searchPlaceholder="Search categories…"
                      disabled={categoriesLoading || !categoryOptions.length}
                      triggerClassName={categoryTriggerClass}
                    />
                  </EditorialField>
                  <EditorialField label="Additional details">
                    <textarea
                      rows={4}
                      value={quoteForm.message}
                      onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                      className={`${inputClass} resize-none text-left`}
                      style={{ textIndent: 0 }}
                    />
                  </EditorialField>
                  <button type="submit" disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? 'Submitting…' : 'Submit quote'}
                  </button>
                </form>
              )}

              {activeTab === 'training' && (
                <form onSubmit={handleTrainingSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Facility name" required>
                      <input type="text" required value={trainingForm.facilityName} onChange={(e) => setTrainingForm({ ...trainingForm, facilityName: e.target.value })} className={inputClass} />
                    </EditorialField>
                    <EditorialField label="Contact person" required>
                      <input type="text" required value={trainingForm.contactPerson} onChange={(e) => setTrainingForm({ ...trainingForm, contactPerson: e.target.value })} className={inputClass} />
                    </EditorialField>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Email" required error={liveEmailError(trainingForm.email)}>
                      <input type="email" autoComplete="email" required value={trainingForm.email} onChange={(e) => setTrainingForm({ ...trainingForm, email: e.target.value })} className={invalidFieldClass(liveEmailError(trainingForm.email), inputClass)} />
                    </EditorialField>
                    <EditorialField label="Phone" required error={livePhoneError(trainingForm.phone)}>
                      <input type="tel" inputMode="tel" autoComplete="tel" required value={trainingForm.phone} onChange={(e) => setTrainingForm({ ...trainingForm, phone: e.target.value })} className={invalidFieldClass(livePhoneError(trainingForm.phone), inputClass)} />
                    </EditorialField>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <EditorialField label="Training type" required>
                      <select required value={trainingForm.trainingType} onChange={(e) => setTrainingForm({ ...trainingForm, trainingType: e.target.value })} className={inputClass}>
                        <option value="">Select training</option>
                        <option value="analyzer">Diagnostic & laboratory analyzer</option>
                        <option value="microscopy">Microscopy & imaging</option>
                        <option value="maintenance">Routine maintenance</option>
                      </select>
                    </EditorialField>
                    <EditorialField label="Participants">
                      <input type="number" min={1} value={trainingForm.numberOfParticipants} onChange={(e) => setTrainingForm({ ...trainingForm, numberOfParticipants: e.target.value })} className={inputClass} />
                    </EditorialField>
                  </div>
                  <EditorialField label="Preferred date">
                    <input type="date" value={trainingForm.preferredDate} onChange={(e) => setTrainingForm({ ...trainingForm, preferredDate: e.target.value })} className={inputClass} />
                  </EditorialField>
                  <EditorialField label="Additional details">
                    <textarea rows={4} value={trainingForm.message} onChange={(e) => setTrainingForm({ ...trainingForm, message: e.target.value })} className={`${inputClass} resize-none`} />
                  </EditorialField>
                  <button type="submit" disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? 'Submitting…' : 'Submit registration'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <section className="mt-24 pt-16 section-divider">
          <div className="mx-auto max-w-xl text-center">
            <p className="editorial-label mb-4">Newsletter</p>
            {newsletterResult?.status === 'already_subscribed' ? (
              <div className="rounded-[4px] border border-ink/10 bg-white px-8 py-10 sm:px-10 text-left shadow-[0_1px_0_rgba(26,26,26,0.04)]">
                <p className="editorial-label text-copper mb-3">Already subscribed</p>
                <h2 className="text-2xl font-bold tracking-tight text-ink mb-3">
                  You&apos;re already on our list
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-2">
                  Your email address{' '}
                  <span className="font-semibold text-ink break-all">{newsletterResult.email}</span>
                </p>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">
                  We&apos;ve sent a confirmation to that inbox. No need to sign up again.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="btn-primary flex-1 justify-center"
                    onClick={() => {
                      setNewsletterResult(null);
                      setNewsletterEmail('');
                    }}
                  >
                    Use a different email
                  </button>
                  {newsletterResult.unsubscribeUrl ? (
                    <a href={newsletterResult.unsubscribeUrl} className="btn-secondary flex-1 justify-center text-center">
                      Unsubscribe
                    </a>
                  ) : null}
                </div>
              </div>
            ) : newsletterResult ? (
              <div className="rounded-[4px] border border-ink/10 bg-white px-8 py-10 sm:px-10 text-left shadow-[0_1px_0_rgba(26,26,26,0.04)]">
                <p className="editorial-label text-brand mb-3">Subscribed</p>
                <h2 className="text-2xl font-bold tracking-tight text-ink mb-3">
                  Thanks for joining
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-2">
                  Your email address{' '}
                  <span className="font-semibold text-ink break-all">{newsletterResult.email}</span>
                </p>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">
                  {newsletterResult.message} Check your inbox for a welcome email.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="btn-primary flex-1 justify-center"
                    onClick={() => setNewsletterResult(null)}
                  >
                    Done
                  </button>
                  {newsletterResult.unsubscribeUrl ? (
                    <a href={newsletterResult.unsubscribeUrl} className="btn-secondary flex-1 justify-center text-center">
                      Unsubscribe
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-[4px] border border-ink/10 bg-white px-8 py-10 sm:px-10 text-left shadow-[0_1px_0_rgba(26,26,26,0.04)]">
                <h2 className="text-2xl font-bold tracking-tight text-ink mb-3">
                  Stay informed
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-8">
                  Equipment updates, training programmes, and healthcare innovation — delivered to your inbox.
                </p>
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="Your email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className={`${invalidFieldClass(liveEmailError(newsletterEmail), inputClass)} sm:flex-1`}
                  />
                  <button type="submit" disabled={newsletterLoading} className="btn-primary whitespace-nowrap disabled:opacity-60">
                    {newsletterLoading ? 'Subscribing…' : 'Subscribe'}
                  </button>
                </form>
                <p className="mt-4 text-xs text-ink-faint">
                  You can unsubscribe at any time from the link in our emails.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

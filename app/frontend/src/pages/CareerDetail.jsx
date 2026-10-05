import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

import { EditorialField } from '../components/template/EditorialSection';
import { ProductDescription } from '../components/ProductDescription';
import { API_URL } from '../config/apiBaseUrl';
import { emailError, liveEmailError, livePhoneError, phoneError, invalidFieldClass } from '../utils/validation';

const inputClass =
  'w-full border border-ink/10 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint/70 focus:outline-none focus:border-copper/40 focus:ring-1 focus:ring-copper/20 bg-white transition-colors';

const typeLabel = (value) => ({
  'full-time': 'Full time',
  'part-time': 'Part time',
  contract: 'Contract',
  internship: 'Internship',
}[value] || value);

const emptyForm = { name: '', email: '', phone: '', cover_letter: '' };

export const CareerDetail = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [cv, setCv] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/careers/${jobId}`)
      .then(({ data }) => setJob(data))
      .catch(() => setMissing(true));
  }, [jobId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const invalidEmail = emailError(form.email);
    const invalidPhone = phoneError(form.phone, { required: false });
    if (invalidEmail) { toast.error(invalidEmail); return; }
    if (invalidPhone) { toast.error(invalidPhone); return; }
    if (!cv) { toast.error('Please attach your CV (PDF or Word).'); return; }
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('name', form.name.trim());
      data.append('email', form.email.trim());
      data.append('phone', form.phone.trim());
      data.append('cover_letter', form.cover_letter.trim());
      data.append('cv', cv);
      await axios.post(`${API_URL}/api/careers/${jobId}/apply`, data);
      setSubmitted(true);
      setForm(emptyForm);
      setCv(null);
      toast.success('Application received. We will be in touch.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not submit the application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (missing) {
    return (
      <div className="min-h-screen pb-20 bg-cream">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-ink mb-3">Role not found</h1>
          <p className="text-sm text-ink-muted mb-8">This opening may have closed.</p>
          <Link to="/careers" className="btn-secondary">All careers</Link>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen pb-20 bg-cream">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <p className="text-sm text-ink-muted">Loading role…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link to="/careers" className="text-xs text-ink-muted hover:text-copper">← All careers</Link>
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 mt-8">
          <div className="lg:col-span-3">
            <p className="editorial-label mb-3">
              {[job.department, job.location, typeLabel(job.employment_type)].filter(Boolean).join(' · ') || 'Open role'}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-8">{job.title}</h1>
            {job.description && (
              <div className="mb-10">
                <p className="editorial-label mb-3">About the role</p>
                <ProductDescription html={job.description} className="text-ink-muted" />
              </div>
            )}
            {job.requirements && (
              <div>
                <p className="editorial-label mb-3">What we look for</p>
                <ProductDescription html={job.requirements} className="text-ink-muted" />
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="editorial-panel">
              <h2 className="font-semibold text-ink mb-5">Apply</h2>
              {submitted ? (
                <p className="text-sm text-ink-muted">Thank you. Your application has been received.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <EditorialField label="Full name" required>
                    <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </EditorialField>
                  <EditorialField label="Email" required error={liveEmailError(form.email)}>
                    <input required type="email" className={invalidFieldClass(liveEmailError(form.email), inputClass)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </EditorialField>
                  <EditorialField label="Phone" error={livePhoneError(form.phone)}>
                    <input type="tel" className={invalidFieldClass(livePhoneError(form.phone), inputClass)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </EditorialField>
                  <EditorialField label="Cover letter">
                    <textarea rows={5} className={`${inputClass} resize-none`} value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} />
                  </EditorialField>
                  <EditorialField label="CV" required>
                    <input
                      required
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,.msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setCv(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-ink-muted file:mr-3 file:h-9 file:px-3 file:border file:border-ink/15 file:bg-white file:text-sm file:text-ink"
                    />
                    <p className="text-[11px] text-ink-faint mt-1">PDF or Word, up to 5MB.</p>
                  </EditorialField>
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

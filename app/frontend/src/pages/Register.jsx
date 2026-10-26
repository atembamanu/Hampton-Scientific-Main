import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { facilityHomePath } from '../utils/facilityHome';
import { EditorialField } from '../components/template/EditorialSection';
import { PasswordStrength, isPasswordValid } from '../components/facility/PasswordStrength';
import { isValidEmail, isValidPhone, liveEmailError, livePhoneError, invalidFieldClass } from '../utils/validation';
import { Input } from '../components/ui/input';
import { HamptonLogo } from '../components/HamptonLogo';
import { SearchableSelect } from '../components/admin/SearchableSelect';
import { kenyaCountyOptions } from '../data/kenyaCounties';

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'medical_centre', label: 'Medical Centre' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
];

const STEPS = ['Facility', 'Contact details', 'Branch setup'];

const PREVIEW = {
  src: '/marketing/Facility%20Quotes.png',
  alt: 'Facility quotes dashboard preview',
  title: 'Quotes, orders, and invoices in one place',
  body: 'Track procurement across your facility — from draft requests to accepted quotes.',
};

const stepForFieldKey = (key, multiBranch) => {
  if (key.startsWith('organization.')) return 0;
  if (key.startsWith('primaryContact.') || key.startsWith('credentials.')) return 1;
  if (key.startsWith('firstBranch.')) return multiBranch ? 2 : 1;
  return null;
};

export const Register = () => {
  const navigate = useNavigate();
  const { registerFacility, isAuthenticated, user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [multiBranch, setMultiBranch] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    orgName: '', facilityType: 'hospital', regNumber: '', taxNumber: '',
    orgPhone: '', orgEmail: '', website: '', addressLine: '', county: '', country: 'Kenya',
    firstName: '', lastName: '', jobTitle: '', contactPhone: '', contactEmail: '',
    email: '', password: '', confirmPassword: '',
    branchName: '', branchCode: '', branchAddress: '', branchCounty: '',
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(facilityHomePath(user), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setSubmitError('');
  };

  const clearApiField = (...keys) => {
    setFieldErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => { delete next[key]; });
      return next;
    });
  };

  const visibleSteps = multiBranch ? STEPS : STEPS.slice(0, 2);
  const canProceedStep0 = form.orgName && form.addressLine && form.facilityType
    && isValidPhone(form.orgPhone) && isValidEmail(form.orgEmail);
  const canProceedStep1 = form.firstName && form.lastName && isValidPhone(form.contactPhone) && isValidEmail(form.email)
    && form.password && form.password === form.confirmPassword && isPasswordValid(form.password);

  const handleSubmit = async () => {
    if (multiBranch && (!form.branchName || !form.branchCode || !form.branchAddress)) {
      toast.error('Complete branch details');
      return;
    }
    setLoading(true);
    setSubmitError('');
    setFieldErrors({});
    const payload = {
      organization: {
        name: form.orgName,
        facilityType: form.facilityType,
        registrationNumber: form.regNumber || null,
        taxNumber: form.taxNumber || null,
        phone: form.orgPhone,
        email: form.orgEmail,
        website: form.website || null,
        addressLine: form.addressLine,
        county: form.county || null,
        country: form.country,
        isMultiBranch: multiBranch,
      },
      primaryContact: {
        firstName: form.firstName,
        lastName: form.lastName,
        jobTitle: form.jobTitle || null,
        phone: form.contactPhone,
        email: form.contactEmail || form.email,
      },
      credentials: { email: form.email, password: form.password },
      multiBranch,
      firstBranch: multiBranch ? {
        name: form.branchName,
        branchCode: form.branchCode,
        physicalAddress: form.branchAddress,
        deliveryAddress: form.branchAddress,
        county: form.branchCounty || form.county,
      } : null,
    };

    try {
      const result = await registerFacility(payload);
      if (result.success) {
        toast.success('Registration complete!');
        navigate('/dashboard');
        return;
      }

      const message = typeof result.error === 'string'
        ? result.error
        : 'Registration failed. Please correct the highlighted fields and try again.';
      const apiFields = result.fieldErrors || {};
      setSubmitError(message);
      setFieldErrors(apiFields);
      toast.error(message);

      const firstKey = Object.keys(apiFields)[0];
      const targetStep = firstKey != null ? stepForFieldKey(firstKey, multiBranch) : null;
      if (targetStep != null && targetStep !== step) {
        setStep(targetStep);
      }
    } catch {
      const message = 'Registration failed. Please try again.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  const loginEmailError = liveEmailError(form.email) || fieldErrors['credentials.email'] || fieldErrors['primaryContact.email'];
  const orgEmailError = liveEmailError(form.orgEmail) || fieldErrors['organization.email'];

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-2">
      <div className="relative flex items-start lg:items-center justify-center px-6 py-12 lg:py-16 overflow-y-auto overflow-x-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(26,26,26,0.05) 0.5px, transparent 0.5px), linear-gradient(to bottom, rgba(26,26,26,0.05) 0.5px, transparent 0.5px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="relative w-full max-w-lg">
          <Link to="/" className="inline-block mb-8"><HamptonLogo size="small" /></Link>
          <p className="editorial-label mb-2">Facility portal</p>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold leading-tight tracking-tight text-ink uppercase mb-2">
            Register your <span className="text-brand">facility</span>
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            Create your facility account in {visibleSteps.length} steps.
          </p>

          <div className="editorial-panel p-6 sm:p-8 space-y-6">
            <nav aria-label="Registration steps" className="flex items-center gap-2">
              {visibleSteps.map((label, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <div key={label} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
                    <div className={`flex items-center gap-2 min-w-0 ${current ? 'text-brand' : done ? 'text-ink' : 'text-ink-muted'}`}>
                      <span
                        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          current
                            ? 'bg-brand text-white'
                            : done
                              ? 'bg-brand/15 text-brand'
                              : 'bg-ink/[0.08] text-ink-muted'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`text-sm font-medium truncate ${current ? '' : 'hidden sm:inline'}`}>
                        {label}
                      </span>
                    </div>
                    {i < visibleSteps.length - 1 && (
                      <div className={`flex-1 h-px min-w-[1rem] ${done || current ? 'bg-brand/30' : 'bg-ink/10'}`} aria-hidden />
                    )}
                  </div>
                );
              })}
            </nav>

            {submitError ? (
              <div className="rounded-[4px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {submitError}
              </div>
            ) : null}

            {step === 0 && (
              <>
                <EditorialField label="Facility name" required>
                  <Input value={form.orgName} onChange={set('orgName')} className="bg-white/80" />
                </EditorialField>
                <EditorialField label="Facility type" required>
                  <select value={form.facilityType} onChange={set('facilityType')} className="w-full h-10 px-3 rounded-xl border border-ink/15 bg-white/80 text-sm">
                    {FACILITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </EditorialField>
                <div className="grid grid-cols-2 gap-4">
                  <EditorialField label="Registration no."><Input value={form.regNumber} onChange={set('regNumber')} className="bg-white/80" /></EditorialField>
                  <EditorialField label="Tax / KRA PIN"><Input value={form.taxNumber} onChange={set('taxNumber')} className="bg-white/80" /></EditorialField>
                </div>
                <EditorialField label="Phone" required error={livePhoneError(form.orgPhone) || fieldErrors['organization.phone']}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.orgPhone}
                    onChange={(e) => { set('orgPhone')(e); clearApiField('organization.phone'); }}
                    className={invalidFieldClass(livePhoneError(form.orgPhone) || fieldErrors['organization.phone'], 'bg-white/80')}
                  />
                </EditorialField>
                <EditorialField label="Facility email" required error={orgEmailError}>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.orgEmail}
                    onChange={(e) => { set('orgEmail')(e); clearApiField('organization.email'); }}
                    className={invalidFieldClass(orgEmailError, 'bg-white/80')}
                  />
                </EditorialField>
                <EditorialField label="Physical address" required><Input value={form.addressLine} onChange={set('addressLine')} className="bg-white/80" /></EditorialField>
                <EditorialField label="County">
                  <SearchableSelect
                    value={form.county}
                    options={kenyaCountyOptions}
                    onSelect={(opt) => setForm((f) => ({ ...f, county: opt.value }))}
                    placeholder="Select county"
                    searchPlaceholder="Search counties…"
                    className="bg-white/80"
                  />
                </EditorialField>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiBranch}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMultiBranch(on);
                      if (!on && step > 1) setStep(1);
                    }}
                    className="rounded border-ink/20"
                  />
                  <span className="text-sm text-ink">We operate multiple branches</span>
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <EditorialField label="First name" required><Input value={form.firstName} onChange={set('firstName')} className="bg-white/80" /></EditorialField>
                <EditorialField label="Last name" required><Input value={form.lastName} onChange={set('lastName')} className="bg-white/80" /></EditorialField>
                <EditorialField label="Job title"><Input value={form.jobTitle} onChange={set('jobTitle')} className="bg-white/80" /></EditorialField>
                <EditorialField label="Phone" required error={livePhoneError(form.contactPhone) || fieldErrors['primaryContact.phone']}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.contactPhone}
                    onChange={(e) => { set('contactPhone')(e); clearApiField('primaryContact.phone'); }}
                    className={invalidFieldClass(livePhoneError(form.contactPhone) || fieldErrors['primaryContact.phone'], 'bg-white/80')}
                  />
                </EditorialField>
                <EditorialField label="Login email" required error={loginEmailError}>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => {
                      set('email')(e);
                      clearApiField('credentials.email', 'primaryContact.email');
                    }}
                    className={invalidFieldClass(loginEmailError, 'bg-white/80')}
                  />
                </EditorialField>
                <EditorialField label="Password" required error={fieldErrors['credentials.password']}>
                  <Input type="password" value={form.password} onChange={set('password')} className="bg-white/80" />
                  <PasswordStrength password={form.password} />
                </EditorialField>
                <EditorialField label="Confirm password" required>
                  <Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} className="bg-white/80" />
                </EditorialField>
              </>
            )}

            {step === 2 && multiBranch && (
              <>
                <p className="text-sm text-ink-muted">Set up your first branch. You can add more from the dashboard.</p>
                <EditorialField label="Branch name" required><Input value={form.branchName} onChange={set('branchName')} className="bg-white/80" /></EditorialField>
                <EditorialField label="Branch code" required><Input value={form.branchCode} onChange={set('branchCode')} placeholder="e.g. THIKA" className="bg-white/80 uppercase" /></EditorialField>
                <EditorialField label="Address" required><Input value={form.branchAddress} onChange={set('branchAddress')} className="bg-white/80" /></EditorialField>
                <EditorialField label="County">
                  <SearchableSelect
                    value={form.branchCounty}
                    options={kenyaCountyOptions}
                    onSelect={(opt) => setForm((f) => ({ ...f, branchCounty: opt.value }))}
                    placeholder="Select county"
                    searchPlaceholder="Search counties…"
                    className="bg-white/80"
                  />
                </EditorialField>
              </>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Link to="/login" className="text-sm font-medium text-brand hover:underline">
                Sign in
              </Link>
              <div className="flex-1" />
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {(step < 1 || (step === 1 && multiBranch)) ? (
                <button
                  type="button"
                  disabled={(step === 0 && !canProceedStep0) || (step === 1 && !canProceedStep1)}
                  onClick={() => { setSubmitError(''); setStep(step + 1); }}
                  className="btn-primary flex items-center gap-1 disabled:opacity-50"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create account
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand text-white px-10 xl:px-14 py-12 lg:sticky lg:top-0 lg:h-screen">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/70 mb-3">
            Facility preview
          </p>
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight max-w-md">
            {PREVIEW.title}
          </h2>
          <p className="mt-3 text-sm text-white/75 max-w-sm leading-relaxed">
            {PREVIEW.body}
          </p>
        </div>
        <div className="relative mt-10 flex-1 flex items-center">
          <div className="w-full rounded-2xl bg-white/10 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-white/20">
            <img
              src={PREVIEW.src}
              alt={PREVIEW.alt}
              className="w-full rounded-xl bg-white object-cover object-top max-h-[min(58vh,520px)]"
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

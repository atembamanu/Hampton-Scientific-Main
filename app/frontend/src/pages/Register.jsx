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

const STEPS = ['Facility', 'Contact & Account', 'Branch setup'];

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
    <div className="min-h-screen bg-cream pt-16 pb-20 px-6">
      <div className="max-w-lg mx-auto">
        <Link to="/" className="inline-block mb-8"><HamptonLogo size="small" /></Link>
        <p className="editorial-label mb-2">Facility portal</p>
        <h1 className="editorial-headline mb-2">Register your <span className="text-copper">facility</span></h1>
        <p className="text-sm text-ink-muted mb-8">Step {step + 1} of {multiBranch ? 3 : 2}: {STEPS[step]}</p>

        <div className="editorial-panel p-6 sm:p-8 space-y-6">
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
                <input type="checkbox" checked={multiBranch} onChange={(e) => setMultiBranch(e.target.checked)} className="rounded border-ink/20" />
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

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <div className="flex-1" />
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

        <p className="text-center text-sm text-ink-muted mt-6">
          Already registered? <Link to="/login" className="text-copper hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

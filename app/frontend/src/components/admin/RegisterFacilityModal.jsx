import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { PasswordStrength, isPasswordValid } from '../facility/PasswordStrength';
import { isValidEmail, isValidPhone, liveEmailError, livePhoneError } from '../../utils/validation';
import { formatApiError } from '../../utils/apiError';
import { FACILITY_TYPES } from './FieldDetailsForm';
import { AdminFormModal } from './AdminFormModal';

const empty = {
  orgName: '', facilityType: 'hospital', orgPhone: '', orgEmail: '', addressLine: '', county: '',
  firstName: '', lastName: '', jobTitle: '', contactPhone: '', contactEmail: '',
  email: '', password: '', confirmPassword: '',
};

const fieldClass = 'w-full h-10 px-3 border border-ink/15 rounded-lg text-sm bg-white';

const formFromEntry = (entry) => {
  if (!entry) return { ...empty };
  const parts = String(entry.contactName || '').trim().split(/\s+/).filter(Boolean);
  return {
    ...empty,
    orgName: entry.facilityName || '',
    facilityType: entry.facilityType || 'hospital',
    orgPhone: entry.facilityPhone || '',
    orgEmail: entry.facilityEmail || entry.contactEmail || '',
    addressLine: entry.address || '',
    county: entry.county || '',
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
    jobTitle: entry.contactTitle || '',
    contactPhone: entry.contactPhone || entry.facilityPhone || '',
    contactEmail: entry.contactEmail || '',
    email: entry.contactEmail || entry.facilityEmail || '',
  };
};

export const RegisterFacilityModal = ({ open, onOpenChange, onSaved, initialRecord = null }) => {
  const headers = getAdminHeader();
  const [form, setForm] = useState(empty);
  const [counties, setCounties] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setForm(formFromEntry(initialRecord));
    setSaving(false);
    axios.get(`${API_URL}/api/admin/field/counties`, { headers })
      .then((res) => {
        if (!cancelled) setCounties(res.data.counties || []);
      })
      .catch(() => {
        if (!cancelled) setCounties([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialRecord]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidPhone(form.orgPhone) || !isValidEmail(form.orgEmail)) {
      toast.error('Enter a valid facility phone and email.');
      return;
    }
    if (!isValidPhone(form.contactPhone) || !isValidEmail(form.email)) {
      toast.error('Enter a valid contact phone and login email.');
      return;
    }
    if (form.password !== form.confirmPassword || !isPasswordValid(form.password)) {
      toast.error('Set a matching password that meets the requirements.');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/api/admin/field/facilities`, {
        prospectId: initialRecord?.id || null,
        organization: {
          name: form.orgName,
          facilityType: form.facilityType,
          phone: form.orgPhone,
          email: form.orgEmail,
          addressLine: form.addressLine,
          county: form.county,
          country: 'Kenya',
        },
        primaryContact: {
          firstName: form.firstName,
          lastName: form.lastName,
          jobTitle: form.jobTitle || null,
          phone: form.contactPhone,
          email: form.contactEmail || form.email,
        },
        credentials: { email: form.email, password: form.password },
        multiBranch: false,
      }, { headers });
      toast.success(`${res.data.name} is registered and credited to you`);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(formatApiError(error, 'Could not register this facility.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={initialRecord ? 'Register as facility' : 'Register a facility'}
      description={initialRecord
        ? 'Review the copied details, add the facility administrator’s login, then register this entry as a facility.'
        : 'You stay signed in. The facility admin uses the email and password you set. Invoices for this facility count toward your monthly target.'}
      className="max-w-5xl"
    >
      <form onSubmit={submit} className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Facility name</span>
          <input required value={form.orgName} onChange={set('orgName')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Type</span>
          <select required value={form.facilityType} onChange={set('facilityType')} className={fieldClass}>
            {FACILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">County</span>
          <select required value={form.county} onChange={set('county')} className={fieldClass}>
            <option value="">Select county</option>
            {counties.map((county) => <option key={county} value={county}>{county}</option>)}
          </select>
        </label>
        <label className="text-sm lg:col-span-3">
          <span className="block text-xs text-ink-muted mb-1">Address</span>
          <input required value={form.addressLine} onChange={set('addressLine')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Facility phone</span>
          <input required value={form.orgPhone} onChange={set('orgPhone')} type="tel" className={fieldClass} />
          {livePhoneError(form.orgPhone) && <p className="text-xs text-red-600 mt-1">{livePhoneError(form.orgPhone)}</p>}
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block text-xs text-ink-muted mb-1">Facility email</span>
          <input required value={form.orgEmail} onChange={set('orgEmail')} type="email" className={fieldClass} />
          {liveEmailError(form.orgEmail) && <p className="text-xs text-red-600 mt-1">{liveEmailError(form.orgEmail)}</p>}
        </label>
        <p className="text-xs uppercase tracking-[0.14em] text-copper font-semibold pt-2 sm:col-span-2 lg:col-span-3">Facility admin</p>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">First name</span>
          <input required value={form.firstName} onChange={set('firstName')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Last name</span>
          <input required value={form.lastName} onChange={set('lastName')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Job title</span>
          <input value={form.jobTitle} onChange={set('jobTitle')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Contact phone</span>
          <input required value={form.contactPhone} onChange={set('contactPhone')} type="tel" className={fieldClass} />
          {livePhoneError(form.contactPhone) && <p className="text-xs text-red-600 mt-1">{livePhoneError(form.contactPhone)}</p>}
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block text-xs text-ink-muted mb-1">Login email</span>
          <input required value={form.email} onChange={set('email')} type="email" className={fieldClass} />
          {liveEmailError(form.email) && <p className="text-xs text-red-600 mt-1">{liveEmailError(form.email)}</p>}
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Password</span>
          <input required type="password" value={form.password} onChange={set('password')} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-muted mb-1">Confirm password</span>
          <input required type="password" value={form.confirmPassword} onChange={set('confirmPassword')} className={fieldClass} />
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <PasswordStrength password={form.password} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Register facility
          </button>
        </div>
      </form>
    </AdminFormModal>
  );
};

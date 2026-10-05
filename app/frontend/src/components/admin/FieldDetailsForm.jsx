import { MapPin } from 'lucide-react';

export const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'medical_centre', label: 'Medical Centre' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
];

export const PROBABILITY_OPTIONS = [
  { value: '1', label: '1 — Very unlikely' },
  { value: '2', label: '2 — Unlikely' },
  { value: '3', label: '3 — Possible' },
  { value: '4', label: '4 — Likely' },
  { value: '5', label: '5 — Very likely' },
];

export const emptyVisitForm = {
  organizationId: '',
  facilityName: '',
  facilityType: 'hospital',
  county: '',
  address: '',
  facilityPhone: '',
  facilityEmail: '',
  contactName: '',
  contactTitle: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
  probability: '3',
};

export const formFromRecord = (record) => ({
  organizationId: record?.organizationId || '',
  facilityName: record?.facilityName || '',
  facilityType: record?.facilityType || 'other',
  county: record?.county || '',
  address: record?.address || '',
  facilityPhone: record?.facilityPhone || '',
  facilityEmail: record?.facilityEmail || '',
  contactName: record?.contactName || '',
  contactTitle: record?.contactTitle || '',
  contactPhone: record?.contactPhone || '',
  contactEmail: record?.contactEmail || '',
  notes: record?.notes || '',
  probability: record?.probability ? String(record.probability) : '3',
});

export const captureLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('This browser cannot share your location. Allow location access and try again.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
    }),
    () => reject(new Error('Allow location to continue. Nothing was saved.')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
});

export const mapHref = (latitude, longitude) => {
  if (latitude == null || longitude == null) return null;
  return `https://maps.google.com/?q=${latitude},${longitude}`;
};

export const outsideLabel = (role) => (
  role === 'sales' ? 'Outside my counties' : 'Outside assigned counties'
);

const fieldClass = 'w-full h-10 px-3 border border-ink/15 rounded-lg text-sm bg-white';

export const FieldDetailsForm = ({ value, onChange, counties }) => {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Facility name</span>
        <input required value={value.facilityName} onChange={set('facilityName')} className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Facility type</span>
        <select required value={value.facilityType} onChange={set('facilityType')} className={fieldClass}>
          {FACILITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">County</span>
        <select required value={value.county} onChange={set('county')} className={fieldClass}>
          <option value="">Select county</option>
          {counties.map((county) => (
            <option key={county} value={county}>{county}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Address</span>
        <input value={value.address} onChange={set('address')} className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Facility phone</span>
        <input value={value.facilityPhone} onChange={set('facilityPhone')} type="tel" className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Facility email</span>
        <input value={value.facilityEmail} onChange={set('facilityEmail')} type="email" className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Who you met</span>
        <input required value={value.contactName} onChange={set('contactName')} className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Their role</span>
        <input value={value.contactTitle} onChange={set('contactTitle')} className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Contact phone</span>
        <input value={value.contactPhone} onChange={set('contactPhone')} type="tel" className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Contact email</span>
        <input value={value.contactEmail} onChange={set('contactEmail')} type="email" className={fieldClass} />
      </label>
      <label className="text-sm">
        <span className="block text-xs text-ink-muted mb-1">Probability of a deal</span>
        <select required value={value.probability} onChange={set('probability')} className={fieldClass}>
          {PROBABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2 lg:col-span-3">
        <span className="block text-xs text-ink-muted mb-1">Notes / what they said</span>
        <textarea value={value.notes} onChange={set('notes')} rows={3} className="w-full px-3 py-2 border border-ink/15 rounded-lg text-sm bg-white" />
      </label>
    </div>
  );
};

export const LocationHint = ({ status }) => (
  <p className="text-sm text-ink-muted inline-flex items-start gap-2">
    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-copper" />
    <span>{status}</span>
  </p>
);

export const visitPayload = (form) => ({
  facilityName: form.facilityName,
  facilityType: form.facilityType,
  county: form.county,
  address: form.address,
  facilityPhone: form.facilityPhone,
  facilityEmail: form.facilityEmail,
  contactName: form.contactName,
  contactTitle: form.contactTitle,
  contactPhone: form.contactPhone,
  contactEmail: form.contactEmail,
  notes: form.notes,
  probability: Number(form.probability),
});

export const apiError = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (error?.message && !error?.response) return error.message;
  return fallback;
};

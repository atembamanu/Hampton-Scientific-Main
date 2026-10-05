import { toast } from 'sonner';
import { phoneError, livePhoneError } from '../../utils/validation';

export const snapshotToDeliveryForm = (snapshot = {}) => ({
  location: snapshot.address_line || snapshot.label || snapshot.location || '',
  receiver_name: snapshot.contact_name || snapshot.receiver_name || '',
  receiver_phone: snapshot.phone || snapshot.receiver_phone || '',
  rider_name: snapshot.rider_name || '',
  rider_no: snapshot.rider_no || snapshot.rider_phone || '',
});

export const deliveryFormToSnapshot = (form, previous = {}) => ({
  ...previous,
  label: previous.label || form.location || 'Delivery location',
  address_line: form.location,
  location: form.location,
  contact_name: form.receiver_name,
  receiver_name: form.receiver_name,
  phone: form.receiver_phone,
  receiver_phone: form.receiver_phone,
  rider_name: form.rider_name,
  rider_no: form.rider_no,
  rider_phone: form.rider_no,
});

const FIELDS = [
  { key: 'location', label: 'Location' },
  { key: 'receiver_name', label: 'Receiver name' },
  { key: 'receiver_phone', label: 'Receiver contact no.' },
  { key: 'rider_name', label: 'Rider name' },
  { key: 'rider_no', label: 'Rider no.' },
];

export const DeliveryDetailsForm = ({ value, onChange, onSave, saving, readOnly = false, className = '' }) => (
  <div className={className}>
    <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Delivery</p>
    <div className="grid sm:grid-cols-2 gap-4">
      {FIELDS.map((field) => (
        <label key={field.key} className="block text-sm">
          <span className="text-xs text-gray-500">{field.label}</span>
          <input
            type={field.key.includes('phone') || field.key === 'rider_no' ? 'tel' : 'text'}
            value={value[field.key] || ''}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => !readOnly && onChange({ ...value, [field.key]: e.target.value })}
            className={`mt-1 h-9 w-full px-3 border rounded-lg text-sm ${readOnly ? 'bg-gray-50 text-gray-700' : 'bg-white'} ${
              (field.key === 'receiver_phone' && livePhoneError(value.receiver_phone)) || (field.key === 'rider_no' && livePhoneError(value.rider_no))
                ? 'border-red-400'
                : 'border-ink/15'
            }`}
          />
          {field.key === 'receiver_phone' && livePhoneError(value.receiver_phone) && (
            <p className="text-xs text-red-600 mt-1">{livePhoneError(value.receiver_phone)}</p>
          )}
          {field.key === 'rider_no' && livePhoneError(value.rider_no) && (
            <p className="text-xs text-red-600 mt-1">{livePhoneError(value.rider_no)}</p>
          )}
        </label>
      ))}
    </div>
    {!readOnly && (
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => {
            const receiver = phoneError(value.receiver_phone, { required: false });
            const rider = phoneError(value.rider_no, { required: false });
            if (receiver) { toast.error(`Receiver contact: ${receiver}`); return; }
            if (rider) { toast.error(`Rider no.: ${rider}`); return; }
            onSave();
          }}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[#006332] text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save delivery'}
        </button>
      </div>
    )}
  </div>
);

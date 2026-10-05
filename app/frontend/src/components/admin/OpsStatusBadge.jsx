const STYLES = {
  submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  new: 'bg-amber-50 text-amber-800 border-amber-200',
  under_review: 'bg-blue-50 text-blue-800 border-blue-200',
  awaiting_information: 'bg-purple-50 text-purple-800 border-purple-200',
  preparing_quote: 'bg-blue-50 text-blue-800 border-blue-200', // legacy alias of under_review
  awaiting_customer: 'bg-sky-50 text-sky-800 border-sky-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  converted: 'bg-gray-100 text-gray-800 border-gray-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  quoted: 'bg-blue-50 text-blue-800 border-blue-200',
  invoiced: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  awaiting_payment: 'bg-amber-50 text-amber-800 border-amber-200',
  unpaid: 'bg-amber-50 text-amber-800 border-amber-200', // legacy alias of awaiting_payment
  overdue: 'bg-red-50 text-red-800 border-red-200',
  paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  processing: 'bg-blue-50 text-blue-800 border-blue-200',
  dispatched: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  out_for_delivery: 'bg-purple-50 text-purple-800 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  order_placed: 'bg-copper/10 text-copper border-copper/20',
  none: 'bg-gray-50 text-gray-500 border-gray-200',
};

const LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  awaiting_information: 'Awaiting Information',
  preparing_quote: 'Under Review', // legacy alias
  awaiting_customer: 'Awaiting Customer',
  accepted: 'Accepted',
  converted: 'Converted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
  order_placed: 'Confirmed',
  out_for_delivery: 'Out for Delivery',
  none: 'None',
  awaiting_payment: 'Awaiting Payment',
  unpaid: 'Awaiting Payment', // legacy alias
  overdue: 'Overdue',
  paid: 'Paid',
};

export const OpsStatusBadge = ({ status }) => {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STYLES[key] || 'bg-gray-50 text-gray-600 border-gray-200';
  const label = LABELS[key] || (status || 'unknown').replace(/_/g, ' ');
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-ink/5 text-ink-muted border-ink/10',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_information: 'bg-purple-50 text-purple-700 border-purple-200',
  quoted: 'bg-sky-50 text-sky-700 border-sky-200',
  draft: 'bg-ink/5 text-ink-muted border-ink/10',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  converted: 'bg-gray-100 text-gray-700 border-gray-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  revision_proposed: 'bg-purple-50 text-purple-700 border-purple-200',
  quote_requested: 'bg-amber-50 text-amber-700 border-amber-200',
  order_placed: 'bg-copper/10 text-copper border-copper/20',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  out_for_delivery: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  awaiting_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-amber-50 text-amber-700 border-amber-200', // legacy alias of awaiting_payment
  overdue: 'bg-red-50 text-red-700 border-red-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const StatusBadge = ({ status }) => {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STATUS_STYLES[key] || 'bg-ink/5 text-ink-muted border-ink/10';
  const label = (status || 'unknown').replace(/_/g, ' ');

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${style}`}>
      {label}
    </span>
  );
};

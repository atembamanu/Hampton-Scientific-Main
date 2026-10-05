/**
 * Invoice status vocabulary, shared by the admin and facility portals.
 * Mirrors backend utils/ops_stats.py.
 *
 * Stored:  awaiting_payment | paid   (legacy rows may still say pending/unpaid)
 * Display: awaiting_payment | overdue | paid   ("overdue" is derived from due_date)
 */
export const INVOICE_AWAITING_PAYMENT = 'awaiting_payment';
export const INVOICE_OVERDUE = 'overdue';
export const INVOICE_PAID = 'paid';

export const INVOICE_STATUS_LABELS = {
  [INVOICE_AWAITING_PAYMENT]: 'Awaiting payment',
  [INVOICE_OVERDUE]: 'Overdue',
  [INVOICE_PAID]: 'Paid',
};

/** Filter options in workflow order. */
export const INVOICE_STATUS_OPTIONS = [
  { value: INVOICE_AWAITING_PAYMENT, label: INVOICE_STATUS_LABELS[INVOICE_AWAITING_PAYMENT] },
  { value: INVOICE_OVERDUE, label: INVOICE_STATUS_LABELS[INVOICE_OVERDUE] },
  { value: INVOICE_PAID, label: INVOICE_STATUS_LABELS[INVOICE_PAID] },
];

/** Every bucket that still needs money collected. */
export const OPEN_INVOICE_STATUSES = [INVOICE_AWAITING_PAYMENT, INVOICE_OVERDUE];

export const normalizeInvoiceStatus = (status) =>
  ((status || '').toLowerCase() === INVOICE_PAID ? INVOICE_PAID : INVOICE_AWAITING_PAYMENT);

export const invoiceDisplayStatus = (inv, now = new Date()) => {
  if (!inv) return INVOICE_AWAITING_PAYMENT;
  if (normalizeInvoiceStatus(inv.status) === INVOICE_PAID) return INVOICE_PAID;
  if (inv.due_date && new Date(inv.due_date) < now) return INVOICE_OVERDUE;
  return INVOICE_AWAITING_PAYMENT;
};

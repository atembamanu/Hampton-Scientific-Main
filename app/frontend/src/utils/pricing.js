export const CURRENCY = 'KES';
export const DEFAULT_TAX_RATE = 16;

export const formatPrice = (amount, { currency = CURRENCY } = {}) => {
  const value = Number(amount) || 0;
  return `${currency} ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
};

export const formatPriceWithUnit = (amount, unit = 'unit') => {
  return `${formatPrice(amount)} / ${unit}`;
};

export const lineTotal = (unitPrice, quantity) =>
  (Number(unitPrice) || 0) * (Number(quantity) || 1);

export const hasQuotedPrices = (items = []) =>
  items.some((item) => (Number(item.unit_price ?? item.quoted_unit_price ?? item.modified_price ?? item.agreed_unit_price) || 0) > 0);

export const itemQuantity = (item) =>
  Number(item.quoted_quantity ?? item.quantity) || 1;

export const itemListPrice = (item) =>
  Number(item.list_price ?? item.listPrice ?? item.original_price) || 0;

export const itemQuotedPrice = (item) =>
  Number(item.unit_price ?? item.quoted_unit_price ?? item.modified_price ?? item.agreed_unit_price) || 0;

export const itemAgreedPrice = (item) =>
  Number(item.agreed_unit_price ?? item.unit_price ?? item.modified_price) || 0;

export const itemSavings = (item) => {
  const list = itemListPrice(item);
  const quoted = itemQuotedPrice(item);
  if (list > 0 && quoted > 0 && quoted < list) {
    return (list - quoted) * itemQuantity(item);
  }
  return 0;
};

export const savingsPercent = (listPrice, quotedPrice) => {
  const list = Number(listPrice) || 0;
  const quoted = Number(quotedPrice) || 0;
  if (list <= 0 || quoted <= 0 || quoted >= list) return null;
  return Math.round(((list - quoted) / list) * 100);
};

export const sumListSubtotal = (items = []) =>
  items.reduce((sum, item) => sum + lineTotal(itemListPrice(item), itemQuantity(item)), 0);

export const sumQuotedSubtotal = (items = []) =>
  items.reduce((sum, item) => sum + lineTotal(itemQuotedPrice(item), itemQuantity(item)), 0);

export const sumCustomerSavings = (items = []) =>
  items.reduce((sum, item) => sum + itemSavings(item), 0);

export const resolveTaxRate = (doc = {}) => {
  const rate = Number(doc.tax_rate);
  if (doc.include_vat === false) return Number.isFinite(rate) && rate > 0 ? rate : 0;
  if (Number.isFinite(rate) && rate > 0) return rate;
  return DEFAULT_TAX_RATE;
};

/** List subtotal, discount (list − quoted), VAT on quoted, total. */
export const documentPricing = (doc = {}) => {
  const items = doc.items || [];
  const listSubtotal = items.length ? sumListSubtotal(items) : Number(doc.list_subtotal) || 0;
  const quotedFromItems = items.length ? sumQuotedSubtotal(items) : 0;
  const quotedSubtotal = hasQuotedPrices(items)
    ? quotedFromItems
    : (Number(doc.subtotal) || quotedFromItems || 0);
  const discount = quotedSubtotal > 0 ? Math.max(0, listSubtotal - quotedSubtotal) : 0;
  const includeVat = doc.include_vat !== false;
  const taxRate = resolveTaxRate(doc);
  const taxAmount = includeVat && taxRate > 0 ? quotedSubtotal * (taxRate / 100) : 0;
  const delivery = Number(doc.delivery_charge) || 0;
  const total = quotedSubtotal + taxAmount + delivery;

  return {
    listSubtotal,
    quotedSubtotal,
    discount,
    taxRate,
    taxAmount,
    delivery,
    total,
    includeVat,
    isQuoted: hasQuotedPrices(items) || quotedSubtotal > 0,
  };
};

export const quotePricingSummary = (quote) => documentPricing(quote);

export const documentTax = (doc) => Number(doc?.tax_amount ?? doc?.taxAmount ?? 0) || 0;

export const documentNet = (doc) => {
  if (doc?.net != null && doc.net !== '') return Number(doc.net) || 0;
  const total = Number(doc?.total ?? doc?.subtotal ?? 0) || 0;
  return Math.max(0, total - documentTax(doc));
};

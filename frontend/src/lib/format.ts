/** Round to 2 decimals, removing floating point noise (e.g. 200 - 143.99999 -> 56.01). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrFixed = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹144 or ₹143.50 — decimals only when needed. */
export const formatINR = (n: number): string => {
  const v = round2(n);
  return Number.isInteger(v) ? inrWhole.format(v) : inrFixed.format(v); // never "₹143.5"
};

/** Always two decimals; used for totals and receipts. */
export const formatINRFixed = (n: number): string => inrFixed.format(round2(n));

export const savingsPerUnit = (basePrice: number, currentPrice: number): number =>
  Math.max(0, round2(basePrice - currentPrice));

export const lineTotal = (unitPrice: number, quantity: number): number => round2(unitPrice * quantity);

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dateTimeYear = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso: string | undefined | null, withYear = false): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (withYear ? dateTimeYear : dateTime).format(d);
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SC';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
};

export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return '—';
  return `+91 ••••• ${digits.slice(-5)}`;
};

export const capitalise = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

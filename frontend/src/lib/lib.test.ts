import { describe, expect, it } from 'vitest';
import { formatINR, formatINRFixed, initials, lineTotal, maskPhone, round2, savingsPerUnit } from './format';
import { getTimeLeft } from './time';
import { deriveTiers, getMaxTarget, getNextTier, getProgressPercent, maxQuantityFor } from './pool';
import { isValidFlat, isValidPhone, validatePoolForm, validateTiers } from './validation';
import { isPoolProgress, isUserSession } from './guards';
import { makePool } from '../test/utils';

describe('currency', () => {
  it('removes floating point noise', () => {
    expect(round2(200 - 143.99999999)).toBe(56);
    expect(savingsPerUnit(0.3, 0.1)).toBe(0.2);
    expect(lineTotal(19.99, 3)).toBe(59.97);
  });
  it('shows decimals only when needed', () => {
    expect(formatINR(144)).toBe('₹144');
    expect(formatINR(143.5)).toBe('₹143.50');
    expect(formatINRFixed(144)).toBe('₹144.00');
    expect(formatINR(125000)).toBe('₹1,25,000');
  });
  it('never reports negative savings', () => {
    expect(savingsPerUnit(100, 120)).toBe(0);
  });
});

describe('text helpers', () => {
  it('builds initials and masks phones without inventing digits', () => {
    expect(initials('Asha Rao Kulkarni')).toBe('AK');
    expect(initials('')).toBe('SC');
    expect(maskPhone('9876543210')).toBe('+91 ••••• 43210');
    expect(maskPhone('')).toBe('—');
  });
});

describe('getTimeLeft', () => {
  const now = Date.parse('2026-11-10T10:00:00Z');
  const at = (ms: number) => new Date(now + ms).toISOString();
  it('shows hours+minutes far out and is not urgent', () => {
    const t = getTimeLeft(at(2 * 3600_000 + 5 * 60_000), now);
    expect(t.label).toBe('2h 5m');
    expect(t.urgent).toBe(false);
  });
  it('is urgent under an hour', () => {
    expect(getTimeLeft(at(38 * 60_000), now)).toMatchObject({ label: '38m', urgent: true });
  });
  it('shows seconds inside the last five minutes', () => {
    expect(getTimeLeft(at(3 * 60_000 + 7_000), now).label).toBe('3m 07s');
  });
  it('handles ended and invalid dates', () => {
    expect(getTimeLeft(at(-1000), now)).toMatchObject({ ended: true, label: 'ended' });
    expect(getTimeLeft('nonsense', now).ended).toBe(true);
    expect(getTimeLeft(undefined, now).ended).toBe(true);
  });
});

describe('pool helpers', () => {
  it('derives achieved/current tiers from the live quantity', () => {
    const tiers = deriveTiers(makePool({ aggregateQuantity: 24 }));
    expect(tiers.map((t) => t.achieved)).toEqual([true, true, false]);
    expect(tiers.find((t) => t.current)?.minQuantity).toBe(20);
  });
  it('works when tiers arrive unsorted', () => {
    const p = makePool({ aggregateQuantity: 15, tiers: [{ minQuantity: 30, discountPercent: 35 }, { minQuantity: 10, discountPercent: 10 }] });
    expect(deriveTiers(p).map((t) => t.minQuantity)).toEqual([10, 30]);
  });
  it('computes next tier and progress', () => {
    const p = makePool({ aggregateQuantity: 24 });
    expect(getNextTier(p)).toMatchObject({ unitsNeeded: 6, tier: { discountPercent: 35 } });
    expect(getMaxTarget(p)).toBe(30);
    expect(getProgressPercent(p)).toBe(80);
  });
  it('has no next tier at the top, and survives an empty ladder', () => {
    expect(getNextTier(makePool({ aggregateQuantity: 31 }))).toBeNull();
    expect(getProgressPercent(makePool({ aggregateQuantity: 0, tiers: [] }))).toBe(0);
  });
  it('reads the per-order cap from the pool with a safe default', () => {
    expect(maxQuantityFor({ maxQuantityPerOrder: 5 })).toBe(5);
    expect(maxQuantityFor({})).toBe(20);
  });
});

describe('validation', () => {
  it('validates Indian mobiles and flat numbers', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('1234567890')).toBe(false);
    expect(isValidFlat('B-1204')).toBe(true);
    expect(isValidFlat('<script>')).toBe(false);
    expect(isValidFlat('   ')).toBe(false);
  });
  it('requires ascending units and discounts', () => {
    expect(validateTiers([{ minQuantity: 10, discountPercent: 5 }, { minQuantity: 30, discountPercent: 15 }])).toBeNull();
    expect(validateTiers([{ minQuantity: 30, discountPercent: 5 }, { minQuantity: 10, discountPercent: 15 }])).toMatch(/Tier 2/);
    expect(validateTiers([{ minQuantity: 10, discountPercent: 15 }, { minQuantity: 20, discountPercent: 10 }])).toMatch(/discount must be higher/);
    expect(validateTiers([{ minQuantity: 10, discountPercent: 95 }])).toMatch(/between 1%/);
    expect(validateTiers([{ minQuantity: '', discountPercent: 5 }])).toMatch(/whole number/);
    expect(validateTiers([])).toMatch(/at least one/);
  });
  it('validates the whole pool form', () => {
    const base = { productName: 'Rice', productSku: 'SKU-RICE', basePrice: '200', floorPrice: '140', cutoffAt: '2099-01-01T10:00', tiers: [{ minQuantity: 10, discountPercent: 5 }] };
    expect(validatePoolForm(base)).toBeNull();
    expect(validatePoolForm({ ...base, floorPrice: '250' })).toMatch(/Floor price/);
    expect(validatePoolForm({ ...base, cutoffAt: '2000-01-01T10:00' })).toMatch(/future/);
    expect(validatePoolForm({ ...base, productSku: 'a b' })).toMatch(/SKU/);
    expect(validatePoolForm({ ...base, tiers: [{ minQuantity: 10, discountPercent: 40 }] })).toMatch(/below your floor/);
  });
});

describe('runtime guards', () => {
  it('accepts a real pool and rejects junk frames', () => {
    expect(isPoolProgress(makePool())).toBe(true);
    expect(isPoolProgress({})).toBe(false);
    expect(isPoolProgress(null)).toBe(false);
    expect(isPoolProgress('x')).toBe(false);
  });
  it('validates sessions', () => {
    expect(isUserSession({ residentId: 'a', societyId: 'b', flatNumber: 'c' })).toBe(true);
    expect(isUserSession({ residentId: 1 })).toBe(false);
  });
});

describe('name validation', () => {
  it('accepts real names and rejects junk', async () => {
    const { isValidName } = await import('./validation');
    expect(isValidName('Asha Rao')).toBe(true);
    expect(isValidName("D'Souza-Pinto Jr.")).toBe(true);
    expect(isValidName('Ananya Śarma')).toBe(true);
    expect(isValidName('A')).toBe(false);
    expect(isValidName('1234')).toBe(false);
    expect(isValidName('<script>')).toBe(false);
    expect(isValidName('x'.repeat(61))).toBe(false);
  });
});

describe('csv', () => {
  it('quotes commas, quotes and line breaks, and joins rows with CRLF', async () => {
    const { toCsv } = await import('./csv');
    expect(toCsv([['Flat', 'Name'], ['B-2', 'Rao, Asha'], ['A-1', 'Say "hi"'], ['C-1', 'two\nlines']])).toBe(
      'Flat,Name\r\nB-2,"Rao, Asha"\r\nA-1,"Say ""hi"""\r\nC-1,"two\nlines"',
    );
  });

  it('keeps numbers as they are', async () => {
    const { csvCell } = await import('./csv');
    expect(csvCell(190.5)).toBe('190.5');
    expect(csvCell(-3)).toBe('-3');
  });

  it('defuses spreadsheet formulas in text cells', async () => {
    const { csvCell } = await import('./csv');
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('Normal name')).toBe('Normal name');
  });
});

describe('closing-time validation', () => {
  const now = Date.parse('2026-11-10T10:00:00');
  const local = (ms: number) => {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  it('accepts a time between 5 minutes and 30 days away', async () => {
    const { validateCutoff } = await import('./validation');
    expect(validateCutoff(local(now + 3 * 3600_000), now)).toBeNull();
    expect(validateCutoff(local(now + 29 * 86400_000), now)).toBeNull();
  });

  it('rejects empty, past, too-soon and too-far times with a reason', async () => {
    const { validateCutoff } = await import('./validation');
    expect(validateCutoff('', now)).toMatch(/Choose/);
    expect(validateCutoff(local(now - 3600_000), now)).toMatch(/at least 5 minutes/);
    expect(validateCutoff(local(now + 2 * 60_000), now)).toMatch(/at least 5 minutes/);
    expect(validateCutoff(local(now + 31 * 86400_000), now)).toMatch(/within 30 days/);
  });

  it('formats an ISO time for a datetime-local input', async () => {
    const { toDatetimeLocal } = await import('./time');
    const iso = new Date(2026, 10, 12, 8, 5).toISOString();
    expect(toDatetimeLocal(iso)).toBe('2026-11-12T08:05');
    expect(toDatetimeLocal('nonsense')).toBe('');
    expect(toDatetimeLocal(undefined)).toBe('');
  });
});

describe('product form validation', () => {
  const ok = { sku: 'ATTA-5KG', name: 'Atta 5kg', basePrice: '450', imageUrl: '' };

  it('accepts a complete product, with or without a photo', async () => {
    const { validateProductForm } = await import('./validation');
    expect(validateProductForm(ok)).toBeNull();
    expect(validateProductForm({ ...ok, imageUrl: 'https://img.example/a.png' })).toBeNull();
  });

  it('rejects bad SKU, name, price and image links (including javascript: links)', async () => {
    const { validateProductForm } = await import('./validation');
    expect(validateProductForm({ ...ok, sku: 'a b' })).toMatch(/SKU/);
    expect(validateProductForm({ ...ok, name: '   ' })).toMatch(/name/);
    expect(validateProductForm({ ...ok, basePrice: '' })).toMatch(/price/);
    expect(validateProductForm({ ...ok, basePrice: '-5' })).toMatch(/price/);
    expect(validateProductForm({ ...ok, imageUrl: 'javascript:alert(1)' })).toMatch(/http/);
    expect(validateProductForm({ ...ok, imageUrl: 'ftp://x.example/a.png' })).toMatch(/http/);
  });

  it('the pool form now needs a product choice instead of a typed name', async () => {
    const { validatePoolForm } = await import('./validation');
    const base = { productSku: '', basePrice: '200', floorPrice: '140', cutoffAt: '2099-01-01T10:00', tiers: [{ minQuantity: 10, discountPercent: 5 }] };
    expect(validatePoolForm(base)).toMatch(/Choose a product/);
    expect(validatePoolForm({ ...base, productSku: 'SKU-A' })).toBeNull();
  });
});

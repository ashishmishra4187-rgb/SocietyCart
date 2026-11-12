export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const FLAT_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{0,19}$/;
export const SKU_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;

export const NAME_REGEX = /^\p{L}[\p{L} .'-]*$/u;

export const isValidName = (v: string): boolean => {
  const t = v.trim();
  return t.length >= 2 && t.length <= 60 && NAME_REGEX.test(t);
};

export const isValidPhone = (v: string): boolean => PHONE_REGEX.test(v);
export const isValidFlat = (v: string): boolean => FLAT_REGEX.test(v.trim());

export interface TierInput {
  minQuantity: number | string;
  discountPercent: number | string;
}

export const MAX_DISCOUNT = 90;
export const MAX_TIERS = 8;

/** Returns an error message, or null when the ladder is valid. */
export const validateTiers = (tiers: TierInput[]): string | null => {
  if (tiers.length === 0) return 'Add at least one discount tier.';
  let prevMin = 0;
  let prevDiscount = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t) continue;
    const min = Number(t.minQuantity);
    const disc = Number(t.discountPercent);
    if (t.minQuantity === '' || !Number.isInteger(min) || min <= 0) {
      return `Tier ${i + 1}: minimum units must be a whole number above 0.`;
    }
    if (t.discountPercent === '' || Number.isNaN(disc) || disc <= 0 || disc > MAX_DISCOUNT) {
      return `Tier ${i + 1}: discount must be between 1% and ${MAX_DISCOUNT}%.`;
    }
    if (min <= prevMin) return `Tier ${i + 1}: units must be higher than Tier ${i}.`;
    if (disc <= prevDiscount) return `Tier ${i + 1}: discount must be higher than Tier ${i}.`;
    prevMin = min;
    prevDiscount = disc;
  }
  return null;
};

export interface PoolFormInput {
  /** Ignored: the name comes from the catalog. Kept so older callers still type-check. */
  productName?: string;
  productSku: string;
  basePrice: string;
  floorPrice: string;
  cutoffAt: string;
  tiers: TierInput[];
}

export const validatePoolForm = (f: PoolFormInput, now = Date.now()): string | null => {
  if (!f.productSku.trim()) return 'Choose a product from your product list.';
  if (!SKU_REGEX.test(f.productSku.trim())) return 'SKU must be 2-64 letters, numbers, dashes or underscores.';
  const base = Number(f.basePrice);
  const floor = Number(f.floorPrice);
  if (!f.basePrice || !Number.isFinite(base) || base <= 0) return 'Enter a valid base retail price.';
  if (!f.floorPrice || !Number.isFinite(floor) || floor <= 0) return 'Enter a valid floor price.';
  if (floor >= base) return 'Floor price must be lower than the base retail price.';
  const cutoff = new Date(f.cutoffAt).getTime();
  if (!f.cutoffAt || Number.isNaN(cutoff)) return 'Choose when the pool closes.';
  if (cutoff <= now) return 'Closing time must be in the future.';
  const maxDiscountPrice = base * (1 - Math.max(0, ...f.tiers.map((t) => Number(t.discountPercent) || 0)) / 100);
  if (maxDiscountPrice < floor) return 'The top tier discount takes the price below your floor price.';
  return validateTiers(f.tiers);
};

export const IMAGE_URL_REGEX = /^https?:\/\/\S{4,490}$/;

export interface ProductFormInput {
  sku: string;
  name: string;
  basePrice: string;
  imageUrl: string;
}

/** Returns an error message, or null when the product form is valid. */
export const validateProductForm = (f: ProductFormInput): string | null => {
  if (!SKU_REGEX.test(f.sku.trim())) return 'SKU must be 2-64 letters, numbers, dashes or underscores.';
  const name = f.name.trim();
  if (name.length < 1 || name.length > 255) return 'Enter a product name (up to 255 characters).';
  const price = Number(f.basePrice);
  if (!f.basePrice || !Number.isFinite(price) || price <= 0) return 'Enter the usual shop price.';
  if (price > 1_000_000) return 'That price looks too high.';
  const image = f.imageUrl.trim();
  if (image !== '' && !IMAGE_URL_REGEX.test(image)) return 'Image link must start with http:// or https://';
  return null;
};

export const MIN_CUTOFF_MINUTES = 5;
export const MAX_CUTOFF_DAYS = 30;

/** Same rule the server applies when an admin changes a deal's closing time. */
export const validateCutoff = (localValue: string, now = Date.now()): string | null => {
  const t = new Date(localValue).getTime();
  if (!localValue || Number.isNaN(t)) return 'Choose a closing date and time.';
  if (t <= now + MIN_CUTOFF_MINUTES * 60_000) return `Closing time must be at least ${MIN_CUTOFF_MINUTES} minutes from now.`;
  if (t > now + MAX_CUTOFF_DAYS * 86_400_000) return `Closing time must be within ${MAX_CUTOFF_DAYS} days.`;
  return null;
};

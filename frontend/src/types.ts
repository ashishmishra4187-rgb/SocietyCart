export type PoolStatus = 'OPEN' | 'LOCKED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type OrderStatus = 'COMMITTED' | 'LOCKED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type ResidentRole = 'RESIDENT' | 'SOCIETY_ADMIN' | 'PLATFORM_ADMIN';

/** Society admins manage their society's pools; platform admins can manage any society. */
export const isAdminRole = (role?: ResidentRole | null): boolean => role === 'SOCIETY_ADMIN' || role === 'PLATFORM_ADMIN';

export interface PriceTier {
  minQuantity: number;
  discountPercent: number;
}

export interface PoolProgress {
  poolWindowId: string;
  /** Real catalogue SKU. Orders must be placed against this, never the pool id. */
  productSku: string;
  productName: string;
  imageUrl?: string | null;
  supplierName?: string | null;
  basePrice: number;
  currentUnitPrice: number;
  savingsPercent: number;
  aggregateQuantity: number;
  participantCount: number;
  /** Server hint; the UI derives it from tiers when absent. */
  unitsToNextTier?: number | null;
  tiers: PriceTier[];
  status: PoolStatus;
  cutoffAt: string;
  maxQuantityPerOrder?: number;
}

export interface SocietyDetails {
  id: string;
  name: string;
  city: string;
  joinCode?: string;
}

/** A society a new resident can choose while creating an account. */
export interface SocietyOption {
  id: string;
  name: string;
  city: string;
}

export interface UserSession {
  residentId: string;
  societyId: string;
  flatNumber: string;
  role?: ResidentRole;
}

export interface OrderResponse {
  orderId: string;
  poolWindowId: string;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPriceAtCommit: number;
  totalAmount: number;
  basePrice: number;
  status: OrderStatus;
  cutoffAt: string;
  createdAt: string;
  poolStatus?: PoolStatus;
  /** False while the pool is open: the price shown is today's price and can still drop. */
  priceIsFinal?: boolean;
}

export interface OrderDetailResponse extends OrderResponse {
  flatNumber?: string;
  pool?: PoolProgress;
}

export interface SupplierPOPayload {
  societyName: string;
  deliveryAddress: string;
  sku: string;
  totalQuantity: number;
  agreedUnitPrice: number;
  requiredBy: string;
  dispatchedAt?: string;
}

export interface AdminPoolDetail extends PoolProgress {
  supplierPOPayload?: SupplierPOPayload;
  dispatchedAt?: string;
}

/** A product in a society's catalog; deals are opened by picking one. */
export interface Product {
  id: string;
  societyId: string;
  sku: string;
  name: string;
  imageUrl?: string | null;
  category: string;
  unit: string;
  basePrice: number;
  active: boolean;
}

export interface PackingListLine {
  flatNumber: string;
  residentName: string;
  phone: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  status: OrderStatus;
}

/** Who gets how many units, flat by flat. */
export interface PackingList {
  poolWindowId: string;
  productName: string;
  sku: string;
  unit: string;
  totalUnits: number;
  totalAmount: number;
  lines: PackingListLine[];
}

export interface ResidentProfile {
  name: string;
  phone: string;
  flatNumber: string;
  societyId: string;
  societyName: string;
  joinCode?: string;
}

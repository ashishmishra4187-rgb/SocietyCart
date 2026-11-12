import type { PoolProgress, UserSession } from '../types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export const isPoolProgress = (v: unknown): v is PoolProgress =>
  isObj(v) &&
  typeof v.poolWindowId === 'string' &&
  typeof v.productName === 'string' &&
  typeof v.currentUnitPrice === 'number' &&
  typeof v.basePrice === 'number' &&
  typeof v.aggregateQuantity === 'number' &&
  typeof v.participantCount === 'number' &&
  typeof v.cutoffAt === 'string' &&
  typeof v.status === 'string' &&
  Array.isArray(v.tiers);

export const isUserSession = (v: unknown): v is UserSession =>
  isObj(v) &&
  typeof v.residentId === 'string' &&
  typeof v.societyId === 'string' &&
  typeof v.flatNumber === 'string';

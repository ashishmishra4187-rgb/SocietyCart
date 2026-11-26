import { getErrorMessage, getStatus } from '../lib/errors';
import axiosClient from './axiosClient';
import type { AdminPoolDetail, PackingList, PoolProgress, Product } from '../types';

export interface CreatePoolPayload {
  societyId: string;
  /** SKU of a product from the society's catalog (name, photo and unit come from the catalog). */
  productSku: string;
  basePrice: number;
  floorPrice: number;
  cutoffAt: string;
  tiers: { minQuantity: number; discountPercent: number }[];
}

export const adminListPools = async (societyId: string, page: number) => {
  try {
    const { data } = await axiosClient.get<{ pools: PoolProgress[]; total: number }>('/api/admin/pools/history', { params: { societyId, page } });
    return data;
  } catch (error) {
    // Earlier servers resolve "history" against /pools/{id} and reject the non-UUID.
    if (getStatus(error) !== 400 || getErrorMessage(error, '') !== "Invalid value for 'id'.") throw error;
    const { data } = await axiosClient.get<PoolProgress[]>('/api/admin/pools', { params: { societyId } });
    return { pools: data.slice(page * 20, (page + 1) * 20), total: data.length };
  }
};

export const adminGetPool = async (id: string): Promise<AdminPoolDetail> => {
  const { data } = await axiosClient.get<AdminPoolDetail>(`/api/admin/pools/${encodeURIComponent(id)}`);
  return data;
};

export const adminCreatePool = async (payload: CreatePoolPayload): Promise<PoolProgress> => {
  const { data } = await axiosClient.post<PoolProgress>('/api/admin/pools', payload);
  return data;
};

export const adminClosePool = async (id: string): Promise<void> => {
  await axiosClient.post(`/api/admin/pools/${encodeURIComponent(id)}/close`);
};

export const adminDeliverPool = async (id: string): Promise<void> => {
  await axiosClient.post(`/api/admin/pools/${encodeURIComponent(id)}/deliver`);
};

export interface ProductPayload {
  societyId: string;
  sku: string;
  name: string;
  imageUrl?: string;
  category?: string;
  unit?: string;
  basePrice: number;
}

export type ProductPatch = Partial<Pick<Product, 'name' | 'imageUrl' | 'category' | 'unit' | 'basePrice' | 'active'>>;

export const adminListProducts = async (societyId: string): Promise<Product[]> => {
  const { data } = await axiosClient.get<Product[]>('/api/admin/products', { params: { societyId } });
  return data;
};

export const adminCreateProduct = async (payload: ProductPayload): Promise<Product> => {
  const { data } = await axiosClient.post<Product>('/api/admin/products', payload);
  return data;
};

export const adminUpdateProduct = async (id: string, patch: ProductPatch): Promise<Product> => {
  const { data } = await axiosClient.patch<Product>(`/api/admin/products/${encodeURIComponent(id)}`, patch);
  return data;
};

/** Change when an open deal closes. */
export const adminUpdateCutoff = async (id: string, cutoffAt: string): Promise<PoolProgress> => {
  const { data } = await axiosClient.patch<PoolProgress>(`/api/admin/pools/${encodeURIComponent(id)}`, { cutoffAt });
  return data;
};

export const adminCancelPool = async (id: string): Promise<void> => {
  await axiosClient.post(`/api/admin/pools/${encodeURIComponent(id)}/cancel`);
};

export const adminPackingList = async (id: string): Promise<PackingList> => {
  const { data } = await axiosClient.get<PackingList>(`/api/admin/pools/${encodeURIComponent(id)}/packing-list`);
  return data;
};

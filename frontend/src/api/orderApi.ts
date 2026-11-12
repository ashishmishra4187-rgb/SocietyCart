import axiosClient from './axiosClient';
import type { OrderDetailResponse, OrderResponse, PoolProgress } from '../types';

export type { OrderResponse } from '../types';

export interface OrderItemPayload {
  sku: string;
  quantity: number;
}

export interface CreateOrderPayload {
  residentId: string;
  flatNumber: string;
  items: OrderItemPayload[];
}

/**
 * `idempotencyKey` is generated once per checkout attempt so a double-tap or a retry after a
 * flaky network can never create two orders.
 */
export const createOrder = async (
  poolId: string,
  payload: CreateOrderPayload,
  idempotencyKey: string,
): Promise<PoolProgress> => {
  const { data } = await axiosClient.post<PoolProgress>(`/api/pools/${encodeURIComponent(poolId)}/orders`, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
};

export const cancelOrder = async (poolId: string, orderId: string): Promise<void> => {
  await axiosClient.delete(`/api/pools/${encodeURIComponent(poolId)}/orders/${encodeURIComponent(orderId)}`);
};

export const myOrders = async (): Promise<OrderResponse[]> => {
  const { data } = await axiosClient.get<OrderResponse[]>('/api/orders/me');
  return data;
};

export const getOrder = async (orderId: string): Promise<OrderDetailResponse> => {
  const { data } = await axiosClient.get<OrderDetailResponse>(`/api/orders/${encodeURIComponent(orderId)}`);
  return data;
};

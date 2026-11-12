import axiosClient from './axiosClient';
import type { PoolProgress, SocietyDetails } from '../types';

export const getPool = async (poolId: string): Promise<PoolProgress> => {
  const { data } = await axiosClient.get<PoolProgress>(`/api/pools/${encodeURIComponent(poolId)}`);
  return data;
};

export const getSocietyPools = async (societyId: string): Promise<PoolProgress[]> => {
  const { data } = await axiosClient.get<PoolProgress[]>(`/api/pools/society/${encodeURIComponent(societyId)}`);
  return data;
};

export const getSociety = async (societyId: string): Promise<SocietyDetails> => {
  const { data } = await axiosClient.get<SocietyDetails>(`/api/societies/${encodeURIComponent(societyId)}`);
  return data;
};

export const getMySocieties = async (): Promise<SocietyDetails[]> => {
  const { data } = await axiosClient.get<SocietyDetails[]>('/api/societies');
  return data;
};

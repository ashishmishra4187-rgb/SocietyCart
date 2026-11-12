import { useQuery } from '@tanstack/react-query';
import { getMySocieties, getPool, getSociety, getSocietyPools } from '../api/poolApi';
import type { PoolProgress, SocietyDetails } from '../types';

export type { SocietyDetails } from '../types';

export const useSocietyDetails = (societyId?: string) =>
  useQuery<SocietyDetails>({
    queryKey: ['society', societyId],
    queryFn: () => getSociety(societyId as string),
    enabled: Boolean(societyId),
    staleTime: 5 * 60 * 1000,
  });

export const useMySocieties = () =>
  useQuery<SocietyDetails[]>({ queryKey: ['societies', 'mine'], queryFn: getMySocieties, staleTime: 10 * 60 * 1000 });

export const usePoolList = (societyId?: string) =>
  useQuery<PoolProgress[]>({
    queryKey: ['pools', 'society', societyId],
    queryFn: () => getSocietyPools(societyId as string),
    enabled: Boolean(societyId),
    staleTime: 30 * 1000,
  });

export const usePool = (poolId?: string) =>
  useQuery<PoolProgress>({
    queryKey: ['pool', poolId],
    queryFn: () => getPool(poolId as string),
    enabled: Boolean(poolId),
    refetchOnMount: 'always',
  });

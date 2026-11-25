import { useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { resolveBrokerUrl } from './useStompWebSocket';
import { isPoolProgress } from '../lib/guards';
import type { PoolProgress } from '../types';

export const useSocietyPoolsLive = (societyId?: string): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const queryKey = ['pools', 'society', societyId];
    const refresh = () => void queryClient.invalidateQueries({ queryKey });

    // If an HTTP snapshot overlaps an event it can overwrite newer prices.
    // Reconcile once after that snapshot finishes, regardless of the number of events.
    let reconcile = false;
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (!reconcile || event.type !== 'updated' || event.action.type !== 'success' ||
          event.action.manual || event.query !== queryClient.getQueryCache().find({ queryKey, exact: true })) return;
      reconcile = false;
      refresh();
    });

    const client = new Client({
      brokerURL: resolveBrokerUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        client.subscribe(`/topic/societies/${societyId}/pools`, ({ body }) => {
          let pool: unknown;
          try { pool = JSON.parse(body); } catch { return; }
          if (!isPoolProgress(pool)) return;
          if (queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching') reconcile = true;
          const update = pool;
          queryClient.setQueryData<PoolProgress[]>(queryKey, previous => {
            if (!previous) return previous; // The initial snapshot supplies the complete list.
            if (update.status !== 'OPEN') return previous.filter(p => p.poolWindowId !== update.poolWindowId);
            if (!previous.some(p => p.poolWindowId === update.poolWindowId)) return [update, ...previous];
            return previous.map(p => p.poolWindowId === update.poolWindowId ? update : p);
          });
        });
        refresh();
      },
    });

    client.activate();
    return () => {
      unsubscribe();
      void client.deactivate();
    };
  }, [societyId, queryClient]);
};
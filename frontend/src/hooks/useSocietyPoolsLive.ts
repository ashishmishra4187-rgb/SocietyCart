import { useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { resolveBrokerUrl } from './useStompWebSocket';

/**
 * Keeps a society's deal list fresh. The backend announces every new or changed deal on
 * `/topic/societies/{societyId}/pools`; we simply refetch the list when that happens, so a deal an admin has just
 * opened appears on residents' screens without a reload. Reconnects automatically and refetches on every
 * (re)connect to catch anything missed while offline.
 */
export const useSocietyPoolsLive = (societyId?: string): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['pools', 'society', societyId] });

    const client = new Client({
      brokerURL: resolveBrokerUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        refresh();
        client.subscribe(`/topic/societies/${societyId}/pools`, refresh);
      },
    });

    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [societyId, queryClient]);
};
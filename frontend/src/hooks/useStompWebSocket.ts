import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { isPoolProgress } from '../lib/guards';
import type { PoolProgress } from '../types';

const resolveBrokerUrl = (): string => {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
};

/**
 * Subscribes to `/topic/pools/{poolId}` and writes every update into the React Query cache under
 * ['pool', poolId], so every screen showing that pool (details, checkout) stays in sync.
 *
 * - Reconnects automatically (stomp-js reconnectDelay) and refetches on each (re)connect to
 *   recover any updates missed while offline.
 * - Malformed frames are ignored, never thrown.
 * - Fully cleaned up on unmount / pool change.
 */
export const useStompWebSocket = (poolId?: string): { connected: boolean } => {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!poolId) return;

    const client = new Client({
      brokerURL: resolveBrokerUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        setConnected(true);
        void queryClient.invalidateQueries({ queryKey: ['pool', poolId] });
        client.subscribe(`/topic/pools/${poolId}`, (message) => {
          try {
            const data: unknown = JSON.parse(message.body);
            if (isPoolProgress(data)) queryClient.setQueryData<PoolProgress>(['pool', poolId], data);
          } catch {
            /* ignore malformed frame */
          }
        });
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();
    return () => {
      setConnected(false);
      void client.deactivate();
    };
  }, [poolId, queryClient]);

  return { connected };
};

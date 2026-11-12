import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makePool } from '../test/utils';

interface FakeConfig {
  brokerURL: string;
  onConnect: () => void;
  onWebSocketClose: () => void;
}
const h = vi.hoisted(() => ({
  config: null as unknown as FakeConfig,
  handler: null as null | ((m: { body: string }) => void),
  topic: '',
  activate: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    constructor(cfg: FakeConfig) {
      h.config = cfg;
    }
    activate = h.activate;
    deactivate = h.deactivate;
    subscribe(topic: string, cb: (m: { body: string }) => void) {
      h.topic = topic;
      h.handler = cb;
    }
  },
}));

import { useStompWebSocket } from './useStompWebSocket';

const setup = () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useStompWebSocket('pool-123'), { wrapper });
  return { client, ...hook };
};

describe('useStompWebSocket', () => {
  beforeEach(() => vi.clearAllMocks());

  it('connects, subscribes to the pool topic and reports connection state', () => {
    const { result } = setup();
    expect(h.activate).toHaveBeenCalled();
    expect(h.config.brokerURL).toMatch(/^wss?:\/\/.+\/ws$/);
    expect(result.current.connected).toBe(false);
    act(() => h.config.onConnect());
    expect(h.topic).toBe('/topic/pools/pool-123');
    expect(result.current.connected).toBe(true);
    act(() => h.config.onWebSocketClose());
    expect(result.current.connected).toBe(false);
  });

  it('writes valid frames into the shared pool cache and ignores bad ones', () => {
    const { client } = setup();
    act(() => h.config.onConnect());
    const live = makePool({ aggregateQuantity: 31, currentUnitPrice: 130 });
    act(() => h.handler!({ body: JSON.stringify(live) }));
    expect(client.getQueryData(['pool', 'pool-123'])).toEqual(live);

    act(() => h.handler!({ body: '{broken' }));
    act(() => h.handler!({ body: JSON.stringify({ hello: 'world' }) }));
    expect(client.getQueryData(['pool', 'pool-123'])).toEqual(live);
  });

  it('deactivates the socket on unmount', () => {
    const { unmount } = setup();
    unmount();
    expect(h.deactivate).toHaveBeenCalled();
  });
});

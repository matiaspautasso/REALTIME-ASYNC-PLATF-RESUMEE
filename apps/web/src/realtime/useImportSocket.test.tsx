import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ImportEvents } from '@jobflow/contracts';

// A fake Socket.IO socket whose registered handlers we can fire by hand.
const { handlers, emits, io } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const emits: Array<{ event: string; payload: unknown }> = [];
  const socket = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    },
    off: () => {},
    emit: (event: string, payload: unknown) => {
      emits.push({ event, payload });
    },
    disconnect: () => {},
  };
  return { handlers, emits, io: vi.fn(() => socket) };
});

vi.mock('socket.io-client', () => ({ io }));

// Imported AFTER the mock is registered.
import { useImportSocket } from './useImportSocket';

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useImportSocket', () => {
  beforeEach(() => {
    for (const key of Object.keys(handlers)) delete handlers[key];
    emits.length = 0;
  });

  it('re-fetches GET /imports/:id via REST on (re)connect before trusting deltas', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    renderHook(() => useImportSocket('imp-1'), { wrapper: wrapper(client) });

    // Connection not established yet: no invalidation.
    expect(invalidate).not.toHaveBeenCalled();

    // Simulate the socket connecting (same path a reconnect takes).
    handlers['connect']?.();

    // It re-joined the room and invalidated the detail query.
    expect(emits).toContainEqual({
      event: ImportEvents.Subscribe,
      payload: { importId: 'imp-1' },
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['imports', 'detail', 'imp-1'],
    });
  });
});

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import {
  IMPORTS_NAMESPACE,
  ImportEvents,
  isTerminal,
  type ImportDetail,
  type ImportEventPayload,
} from '@jobflow/contracts';
import { API_URL } from '../api/client';
import { qk } from '../api/queryKeys';

/**
 * Subscribe to one Import's realtime room and keep its React Query cache live.
 *
 * REST is the source of truth (ADR-0006); these deltas only notify. Two rules
 * encode that:
 *
 *  1. On connect AND on every reconnect we re-join the room and INVALIDATE the
 *     detail query, forcing a fresh `GET /imports/:id` before we trust any
 *     further delta — we may have missed events while disconnected
 *     (mandatory scenario 6).
 *  2. Progress deltas patch the cached detail for an instant progress bar, but
 *     terminal events (completed / failed) invalidate detail, errors and
 *     attempts so the authoritative REST state replaces the notification.
 */
export function useImportSocket(importId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!importId) return;

    const socket: Socket = io(`${API_URL}${IMPORTS_NAMESPACE}`, {
      transports: ['websocket'],
    });

    const subscribe = () => {
      socket.emit(ImportEvents.Subscribe, { importId });
    };

    const onConnect = () => {
      // Re-join the room, then refetch REST before trusting deltas.
      subscribe();
      void queryClient.invalidateQueries({ queryKey: qk.importDetail(importId) });
    };

    const applyDelta = (payload: ImportEventPayload) => {
      if (payload.importId !== importId) return;

      queryClient.setQueryData<ImportDetail>(qk.importDetail(importId), (prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              progress: payload.progress,
              processedRows: payload.processedRows,
              totalRows: payload.totalRows,
              successRows: payload.successRows,
              failedRows: payload.failedRows,
            }
          : prev,
      );

      if (isTerminal(payload.status)) {
        // Pull authoritative detail + the now-final errors and attempts.
        void queryClient.invalidateQueries({
          queryKey: qk.importDetail(importId),
        });
        void queryClient.invalidateQueries({
          queryKey: ['imports', 'errors', importId],
        });
        void queryClient.invalidateQueries({
          queryKey: qk.importAttempts(importId),
        });
      }
    };

    socket.on('connect', onConnect);
    socket.on(ImportEvents.Progress, applyDelta);
    socket.on(ImportEvents.Completed, applyDelta);
    socket.on(ImportEvents.Failed, applyDelta);
    socket.on(ImportEvents.Retrying, applyDelta);

    return () => {
      socket.off('connect', onConnect);
      socket.disconnect();
    };
  }, [importId, queryClient]);
}

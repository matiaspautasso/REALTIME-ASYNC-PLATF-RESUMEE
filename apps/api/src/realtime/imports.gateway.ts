import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  IMPORTS_NAMESPACE,
  ImportEvents,
  type ImportEventName,
  type ImportEventPayload,
  type ImportSubscribePayload,
} from '@jobflow/contracts';

/**
 * Socket.IO gateway for the Imports namespace (RF-06). A client joins one
 * Import's room with `import:subscribe` and then receives only that Import's
 * events. The gateway only notifies — REST stays the source of truth (ADR-0006)
 * — so subscribing joins a room and mutates no state.
 */
@WebSocketGateway({ namespace: IMPORTS_NAMESPACE, cors: { origin: '*' } })
export class ImportsGateway {
  private readonly logger = new Logger(ImportsGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  @SubscribeMessage(ImportEvents.Subscribe)
  handleSubscribe(@MessageBody() payload: ImportSubscribePayload, @ConnectedSocket() client: Socket): void {
    if (payload?.importId) {
      void client.join(payload.importId);
    }
  }

  /** Emit one lifecycle event to the Import's room. */
  broadcast(event: ImportEventName, payload: ImportEventPayload): void {
    this.server.to(payload.importId).emit(event, payload);
    this.logger.debug(`${event} → room ${payload.importId} (${payload.progress}%)`);
  }
}

import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { ImportEvents, ImportStatus, type ImportEventPayload } from '@jobflow/contracts';
import { AppModule } from '../src/app.module';
import { ImportsGateway } from '../src/realtime/imports.gateway';

function payloadFor(importId: string): ImportEventPayload {
  return { importId, status: ImportStatus.PROCESSING, progress: 50, processedRows: 1, totalRows: 2, successRows: 1, failedRows: 0 };
}

function connect(port: number): Socket {
  return io(`http://localhost:${port}/imports`, { transports: ['websocket'], forceNew: true });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function subscribed(socket: Socket, importId: string): Promise<void> {
  return new Promise((resolve) => {
    socket.emit(ImportEvents.Subscribe, { importId });
    // the join is processed server-side on the next tick; give it a beat
    setTimeout(resolve, 100);
  });
}

describe('Realtime gateway (e2e)', () => {
  let app: INestApplication;
  let gateway: ImportsGateway;
  let port: number;

  beforeAll(async () => {
    process.env.QUEUE_EVENTS_DISABLED = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    gateway = app.get(ImportsGateway);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers an import event only to clients subscribed to that import room', async () => {
    const clientA = connect(port);
    const clientB = connect(port);
    await Promise.all([once(clientA, 'connect'), once(clientB, 'connect')]);
    await Promise.all([subscribed(clientA, 'imp_A'), subscribed(clientB, 'imp_B')]);

    const receivedA = once<ImportEventPayload>(clientA, ImportEvents.Progress);
    let bReceived = false;
    clientB.on(ImportEvents.Progress, () => {
      bReceived = true;
    });

    gateway.broadcast(ImportEvents.Progress, payloadFor('imp_A'));

    const payload = await receivedA;
    expect(payload).toMatchObject({ importId: 'imp_A', progress: 50, status: ImportStatus.PROCESSING });
    expect(bReceived).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('carries the full lifecycle payload shape to the subscribed client', async () => {
    const client = connect(port);
    await once(client, 'connect');
    await subscribed(client, 'imp_C');

    const received = once<ImportEventPayload>(client, ImportEvents.Completed);
    gateway.broadcast(ImportEvents.Completed, {
      importId: 'imp_C',
      status: ImportStatus.COMPLETED,
      progress: 100,
      processedRows: 10,
      totalRows: 10,
      successRows: 10,
      failedRows: 0,
    });

    const payload = await received;
    expect(payload).toEqual({
      importId: 'imp_C',
      status: ImportStatus.COMPLETED,
      progress: 100,
      processedRows: 10,
      totalRows: 10,
      successRows: 10,
      failedRows: 0,
    });

    client.disconnect();
  });
});

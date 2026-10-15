import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculateProgress,
  ImportStatus,
  toImportEventPayload,
  validateProductRow,
  type ImportEventPayload,
  type ImportJobData,
  type RowError,
  type ValidProduct,
} from '@jobflow/contracts';
import { prisma, runInTransaction, type ImportJob, type TransactionClient } from '@jobflow/database';
import { streamCsvBatches } from '../csv/csv-batch-reader';
import { StructuredLogger } from '../logging/structured-logger';
import { resolveTerminalStatus } from './terminal-status';

/** What BullMQ knows about the current execution of a job. */
export interface AttemptContext {
  attemptNumber: number;
  isLastAttempt: boolean;
}

/**
 * Processes one Import end to end (TICKET-04.1–04.5): opens a JobAttempt,
 * streams the CSV in Batches, and for each Batch commits — in ONE transaction —
 * the upserts, the Data Errors, the counters and the Checkpoint. It resumes
 * after the last committed Batch (ADR-0005) and persists the terminal status
 * before any completion signal (ADR-0006).
 *
 * Error model: a Data Error is a value, never thrown, so it never retries. A
 * thrown error is an Infrastructure Error — the Attempt is marked FAILED and
 * the error re-thrown so BullMQ retries; on the last attempt the Import is set
 * FAILED.
 */
@Injectable()
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);
  private readonly slog = new StructuredLogger({ component: 'worker' });

  constructor(private readonly config: ConfigService) {}

  async process(
    data: ImportJobData,
    attempt: AttemptContext,
    onProgress?: (payload: ImportEventPayload) => void,
  ): Promise<ImportEventPayload> {
    const batchSize = this.config.get<number>('import.batchSize') ?? 100;

    const log = this.slog.child({ importId: data.importId, attemptNumber: attempt.attemptNumber });
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: data.importId } });
    const resumeFrom = job.committedBatches;

    await prisma.jobAttempt.create({
      data: { importJobId: job.id, attemptNumber: attempt.attemptNumber, status: 'RUNNING' },
    });
    await prisma.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
    log.info('attempt.started', { resumeFromBatch: resumeFrom });

    try {
      let batchIndex = 0;
      for await (const batch of streamCsvBatches(data.filePath, batchSize)) {
        if (batchIndex < resumeFrom) {
          batchIndex += 1;
          continue; // already committed before the Checkpoint — skip to avoid double-counting
        }

        const valid: ValidProduct[] = [];
        const errors: RowError[] = [];
        batch.rows.forEach((raw, offset) => {
          const result = validateProductRow(raw, batch.firstRowNumber + offset);
          if (result.ok) {
            valid.push(result.product);
          } else {
            errors.push(result.error);
          }
        });

        const startedAt = Date.now();
        const committed = await runInTransaction((tx) =>
          this.commitBatch(tx, { importJobId: job.id, batchIndex, totalRows: job.totalRows, valid, errors }),
        );
        log.info('batch.committed', {
          batchIndex,
          rows: batch.rows.length,
          success: valid.length,
          failed: errors.length,
          durationMs: Date.now() - startedAt,
          progress: committed.progress,
        });
        onProgress?.(toPayload(committed)); // worker → QueueEvents → gateway (ADR-0002/0006)
        batchIndex += 1;
      }

      const terminal = await this.finish(job.id, attempt.attemptNumber);
      log.info('import.finished', { status: terminal.status, successRows: terminal.successRows, failedRows: terminal.failedRows });
      return terminal;
    } catch (error) {
      await this.fail(job.id, attempt, error);
      log.error('attempt.failed', {
        isLastAttempt: attempt.isLastAttempt,
        cause: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Commit one Batch atomically: upserts, Data Errors, counters and Checkpoint. */
  private async commitBatch(
    tx: TransactionClient,
    params: { importJobId: string; batchIndex: number; totalRows: number; valid: ValidProduct[]; errors: RowError[] },
  ): Promise<ImportJob> {
    const current = await tx.importJob.findUniqueOrThrow({ where: { id: params.importJobId } });
    if (current.committedBatches !== params.batchIndex) {
      return current; // another execution already committed this Batch — idempotent no-op (ADR-0005)
    }

    for (const product of params.valid) {
      await tx.product.upsert({
        where: { sku: product.sku },
        create: { sku: product.sku, name: product.name, price: product.price, stock: product.stock },
        update: { name: product.name, price: product.price, stock: product.stock },
      });
    }

    if (params.errors.length > 0) {
      await tx.importError.createMany({
        data: params.errors.map((e) => ({
          importJobId: params.importJobId,
          rowNumber: e.rowNumber,
          errorCode: e.code,
          message: e.message,
        })),
      });
    }

    const processedRows = current.processedRows + params.valid.length + params.errors.length;
    return tx.importJob.update({
      where: { id: params.importJobId },
      data: {
        processedRows,
        successRows: current.successRows + params.valid.length,
        failedRows: current.failedRows + params.errors.length,
        committedBatches: current.committedBatches + 1,
        progress: calculateProgress(processedRows, params.totalRows),
      },
    });
  }

  /** Resolve and PERSIST the terminal status before any completion signal
   * (ADR-0006), then return the terminal snapshot for the completion event. */
  private async finish(importJobId: string, attemptNumber: number): Promise<ImportEventPayload> {
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    const terminal = await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: resolveTerminalStatus(job.failedRows),
        progress: calculateProgress(job.processedRows, job.totalRows),
      },
    });
    await prisma.jobAttempt.updateMany({
      where: { importJobId, attemptNumber },
      data: { status: 'SUCCEEDED', finishedAt: new Date() },
    });
    return toPayload(terminal);
  }

  private async fail(importJobId: string, attempt: AttemptContext, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Import ${importJobId} attempt ${attempt.attemptNumber} failed: ${message}`);
    await prisma.jobAttempt.updateMany({
      where: { importJobId, attemptNumber: attempt.attemptNumber },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: message },
    });
    if (attempt.isLastAttempt) {
      await prisma.importJob.update({ where: { id: importJobId }, data: { status: ImportStatus.FAILED } });
    }
  }
}

/** Build the wire payload from a Prisma ImportJob, bridging its enum to the
 * contracts enum (same string values, nominally distinct types). */
function toPayload(job: ImportJob): ImportEventPayload {
  return toImportEventPayload({ ...job, status: job.status as unknown as ImportStatus });
}

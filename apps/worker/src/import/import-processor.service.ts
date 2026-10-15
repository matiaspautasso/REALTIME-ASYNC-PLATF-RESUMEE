import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculateProgress,
  ImportStatus,
  validateProductRow,
  type ImportJobData,
  type RowError,
  type ValidProduct,
} from '@jobflow/contracts';
import { prisma, runInTransaction, type TransactionClient } from '@jobflow/database';
import { streamCsvBatches } from '../csv/csv-batch-reader';
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

  constructor(private readonly config: ConfigService) {}

  async process(data: ImportJobData, attempt: AttemptContext): Promise<void> {
    const batchSize = this.config.get<number>('import.batchSize') ?? 100;

    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: data.importId } });
    const resumeFrom = job.committedBatches;

    await prisma.jobAttempt.create({
      data: { importJobId: job.id, attemptNumber: attempt.attemptNumber, status: 'RUNNING' },
    });
    await prisma.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

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

        await runInTransaction((tx) =>
          this.commitBatch(tx, { importJobId: job.id, batchIndex, totalRows: job.totalRows, valid, errors }),
        );
        batchIndex += 1;
      }

      await this.finish(job.id, attempt.attemptNumber);
    } catch (error) {
      await this.fail(job.id, attempt, error);
      throw error;
    }
  }

  /** Commit one Batch atomically: upserts, Data Errors, counters and Checkpoint. */
  private async commitBatch(
    tx: TransactionClient,
    params: { importJobId: string; batchIndex: number; totalRows: number; valid: ValidProduct[]; errors: RowError[] },
  ): Promise<void> {
    const current = await tx.importJob.findUniqueOrThrow({ where: { id: params.importJobId } });
    if (current.committedBatches !== params.batchIndex) {
      return; // another execution already committed this Batch — idempotent no-op (ADR-0005)
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
    await tx.importJob.update({
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

  /** Resolve and PERSIST the terminal status before any completion signal (ADR-0006). */
  private async finish(importJobId: string, attemptNumber: number): Promise<void> {
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    await prisma.importJob.update({
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

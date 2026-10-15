import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateImportResponse,
  ImportDetail,
  ImportErrorCode,
  ImportErrorItem,
  ImportStatus,
  ImportSummary,
  JobAttemptItem,
  JobAttemptStatus,
  Paginated,
  type ImportJobData,
} from '@jobflow/contracts';
import { Prisma, prisma, type ImportError, type ImportJob, type JobAttempt } from '@jobflow/database';
import { PageParams, buildPaginated, toSkipTake } from '../common/pagination';
import { inspectCsv } from './csv-inspector';

/** The subset of a Multer upload the importer needs (avoids the flaky global
 * Express.Multer.File augmentation). */
export interface UploadedCsvFile {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class ImportsService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Validate the uploaded CSV, store it on the shared volume (ADR-0003), and
   * persist the ImportJob together with its Outbox row in ONE transaction
   * (ADR-0004). The relay later publishes the Outbox row to the queue.
   */
  async createFromUpload(file: UploadedCsvFile): Promise<CreateImportResponse> {
    const { totalRows } = inspectCsv(file.buffer.toString('utf8'));

    const uploadDir = this.config.get<string>('upload.dir') ?? './data/uploads';
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, `${randomUUID()}.csv`);
    await writeFile(filePath, file.buffer);

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.importJob.create({
        data: {
          fileName: file.originalname || 'upload.csv',
          filePath,
          totalRows,
          status: 'QUEUED',
        },
      });
      const payload: ImportJobData = { importId: created.id, filePath };
      await tx.outbox.create({
        data: { importJobId: created.id, payload: payload as unknown as Prisma.InputJsonValue },
      });
      return created;
    });

    return { id: job.id, status: ImportStatus.QUEUED, progress: 0, totalRows: job.totalRows };
  }

  async getHistory(params: PageParams): Promise<Paginated<ImportSummary>> {
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await prisma.$transaction([
      prisma.importJob.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.importJob.count(),
    ]);
    return buildPaginated(rows.map(toSummary), total, params);
  }

  async getDetail(id: string): Promise<ImportDetail> {
    return toDetail(await this.getJobOrThrow(id));
  }

  async getErrors(id: string, params: PageParams): Promise<Paginated<ImportErrorItem>> {
    await this.getJobOrThrow(id);
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await prisma.$transaction([
      prisma.importError.findMany({ where: { importJobId: id }, orderBy: { rowNumber: 'asc' }, skip, take }),
      prisma.importError.count({ where: { importJobId: id } }),
    ]);
    return buildPaginated(rows.map(toErrorItem), total, params);
  }

  /** The Job Attempt history of one Import, oldest first (RF for 06.4). */
  async getAttempts(id: string): Promise<JobAttemptItem[]> {
    await this.getJobOrThrow(id);
    const attempts = await prisma.jobAttempt.findMany({
      where: { importJobId: id },
      orderBy: { attemptNumber: 'asc' },
    });
    return attempts.map(toAttemptItem);
  }

  /** All Import Errors of one import as CSV rows (header included). */
  async getErrorsCsv(id: string): Promise<string> {
    await this.getJobOrThrow(id);
    const rows = await prisma.importError.findMany({
      where: { importJobId: id },
      orderBy: { rowNumber: 'asc' },
    });
    const lines = ['rowNumber,errorCode,message'];
    for (const row of rows) {
      lines.push(`${row.rowNumber},${row.errorCode},${csvEscape(row.message)}`);
    }
    return lines.join('\n') + '\n';
  }

  /**
   * Re-queue a terminally FAILED import (RF-10). Counters and the checkpoint are
   * kept so the worker resumes after the last committed Batch (ADR-0005); a new
   * Outbox row is written, which the relay publishes as a fresh job.
   */
  async retry(id: string): Promise<CreateImportResponse> {
    const job = await this.getJobOrThrow(id);
    if (job.status !== 'FAILED') {
      throw new ConflictException(`Import ${id} is ${job.status}; only FAILED imports can be retried`);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.importJob.update({ where: { id }, data: { status: 'QUEUED' } });
      const payload: ImportJobData = { importId: id, filePath: job.filePath };
      await tx.outbox.create({
        data: { importJobId: id, payload: payload as unknown as Prisma.InputJsonValue },
      });
      return next;
    });
    return {
      id,
      status: ImportStatus.QUEUED,
      progress: updated.progress,
      totalRows: updated.totalRows,
    };
  }

  private async getJobOrThrow(id: string): Promise<ImportJob> {
    const job = await prisma.importJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Import ${id} not found`);
    }
    return job;
  }
}

function toAttemptItem(attempt: JobAttempt): JobAttemptItem {
  return {
    attemptNumber: attempt.attemptNumber,
    status: attempt.status as unknown as JobAttemptStatus,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt ? attempt.finishedAt.toISOString() : null,
    errorMessage: attempt.errorMessage ?? null,
  };
}

function toErrorItem(error: ImportError): ImportErrorItem {
  return {
    rowNumber: error.rowNumber,
    errorCode: error.errorCode as ImportErrorCode,
    message: error.message,
  };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toSummary(job: ImportJob): ImportSummary {
  return {
    id: job.id,
    fileName: job.fileName,
    status: job.status as unknown as ImportStatus,
    progress: job.progress,
    totalRows: job.totalRows,
    failedRows: job.failedRows,
    createdAt: job.createdAt.toISOString(),
  };
}

function toDetail(job: ImportJob): ImportDetail {
  return {
    id: job.id,
    fileName: job.fileName,
    status: job.status as unknown as ImportStatus,
    progress: job.progress,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

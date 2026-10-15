import { ImportStatus } from './import-status';
import { ImportErrorCode } from './import-error-code';

/**
 * Shared REST request/response shapes. These are the contract between the API
 * and the web client; they mirror docs/api.md exactly. Timestamps are ISO 8601
 * strings because these types travel as JSON over the wire.
 */

/** 202 Accepted body returned by `POST /imports`. */
export interface CreateImportResponse {
  id: string;
  status: ImportStatus;
  progress: number;
  totalRows: number;
}

/** Full status and metrics of one Import — `GET /imports/:id`. */
export interface ImportDetail {
  id: string;
  fileName: string;
  status: ImportStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  updatedAt: string;
}

/** A row in the paginated history — `GET /imports`. */
export interface ImportSummary {
  id: string;
  fileName: string;
  status: ImportStatus;
  progress: number;
  totalRows: number;
  failedRows: number;
  createdAt: string;
}

/** A row-level Import Error — `GET /imports/:id/errors`. */
export interface ImportErrorItem {
  rowNumber: number;
  errorCode: ImportErrorCode;
  message: string;
}

/** The outcome of one technical Job Attempt (mirrors the DB `JobAttemptStatus`). */
export type JobAttemptStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** One Job Attempt in an Import's attempt history — `GET /imports/:id/attempts`. */
export interface JobAttemptItem {
  attemptNumber: number;
  status: JobAttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

/** An imported Product — `GET /products`. */
export interface ProductListItem {
  sku: string;
  name: string;
  price: number;
  stock: number;
  updatedAt: string;
}

/** Generic pagination envelope used by every list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Pagination query params shared by the list endpoints. */
export interface PaginationQuery {
  page: number;
  pageSize: number;
}

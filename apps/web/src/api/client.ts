import type {
  CreateImportResponse,
  ImportDetail,
  ImportErrorItem,
  ImportSummary,
  JobAttemptItem,
  Paginated,
} from '@jobflow/contracts';

/** Backend origin. Configured per environment via VITE_API_URL (see .env.example). */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * An error carrying the API's machine-readable `code` and human `message`.
 * The upload screen (06.3) surfaces `message` without leaving the page.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'UNKNOWN';
  let message = `Request failed with status ${res.status}`;
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    if (body.code) code = body.code;
    if (body.message) message = body.message;
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  return new ApiError(res.status, code, message);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

function qs(page: number, pageSize: number): string {
  return `?page=${page}&pageSize=${pageSize}`;
}

export const api = {
  /** POST /imports — multipart upload of a single CSV file. 202 on accept. */
  async createImport(file: File): Promise<CreateImportResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/imports`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as CreateImportResponse;
  },

  /** GET /imports — paginated history, newest first. */
  listImports(page: number, pageSize: number): Promise<Paginated<ImportSummary>> {
    return getJson<Paginated<ImportSummary>>(`/imports${qs(page, pageSize)}`);
  },

  /** GET /imports/:id — full detail; the source of truth for an import. */
  getImport(id: string): Promise<ImportDetail> {
    return getJson<ImportDetail>(`/imports/${id}`);
  },

  /** GET /imports/:id/attempts — technical attempt history, oldest first. */
  getAttempts(id: string): Promise<JobAttemptItem[]> {
    return getJson<JobAttemptItem[]>(`/imports/${id}/attempts`);
  },

  /** GET /imports/:id/errors — paginated row-level data errors. */
  getErrors(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ImportErrorItem>> {
    return getJson<Paginated<ImportErrorItem>>(
      `/imports/${id}/errors${qs(page, pageSize)}`,
    );
  },

  /** POST /imports/:id/retry — re-queue a FAILED import. 409 if not FAILED. */
  async retryImport(id: string): Promise<CreateImportResponse> {
    const res = await fetch(`${API_URL}/imports/${id}/retry`, {
      method: 'POST',
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as CreateImportResponse;
  },

  /** Absolute URL of the errors.csv export, for a browser-triggered download. */
  errorsCsvUrl(id: string): string {
    return `${API_URL}/imports/${id}/errors.csv`;
  },
};

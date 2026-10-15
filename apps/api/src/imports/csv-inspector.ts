/** Synchronous, content-level validation of an uploaded CSV before it becomes
 * an Import. Row-level business rules live in @jobflow/contracts and run later
 * in the worker; this only checks the file is shaped like a product CSV. */

export const REQUIRED_COLUMNS = ['sku', 'name', 'price', 'stock'] as const;
export const MAX_ROWS = 10_000;

export enum CsvValidationErrorCode {
  EMPTY = 'EMPTY',
  MISSING_COLUMNS = 'MISSING_COLUMNS',
  TOO_MANY_ROWS = 'TOO_MANY_ROWS',
}

export class CsvValidationError extends Error {
  constructor(
    public readonly code: CsvValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CsvValidationError';
  }
}

export interface CsvInspection {
  totalRows: number;
}

export function inspectCsv(content: string): CsvInspection {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    throw new CsvValidationError(CsvValidationErrorCode.EMPTY, 'CSV file is empty');
  }

  const header = lines[0]!.split(',').map((column) => column.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new CsvValidationError(
      CsvValidationErrorCode.MISSING_COLUMNS,
      `Missing required column(s): ${missing.join(', ')}`,
    );
  }

  const totalRows = lines.length - 1;
  if (totalRows === 0) {
    throw new CsvValidationError(CsvValidationErrorCode.EMPTY, 'CSV file has no data rows');
  }
  if (totalRows > MAX_ROWS) {
    throw new CsvValidationError(
      CsvValidationErrorCode.TOO_MANY_ROWS,
      `CSV file has ${totalRows} rows, the maximum is ${MAX_ROWS}`,
    );
  }

  return { totalRows };
}

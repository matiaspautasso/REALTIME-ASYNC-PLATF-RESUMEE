import { ImportErrorCode } from './import-error-code';

/** A raw CSV row as parsed by the reader: every cell is an optional string. */
export interface RawProductRow {
  sku?: string;
  name?: string;
  price?: string;
  stock?: string;
}

/** A Row that passed every business rule, with its cells normalized. */
export interface ValidProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export interface RowError {
  rowNumber: number;
  code: ImportErrorCode;
  message: string;
}

/**
 * The outcome of validating one Row. A failure is a value, never a thrown
 * exception: a Data Error must not interrupt the Batch processing the Row.
 */
export type RowValidationResult =
  | { ok: true; product: ValidProduct }
  | { ok: false; error: RowError };

/**
 * Apply the product business rules (CONTEXT.md) to one raw CSV Row.
 *
 * Rules, checked in order so the first failure is the reported one:
 *   sku   — required, non-blank
 *   name  — required, non-blank
 *   price — a number strictly greater than zero
 *   stock — an integer greater than or equal to zero
 */
export function validateProductRow(raw: RawProductRow, rowNumber: number): RowValidationResult {
  const row = raw ?? {};

  const sku = (row.sku ?? '').trim();
  if (sku === '') {
    return fail(rowNumber, ImportErrorCode.MISSING_SKU, 'sku is required');
  }

  const name = (row.name ?? '').trim();
  if (name === '') {
    return fail(rowNumber, ImportErrorCode.MISSING_NAME, 'name is required');
  }

  // A blank cell coerces to 0 via Number(''), so reject it explicitly before parsing.
  const priceRaw = (row.price ?? '').trim();
  const price = Number(priceRaw);
  if (priceRaw === '' || !Number.isFinite(price) || price <= 0) {
    return fail(rowNumber, ImportErrorCode.INVALID_PRICE, 'price must be a number greater than 0');
  }

  const stockRaw = (row.stock ?? '').trim();
  const stock = Number(stockRaw);
  if (stockRaw === '' || !Number.isInteger(stock) || stock < 0) {
    return fail(rowNumber, ImportErrorCode.INVALID_STOCK, 'stock must be an integer of 0 or more');
  }

  return { ok: true, product: { sku, name, price, stock } };
}

function fail(rowNumber: number, code: ImportErrorCode, message: string): RowValidationResult {
  return { ok: false, error: { rowNumber, code, message } };
}

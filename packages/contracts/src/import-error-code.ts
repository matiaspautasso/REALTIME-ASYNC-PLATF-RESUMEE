/**
 * Why a single CSV Row was rejected. A Data Error (see CONTEXT.md): recorded
 * as an ImportError and never a cause for retry. Shared by row validation, the
 * worker and the errors.csv export so the vocabulary stays in one place.
 */
export enum ImportErrorCode {
  MISSING_SKU = 'MISSING_SKU',
  MISSING_NAME = 'MISSING_NAME',
  INVALID_PRICE = 'INVALID_PRICE',
  INVALID_STOCK = 'INVALID_STOCK',
}

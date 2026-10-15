// Domain core (TICKET-01.1)
export { ImportStatus, isTerminal, canTransition } from './import-status';
export { calculateProgress } from './progress';
export { ImportErrorCode } from './import-error-code';
export {
  validateProductRow,
  type RawProductRow,
  type ValidProduct,
  type RowError,
  type RowValidationResult,
} from './validate-product-row';

// REST DTOs and pagination (TICKET-01.2)
export type {
  CreateImportResponse,
  ImportDetail,
  ImportSummary,
  ImportErrorItem,
  ProductListItem,
  Paginated,
  PaginationQuery,
} from './dto';

// WebSocket event contract (TICKET-01.3)
export {
  IMPORTS_NAMESPACE,
  ImportEvents,
  type ImportEventName,
  type ImportSubscribePayload,
  type ImportEventPayload,
} from './events';

/** BullMQ queue name shared by the API (producer) and the worker (consumer). */
export const IMPORTS_QUEUE_NAME = 'imports';

/** Payload enqueued for one Import. Only a reference to the file, never its
 * contents (ADR-0003). */
export interface ImportJobData {
  importId: string;
  filePath: string;
}

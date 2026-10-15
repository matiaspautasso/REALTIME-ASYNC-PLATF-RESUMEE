/**
 * Minimal structured (JSON-per-line) logger (TICKET-07.1). One JSON object per
 * line keyed by fields like `importId`, `attemptNumber` and `batchIndex`, so a
 * whole job lifecycle is greppable by `importId` and batch timings are visible.
 * Kept dependency-free on purpose — a log line is just `JSON.stringify`.
 */
export type LogFields = Record<string, unknown>;

export class StructuredLogger {
  constructor(private readonly base: LogFields = {}) {}

  /** Derive a child logger that stamps `fields` onto every line. */
  child(fields: LogFields): StructuredLogger {
    return new StructuredLogger({ ...this.base, ...fields });
  }

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: string, event: string, fields: LogFields): void {
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...this.base, ...fields });
    process.stdout.write(`${line}\n`);
  }
}

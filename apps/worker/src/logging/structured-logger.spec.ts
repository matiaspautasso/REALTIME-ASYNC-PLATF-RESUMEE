import { StructuredLogger } from './structured-logger';

describe('StructuredLogger', () => {
  function capture(fn: () => void): Record<string, unknown> {
    const lines: string[] = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      fn();
    } finally {
      spy.mockRestore();
    }
    return JSON.parse(lines[0] ?? '{}');
  }

  it('writes one JSON line carrying level, event and the given fields', () => {
    const entry = capture(() => new StructuredLogger().info('batch.committed', { rows: 100, durationMs: 12 }));
    expect(entry).toMatchObject({ level: 'info', event: 'batch.committed', rows: 100, durationMs: 12 });
    expect(typeof entry.time).toBe('string');
  });

  it('stamps base fields from a child logger so lines are greppable by importId', () => {
    const entry = capture(() => new StructuredLogger({ component: 'worker' }).child({ importId: 'imp_1' }).warn('attempt.failed', { cause: 'ECONN' }));
    expect(entry).toMatchObject({ level: 'warn', event: 'attempt.failed', component: 'worker', importId: 'imp_1', cause: 'ECONN' });
  });
});

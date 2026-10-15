import { inspectCsv, CsvValidationError, CsvValidationErrorCode, MAX_ROWS } from './csv-inspector';

const header = 'sku,name,price,stock';

describe('inspectCsv', () => {
  it('counts the data rows of a valid CSV', () => {
    const csv = [header, 'A,Item A,1.00,1', 'B,Item B,2.00,2'].join('\n');
    expect(inspectCsv(csv)).toEqual({ totalRows: 2 });
  });

  it('ignores a trailing newline', () => {
    const csv = [header, 'A,Item A,1.00,1', ''].join('\n');
    expect(inspectCsv(csv)).toEqual({ totalRows: 1 });
  });

  it('accepts CRLF line endings and header in any case/spacing', () => {
    const csv = [' SKU , Name , Price , Stock ', 'A,Item A,1.00,1'].join('\r\n');
    expect(inspectCsv(csv)).toEqual({ totalRows: 1 });
  });

  it('allows extra columns as long as the required ones are present', () => {
    const csv = ['sku,name,price,stock,category', 'A,Item A,1.00,1,tools'].join('\n');
    expect(inspectCsv(csv)).toEqual({ totalRows: 1 });
  });

  it('rejects an empty file', () => {
    expectError(() => inspectCsv(''), CsvValidationErrorCode.EMPTY);
  });

  it('rejects a header with no data rows', () => {
    expectError(() => inspectCsv(header), CsvValidationErrorCode.EMPTY);
  });

  it('rejects a missing required column', () => {
    const csv = ['sku,name,price', 'A,Item A,1.00'].join('\n');
    expectError(() => inspectCsv(csv), CsvValidationErrorCode.MISSING_COLUMNS);
  });

  it(`rejects more than ${MAX_ROWS} data rows`, () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `SKU-${i},Item,1.00,1`);
    expectError(() => inspectCsv([header, ...rows].join('\n')), CsvValidationErrorCode.TOO_MANY_ROWS);
  });

  it('accepts exactly the maximum number of rows', () => {
    const rows = Array.from({ length: MAX_ROWS }, (_, i) => `SKU-${i},Item,1.00,1`);
    expect(inspectCsv([header, ...rows].join('\n'))).toEqual({ totalRows: MAX_ROWS });
  });
});

function expectError(fn: () => unknown, code: CsvValidationErrorCode): void {
  expect(fn).toThrow(CsvValidationError);
  try {
    fn();
  } catch (error) {
    expect((error as CsvValidationError).code).toBe(code);
  }
}

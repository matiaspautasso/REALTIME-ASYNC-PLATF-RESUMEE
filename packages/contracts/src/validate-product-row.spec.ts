import { validateProductRow } from './validate-product-row';
import { ImportErrorCode } from './import-error-code';

describe('validateProductRow', () => {
  const valid = { sku: 'SKU-1', name: 'Widget', price: '9.99', stock: '12' };

  it('accepts a well-formed row and normalizes its types', () => {
    const result = validateProductRow(valid, 2);
    expect(result).toEqual({
      ok: true,
      product: { sku: 'SKU-1', name: 'Widget', price: 9.99, stock: 12 },
    });
  });

  it('trims surrounding whitespace on sku and name', () => {
    const result = validateProductRow({ ...valid, sku: '  SKU-1 ', name: ' Widget ' }, 2);
    expect(result).toEqual({
      ok: true,
      product: { sku: 'SKU-1', name: 'Widget', price: 9.99, stock: 12 },
    });
  });

  it('rejects a missing or blank sku', () => {
    const result = validateProductRow({ ...valid, sku: '   ' }, 5);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toEqual({
      rowNumber: 5,
      code: ImportErrorCode.MISSING_SKU,
      message: expect.any(String),
    });
  });

  it('rejects a blank name', () => {
    const result = validateProductRow({ ...valid, name: '' }, 5);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe(ImportErrorCode.MISSING_NAME);
  });

  it.each(['0', '-1', 'abc', ''])('rejects a non-positive or unparseable price %p', (price) => {
    const result = validateProductRow({ ...valid, price }, 7);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe(ImportErrorCode.INVALID_PRICE);
  });

  it.each(['-1', '2.5', 'abc', ''])('rejects a negative, fractional or unparseable stock %p', (stock) => {
    const result = validateProductRow({ ...valid, stock }, 7);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe(ImportErrorCode.INVALID_STOCK);
  });

  it('accepts a stock of zero', () => {
    const result = validateProductRow({ ...valid, stock: '0' }, 2);
    expect(result.ok).toBe(true);
  });

  it('reports the first broken rule when several are broken (sku before price)', () => {
    const result = validateProductRow({ sku: '', name: 'Widget', price: '-1', stock: '1' }, 9);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe(ImportErrorCode.MISSING_SKU);
  });

  it('never throws on malformed input', () => {
    expect(() => validateProductRow({} as never, 1)).not.toThrow();
    expect(() => validateProductRow(undefined as never, 1)).not.toThrow();
  });
});

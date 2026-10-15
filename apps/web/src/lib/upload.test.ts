import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, checkUploadFile } from './upload';

function fileOfSize(bytes: number, name: string, type: string): File {
  // A sparse Blob the right size without allocating real bytes.
  const blob = new Blob([new Uint8Array(0)]);
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('checkUploadFile', () => {
  it('accepts a small .csv file', () => {
    const file = fileOfSize(1024, 'products.csv', 'text/csv');
    expect(checkUploadFile(file)).toEqual({ ok: true });
  });

  it('accepts a .csv file even when the browser reports no MIME type', () => {
    const file = fileOfSize(1024, 'products.csv', '');
    expect(checkUploadFile(file).ok).toBe(true);
  });

  it('rejects a non-CSV file', () => {
    const file = fileOfSize(1024, 'photo.png', 'image/png');
    const result = checkUploadFile(file);
    expect(result.ok).toBe(false);
  });

  it('rejects a CSV larger than the 5 MB limit', () => {
    const file = fileOfSize(MAX_UPLOAD_BYTES + 1, 'big.csv', 'text/csv');
    const result = checkUploadFile(file);
    expect(result.ok).toBe(false);
  });
});

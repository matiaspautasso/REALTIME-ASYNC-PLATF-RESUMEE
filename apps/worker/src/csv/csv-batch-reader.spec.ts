import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { streamCsvBatches, type CsvBatch } from './csv-batch-reader';

async function collect(filePath: string, batchSize: number): Promise<CsvBatch[]> {
  const batches: CsvBatch[] = [];
  for await (const batch of streamCsvBatches(filePath, batchSize)) {
    batches.push(batch);
  }
  return batches;
}

describe('streamCsvBatches', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'jobflow-csv-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function fixture(name: string, content: string): Promise<string> {
    const filePath = join(dir, name);
    await writeFile(filePath, content);
    return filePath;
  }

  it('groups data rows into fixed-size batches and handles the final partial batch', async () => {
    const path = await fixture(
      'five.csv',
      ['sku,name,price,stock', 'A,Alpha,1,1', 'B,Bravo,2,2', 'C,Charlie,3,3', 'D,Delta,4,4', 'E,Echo,5,5'].join(
        '\n',
      ),
    );

    const batches = await collect(path, 2);

    expect(batches.map((b) => b.rows.length)).toEqual([2, 2, 1]);
    expect(batches.map((b) => b.firstRowNumber)).toEqual([2, 4, 6]);
    expect(batches[0]?.rows[0]).toEqual({ sku: 'A', name: 'Alpha', price: '1', stock: '1' });
  });

  it('maps columns by header name regardless of their order', async () => {
    const path = await fixture('reordered.csv', ['name,stock,sku,price', 'Widget,7,W-1,9.50'].join('\n'));

    const [batch] = await collect(path, 10);

    expect(batch?.rows[0]).toEqual({ sku: 'W-1', name: 'Widget', price: '9.50', stock: '7' });
    expect(batch?.firstRowNumber).toBe(2);
  });

  it('skips blank lines without consuming a row number', async () => {
    const path = await fixture(
      'blanks.csv',
      ['sku,name,price,stock', 'A,Alpha,1,1', '', 'B,Bravo,2,2', ''].join('\n'),
    );

    const batches = await collect(path, 10);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.rows.map((r) => r.sku)).toEqual(['A', 'B']);
    expect(batches[0]?.firstRowNumber).toBe(2);
  });

  it('yields nothing for a header-only file', async () => {
    const path = await fixture('empty.csv', 'sku,name,price,stock\n');
    expect(await collect(path, 10)).toEqual([]);
  });
});

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { RawProductRow } from '@jobflow/contracts';

/** A fixed-size group of raw Rows, with the file row number of its first Row. */
export interface CsvBatch {
  rows: RawProductRow[];
  firstRowNumber: number;
}

const COLUMNS = ['sku', 'name', 'price', 'stock'] as const;

/**
 * Stream a product CSV from the shared volume (ADR-0003) and yield its data
 * Rows in fixed-size Batches. The file is read line by line (never buffered
 * whole), so a 10k-row file costs one Batch of memory at a time (TICKET-04.2).
 *
 * Row numbers follow the file: the header is row 1 and the first data Row is
 * row 2, matching the rowNumber recorded on an ImportError. Blank lines are
 * skipped and do not consume a number. Columns are mapped by header name, so
 * their order in the file does not matter. Cells are left as raw strings;
 * business rules run later via validateProductRow.
 */
export async function* streamCsvBatches(filePath: string, batchSize: number): AsyncGenerator<CsvBatch> {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });

  let columnIndex: Record<string, number> | undefined;
  let lineNumber = 0; // counts non-blank lines: header is 1, first data Row is 2
  let buffer: RawProductRow[] = [];
  let firstRowNumber = 0;

  try {
    for await (const line of rl) {
      if (line.trim() === '') {
        continue;
      }
      lineNumber += 1;

      if (lineNumber === 1) {
        columnIndex = indexHeader(line);
        continue;
      }

      if (buffer.length === 0) {
        firstRowNumber = lineNumber;
      }
      buffer.push(parseRow(line, columnIndex!));

      if (buffer.length === batchSize) {
        yield { rows: buffer, firstRowNumber };
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      yield { rows: buffer, firstRowNumber };
    }
  } finally {
    rl.close();
  }
}

function indexHeader(line: string): Record<string, number> {
  const cells = line.split(',').map((cell) => cell.trim().toLowerCase());
  const index: Record<string, number> = {};
  for (const column of COLUMNS) {
    index[column] = cells.indexOf(column);
  }
  return index;
}

function parseRow(line: string, columnIndex: Record<string, number>): RawProductRow {
  const cells = line.split(',');
  const at = (column: string): string | undefined => {
    const i = columnIndex[column];
    return i !== undefined && i >= 0 ? cells[i]?.trim() : undefined;
  };
  return { sku: at('sku'), name: at('name'), price: at('price'), stock: at('stock') };
}

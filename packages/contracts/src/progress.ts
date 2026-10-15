/**
 * Integer completion percentage (0–100) of an Import.
 *
 * An import with no rows is considered complete (100). The result is floored
 * so it only reaches 100 when every row has been processed, and is clamped to
 * tolerate transient over- or under-counts.
 */
export function calculateProgress(processedRows: number, totalRows: number): number {
  if (totalRows <= 0) {
    return 100;
  }
  const percent = Math.floor((processedRows / totalRows) * 100);
  if (percent < 0) {
    return 0;
  }
  if (percent > 100) {
    return 100;
  }
  return percent;
}

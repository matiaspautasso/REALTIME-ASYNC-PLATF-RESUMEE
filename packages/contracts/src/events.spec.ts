import { ImportStatus } from './import-status';
import { ImportEvents, lifecycleEventFor, toImportEventPayload } from './events';

const snapshot = {
  id: 'imp_1',
  status: ImportStatus.PROCESSING,
  progress: 40,
  processedRows: 4,
  totalRows: 10,
  successRows: 3,
  failedRows: 1,
};

describe('toImportEventPayload', () => {
  it('maps an ImportJob snapshot to the wire payload, renaming id to importId', () => {
    expect(toImportEventPayload(snapshot)).toEqual({
      importId: 'imp_1',
      status: ImportStatus.PROCESSING,
      progress: 40,
      processedRows: 4,
      totalRows: 10,
      successRows: 3,
      failedRows: 1,
    });
  });
});

describe('lifecycleEventFor', () => {
  it('selects completed for COMPLETED and COMPLETED_WITH_ERRORS', () => {
    expect(lifecycleEventFor(ImportStatus.COMPLETED)).toBe(ImportEvents.Completed);
    expect(lifecycleEventFor(ImportStatus.COMPLETED_WITH_ERRORS)).toBe(ImportEvents.Completed);
  });

  it('selects failed for FAILED', () => {
    expect(lifecycleEventFor(ImportStatus.FAILED)).toBe(ImportEvents.Failed);
  });

  it('selects retrying for RETRYING', () => {
    expect(lifecycleEventFor(ImportStatus.RETRYING)).toBe(ImportEvents.Retrying);
  });

  it('selects progress for a non-terminal, non-retrying status', () => {
    expect(lifecycleEventFor(ImportStatus.PROCESSING)).toBe(ImportEvents.Progress);
    expect(lifecycleEventFor(ImportStatus.QUEUED)).toBe(ImportEvents.Progress);
  });
});

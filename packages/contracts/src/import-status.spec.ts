import { ImportStatus, isTerminal, canTransition } from './import-status';

describe('ImportStatus lifecycle', () => {
  describe('isTerminal', () => {
    it.each([
      ImportStatus.COMPLETED,
      ImportStatus.COMPLETED_WITH_ERRORS,
      ImportStatus.FAILED,
    ])('treats %s as terminal', (status) => {
      expect(isTerminal(status)).toBe(true);
    });

    it.each([ImportStatus.QUEUED, ImportStatus.PROCESSING, ImportStatus.RETRYING])(
      'treats %s as non-terminal',
      (status) => {
        expect(isTerminal(status)).toBe(false);
      },
    );
  });

  describe('canTransition', () => {
    it('allows a queued import to start processing', () => {
      expect(canTransition(ImportStatus.QUEUED, ImportStatus.PROCESSING)).toBe(true);
    });

    it('allows processing to reach each terminal success and retry', () => {
      expect(canTransition(ImportStatus.PROCESSING, ImportStatus.COMPLETED)).toBe(true);
      expect(canTransition(ImportStatus.PROCESSING, ImportStatus.COMPLETED_WITH_ERRORS)).toBe(true);
      expect(canTransition(ImportStatus.PROCESSING, ImportStatus.RETRYING)).toBe(true);
      expect(canTransition(ImportStatus.PROCESSING, ImportStatus.FAILED)).toBe(true);
    });

    it('allows a retry to resume processing or give up', () => {
      expect(canTransition(ImportStatus.RETRYING, ImportStatus.PROCESSING)).toBe(true);
      expect(canTransition(ImportStatus.RETRYING, ImportStatus.FAILED)).toBe(true);
    });

    it('allows a failed import to be manually re-queued', () => {
      expect(canTransition(ImportStatus.FAILED, ImportStatus.QUEUED)).toBe(true);
    });

    it('rejects resurrecting a completed import', () => {
      expect(canTransition(ImportStatus.COMPLETED, ImportStatus.PROCESSING)).toBe(false);
      expect(canTransition(ImportStatus.COMPLETED_WITH_ERRORS, ImportStatus.QUEUED)).toBe(false);
    });

    it('rejects skipping straight from queued to completed', () => {
      expect(canTransition(ImportStatus.QUEUED, ImportStatus.COMPLETED)).toBe(false);
    });
  });
});

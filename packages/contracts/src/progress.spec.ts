import { calculateProgress } from './progress';

describe('calculateProgress', () => {
  it('is 0 at the start of a non-empty import', () => {
    expect(calculateProgress(0, 10000)).toBe(0);
  });

  it('floors the percentage to an integer', () => {
    // 6500 / 10000 = 65%
    expect(calculateProgress(6500, 10000)).toBe(65);
    // 1 / 3 = 33.33% -> 33
    expect(calculateProgress(1, 3)).toBe(33);
  });

  it('is 100 only when every row is processed', () => {
    expect(calculateProgress(10000, 10000)).toBe(100);
    expect(calculateProgress(9999, 10000)).toBe(99);
  });

  it('treats a zero-row import as already complete', () => {
    expect(calculateProgress(0, 0)).toBe(100);
  });

  it('clamps an over-count to 100', () => {
    expect(calculateProgress(10050, 10000)).toBe(100);
  });

  it('clamps a negative processed count to 0', () => {
    expect(calculateProgress(-5, 10000)).toBe(0);
  });
});

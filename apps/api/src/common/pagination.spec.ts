import { parsePageParams, toSkipTake, buildPaginated } from './pagination';

describe('parsePageParams', () => {
  it('defaults to page 1, pageSize 20', () => {
    expect(parsePageParams(undefined, undefined)).toEqual({ page: 1, pageSize: 20 });
  });

  it('parses valid values', () => {
    expect(parsePageParams('3', '50')).toEqual({ page: 3, pageSize: 50 });
  });

  it('clamps page to a minimum of 1', () => {
    expect(parsePageParams('0', '10').page).toBe(1);
    expect(parsePageParams('-5', '10').page).toBe(1);
  });

  it('clamps pageSize to the 1..100 range', () => {
    expect(parsePageParams('1', '0').pageSize).toBe(1);
    expect(parsePageParams('1', '500').pageSize).toBe(100);
  });

  it('falls back to defaults on non-numeric input', () => {
    expect(parsePageParams('abc', 'xyz')).toEqual({ page: 1, pageSize: 20 });
  });
});

describe('toSkipTake', () => {
  it('computes skip from the page offset', () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, pageSize: 50 })).toEqual({ skip: 100, take: 50 });
  });
});

describe('buildPaginated', () => {
  it('wraps items with pagination metadata', () => {
    expect(buildPaginated([1, 2], 7, { page: 2, pageSize: 2 })).toEqual({
      items: [1, 2],
      total: 7,
      page: 2,
      pageSize: 2,
    });
  });
});

import { Paginated } from '@jobflow/contracts';

export interface PageParams {
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

/** Normalize raw query params into safe page/pageSize (1-based, clamped). */
export function parsePageParams(pageRaw?: string, pageSizeRaw?: string): PageParams {
  const page = Math.max(1, toInt(pageRaw, 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(pageSizeRaw, DEFAULT_PAGE_SIZE)));
  return { page, pageSize };
}

/** Prisma skip/take for a given page. */
export function toSkipTake({ page, pageSize }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginated<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  return { items, total, page: params.page, pageSize: params.pageSize };
}

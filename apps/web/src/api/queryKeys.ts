/** Centralised TanStack Query keys so cache reads, writes and invalidations
 * in hooks, pages and the socket layer all key on the same tuples. */
export const qk = {
  importsList: (page: number, pageSize: number) =>
    ['imports', 'list', page, pageSize] as const,
  importDetail: (id: string) => ['imports', 'detail', id] as const,
  importErrors: (id: string, page: number, pageSize: number) =>
    ['imports', 'errors', id, page, pageSize] as const,
  importAttempts: (id: string) => ['imports', 'attempts', id] as const,
};

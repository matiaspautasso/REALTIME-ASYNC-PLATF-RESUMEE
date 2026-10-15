import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportSummary, Paginated } from '@jobflow/contracts';
import { api } from '../api/client';
import { qk } from '../api/queryKeys';

export function useImportsList(page: number, pageSize: number) {
  return useQuery({
    queryKey: qk.importsList(page, pageSize),
    queryFn: () => api.listImports(page, pageSize),
    placeholderData: (prev: Paginated<ImportSummary> | undefined) => prev,
  });
}

export function useImportDetail(id: string) {
  return useQuery({
    queryKey: qk.importDetail(id),
    queryFn: () => api.getImport(id),
  });
}

export function useImportAttempts(id: string) {
  return useQuery({
    queryKey: qk.importAttempts(id),
    queryFn: () => api.getAttempts(id),
  });
}

export function useImportErrors(id: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: qk.importErrors(id, page, pageSize),
    queryFn: () => api.getErrors(id, page, pageSize),
  });
}

export function useRetryImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryImport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    },
  });
}

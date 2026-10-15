import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ImportStatus, type ImportSummary } from '@jobflow/contracts';

const listImports = vi.fn();
const getImport = vi.fn();

vi.mock('../api/client', () => ({
  API_URL: 'http://localhost:3000',
  api: {
    listImports: (...args: unknown[]) => listImports(...args),
    getImport: (...args: unknown[]) => getImport(...args),
  },
}));

// Keep the realtime layer inert in this render test.
vi.mock('socket.io-client', () => ({
  io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }),
}));

import { DashboardPage } from './DashboardPage';

const summaries: ImportSummary[] = [
  {
    id: 'a',
    fileName: 'running.csv',
    status: ImportStatus.PROCESSING,
    progress: 40,
    totalRows: 100,
    failedRows: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b',
    fileName: 'queued.csv',
    status: ImportStatus.QUEUED,
    progress: 0,
    totalRows: 50,
    failedRows: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c',
    fileName: 'done.csv',
    status: ImportStatus.COMPLETED,
    progress: 100,
    totalRows: 10,
    failedRows: 0,
    createdAt: new Date().toISOString(),
  },
];

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    listImports.mockReset();
    getImport.mockReset();
    getImport.mockImplementation(() => new Promise(() => {})); // never settles
  });

  it('shows counters derived from GET /imports and lists active imports', async () => {
    listImports.mockResolvedValue({
      items: summaries,
      total: 3,
      page: 1,
      pageSize: 100,
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('in-process-count')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('finished-count')).toHaveTextContent('1');

    // The two active imports render as cards; the finished one does not.
    expect(screen.getByText('running.csv')).toBeInTheDocument();
    expect(screen.getByText('queued.csv')).toBeInTheDocument();
    expect(screen.queryByText('done.csv')).not.toBeInTheDocument();
  });
});

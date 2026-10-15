import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isTerminal, type ImportSummary } from '@jobflow/contracts';
import { useImportDetail, useImportsList } from '../hooks/useImports';
import { useImportSocket } from '../realtime/useImportSocket';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';

const DASHBOARD_PAGE_SIZE = 100;

/** A single active import, kept live over the socket while it runs. */
function ActiveImportCard({ summary }: { summary: ImportSummary }) {
  const queryClient = useQueryClient();
  useImportSocket(summary.id);
  const { data } = useImportDetail(summary.id);

  const status = data?.status ?? summary.status;
  const progress = data?.progress ?? summary.progress;

  // When this import reaches a terminal state the history list changed, so
  // refresh the dashboard counters and drop it from the active section.
  useEffect(() => {
    if (isTerminal(status)) {
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    }
  }, [status, queryClient]);

  return (
    <Link to={`/imports/${summary.id}`} className="card card--link">
      <div className="card__row">
        <span className="card__title">{summary.fileName}</span>
        <StatusBadge status={status} />
      </div>
      <ProgressBar value={progress} />
      <div className="card__meta">
        {data ? `${data.processedRows} / ${data.totalRows} rows` : `${progress}%`}
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useImportsList(1, DASHBOARD_PAGE_SIZE);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const inProcess = items.filter((i) => !isTerminal(i.status));
  const finished = items.filter((i) => isTerminal(i.status));

  return (
    <section>
      <h1>Dashboard</h1>

      <div className="stats">
        <div className="stat">
          <span className="stat__value">{total}</span>
          <span className="stat__label">Total imports</span>
        </div>
        <div className="stat">
          <span className="stat__value" data-testid="in-process-count">
            {inProcess.length}
          </span>
          <span className="stat__label">In process</span>
        </div>
        <div className="stat">
          <span className="stat__value" data-testid="finished-count">
            {finished.length}
          </span>
          <span className="stat__label">Finished</span>
        </div>
      </div>

      <h2>Active imports</h2>
      {isLoading && <p className="muted">Loading…</p>}
      {isError && <p className="error-text">Could not load imports.</p>}
      {!isLoading && !isError && inProcess.length === 0 && (
        <p className="muted">
          No imports in process. <Link to="/imports/new">Start a new import</Link>.
        </p>
      )}
      <div className="card-list">
        {inProcess.map((summary) => (
          <ActiveImportCard key={summary.id} summary={summary} />
        ))}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImportStatus } from '@jobflow/contracts';
import { useImportsList, useRetryImport } from '../hooks/useImports';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { statusDisplay } from '../lib/status';

const PAGE_SIZE = 10;
const ALL = 'ALL' as const;

type Filter = ImportStatus | typeof ALL;

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>(ALL);
  const { data, isLoading, isError } = useImportsList(page, PAGE_SIZE);
  const retry = useRetryImport();

  // The API list is not status-filtered, so we filter the current page client
  // side. Good enough for the portfolio scope; a server filter would be the
  // production move.
  const items = (data?.items ?? []).filter(
    (i) => filter === ALL || i.status === filter,
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section>
      <h1>History</h1>

      <div className="toolbar">
        <label>
          Status:{' '}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value={ALL}>All</option>
            {Object.values(ImportStatus).map((s) => (
              <option key={s} value={s}>
                {statusDisplay(s).label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {isError && <p className="error-text">Could not load history.</p>}

      {data && (
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Failed rows</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link to={`/imports/${i.id}`}>{i.fileName}</Link>
                </td>
                <td>
                  <StatusBadge status={i.status} />
                </td>
                <td>{i.progress}%</td>
                <td>{i.failedRows}</td>
                <td>{new Date(i.createdAt).toLocaleString()}</td>
                <td className="row-actions">
                  {i.status === ImportStatus.FAILED && (
                    <button
                      className="btn"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(i.id)}
                    >
                      Retry
                    </button>
                  )}
                  {i.failedRows > 0 && (
                    <a className="btn" href={api.errorsCsvUrl(i.id)} download>
                      errors.csv
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No imports match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="pager">
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="muted">
          Page {page} of {pages}
        </span>
        <button
          className="btn"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

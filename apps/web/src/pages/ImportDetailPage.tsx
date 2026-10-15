import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isTerminal } from '@jobflow/contracts';
import {
  useImportAttempts,
  useImportDetail,
  useImportErrors,
} from '../hooks/useImports';
import { useImportSocket } from '../realtime/useImportSocket';
import { api } from '../api/client';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';

const ERRORS_PAGE_SIZE = 20;

export function ImportDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [errorsPage, setErrorsPage] = useState(1);

  useImportSocket(id);
  const detail = useImportDetail(id);
  const attempts = useImportAttempts(id);
  const errors = useImportErrors(id, errorsPage, ERRORS_PAGE_SIZE);

  if (detail.isLoading) return <p className="muted">Loading import…</p>;
  if (detail.isError || !detail.data)
    return <p className="error-text">Import not found.</p>;

  const d = detail.data;
  const terminal = isTerminal(d.status);
  const errorPages = errors.data
    ? Math.max(1, Math.ceil(errors.data.total / ERRORS_PAGE_SIZE))
    : 1;

  return (
    <section>
      <div className="detail__head">
        <div>
          <h1>{d.fileName}</h1>
          <p className="muted">Import {d.id}</p>
        </div>
        <StatusBadge status={d.status} />
      </div>

      <div className="panel">
        <ProgressBar value={d.progress} />
        <div className="detail__metrics">
          <Metric label="Progress" value={`${d.progress}%`} />
          <Metric label="Processed" value={`${d.processedRows} / ${d.totalRows}`} />
          <Metric label="Succeeded" value={d.successRows} tone="success" />
          <Metric label="Failed" value={d.failedRows} tone="error" />
        </div>
        {terminal && (
          <p className="muted">
            Finished · updated {new Date(d.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <h2>Attempts</h2>
      {attempts.isLoading && <p className="muted">Loading attempts…</p>}
      {attempts.data && attempts.data.length === 0 && (
        <p className="muted">No attempts yet.</p>
      )}
      {attempts.data && attempts.data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {attempts.data.map((a) => (
              <tr key={a.attemptNumber}>
                <td>{a.attemptNumber}</td>
                <td>{a.status}</td>
                <td>{new Date(a.startedAt).toLocaleString()}</td>
                <td>{a.finishedAt ? new Date(a.finishedAt).toLocaleString() : '—'}</td>
                <td>{a.errorMessage ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="detail__head">
        <h2>Row errors</h2>
        {d.failedRows > 0 && (
          <a className="btn" href={api.errorsCsvUrl(d.id)} download>
            Download errors.csv
          </a>
        )}
      </div>
      {errors.isLoading && <p className="muted">Loading errors…</p>}
      {errors.data && errors.data.items.length === 0 && (
        <p className="muted">No row errors.</p>
      )}
      {errors.data && errors.data.items.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Code</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.data.items.map((e) => (
                <tr key={`${e.rowNumber}-${e.errorCode}`}>
                  <td>{e.rowNumber}</td>
                  <td>{e.errorCode}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager
            page={errorsPage}
            pages={errorPages}
            onChange={setErrorsPage}
          />
        </>
      )}

      <p>
        <Link to="/history">← Back to history</Link>
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'success' | 'error';
}) {
  return (
    <div className="metric">
      <span className={tone ? `metric__value metric__value--${tone}` : 'metric__value'}>
        {value}
      </span>
      <span className="metric__label">{label}</span>
    </div>
  );
}

function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="muted">
        Page {page} of {pages}
      </span>
      <button
        className="btn"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

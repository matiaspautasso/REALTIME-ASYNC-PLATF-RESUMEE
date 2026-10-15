import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { checkUploadFile } from '../lib/upload';

export function NewImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }

    const guard = checkUploadFile(file);
    if (!guard.ok) {
      setError(guard.reason);
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createImport(file);
      navigate(`/imports/${created.id}`);
    } catch (err) {
      // A 400 from the API surfaces its message without leaving the screen.
      setError(err instanceof ApiError ? err.message : 'Upload failed. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow">
      <h1>New import</h1>
      <p className="muted">
        Upload a CSV of products. Columns: sku, name, price, stock. Max 5 MB.
      </p>

      <form onSubmit={onSubmit} className="form">
        <label className="file-field">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
        </label>

        {file && <p className="muted">Selected: {file.name}</p>}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Uploading…' : 'Upload and start import'}
        </button>
      </form>
    </section>
  );
}

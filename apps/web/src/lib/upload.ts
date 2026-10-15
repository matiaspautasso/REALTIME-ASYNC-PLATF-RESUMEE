/**
 * Client-side pre-upload guard for the New Import screen (06.3).
 *
 * This is a fast-feedback check only: the API remains the authority on what is
 * a valid CSV. We reject the two things we can cheaply detect in the browser —
 * wrong file type and oversized files — before spending a round trip.
 */

/** Hard cap mirrored from the API's upload limit. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadGuardResult =
  | { ok: true }
  | { ok: false; reason: string };

function isCsv(file: File): boolean {
  // Browsers are inconsistent about the MIME type they attach to .csv files
  // (text/csv, application/vnd.ms-excel, or empty), so accept either a CSV
  // media type or a .csv extension.
  const type = file.type.toLowerCase();
  if (type === 'text/csv') return true;
  return file.name.toLowerCase().endsWith('.csv');
}

/** Validate a chosen file before uploading it to `POST /imports`. */
export function checkUploadFile(file: File): UploadGuardResult {
  if (!isCsv(file)) {
    return { ok: false, reason: 'Only .csv files are allowed.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'File is larger than the 5 MB limit.' };
  }
  return { ok: true };
}

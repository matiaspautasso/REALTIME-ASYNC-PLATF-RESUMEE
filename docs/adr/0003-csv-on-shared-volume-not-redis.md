# CSV files live on a shared volume, not in Redis

The API writes the uploaded CSV to a shared Docker volume (`UPLOAD_DIR`) and enqueues only the file path and import id. The worker reads the file from the same volume by path. CSV contents are never placed in the Redis job payload.

Redis holds everything in memory; pushing up to 5 MB of CSV per job through it wastes memory and bloats the queue. Passing a reference keeps jobs small and keeps the file as a stream the worker can process in batches.

## Consequences

- API and worker containers both mount the same volume; this is why they are co-located in `docker-compose` for the MVP.
- In a distributed deployment the shared volume would be replaced by object storage (e.g. S3) and the job would carry an object key instead of a local path. The seam (a file reference, not file bytes) stays the same.

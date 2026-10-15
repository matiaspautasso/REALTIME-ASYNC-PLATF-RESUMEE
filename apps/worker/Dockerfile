# Multi-stage image for the JobFlow worker (independent process, ADR-0002).
# Built from the monorepo root so the workspace packages resolve.
#   docker build -f apps/worker/Dockerfile -t jobflow-worker .

# ---- builder ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jobflow/worker... build

# ---- runtime ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo .
WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]

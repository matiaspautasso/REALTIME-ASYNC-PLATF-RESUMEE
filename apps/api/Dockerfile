# Multi-stage image for the JobFlow API. Built from the monorepo root so the
# workspace packages (@jobflow/contracts, @jobflow/database) resolve.
#   docker build -f apps/api/Dockerfile -t jobflow-api .

# ---- builder: install the whole workspace and build the API + its deps ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /repo
COPY . .
# On Linux the Prisma postinstall (prisma generate) runs cleanly.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jobflow/api... build

# ---- runtime: carry the built workspace and run the compiled entrypoint ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo .
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

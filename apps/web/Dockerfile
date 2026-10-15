# Multi-stage image for the JobFlow web dashboard. Built from the monorepo root.
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t jobflow-web .
#
# VITE_API_URL is the browser-facing API origin, inlined at build time by Vite,
# so it must be the host-exposed URL (not the compose-internal service name).

# ---- builder ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @jobflow/web... build

# ---- runtime: static files served by nginx ----
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]

# Monorepo with pnpm workspaces and Turborepo

The API, worker and web app share DTOs, event contracts and the Prisma schema. We keep them in a single repo with `pnpm` workspaces (strict, symlinked dependencies) and Turborepo (task caching and `^build` ordering) so `packages/contracts` and `packages/database` are consumed as first-class internal packages instead of being copied or published.

## Considered Options

- **Nx**: more powerful (generators, project graph) but heavier and more opinionated than an MVP needs.
- **npm/yarn workspaces, no orchestrator**: simpler, but no task cache means CI rebuilds and retests everything on every change.

We chose pnpm + Turborepo as the lightest setup that still demonstrates real monorepo task orchestration.

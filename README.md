# Node Playground

Monorepo: user service, user-info service, and observability stack (Loki, Prometheus, Grafana).

## Requirements

- Node.js 20+
- npm 9+

## Quick start (user service only)

```bash
cd user
npm install
cp .env.example .env
npm run dev
```

Server: `http://localhost:3000`.

## Full stack (Docker)

From the repo root:

```bash
npm run docker:up:build
```

Runs user service, user-info service, Loki, Prometheus, and Grafana. Copy `user/.env.example` and `user-info/.env.example` to `.env` in each directory (or set env in Docker) as needed.

## Workspace build (all packages)

From the repo root:

```bash
npm install
cd packages/observability && npm run build
cd ../../user && npm run build
cd ../user-info && npm run build
```

Then run each service: `npm run dev` from `user/` or `user-info/`.

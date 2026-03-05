# Build from repo root so workspace @node-playground/observability is available
FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/observability ./packages/observability
COPY user ./user
COPY user-info ./user-info
RUN npm ci
RUN npm run build --workspace=@node-playground/observability

WORKDIR /app/user
EXPOSE 3000
CMD ["npm", "run", "dev"]


FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/observability ./packages/observability
COPY user ./user
COPY user-info ./user-info
RUN npm ci
RUN npm run build --workspace=@node-playground/observability
WORKDIR /app/user
RUN npm run build


FROM node:22-alpine AS production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/observability ./packages/observability
COPY user ./user
COPY user-info ./user-info
RUN npm ci --omit=dev
RUN npm run build --workspace=@node-playground/observability
COPY --from=builder /app/user/dist ./user/dist
WORKDIR /app/user
RUN mkdir -p logs
EXPOSE 3000
CMD ["node", "dist/server.js"]

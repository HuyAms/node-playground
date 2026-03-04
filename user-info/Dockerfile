FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "run", "dev"]


FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build


FROM node:22-alpine AS production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs

EXPOSE 3000

CMD ["node", "dist/server.js"]

# Stage 1: Builder
FROM node:22 AS builder
WORKDIR /app
ENV CI=true
ENV NODE_OPTIONS="--max-old-space-size=450"
COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web run build

# Stage 2: Production
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
ENV NODE_OPTIONS="--max-old-space-size=400"
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

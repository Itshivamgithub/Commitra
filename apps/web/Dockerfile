# Stage 1: Builder
FROM node:22 AS builder
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web build

# Stage 2: Production
FROM node:22 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

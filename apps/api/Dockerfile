# Stage 1: Builder
FROM node:22 AS builder
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api run build

# Stage 2: Production
FROM node:22 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
RUN npm install -g pnpm
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]

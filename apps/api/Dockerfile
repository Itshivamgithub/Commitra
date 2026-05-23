FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy root and workspaces
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies including workspace packages
RUN pnpm install --no-frozen-lockfile

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["pnpm", "dev"]

FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy root and workspaces
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/types ./packages/types
COPY apps/web ./apps/web

# Install dependencies including workspace packages
RUN pnpm install --no-frozen-lockfile

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "dev"]

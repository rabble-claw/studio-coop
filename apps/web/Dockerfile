FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source
COPY apps/web/ apps/web/
COPY packages/ packages/
COPY turbo.json ./

# Build
RUN pnpm --filter @studio-coop/shared build 2>/dev/null || true
RUN pnpm --filter @studio-coop/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@studio-coop/web", "start"]

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source
COPY packages/ packages/
COPY turbo.json ./

# Build
RUN pnpm --filter @studio-coop/shared build 2>/dev/null || true
RUN pnpm --filter @studio-coop/api build 2>/dev/null || true

EXPOSE 3001
CMD ["node", "--import", "tsx", "packages/api/src/serve.ts"]

# Build from the REPO ROOT context (like eps-backend):
#   docker build -f packages/eps-transact-mcp/Dockerfile .
# Prerequisite: the baked data files exist (root `npm run build` ran first) —
# packages/eps-transact-mcp/data/eps.json and packages/sdk-js/data/sdk-surface.json
# are gitignored build artifacts, so CI must bake before building this image.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Root package.json's `prepare` runs `node .githooks/setup.mjs` on npm ci
# (--include-workspace-root below). The script no-ops without a .git dir, but
# the file must exist or node throws "Cannot find module". Copy just the script.
COPY .githooks/setup.mjs .githooks/setup.mjs
COPY packages/sdk-js/package.json packages/sdk-js/package.json
COPY packages/eps-transact-mcp/package.json packages/eps-transact-mcp/package.json
# Both workspaces: sdk-js needs its own devDeps (tsup) to build its dist.
RUN npm ci --workspace @ekoindia/eps-transact-mcp --workspace @ekoindia/eps-sdk --include-workspace-root
COPY packages/sdk-js packages/sdk-js
COPY packages/eps-transact-mcp packages/eps-transact-mcp
RUN npm run build -w @ekoindia/eps-sdk && npm run build -w @ekoindia/eps-transact-mcp

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
# The @ekoindia/eps-sdk workspace symlink in node_modules resolves to
# /app/packages/sdk-js — keep that path shape, with its baked surface.
COPY --from=build /app/packages/sdk-js/package.json ./packages/sdk-js/package.json
COPY --from=build /app/packages/sdk-js/dist ./packages/sdk-js/dist
COPY --from=build /app/packages/sdk-js/data ./packages/sdk-js/data
COPY --from=build /app/packages/eps-transact-mcp/package.json ./package.json
COPY --from=build /app/packages/eps-transact-mcp/dist ./dist
COPY --from=build /app/packages/eps-transact-mcp/data ./data
EXPOSE 8788
# Drop root: the server only reads baked data + does network I/O (no disk writes),
# and binds 8788 (>1024, no privilege needed). node:20-alpine ships the `node` user.
USER node
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Root package.json's `prepare` runs `node .githooks/setup.mjs` on npm ci
# (--include-workspace-root below). The script no-ops without a .git dir, but
# the file must exist or node throws "Cannot find module". Copy just the script.
COPY .githooks/setup.mjs .githooks/setup.mjs
COPY packages/eps-backend/package.json packages/eps-backend/package.json
# eps-context-mcp is a devDependency, bundled into dist by tsup and never
# shipped as a runtime dep: npm needs its manifest to link the workspace,
# esbuild needs its src/. Neither survives into the runtime stage.
COPY packages/eps-context-mcp/package.json packages/eps-context-mcp/package.json
RUN npm ci --workspace @ekoindia/eps-backend --include-workspace-root
COPY packages/eps-backend packages/eps-backend
COPY packages/eps-context-mcp/src packages/eps-context-mcp/src
RUN npm run build -w @ekoindia/eps-backend

# Runtime dependencies only, resolved fresh from the lockfile rather than pruned
# out of the build tree — tsup, typescript, vitest and friends never enter the
# final image. Worth a second npm ci: the deploy VM's Docker runs on the vfs
# storage driver, which copies every layer in full, so image size converts
# directly into pull and container-create minutes.
FROM node:20-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
COPY .githooks/setup.mjs .githooks/setup.mjs
COPY packages/eps-backend/package.json packages/eps-backend/package.json
RUN npm ci --workspace @ekoindia/eps-backend --include-workspace-root --omit=dev

FROM node:20-alpine
# Keep the monorepo path layout from the build stage — do NOT flatten dist into
# /app. npm nests a workspace dep whenever the hoisted version conflicts (here:
# eps-backend wants jose@^5 while @modelcontextprotocol/sdk hoists jose@^6, so
# jose@5 lands in packages/eps-backend/node_modules). Node resolves upward from
# the entrypoint's directory, so dist must sit beside that nested node_modules
# or those deps are invisible at runtime.
WORKDIR /app/packages/eps-backend
ENV NODE_ENV=production
# The whole resolved tree, not hand-picked node_modules paths: which deps nest
# under the workspace vs hoist to the root is npm's call and changes with the
# lockfile, and a COPY naming a path that stops existing fails the build.
COPY --from=proddeps /app /app
COPY --from=build /app/packages/eps-backend/dist ./dist
EXPOSE 8787
CMD ["node", "dist/index.js"]

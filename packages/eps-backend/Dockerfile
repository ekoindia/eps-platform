FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Root package.json's `prepare` runs `node .githooks/setup.mjs` on npm ci
# (--include-workspace-root below). The script no-ops without a .git dir, but
# the file must exist or node throws "Cannot find module". Copy just the script.
COPY .githooks/setup.mjs .githooks/setup.mjs
COPY packages/eps-backend/package.json packages/eps-backend/package.json
RUN npm ci --workspace @ekoindia/eps-backend --include-workspace-root
COPY packages/eps-backend packages/eps-backend
RUN npm run build -w @ekoindia/eps-backend

FROM node:20-alpine
# Keep the monorepo path layout from the build stage — do NOT flatten dist into
# /app. npm nests a workspace dep whenever the hoisted version conflicts (here:
# eps-backend wants jose@^5 while @modelcontextprotocol/sdk hoists jose@^6, so
# jose@5 lands in packages/eps-backend/node_modules). Node resolves upward from
# the entrypoint's directory, so dist must sit beside that nested node_modules
# or those deps are invisible at runtime.
WORKDIR /app/packages/eps-backend
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/eps-backend/node_modules ./node_modules
COPY --from=build /app/packages/eps-backend/dist ./dist
COPY --from=build /app/packages/eps-backend/package.json ./package.json
EXPOSE 8787
CMD ["node", "dist/index.js"]

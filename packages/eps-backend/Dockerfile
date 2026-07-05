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
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/eps-backend/dist ./dist
COPY --from=build /app/packages/eps-backend/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8787
CMD ["node", "dist/index.js"]

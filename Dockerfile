# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g pnpm@12.16.1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate && pnpm exec nuxt prepare && pnpm build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
RUN apk add --no-cache curl
# node_modules stay for the Prisma CLI (migrations on start) and the seed script.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json /app/tsconfig.json ./
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]

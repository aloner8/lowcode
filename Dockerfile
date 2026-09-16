# Multi-stage Dockerfile for the Low-Code control plane and tenant site runtimes.
# The same image runs three ways:
#   node server.js                  -> control plane / a single site
#   node scripts/run-sites.mjs      -> multi-site launcher (one process per site)

FROM node:22-alpine AS base
WORKDIR /app

# 1. Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/sharemodule/package.json ./packages/sharemodule/package.json
RUN npm ci

# 2. Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG GIT_SHA=unknown
ARG PLATFORM_VERSION=0.1.0
ARG SHAREMODULE_VERSION=0.0.0
ARG IMAGE_SOURCE=https://github.com/aloner8/lowcode
ENV BUILD_GIT_SHA=$GIT_SHA
RUN npm run build

# 3. Production runner
FROM base AS runner
ARG GIT_SHA=unknown
ARG PLATFORM_VERSION=0.1.0
ARG SHAREMODULE_VERSION=0.0.0
ARG IMAGE_SOURCE=https://github.com/aloner8/lowcode
LABEL org.opencontainers.image.source=$IMAGE_SOURCE \
      org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.version=$PLATFORM_VERSION \
      io.matchanu.sharemodule.version=$SHAREMODULE_VERSION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The multi-site launcher runs outside the Next server bundle, so it and its
# only dependency (pg, already traced into standalone/node_modules) are copied in.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

COPY --from=builder --chown=nextjs:nodejs /app/packages/sharemodule/package.json ./packages/sharemodule/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/sharemodule/dist ./packages/sharemodule/dist
# Next bundles workspace imports and can omit the npm workspace link. Keep the
# compiled package usable by standalone scripts and future worker entrypoints.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/lucide-react ./node_modules/lucide-react
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/react ./node_modules/react
RUN mkdir -p /app/node_modules/@matchanu \
 && ln -sfn ../../packages/sharemodule /app/node_modules/@matchanu/sharemodule

# Tenant uploads live here and are backed by a named volume in compose.
# Created before dropping privileges so the app can write to it.
RUN mkdir -p /app/storage/tenants && chown -R nextjs:nodejs /app/storage
ENV TENANT_STORAGE_ROOT=/app/storage/tenants

USER nextjs

# 33000 = control plane; 33001-33020 = tenant sites started by run-sites.mjs
EXPOSE 33000 33001 33002 33003 33004 33005

ENV PORT=33000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

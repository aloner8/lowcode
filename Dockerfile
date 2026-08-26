# Multi-stage Dockerfile for the Low-Code control plane and tenant site runtimes.
# The same image runs three ways:
#   node server.js                  -> control plane / a single site
#   node scripts/run-sites.mjs      -> multi-site launcher (one process per site)

FROM node:22-alpine AS base
WORKDIR /app

# 1. Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The multi-site launcher runs outside the Next server bundle, so it and its
# only dependency (pg, already traced into standalone/node_modules) are copied in.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

# 33000 = control plane; 33001-33020 = tenant sites started by run-sites.mjs
EXPOSE 33000 33001 33002 33003 33004 33005

ENV PORT=33000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

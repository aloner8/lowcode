# Multi-stage Dockerfile for Low-Code App Mother & Child Dynamic Player

FROM node:22-alpine AS base
WORKDIR /app

# 1. Install Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build Stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 3. Production Runner Stage
FROM base AS runner
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 33000 33001 33002

ENV PORT 33000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]

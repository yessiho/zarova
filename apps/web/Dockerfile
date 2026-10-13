# .dockerignore should exclude: node_modules, .next, .env*, coverage
# next.config must have output: 'standalone' for this Dockerfile to work.

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package*.json ./
RUN npm ci


# ── Stage 2: Build the application ───────────────────────────────────────────
FROM node:24-alpine AS build

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:24-alpine AS runner

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Standalone output bundles the server; static assets are copied separately
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

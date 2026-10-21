# .dockerignore should exclude: node_modules, dist, .env*, coverage, *.spec.ts, test/
# This keeps build context lean and prevents secrets from leaking into the image.

# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev


# ── Stage 2: Build the application ───────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

# Copy source and all dependencies (including devDeps for the build)
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:24-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Use build-stage node_modules so the Prisma CLI (devDep) is available for
# the migration step in start.sh. The image is slightly larger but correct.
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Compiled application
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# Prisma contract files needed at runtime for migrations
COPY --from=build --chown=nestjs:nodejs /app/src/prisma ./src/prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Startup script (runs migrations then starts the server)
COPY --chown=nestjs:nodejs start.sh ./start.sh
RUN chmod +x ./start.sh

COPY --chown=nestjs:nodejs package.json ./

ENV NODE_ENV=production
ENV PORT=3001

USER nestjs

EXPOSE 3001

CMD ["sh", "start.sh"]

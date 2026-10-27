# =========================================================
# Multi-Stage Production Dockerfile for ElectionDesk
# Stage 1: Build Frontend Assets
# Stage 2: Production Node.js Backend Container
# =========================================================

# --- Stage 1: Frontend Builder ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Backend Runtime ---
FROM node:22-alpine AS production
WORKDIR /app

# Install security patches & create unprivileged runtime user
RUN apk --no-cache add ca-certificates tzdata \
    && addgroup -g 1001 -S electiondesk \
    && adduser -u 1001 -S electiondesk -G electiondesk

ENV NODE_ENV=production
ENV PORT=5000

# Copy Backend package manifests and install production-only dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy built frontend static assets into public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Setup private storage directory with strict unprivileged permissions
RUN mkdir -p /var/data/electiondesk/voter_photos \
    && chown -R electiondesk:electiondesk /app /var/data/electiondesk

# Run container as non-root user
USER electiondesk

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

CMD ["node", "src/server.js"]

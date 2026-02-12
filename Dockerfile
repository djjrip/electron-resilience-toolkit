FROM node:18-alpine

LABEL maintainer="Jayson Quindao"
LABEL description="Electron Resilience Toolkit - Self-healing process watchdog"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create directories for runtime artifacts
RUN mkdir -p heap-snapshots logs

# Expose health check port (optional)
EXPOSE 3000

# Set environment defaults
ENV HEARTBEAT_PATH=/app/heartbeat.lock \
    MAX_MEMORY_MB=1500 \
    CHECK_INTERVAL_MS=5000 \
    HEAP_LIMIT_MB=1200

# Run watchdog as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD test -f /app/heartbeat.lock || exit 1

CMD ["node", "watchdog/process-monitor.js"]

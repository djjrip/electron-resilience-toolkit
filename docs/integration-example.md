# Integration Example: Express API

This example shows how to integrate the resilience toolkit into a real Node.js application.

## Basic Integration

```javascript
// server.js
const express = require('express');
const fs = require('fs');
const heapMonitor = require('./watchdog/heap-monitor');

const app = express();
const HEARTBEAT_FILE = './heartbeat.lock';

// Start heap monitoring
heapMonitor.analyzeHeap();
setInterval(() => heapMonitor.analyzeHeap(), 10000);

// Heartbeat writer (proves event loop is alive)
setInterval(() => {
  fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString());
}, 5000);

// Your API routes
app.get('/api/status', (req, res) => {
  const stats = heapMonitor.getHeapStats();
  res.json({
    status: 'healthy',
    heap: `${stats.used.toFixed(0)}MB / ${stats.limit.toFixed(0)}MB`,
    uptime: process.uptime()
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Heartbeat: enabled');
  console.log('Heap monitoring: enabled');
});
```

## Run with External Watchdog

```bash
# Terminal 1: Run your app
node server.js

# Terminal 2: Run watchdog
node watchdog/process-monitor.js $(pgrep -f "node server.js")
```

## Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - MAX_MEMORY_MB=1500
      - HEARTBEAT_PATH=/app/heartbeat.lock
    volumes:
      - ./heap-snapshots:/app/heap-snapshots
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "test", "-f", "/app/heartbeat.lock"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: './server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        MAX_MEMORY_MB: 1500
      }
    },
    {
      name: 'watchdog',
      script: './watchdog/process-monitor.js',
      args: 'auto', // Auto-detects main app PID
      env: {
        CHECK_INTERVAL_MS: 5000,
        MAX_HEARTBEAT_AGE_MS: 60000
      }
    }
  ]
};
```

## Graceful Shutdown

```javascript
// server.js (continued)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Take final heap snapshot for forensics
  heapMonitor.takeHeapSnapshot('SHUTDOWN');
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

## Result

- **Before:** Manual restarts 3x/week, no crash data
- **After:** Zero manual restarts for 30 days, full crash forensics

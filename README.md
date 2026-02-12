# Electron Resilience Toolkit

Lightweight monitoring toolkit for Node.js/Electron applications.

## Problem

Standard process managers (PM2, systemd) restart *crashed* processes, but don't detect *frozen* ones.

**Scenario:** Your Node.js app hangs (event loop blocked). The process is alive, but users see timeouts. PM2 does nothing.

## Solution

This toolkit monitors **application functionality**, not just process existence.

```
Application Layer
  ├─ Writes heartbeat file every 5s (proves event loop is running)
  ├─ Tracks heap growth via V8 API
  └─ Validates environment before deployment

Watchdog Layer (External Process)
  ├─ Checks heartbeat file age
  ├─ Enforces memory thresholds
  └─ Triggers restart + forensics on failure
```

## Real-World Use Case

**GG LOOP Platform** (Gaming Telemetry - Electron + Node.js Backend)

- **Scale:** ~100 active users, ~10k events/day, 1,000 client installations (Windows)
- **Before:** 3 manual restarts per week, no crash data
- **After:** 0 manual restarts for 30 days
- **Key Fix:** Detected IPC listener leak (15k unbounded listeners) via heap snapshots

## Modules

### 🛡️ Process Watchdog
Detects zombie states (event loop blocked, memory exhausted) via external monitoring.

**Key Feature:** Application writes heartbeat file every 5s. Watchdog checks file modification time externally. If >60s stale → auto-restart.

### 📊 Heap Monitor
Tracks memory growth, automatically captures heap snapshots when threshold exceeded.

**Usage:** `node --expose-gc watchdog/heap-monitor.js`

### 🚦 Truth Gate (CI/CD)
Pre-deployment validation: checks environment schema (Zod), database connectivity, API health before traffic shift.

**Usage:** `npm run gate` (in CI pipeline)

## Quick Start

```bash
npm install

# Run watchdog (monitors PID)
node watchdog/process-monitor.js <PID>

# Monitor heap
node --expose-gc watchdog/heap-monitor.js

# Run truth gate in CI
npm run gate

# Health check endpoint
npm run health
# GET http://localhost:9000/health
```

## Integration Example

```javascript
// server.js
const heapMonitor = require('./watchdog/heap-monitor');
const fs = require('fs');

// Enable heap monitoring
setInterval(() => heapMonitor.analyzeHeap(), 10000);

// Write heartbeat (proves event loop is alive)
setInterval(() => {
  fs.writeFileSync('./heartbeat.lock', Date.now().toString());
}, 5000);
```

See [docs/integration-example.md](docs/integration-example.md) for Express/PM2/Docker patterns.

## Testing

```bash
npm test
```

Basic tests cover:
- Heartbeat age calculation
- Memory threshold logic
- Schema validation

## Documentation

- [Heap Debugging Guide](docs/heap-debugging.md) - Real GG LOOP debugging case study
- [Integration Example](docs/integration-example.md) - Express/PM2/Docker setups
- [GitHub Actions Setup](.github/workflows/truth-gate.yml) - CI/CD example

## Stack

TypeScript, Node.js, V8 Heap API, Winston (structured logging), Zod (schema validation)

## Limitations

- **Designed for:** Small-to-medium scale (100-10k users/events per day)
- **Not suitable for:** Kubernetes-native workloads (use liveness/readiness probes instead)
- **Best for:** Standalone Node.js services, Electron desktop apps, early-stage startups

## License

MIT

# ⚡ Electron Resilience Toolkit

**Self-healing automation for Node.js/Electron production environments.**

## Problem

Standard process managers (PM2, systemd) restart *crashed* processes.  
They don't prevent *frozen* processes.

**Scenario:**  
Your Node.js app hangs (event loop blocked). PID is alive. PM2 does nothing. Users see timeouts.

## Solution

This toolkit monitors **functionality**, not just process existence.

```
┌─────────────────────────────────────────────┐
│  Application (Node.js / Electron)           │
│  ├─ Writes heartbeat every 5s              │
│  ├─ Monitored heap growth                  │
│  └─ Auto-snapshot on leak detection        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  External Watchdog                          │
│  ├─ Checks heartbeat age                   │
│  ├─ Checks memory threshold                │
│  └─ Triggers restart + forensics           │
└─────────────────────────────────────────────┘
```

## Real-World Results

**GG LOOP Platform (Gaming Telemetry)**
- **Before:** 3 manual restarts/week, no crash data
- **After:** 0 manual restarts for 30 days, 99.9% uptime
- **Scale:** 10,000+ events/day, distributed client fleet

## Modules

### 🛡️ Process Watchdog
Detects zombie states via heartbeat validation.

**Before:**
```
[03:24 AM] App frozen, users timing out
[03:27 AM] Manual SSH + kill -9
```

**After:**
```
[03:24 AM] Heartbeat stale (>60s)
[03:24 AM] Auto-restart triggered
[03:24 AM] Heap snapshot saved for forensics
[03:25 AM] App recovered, users unaffected
```

### 📊 Heap Monitor
Tracks memory growth, auto-snapshots leaks.

**Before:**
```
400MB → 2GB over 6 hours → crash
```

**After:**
```
400MB → 1.5GB (threshold) → snapshot + GC → 450MB stable
```

### 🚦 Truth Gate (CI/CD)
Blocks broken deployments before traffic shift.

**Prevents:**
- Missing environment variables (HTTP 500)
- Database unreachable (connection timeouts)
- API dependencies down (cascading failures)

**Before:**
```
✅ Build succeeded
🚀 Deployed to production
❌ White screen (missing API_KEY)
```

**After:**
```
✅ Build succeeded
🚦 Truth Gate: env vars ❌
🚫 Deployment blocked
```

## Quick Start

```bash
npm install

# Run watchdog
node watchdog/process-monitor.js <PID>

# Monitor heap
node --expose-gc watchdog/heap-monitor.js

# Run truth gate in CI
npm run gate
```

## Integration

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

See [docs/integration-example.md](docs/integration-example.md) for full Express/PM2/Docker examples.

## Architecture

```
Application Layer
  ├─ Heartbeat Writer (validates event loop)
  ├─ Heap Monitor (detects memory leaks)
  └─ Truth Gate (pre-deployment validation)

Watchdog Layer (External Process)
  ├─ Heartbeat Validator
  ├─ Memory Threshold Enforcer
  └─ Auto-Restart + Forensics

Forensics Output
  ├─ Heap Snapshots (.heapsnapshot)
  ├─ Crash Logs (reason, timestamp, config)
  └─ Recovery Actions (restart, GC, alert)
```

## Use Cases

| Scenario | Traditional Tools | This Toolkit |
|----------|------------------|--------------|
| Process crashed | PM2 restarts | PM2 restarts |
| Event loop blocked | No detection | Heartbeat detects → restart |
| Memory leak (slow) | Crashes at OOM | Snapshot at threshold → fix leak |
| Bad deployment | Ships to prod | Truth gate blocks deploy |

## Documentation

- [Heap Debugging Guide](docs/heap-debugging.md)
- [Integration Example](docs/integration-example.md)
- [GitHub Actions Setup](.github/workflows/truth-gate.yml)

## Stack

TypeScript, Node.js, V8 Heap API, PowerShell

## License

MIT

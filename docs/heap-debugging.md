# Heap Debugging Guide

## Reproducing Memory Leaks

### Step 1: Run with Heap Monitoring
```bash
node --expose-gc --inspect watchdog/heap-monitor.js
```

### Step 2: Monitor Heap Growth
The heap monitor will log stats every 10 seconds:
```
📊 Heap: 145MB / 2048MB (7.1%)
📊 Heap: 287MB / 2048MB (14.0%)
⚠️  Heap usage at 82.3% - approaching limit
```

### Step 3: Automatic Snapshot on Threshold
When heap exceeds configured limit (default: 1200MB), snapshot is automatically saved:
```
❌ CRITICAL: Heap limit exceeded (1247MB)
📸 Taking heap snapshot: LIMIT_EXCEEDED
✅ Snapshot saved: ./heap-snapshots/heap-2026-02-11T20-35-12-345Z-LIMIT_EXCEEDED.heapsnapshot
```

## Analyzing Snapshots

### Open in Chrome DevTools
1. Open Chrome: `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to Memory tab
4. Click "Load" and select your `.heapsnapshot` file

### Compare Snapshots
1. Take baseline snapshot (before leak)
2. Trigger leak action (load page, run query, etc.)
3. Take second snapshot
4. In DevTools, select second snapshot
5. Change view to "Comparison"
6. Select baseline as comparison target

### What to Look For

**Growing Objects:**
- Arrays with >1000 new elements
- Event emitters with increasing listener counts
- Closures holding large objects

**Common Culprits:**
```javascript
// ❌ BAD: Unbounded cache
const cache = {};
setInterval(() => {
  cache[Date.now()] = largeData; // Grows forever
}, 1000);

// ✅ GOOD: Bounded cache with WeakMap
const cache = new WeakMap();
// Auto-GCs when key is no longer referenced
```

**Electron-Specific:**
```javascript
// ❌ BAD: IPC listeners never removed
ipcRenderer.on('event', handler);

// ✅ GOOD: Clean up on unmount
useEffect(() => {
  ipcRenderer.on('event', handler);
  return () => ipcRenderer.removeListener('event', handler);
}, []);
```

## Manual Snapshot Workflow

```javascript
const heapMonitor = require('./watchdog/heap-monitor');

// Take snapshot before operation
heapMonitor.takeHeapSnapshot('BEFORE_OPERATION');

// Run your suspect code
await suspectOperation();

// Take snapshot after
heapMonitor.takeHeapSnapshot('AFTER_OPERATION');

// Compare in DevTools
```

## Forcing Garbage Collection

```bash
# Run with --expose-gc flag
node --expose-gc myapp.js
```

```javascript
// In code
if (global.gc) {
  console.log('Forcing GC...');
  global.gc();
  console.log('GC complete');
}
```

## Real-World Example (GG LOOP)

**Problem:**  
Electron app memory grew from 400MB → 2GB over 6 hours, causing crashes.

**Diagnosis:**
1. Added heap monitor with 1.5GB threshold
2. Snapshot captured at 1.6GB
3. DevTools showed 15,000 IPC listeners for `match-update` event

**Root Cause:**  
React component re-rendered 15,000 times without cleaning up IPC listener.

**Fix:**
```javascript
useEffect(() => {
  const handler = (event, data) => setMatchData(data);
  ipcRenderer.on('match-update', handler);
  return () => ipcRenderer.removeListener('match-update', handler);
}, []); // Empty deps = register once
```

**Result:**  
Memory stabilized at 450MB, no crashes for 30+ days.

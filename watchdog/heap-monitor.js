const v8 = require('v8');
const fs = require('fs');

/**
 * HEAP MONITOR - Memory Leak Detection
 * Tracks heap statistics and triggers snapshots when thresholds are exceeded
 */

const CONFIG = {
    checkInterval: parseInt(process.env.HEAP_CHECK_INTERVAL_MS) || 10000,
    heapLimitMB: parseInt(process.env.HEAP_LIMIT_MB) || 1200,
    snapshotDir: process.env.SNAPSHOT_DIR || './heap-snapshots',
    alertThresholdPercent: parseInt(process.env.ALERT_THRESHOLD) || 80
};

// Ensure snapshot directory exists
if (!fs.existsSync(CONFIG.snapshotDir)) {
    fs.mkdirSync(CONFIG.snapshotDir, { recursive: true });
}

console.log('📊 Heap Monitor Started');
console.log('Config:', CONFIG);

function getHeapStats() {
    const stats = v8.getHeapStatistics();
    const used = stats.used_heap_size / 1024 / 1024;
    const total = stats.total_heap_size / 1024 / 1024;
    const limit = stats.heap_size_limit / 1024 / 1024;
    const percent = (used / limit) * 100;

    return { used, total, limit, percent };
}

function takeHeapSnapshot(reason) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${CONFIG.snapshotDir}/heap-${timestamp}-${reason}.heapsnapshot`;

    console.log(`📸 Taking heap snapshot: ${reason}`);

    const snapshot = v8.writeHeapSnapshot(filename);
    console.log(`✅ Snapshot saved: ${snapshot}`);

    return snapshot;
}

function analyzeHeap() {
    const stats = getHeapStats();

    console.log(`📊 Heap: ${stats.used.toFixed(0)}MB / ${stats.limit.toFixed(0)}MB (${stats.percent.toFixed(1)}%)`);

    // Alert threshold check
    if (stats.percent >= CONFIG.alertThresholdPercent && stats.percent < 95) {
        console.warn(`⚠️  Heap usage at ${stats.percent.toFixed(1)}% - approaching limit`);
    }

    // Critical threshold - take snapshot
    if (stats.used >= CONFIG.heapLimitMB) {
        console.error(`❌ CRITICAL: Heap limit exceeded (${stats.used.toFixed(0)}MB)`);
        takeHeapSnapshot('LIMIT_EXCEEDED');

        // Trigger GC if available
        if (global.gc) {
            console.log('🗑️  Forcing garbage collection...');
            global.gc();

            setTimeout(() => {
                const afterGC = getHeapStats();
                console.log(`✅ After GC: ${afterGC.used.toFixed(0)}MB (freed ${(stats.used - afterGC.used).toFixed(0)}MB)`);
            }, 1000);
        }

        return false;
    }

    return true;
}

// Periodic heap monitoring
setInterval(analyzeHeap, CONFIG.checkInterval);

// Initial check
analyzeHeap();

// Graceful shutdown handler
process.on('SIGTERM', () => {
    console.log('📸 Shutdown requested - taking final heap snapshot');
    takeHeapSnapshot('SHUTDOWN');
    process.exit(0);
});

// Export for programmatic use
module.exports = {
    getHeapStats,
    takeHeapSnapshot,
    analyzeHeap
};

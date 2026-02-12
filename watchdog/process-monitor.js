const fs = require('fs');
const { exec } = require('child_process');

/**
 * PROCESS MONITOR (Node.js)
 * Monitors application health via heartbeat validation and memory checks
 */

const CONFIG = {
    heartbeatFile: process.env.HEARTBEAT_PATH || './heartbeat.lock',
    maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB) || 1500,
    maxHeartbeatAge: parseInt(process.env.MAX_HEARTBEAT_AGE_MS) || 60000,
    checkInterval: parseInt(process.env.CHECK_INTERVAL_MS) || 5000,
    targetPID: parseInt(process.argv[2]) || null,
    maxRestartAttempts: 3
};

console.log('🛡️ Process Monitor Started');
console.log('Config:', CONFIG);

function checkHeartbeat() {
    try {
        const stats = fs.statSync(CONFIG.heartbeatFile);
        const age = Date.now() - stats.mtimeMs;

        if (age > CONFIG.maxHeartbeatAge) {
            console.error(`❌ FATAL: Event loop stalled (${age}ms since last heartbeat)`);
            triggerRestart('EVENT_LOOP_STALL');
            return false;
        }
        return true;
    } catch (e) {
        console.error('❌ FATAL: Heartbeat file missing');
        return false;
    }
}

function checkMemory(pid) {
    if (!pid) return Promise.resolve(true);

    return new Promise((resolve) => {
        exec(`tasklist /FI "PID eq ${pid}" /FO CSV`, (err, stdout) => {
            if (err) {
                console.error('Memory check failed:', err.message);
                return resolve(true);
            }

            // Parse CSV output for memory usage
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) return resolve(true);

            const memStr = lines[1].split(',')[4]?.replace(/"/g, '').replace(/[^0-9]/g, '');
            const memKB = parseInt(memStr);
            const memMB = memKB / 1024;

            if (memMB > CONFIG.maxMemoryMB) {
                console.error(`❌ FATAL: Memory limit exceeded (${memMB.toFixed(0)}MB / ${CONFIG.maxMemoryMB}MB)`);
                triggerRestart('MEMORY_LIMIT');
                return resolve(false);
            }

            console.log(`✅ Memory: ${memMB.toFixed(0)}MB`);
            resolve(true);
        });
    });
}

let restartAttempts = 0;

function triggerRestart(reason) {
    if (restartAttempts >= CONFIG.maxRestartAttempts) {
        console.error(`⛔ Max restart attempts (${CONFIG.maxRestartAttempts}) reached. Giving up.`);
        process.exit(1);
    }

    restartAttempts++;
    const backoffMs = Math.pow(2, restartAttempts) * 1000;

    console.log(`⚠️  RESTART TRIGGERED: ${reason}`);
    console.log(`⚠️  Attempt: ${restartAttempts}/${CONFIG.maxRestartAttempts}`);
    console.log(`⚠️  Backoff: ${backoffMs}ms`);
    console.log(`⚠️  Timestamp: ${new Date().toISOString()}`);

    const forensicLog = {
        timestamp: new Date().toISOString(),
        reason,
        attempt: restartAttempts,
        backoffMs,
        config: CONFIG
    };

    fs.appendFileSync('restart-forensics.log', JSON.stringify(forensicLog) + '\n');

    // Implement your restart logic here with exponential backoff
    // setTimeout(() => exec('pm2 restart app'), backoffMs);
}

async function healthCheck() {
    const heartbeatOK = checkHeartbeat();
    const memoryOK = await checkMemory(CONFIG.targetPID);

    if (heartbeatOK && memoryOK) {
        console.log('✅ Health check passed');
    }
}

function cleanup() {
    console.log('🛑 Shutting down gracefully...');
    try {
        if (fs.existsSync(CONFIG.heartbeatFile)) {
            fs.unlinkSync(CONFIG.heartbeatFile);
            console.log('✅ Cleaned up heartbeat file');
        }
    } catch (e) {
        console.error('❌ Cleanup failed:', e.message);
    }
    process.exit(0);
}

// Graceful shutdown handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Main loop
setInterval(healthCheck, CONFIG.checkInterval);
healthCheck(); // Run immediately

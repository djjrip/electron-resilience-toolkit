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
    targetPID: parseInt(process.argv[2]) || null
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

function triggerRestart(reason) {
    console.log(`⚠️  RESTART TRIGGERED: ${reason}`);
    console.log(`⚠️  Timestamp: ${new Date().toISOString()}`);

    // Log to forensics file
    const forensicLog = {
        timestamp: new Date().toISOString(),
        reason,
        config: CONFIG
    };

    fs.appendFileSync('restart-forensics.log', JSON.stringify(forensicLog) + '\n');

    // Implement your restart logic here
    // e.g., exec('pm2 restart app')
}

async function healthCheck() {
    const heartbeat Status = checkHeartbeat();
    const memoryOK = await checkMemory(CONFIG.targetPID);

    if (heartbeatOK && memoryOK) {
        console.log('✅ Health check passed');
    }
}

// Main loop
setInterval(healthCheck, CONFIG.checkInterval);
healthCheck(); // Run immediately

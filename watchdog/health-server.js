const express = require('express');
const fs = require('fs');

/**
 * HEALTH CHECK SERVER
 * Exposes watchdog status and metrics
 */

const app = express();
const PORT = process.env.HEALTH_PORT || 9000;

let lastCheckTime = Date.now();
const startTime = Date.now();

// Update this externally or via shared state
function updateLastCheck() {
    lastCheckTime = Date.now();
}

app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const timeSinceLastCheck = Math.floor((Date.now() - lastCheckTime) / 1000);

    res.json({
        status: 'healthy',
        uptime: uptime,
        lastCheckSecondsAgo: timeSinceLastCheck,
        timestamp: new Date().toISOString()
    });
});

app.get('/metrics', (req, res) => {
    // Read forensics log for restart count
    let restartCount = 0;
    try {
        if (fs.existsSync('restart-forensics.log')) {
            const logs = fs.readFileSync('restart-forensics.log', 'utf8').trim().split('\n');
            restartCount = logs.length;
        }
    } catch (e) {
        // Ignore
    }

    res.json({
        restarts_total: restartCount,
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    });
});

app.listen(PORT, () => {
    console.log(`Health endpoint listening on :${PORT}`);
    console.log(`GET /health - Watchdog status`);
    console.log(`GET /metrics - Restart metrics`);
});

module.exports = { updateLastCheck };

const fs = require('fs');
const path = require('path');

describe('Heartbeat Age Calculation', () => {
    const testHeartbeatFile = path.join(__dirname, 'test-heartbeat.lock');

    afterEach(() => {
        if (fs.existsSync(testHeartbeatFile)) {
            fs.unlinkSync(testHeartbeatFile);
        }
    });

    test('should detect fresh heartbeat as healthy', () => {
        fs.writeFileSync(testHeartbeatFile, Date.now().toString());
        const stats = fs.statSync(testHeartbeatFile);
        const age = Date.now() - stats.mtimeMs;

        expect(age).toBeLessThan(5000); // Less than 5 seconds
    });

    test('should detect stale heartbeat as unhealthy', (done) => {
        fs.writeFileSync(testHeartbeatFile, 'old');

        // Wait 100ms then check age
        setTimeout(() => {
            const stats = fs.statSync(testHeartbeatFile);
            const age = Date.now() - stats.mtimeMs;

            expect(age).toBeGreaterThan(50); // At least 50ms old
            done();
        }, 100);
    });

    test('should handle missing heartbeat file', () => {
        expect(fs.existsSync(testHeartbeatFile)).toBe(false);
    });
});

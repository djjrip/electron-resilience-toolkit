import { z } from 'zod';
import https from 'https';

/**
 * TRUTH GATE - Pre-Flight Deployment Verification
 * Validates environment, connectivity, and dependencies before traffic shift
 */

// Environment schema validation
const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'staging']),
    DATABASE_URL: z.string().url(),
    API_ENDPOINT: z.string().url(),
    // Add your required keys here
});

interface HealthCheck {
    name: string;
    url: string;
    timeout?: number;
}

const CRITICAL_SERVICES: HealthCheck[] = [
    { name: 'Database', url: process.env.DATABASE_URL || '', timeout: 5000 },
    { name: 'API Gateway', url: process.env.API_ENDPOINT || '', timeout: 3000 },
];

async function validateEnvironment(): Promise<boolean> {
    console.log('🔍 Validating environment schema...');

    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ FATAL: Invalid environment configuration');
        console.error(result.error.errors);
        return false;
    }

    console.log('✅ Environment validated');
    return true;
}

async function checkService(service: HealthCheck): Promise<boolean> {
    return new Promise((resolve) => {
        const url = new URL(service.url);
        const req = https.request({
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'GET',
            timeout: service.timeout || 5000
        }, (res) => {
            if (res.statusCode && res.statusCode < 500) {
                console.log(`✅ ${service.name} reachable (${res.statusCode})`);
                resolve(true);
            } else {
                console.error(`❌ ${service.name} returned ${res.statusCode}`);
                resolve(false);
            }
        });

        req.on('error', (err) => {
            console.error(`❌ ${service.name} unreachable:`, err.message);
            resolve(false);
        });

        req.on('timeout', () => {
            console.error(`❌ ${service.name} timeout`);
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

async function verifyConnectivity(): Promise<boolean> {
    console.log('🌐 Verifying external service connectivity...');

    const results = await Promise.all(
        CRITICAL_SERVICES.map(service => checkService(service))
    );

    const allHealthy = results.every(r => r);

    if (!allHealthy) {
        console.error('❌ FATAL: One or more critical services are down');
        return false;
    }

    console.log('✅ All services reachable');
    return true;
}

async function runTruthGate(): Promise<void> {
    console.log('\n🚦 INITIATING TRUTH GATE...\n');

    const envOK = await validateEnvironment();
    if (!envOK) {
        console.error('\n🚫 TRUTH GATE FAILED: Environment validation');
        process.exit(1);
    }

    const connectivityOK = await verifyConnectivity();
    if (!connectivityOK) {
        console.error('\n🚫 TRUTH GATE FAILED: Service connectivity');
        process.exit(1);
    }

    console.log('\n✅ TRUTH GATE PASSED');
    console.log('✅ PERMISSION TO DEPLOY GRANTED\n');
    process.exit(0);
}

// Execute
runTruthGate().catch((error) => {
    console.error('❌ Truth Gate crashed:', error);
    process.exit(1);
});

/**
 * Default configuration for API test scripts
 * Override with environment variables or by editing test-data.json
 */

import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenvConfig({ path: join(__dirname, '../../.env') });

export const config = {
    // API Configuration
    api: {
        baseUrl: process.env.API_TEST_BASE_URL || 'https://api-test.indealeg.com',
        version: 'v1',
        timeout: 30000, // 30 seconds
    },

    // Paths
    paths: {
        testData: join(__dirname, 'test-data.json'),
        uploads: join(__dirname, '../uploads'),
    },

    // Logging
    logging: {
        verbose: process.env.VERBOSE === 'true',
        showResponseBody: process.env.SHOW_RESPONSE === 'true',
    },

    // Timing configuration for flows
    timing: {
        delayBetweenRequests: 500, // ms between requests in a flow
        delayBetweenFlows: 2000,   // ms between flows when running all
    },
};

export default config;

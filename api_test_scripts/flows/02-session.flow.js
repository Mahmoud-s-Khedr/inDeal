/**
 * Flow 02: Agent Login/Logout Session
 * 
 * Simulates a typical user session:
 * 1. Login with credentials
 * 2. Get user profile
 * 3. Get company profile
 * 4. Logout
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runSessionFlow(credentials = null) {
    return runFlow(
        'Login/Logout Session',
        'Authenticate, access user and company data, then logout',
        async (results) => {
            // Clear any existing auth
            apiClient.clearTokens();

            // Get credentials
            let email, password;

            if (credentials) {
                email = credentials.email;
                password = credentials.password;
            } else {
                try {
                    const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
                    email = testData.users[0].email;
                    password = testData.users[0].password;
                } catch {
                    console.log(chalk.red('  ✗ No test data found. Run: npm run generate-data'));
                    throw new Error('Test data file not found');
                }
            }

            console.log(chalk.gray(`  Email: ${email}`));

            // Step 1: Login
            let loginResult;
            results.push(await step('Login', async () => {
                loginResult = await apiClient.login(email, password);
                console.log(chalk.gray(`    User ID: ${loginResult.data?.user?.id}`));
                console.log(chalk.gray(`    Role: ${loginResult.data?.user?.role}`));
                return loginResult;
            }));

            if (!results[results.length - 1].success) {
                console.log(chalk.red('  ✗ Login failed, cannot continue flow'));
                return;
            }

            await delayBetweenRequests();

            // Step 2: Get user profile
            let userProfile;
            results.push(await step('Get user profile (/users/me)', async () => {
                userProfile = await apiClient.getMe();
                console.log(chalk.gray(`    Name: ${userProfile.data?.firstName} ${userProfile.data?.lastName}`));
                console.log(chalk.gray(`    Email: ${userProfile.data?.email}`));
                return userProfile;
            }));

            await delayBetweenRequests();

            // Step 3: Get company profile
            let companyProfile;
            results.push(await step('Get company profile (/companies/me)', async () => {
                companyProfile = await apiClient.getMyCompany();
                console.log(chalk.gray(`    Company: ${companyProfile.data?.company?.name}`));
                console.log(chalk.gray(`    Status: ${companyProfile.data?.company?.status}`));
                console.log(chalk.gray(`    Type: ${companyProfile.data?.company?.companyType}`));
                return companyProfile;
            }));

            await delayBetweenRequests();

            // Step 4: Logout
            results.push(await step('Logout', async () => {
                const logoutResult = await apiClient.logout();
                console.log(chalk.gray('    Session terminated'));
                return logoutResult;
            }));

            // Step 5: Verify logout (optional - should fail)
            results.push(await step('Verify token invalidated', async () => {
                try {
                    // This should fail since we logged out
                    await apiClient.getMe();
                    throw new Error('Token should have been invalidated');
                } catch (error) {
                    if (error.response?.status === 401) {
                        console.log(chalk.gray('    ✓ Token correctly invalidated'));
                        return { verified: true };
                    }
                    throw error;
                }
            }));

            return {
                loginResult,
                userProfile,
                companyProfile,
            };
        }
    );
}

// Run if executed directly
if (process.argv[1].includes('02-session.flow.js')) {
    runSessionFlow().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

export default runSessionFlow;

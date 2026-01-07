/**
 * Flow 03: Password Reset
 * 
 * Simulates the password reset flow:
 * 1. Request OTP (forgot password)
 * 2. Verify OTP
 * 3. Reset password
 * 4. Login with new password
 * 
 * Note: This flow requires manual OTP entry or a test email service
 */

import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runPasswordResetFlow(testEmail = null, testOtp = null) {
    return runFlow(
        'Password Reset',
        'Request OTP, verify, and reset password',
        async (results) => {
            // Clear any existing auth
            apiClient.clearTokens();

            // Get email
            let email, otp;

            if (testEmail) {
                email = testEmail;
                otp = testOtp;
            } else {
                try {
                    const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
                    email = testData.users[0].email;
                    otp = testData.testTokens?.passwordResetOtp || null;
                } catch {
                    console.log(chalk.red('  ✗ No test data found. Run: npm run generate-data'));
                    throw new Error('Test data file not found');
                }
            }

            console.log(chalk.gray(`  Email: ${email}`));

            // Step 1: Request OTP
            results.push(await step('Request password reset OTP', async () => {
                const result = await apiClient.forgotPassword(email);
                console.log(chalk.yellow('    ⚠ OTP sent to email'));
                console.log(chalk.gray('    Check email and update testTokens.passwordResetOtp in test-data.json'));
                return result;
            }));

            if (!results[results.length - 1].success) {
                return;
            }

            await delayBetweenRequests();

            // Check if we have OTP to continue
            if (!otp) {
                results.push(await step('Waiting for OTP (manual step)', async () => {
                    console.log(chalk.yellow('    ⚠ No OTP provided'));
                    console.log(chalk.gray('    To complete this flow:'));
                    console.log(chalk.gray('    1. Check email for OTP'));
                    console.log(chalk.gray('    2. Update testTokens.passwordResetOtp in test-data.json'));
                    console.log(chalk.gray('    3. Re-run this flow'));
                    return { status: 'waiting_for_otp' };
                }));
                return;
            }

            // Step 2: Verify OTP
            results.push(await step('Verify OTP', async () => {
                const result = await apiClient.verifyOtp(email, otp);
                console.log(chalk.green('    ✓ OTP verified'));
                return result;
            }));

            if (!results[results.length - 1].success) {
                console.log(chalk.red('  ✗ OTP verification failed'));
                return;
            }

            await delayBetweenRequests();

            // Step 3: Reset password
            const newPassword = `NewPassword${Date.now()}!`;
            results.push(await step('Reset password', async () => {
                const result = await apiClient.resetPassword(email, otp, newPassword, newPassword);
                console.log(chalk.green('    ✓ Password reset successful'));
                console.log(chalk.gray(`    New password: ${newPassword}`));
                return result;
            }));

            if (!results[results.length - 1].success) {
                return;
            }

            await delayBetweenRequests();

            // Step 4: Login with new password
            results.push(await step('Login with new password', async () => {
                const result = await apiClient.login(email, newPassword);
                console.log(chalk.green('    ✓ Login successful with new password'));
                return result;
            }));

            // Optional: Update test data file with new password
            try {
                const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
                const userIndex = testData.users.findIndex(u => u.email === email);
                if (userIndex >= 0) {
                    testData.users[userIndex].password = newPassword;
                    testData.testTokens.passwordResetOtp = ''; // Clear used OTP
                    writeFileSync(config.paths.testData, JSON.stringify(testData, null, 2));
                    console.log(chalk.gray('\n  📝 Updated test-data.json with new password'));
                }
            } catch {
                // Ignore file update errors
            }

            // Cleanup: logout
            try {
                await apiClient.logout();
            } catch {
                // Ignore logout errors
            }

            return { newPassword };
        }
    );
}

// Run if executed directly
if (process.argv[1].includes('03-password-reset.flow.js')) {
    runPasswordResetFlow().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

export default runPasswordResetFlow;

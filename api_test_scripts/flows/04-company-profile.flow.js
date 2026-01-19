/**
 * Flow 04: Company Profile Management
 *
 * Simulates managing company profile:
 * 1. Login
 * 2. Get current company profile
 * 3. Update profile details
 * 4. Submit for review (if needed)
 * 5. Verify changes
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { generateCompany } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runCompanyProfileFlow(credentials = null) {
  return runFlow(
    'Company Profile Management',
    'Update company profile and submit for review',
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

      // Step 1: Login
      results.push(
        await step('Login', async () => {
          return await apiClient.login(email, password);
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      // Step 2: Get current profile
      let currentProfile;
      results.push(
        await step('Get current company profile', async () => {
          currentProfile = await apiClient.getMyCompany();
          const company = currentProfile.data?.company;
          console.log(chalk.gray(`    Name: ${company?.name}`));
          console.log(chalk.gray(`    Status: ${company?.status}`));
          console.log(chalk.gray(`    Description: ${company?.description?.substring(0, 50)}...`));
          return currentProfile;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      // Step 3: Update profile
      const updates = {
        description: generateCompany().description,
        phone: `+20${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        contacts: [
          { type: 'email', value: `updated-${Date.now()}@example.com` },
          { type: 'phone', value: `+20${Math.floor(1000000000 + Math.random() * 9000000000)}` },
        ],
      };

      results.push(
        await step('Update company profile', async () => {
          const result = await apiClient.updateMyCompany(updates);
          console.log(chalk.gray('    Updated fields: description, phone, contacts'));
          return result;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      // Step 4: Verify changes
      results.push(
        await step('Verify profile changes', async () => {
          const updated = await apiClient.getMyCompany();
          const company = updated.data?.company;

          // Check if changes were applied
          if (company?.phone === updates.phone) {
            console.log(chalk.green('    ✓ Phone updated correctly'));
          } else {
            console.log(chalk.yellow('    ⚠ Phone not updated as expected'));
          }

          return updated;
        })
      );

      await delayBetweenRequests();

      // Step 5: Submit for review (if status allows)
      const currentStatus = currentProfile.data?.company?.status;
      if (currentStatus !== 'active') {
        results.push(
          await step('Submit for review', async () => {
            const result = await apiClient.resendForReview();
            console.log(chalk.gray('    Company submitted for admin review'));
            return result;
          })
        );
      } else {
        results.push(
          await step('Skip review submission (already active)', async () => {
            console.log(chalk.gray('    Company is already active, no review needed'));
            return { skipped: true };
          })
        );
      }

      // Cleanup: logout
      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { updates };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('04-company-profile.flow.js')) {
  runCompanyProfileFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runCompanyProfileFlow;

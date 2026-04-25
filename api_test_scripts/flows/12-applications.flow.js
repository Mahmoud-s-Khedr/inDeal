/**
 * Flow 12: Deal Applications (Requests) Management
 *
 * Simulates applying to deals and managing requests:
 * 1. Login
 * 2. Search for a deal to apply to
 * 3. Create a deal request (application)
 * 4. Get my sent requests
 * 5. Update request status (e.g. pause/cancel)
 * 6. Delete the request
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { generateDealRequest } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runApplicationsFlow(credentials = null) {
  return runFlow(
    'Applications Management',
    'Apply to deals and manage requests',
    async (results) => {
      apiClient.clearTokens();

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

      // Step 2: Search for a deal
      let targetDealId;
      results.push(
        await step('Find a deal', async () => {
          const result = await apiClient.getDeals({ limit: 1 });
          const deals = result.data?.data || result.data || [];
          if (deals.length > 0) {
            targetDealId = deals[0].id;
            console.log(chalk.gray(`    Found deal ID: ${targetDealId}`));
          } else {
            console.log(chalk.yellow('    ⚠ No deals found to apply to. Cannot continue.'));
          }
          return result;
        })
      );

      if (!targetDealId) {
        return;
      }

      await delayBetweenRequests();

      // Step 3: Create a Deal Request
      const newRequest = generateDealRequest();
      let createdRequestId;
      results.push(
        await step('Apply to deal', async () => {
          const result = await apiClient.createDealRequest(targetDealId, newRequest);
          createdRequestId = result.data?.id || result.data?.request?.id;
          console.log(chalk.gray(`    Created request ID: ${createdRequestId}`));
          return result;
        })
      );

      if (!createdRequestId) {
        console.log(chalk.yellow('    ⚠ Could not create request, skipping remaining steps'));
        return;
      }

      await delayBetweenRequests();

      // Step 4: Get My Requests
      results.push(
        await step('Get my requests', async () => {
          const result = await apiClient.getMyRequests();
          console.log(chalk.gray(`    Total requests found: ${result.data?.length || 0}`));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 5: Pause the Request
      results.push(
        await step('Pause the request', async () => {
          const result = await apiClient.pauseRequest(createdRequestId);
          console.log(chalk.gray('    Request paused'));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 6: Delete the Request
      results.push(
        await step('Delete the request', async () => {
          const result = await apiClient.deleteRequest(createdRequestId);
          console.log(chalk.gray('    Request deleted successfully'));
          return result;
        })
      );

      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { completed: true };
    }
  );
}

if (process.argv[1].includes('12-applications.flow.js')) {
  runApplicationsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runApplicationsFlow;

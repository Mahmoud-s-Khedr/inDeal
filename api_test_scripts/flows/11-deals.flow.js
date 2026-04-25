/**
 * Flow 11: Deals Management
 *
 * Simulates managing deals:
 * 1. Login
 * 2. Create a deal
 * 3. Get my deals
 * 4. Update a deal
 * 5. Search deals
 * 6. Delete a deal
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { generateDeal } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runDealsFlow(credentials = null) {
  return runFlow(
    'Deals Management',
    'Create, update, search, and delete deals',
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

      // Step 2: Create a Deal
      const newDeal = generateDeal();
      let createdDealId;
      results.push(
        await step('Create a deal', async () => {
          const result = await apiClient.createDeal(newDeal);
          createdDealId = result.data?.id || result.data?.deal?.id;
          console.log(chalk.gray(`    Created deal ID: ${createdDealId}`));
          return result;
        })
      );

      if (!createdDealId) {
        console.log(chalk.yellow('    ⚠ Could not create deal, skipping remaining steps'));
        return;
      }

      await delayBetweenRequests();

      // Step 3: Get My Deals
      results.push(
        await step('Get my deals', async () => {
          const result = await apiClient.getMyDeals();
          console.log(chalk.gray(`    Total deals found: ${result.data?.length || 0}`));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 4: Update the Deal
      results.push(
        await step('Update the deal', async () => {
          const updateData = { dealValue: 50000 };
          const result = await apiClient.updateDeal(createdDealId, updateData);
          console.log(chalk.gray('    Updated deal value'));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 5: Search Deals
      results.push(
        await step('Search deals', async () => {
          const result = await apiClient.getDeals({ limit: 10 });
          console.log(
            chalk.gray(
              `    Deals returned from search: ${result.data?.data?.length || result.data?.length || 0}`
            )
          );
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 6: Delete the Deal
      results.push(
        await step('Delete the deal', async () => {
          const result = await apiClient.deleteDeal(createdDealId);
          console.log(chalk.gray('    Deal deleted successfully'));
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

if (process.argv[1].includes('11-deals.flow.js')) {
  runDealsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runDealsFlow;

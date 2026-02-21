/**
 * Flow 10: Company Route Regression (Singular vs Plural)
 *
 * Verifies:
 * 1. Wrong singular path `/company` returns 404
 * 2. Correct plural path `/companies` works for contribution delete
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runCompanyRouteRegressionFlow(credentials = null) {
  return runFlow(
    'Company Route Regression',
    'Assert /company returns 404 and /companies remains the valid path',
    async (results) => {
      apiClient.clearTokens();

      let email;
      let password;

      if (credentials) {
        email = credentials.email;
        password = credentials.password;
      } else {
        const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
        email = testData.users[0].email;
        password = testData.users[0].password;
      }

      results.push(
        await step('Login', async () => {
          return await apiClient.login(email, password);
        })
      );
      if (!results[results.length - 1].success) return;

      await delayBetweenRequests();

      let contributionId;
      results.push(
        await step('Create contribution for route test', async () => {
          const payload = {
            type: 'product',
            title: `Route Regression ${Date.now()}`,
            description: 'Temporary contribution for route regression check.',
          };
          const created = await apiClient.createContribution(payload);
          contributionId = created?.data?.id;
          if (!contributionId) {
            throw new Error('Failed to create contribution for route regression test');
          }
          return created;
        })
      );
      if (!results[results.length - 1].success) return;

      await delayBetweenRequests();

      results.push(
        await step('Assert singular /company path returns 404', async () => {
          try {
            await apiClient.client.delete(`/company/me/contributions/${contributionId}`);
            throw new Error('Expected 404 on /company path, but request succeeded');
          } catch (error) {
            const status = error?.response?.status;
            if (status !== 404) {
              throw new Error(`Expected 404 on /company path, got ${status ?? 'network error'}`);
            }
            console.log(chalk.gray('    Received expected 404 for singular /company path'));
            return { status };
          }
        })
      );

      await delayBetweenRequests();

      results.push(
        await step('Delete contribution using valid /companies path', async () => {
          const deleted = await apiClient.deleteContribution(contributionId);
          console.log(chalk.gray(`    Deleted contribution ${contributionId}`));
          return deleted;
        })
      );
    }
  );
}

if (process.argv[1].includes('10-company-route-regression.flow.js')) {
  runCompanyRouteRegressionFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runCompanyRouteRegressionFlow;

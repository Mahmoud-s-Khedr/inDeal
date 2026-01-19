/**
 * Flow 09: Admin Company Management
 *
 * Simulates admin workflow:
 * 1. Admin login
 * 2. List pending companies
 * 3. View company details
 * 4. Approve/reject company
 * 5. Update company status
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runAdminFlow(adminCredentials = null) {
  return runFlow(
    'Admin Company Management',
    'Admin login, review pending companies, and manage status',
    async (results) => {
      // Clear any existing auth
      apiClient.clearTokens();

      // Get admin credentials
      let email, password;

      if (adminCredentials) {
        email = adminCredentials.email;
        password = adminCredentials.password;
      } else {
        try {
          const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
          email = testData.admin?.email;
          password = testData.admin?.password;
        } catch {
          console.log(chalk.red('  ✗ No test data found. Run: npm run generate-data'));
          throw new Error('Test data file not found');
        }
      }

      if (!email || !password) {
        console.log(chalk.red('  ✗ Admin credentials not configured'));
        console.log(chalk.gray('  Update admin section in config/test-data.json'));
        return;
      }

      // Step 1: Admin login
      results.push(
        await step('Admin login', async () => {
          const result = await apiClient.adminLogin(email, password);
          console.log(chalk.gray(`    Admin ID: ${result.data?.user?.id}`));
          console.log(chalk.gray(`    Role: ${result.data?.user?.role}`));
          return result;
        })
      );

      if (!results[results.length - 1].success) {
        console.log(chalk.red('  ✗ Admin login failed'));
        console.log(chalk.gray('  Ensure admin credentials are correct in test-data.json'));
        return;
      }

      await delayBetweenRequests();

      // Step 2: Get system stats
      results.push(
        await step('Get system stats', async () => {
          const stats = await apiClient.getSystemStats();
          console.log(chalk.gray(`    Total companies: ${stats.data?.totalCompanies || 'N/A'}`));
          console.log(chalk.gray(`    Active companies: ${stats.data?.activeCompanies || 'N/A'}`));
          return stats;
        })
      );

      await delayBetweenRequests();

      // Step 3: List all companies
      let allCompanies;
      results.push(
        await step('List all companies', async () => {
          allCompanies = await apiClient.adminGetCompanies();
          console.log(chalk.gray(`    Total: ${allCompanies.data?.length || 0}`));
          return allCompanies;
        })
      );

      await delayBetweenRequests();

      // Step 4: List pending companies
      let pendingCompanies;
      results.push(
        await step('List pending companies', async () => {
          pendingCompanies = await apiClient.adminGetPendingCompanies();
          console.log(chalk.gray(`    Pending: ${pendingCompanies.data?.length || 0}`));
          if (pendingCompanies.data?.length > 0) {
            pendingCompanies.data.slice(0, 3).forEach((c) => {
              console.log(chalk.gray(`      - ${c.name} (ID: ${c.id})`));
            });
          }
          return pendingCompanies;
        })
      );

      await delayBetweenRequests();

      // If there are pending companies, process one
      let targetCompanyId = pendingCompanies.data?.[0]?.id;

      // If no pending, use any company
      if (!targetCompanyId && allCompanies.data?.length > 0) {
        targetCompanyId = allCompanies.data[0].id;
        console.log(
          chalk.gray(`\n  No pending companies, using existing company ID: ${targetCompanyId}`)
        );
      }

      if (targetCompanyId) {
        // Step 5: View company details
        let companyDetails;
        results.push(
          await step(`Get company details (ID: ${targetCompanyId})`, async () => {
            companyDetails = await apiClient.adminGetCompany(targetCompanyId);
            console.log(chalk.gray(`    Name: ${companyDetails.data?.name}`));
            console.log(chalk.gray(`    Status: ${companyDetails.data?.status}`));
            console.log(chalk.gray(`    Type: ${companyDetails.data?.companyType}`));
            return companyDetails;
          })
        );

        await delayBetweenRequests();

        const currentStatus = companyDetails.data?.status;

        // Step 6: Take action based on status
        if (currentStatus === 'underReview') {
          // Approve the company
          results.push(
            await step('Approve company', async () => {
              const approved = await apiClient.adminApproveCompany(targetCompanyId);
              console.log(chalk.green('    ✓ Company approved'));
              return approved;
            })
          );
        } else if (currentStatus === 'active') {
          // Update status to demonstrate the capability
          results.push(
            await step('Update company status (demo)', async () => {
              // We'll just verify we can read, not actually change active status
              console.log(chalk.gray('    Company is active, skipping status change'));
              return { skipped: true, currentStatus };
            })
          );
        } else {
          results.push(
            await step(`Handle ${currentStatus} status`, async () => {
              console.log(chalk.gray(`    Current status: ${currentStatus}`));
              console.log(chalk.gray('    No action taken'));
              return { currentStatus };
            })
          );
        }

        await delayBetweenRequests();

        // Step 7: Verify status change
        results.push(
          await step('Verify company status', async () => {
            const updated = await apiClient.adminGetCompany(targetCompanyId);
            console.log(chalk.gray(`    Current status: ${updated.data?.status}`));
            return updated;
          })
        );
      } else {
        results.push(
          await step('No companies to manage', async () => {
            console.log(chalk.yellow('    ⚠ No companies found in the system'));
            console.log(chalk.gray('    Run registration flow first to create companies'));
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

      return { targetCompanyId };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('09-admin.flow.js')) {
  runAdminFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runAdminFlow;

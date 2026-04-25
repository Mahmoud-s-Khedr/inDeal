/**
 * Run All Flows Script
 * Executes all flow scripts sequentially
 */

import chalk from 'chalk';
import { delayBetweenFlows, printSummary } from '../lib/flow-runner.js';

// Import all flows
import { runRegistrationFlow } from '../flows/01-registration.flow.js';
import { runSessionFlow } from '../flows/02-session.flow.js';
import { runPasswordResetFlow } from '../flows/03-password-reset.flow.js';
import { runCompanyProfileFlow } from '../flows/04-company-profile.flow.js';
import { runDocumentsFlow } from '../flows/05-documents.flow.js';
import { runGalleryFlow } from '../flows/06-gallery.flow.js';
import { runContributionsFlow } from '../flows/07-contributions.flow.js';
import { runReviewsFlow } from '../flows/08-reviews.flow.js';
import { runCompanyRouteRegressionFlow } from '../flows/10-company-route-regression.flow.js';
import { runDealsFlow } from '../flows/11-deals.flow.js';
import { runApplicationsFlow } from '../flows/12-applications.flow.js';
import { runChatsFlow } from '../flows/13-chats.flow.js';

const ALL_FLOWS = [
  { name: 'Registration', fn: runRegistrationFlow },
  { name: 'Session', fn: runSessionFlow },
  { name: 'Password Reset', fn: runPasswordResetFlow },
  { name: 'Company Profile', fn: runCompanyProfileFlow },
  { name: 'Documents', fn: runDocumentsFlow },
  { name: 'Gallery', fn: runGalleryFlow },
  { name: 'Contributions', fn: runContributionsFlow },
  { name: 'Reviews', fn: runReviewsFlow },
  { name: 'Company Route Regression', fn: runCompanyRouteRegressionFlow },
  { name: 'Deals', fn: runDealsFlow },
  { name: 'Applications', fn: runApplicationsFlow },
  { name: 'Chats', fn: runChatsFlow },
];

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(chalk.bold.cyan('🚀 Running All API Test Flows'));
  console.log('═'.repeat(60));

  // Parse command line arguments for flow selection
  const args = process.argv.slice(2);
  const skipFlows = args
    .filter((arg) => arg.startsWith('--skip='))
    .flatMap((arg) => arg.replace('--skip=', '').split(','));

  const onlyFlows = args
    .filter((arg) => arg.startsWith('--only='))
    .flatMap((arg) => arg.replace('--only=', '').split(','));

  const flowsToRun = ALL_FLOWS.filter((flow) => {
    const name = flow.name.toLowerCase();
    if (onlyFlows.length > 0) {
      return onlyFlows.some((f) => name.includes(f.toLowerCase()));
    }
    if (skipFlows.length > 0) {
      return !skipFlows.some((f) => name.includes(f.toLowerCase()));
    }
    return true;
  });

  console.log(chalk.gray(`\nFlows to run: ${flowsToRun.map((f) => f.name).join(', ')}\n`));

  const results = {};

  for (const flow of flowsToRun) {
    try {
      results[flow.name] = await flow.fn();
    } catch (error) {
      results[flow.name] = { success: false, error, duration: 0 };
      console.log(chalk.red(`\n💥 ${flow.name} flow crashed: ${error.message}`));
    }

    // Delay between flows
    if (flow !== flowsToRun[flowsToRun.length - 1]) {
      await delayBetweenFlows();
    }
  }

  // Print summary
  const summary = printSummary(results);

  // Exit with error code if any flow failed
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

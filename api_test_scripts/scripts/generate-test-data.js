/**
 * Generate Test Data Script
 * Creates/refreshes the test-data.json file with fake data
 */

import { writeFileSync } from 'fs';
import chalk from 'chalk';
import config from '../config/default.js';
import { generateTestDataSet } from '../lib/data-generator.js';

console.log(chalk.bold.cyan('\n📝 Generating Test Data\n'));

// Get user count from command line or default to 2
const userCount = parseInt(process.argv[2], 10) || 2;

console.log(chalk.gray(`Generating ${userCount} users with companies...`));

const testData = generateTestDataSet(userCount);

// Write to file
writeFileSync(config.paths.testData, JSON.stringify(testData, null, 2));

console.log(chalk.green(`\n✓ Test data saved to: ${config.paths.testData}`));
console.log(chalk.gray(`  - ${testData.users.length} users`));
console.log(chalk.gray(`  - ${testData.companies.length} companies`));

console.log(
  chalk.yellow('\n⚠️  Remember to edit the file to add real temp emails for testing email flows!\n')
);

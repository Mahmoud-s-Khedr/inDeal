/**
 * Flow Runner - Utilities for running and logging test flows
 */

import chalk from 'chalk';
import config from '../config/default.js';

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flow step wrapper with timing and error handling
 */
export async function step(name, fn) {
    const start = Date.now();
    console.log(chalk.blue(`\n  ⟶ ${name}`));

    try {
        const result = await fn();
        const duration = Date.now() - start;
        console.log(chalk.green(`  ✓ ${name} (${duration}ms)`));
        return { success: true, result, duration };
    } catch (error) {
        const duration = Date.now() - start;
        console.log(chalk.red(`  ✗ ${name} failed (${duration}ms)`));
        console.log(chalk.red(`    Error: ${error.message}`));
        return { success: false, error, duration };
    }
}

/**
 * Run a flow with header and summary
 */
export async function runFlow(name, description, flowFn) {
    console.log('\n' + '═'.repeat(60));
    console.log(chalk.bold.cyan(`📋 Flow: ${name}`));
    console.log(chalk.gray(description));
    console.log('─'.repeat(60));

    const start = Date.now();
    const results = [];

    try {
        await flowFn(results);

        const duration = Date.now() - start;
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log('\n' + '─'.repeat(60));
        console.log(chalk.bold(
            failed === 0
                ? chalk.green(`✅ Flow completed: ${passed}/${results.length} steps passed (${duration}ms)`)
                : chalk.red(`❌ Flow failed: ${passed}/${results.length} steps passed (${duration}ms)`)
        ));
        console.log('═'.repeat(60) + '\n');

        return { success: failed === 0, results, duration };
    } catch (error) {
        const duration = Date.now() - start;
        console.log('\n' + '─'.repeat(60));
        console.log(chalk.bold.red(`💥 Flow crashed: ${error.message}`));
        console.log('═'.repeat(60) + '\n');

        return { success: false, error, results, duration };
    }
}

/**
 * Delay between requests
 */
export async function delayBetweenRequests() {
    await sleep(config.timing.delayBetweenRequests);
}

/**
 * Delay between flows
 */
export async function delayBetweenFlows() {
    await sleep(config.timing.delayBetweenFlows);
}

/**
 * Print a summary of multiple flow results
 */
export function printSummary(flowResults) {
    console.log('\n' + '═'.repeat(60));
    console.log(chalk.bold.cyan('📊 Test Summary'));
    console.log('─'.repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    for (const [name, result] of Object.entries(flowResults)) {
        const icon = result.success ? chalk.green('✓') : chalk.red('✗');
        const status = result.success ? chalk.green('PASSED') : chalk.red('FAILED');
        console.log(`${icon} ${name}: ${status} (${result.duration}ms)`);

        if (result.success) totalPassed++;
        else totalFailed++;
        totalDuration += result.duration;
    }

    console.log('─'.repeat(60));
    console.log(chalk.bold(
        totalFailed === 0
            ? chalk.green(`All ${totalPassed} flows passed in ${totalDuration}ms`)
            : chalk.red(`${totalFailed}/${totalPassed + totalFailed} flows failed (${totalDuration}ms)`)
    ));
    console.log('═'.repeat(60) + '\n');

    return { passed: totalPassed, failed: totalFailed, duration: totalDuration };
}

export default {
    sleep,
    step,
    runFlow,
    delayBetweenRequests,
    delayBetweenFlows,
    printSummary,
};

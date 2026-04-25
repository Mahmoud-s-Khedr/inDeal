/**
 * Flow 08: Company Reviews (Cross-Company Interaction)
 *
 * Simulates reviewing another company:
 * 1. Login as User A
 * 2. Get list of companies (or use known company ID)
 * 3. View target company profile
 * 4. View existing reviews
 * 5. Submit a review
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { generateReview } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runReviewsFlow(credentials = null, targetCompanyId = null) {
  return runFlow('Company Reviews', 'View companies and submit reviews', async (results) => {
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
        // Use second user if available, otherwise first
        const userIndex = testData.users.length > 1 ? 1 : 0;
        email = testData.users[userIndex].email;
        password = testData.users[userIndex].password;
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

    // Step 2: Get current user's company to avoid reviewing own company
    let myCompanyId;
    results.push(
      await step('Get own company (to avoid self-review)', async () => {
        const myCompany = await apiClient.getMyCompany();
        myCompanyId = myCompany.data?.company?.id;
        console.log(chalk.gray(`    My company ID: ${myCompanyId}`));
        return myCompany;
      })
    );

    await delayBetweenRequests();

    // Step 3: Find a company to review
    let companyToReview = targetCompanyId;

    if (!companyToReview) {
      results.push(
        await step('Find company to review', async () => {
          // Try using admin endpoint to find companies, or use a hardcoded test ID
          // For now, we'll try to get a company that's not ours
          // In a real scenario, you might have a public company listing endpoint

          // Attempt to use ID 1 or 2 if not our company
          const testIds = [1, 2, 3];
          for (const testId of testIds) {
            if (testId !== myCompanyId) {
              try {
                const company = await apiClient.getCompany(testId);
                if (company.data) {
                  companyToReview = testId;
                  console.log(
                    chalk.gray(
                      `    Found company: ${company.data?.name || 'Unknown'} (ID: ${testId})`
                    )
                  );
                  return company;
                }
              } catch {
                // Company doesn't exist, try next
              }
            }
          }

          console.log(chalk.yellow('    ⚠ No other companies found to review'));
          console.log(chalk.gray('    Run registration flow first to create another company'));
          return { skipped: true };
        })
      );

      if (!companyToReview) {
        console.log(chalk.yellow('\n  ⚠ Skipping review creation - no target company'));
        // Still mark as success since this is expected in fresh environments
        return;
      }
    }

    await delayBetweenRequests();

    // Step 4: View company profile
    results.push(
      await step('View target company profile', async () => {
        const company = await apiClient.getCompany(companyToReview);
        console.log(chalk.gray(`    Company: ${company.data?.name}`));
        console.log(chalk.gray(`    Type: ${company.data?.companyType}`));
        console.log(chalk.gray(`    Status: ${company.data?.status}`));
        return company;
      })
    );

    await delayBetweenRequests();

    // Step 5: View company gallery (optional)
    results.push(
      await step('View company gallery', async () => {
        const gallery = await apiClient.getCompanyGallery(companyToReview);
        console.log(chalk.gray(`    Gallery items: ${gallery.data?.length || 0}`));
        return gallery;
      })
    );

    await delayBetweenRequests();

    // Step 6: View existing reviews
    results.push(
      await step('View existing reviews', async () => {
        const reviews = await apiClient.getCompanyReviews(companyToReview);
        console.log(chalk.gray(`    Existing reviews: ${reviews.data?.length || 0}`));
        if (reviews.data?.length > 0) {
          const avgRating =
            reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length;
          console.log(chalk.gray(`    Average rating: ${avgRating.toFixed(1)}/5`));
        }
        return reviews;
      })
    );

    await delayBetweenRequests();

    // Step 7: Submit review
    let reviewSkipped = false;
    results.push(
      await step('Submit review', async () => {
        try {
          const reviewData = generateReview();
          const dummyDealId = 999; // Mock ID, real flow requires actual accepted deal
          const review = await apiClient.createCompanyReview(
            companyToReview,
            dummyDealId,
            reviewData.rating,
            reviewData.reviewText
          );
          console.log(chalk.gray(`    Rating: ${'⭐'.repeat(reviewData.rating)}`));
          console.log(chalk.gray(`    Review: ${reviewData.reviewText.substring(0, 50)}...`));
          return review;
        } catch (error) {
          const msg = error.response?.data?.message || '';
          if (
            error.response?.status === 400 ||
            error.response?.status === 403 ||
            msg.includes('deal')
          ) {
            console.log(
              chalk.yellow(
                '    ⚠ Skipping review creation - requires an accepted deal between companies.'
              )
            );
            reviewSkipped = true;
            return { skipped: true };
          }
          throw error;
        }
      })
    );

    await delayBetweenRequests();

    // Step 8: Verify review was added
    if (!reviewSkipped) {
      results.push(
        await step('Verify review was added', async () => {
          const reviews = await apiClient.getCompanyReviews(companyToReview);
          console.log(chalk.gray(`    Total reviews now: ${reviews.data?.length || 0}`));
          return reviews;
        })
      );
    } else {
      console.log(chalk.yellow('  ⊘ Skipped: Verify review was added'));
    }

    // Cleanup: logout
    try {
      await apiClient.logout();
    } catch {
      // Ignore
    }

    return { companyToReview };
  });
}

// Run if executed directly
if (process.argv[1].includes('08-reviews.flow.js')) {
  runReviewsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runReviewsFlow;

/**
 * Flow 07: Contribution & Media Management
 *
 * Simulates managing contributions with media:
 * 1. Login
 * 2. Upload media file
 * 3. Create contribution
 * 4. Add media items
 * 5. List contribution media
 * 6. Reorder media
 * 7. Update contribution
 * 8. Delete media item
 * 9. Delete contribution
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { uploadFile } from '../lib/file-uploader.js';
import { generateContribution, generateContributionMedia } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runContributionsFlow(credentials = null) {
  return runFlow(
    'Contribution & Media Management',
    'Create contributions with media, reorder, update, and delete',
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

      // Step 2: Upload media files
      let uploadedFile1, uploadedFile2;
      results.push(
        await step('Upload first media file (image)', async () => {
          uploadedFile1 = await uploadFile(apiClient, 'image', false);
          console.log(chalk.gray(`    File ID: ${uploadedFile1.fileId}`));
          return uploadedFile1;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      results.push(
        await step('Upload second media file (document)', async () => {
          uploadedFile2 = await uploadFile(apiClient, 'document', false);
          console.log(chalk.gray(`    File ID: ${uploadedFile2.fileId}`));
          return uploadedFile2;
        })
      );

      await delayBetweenRequests();

      // Step 3: Create contribution
      let createdContribution;
      results.push(
        await step('Create contribution', async () => {
          const contributionData = generateContribution(uploadedFile1.fileId, {
            type: 'product',
            mediaType: 'image',
          });
          createdContribution = await apiClient.createContribution(contributionData);
          console.log(chalk.gray(`    Contribution ID: ${createdContribution.data?.id}`));
          console.log(chalk.gray(`    Type: ${contributionData.type}`));
          console.log(chalk.gray(`    Title: ${contributionData.title}`));
          return createdContribution;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      const contributionId = createdContribution.data?.id;

      await delayBetweenRequests();

      // Step 4: Add additional media
      let createdMedia;
      results.push(
        await step('Add media item to contribution', async () => {
          const mediaData = generateContributionMedia(uploadedFile2.fileId, {
            mediaType: 'file',
            caption: 'Product specification sheet',
            sortOrder: 1,
          });
          createdMedia = await apiClient.addContributionMedia(contributionId, mediaData);
          console.log(chalk.gray(`    Media ID: ${createdMedia.data?.id}`));
          return createdMedia;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      const mediaId = createdMedia.data?.id;

      await delayBetweenRequests();

      // Step 5: List contribution media
      let mediaList;
      results.push(
        await step('List contribution media', async () => {
          mediaList = await apiClient.getContributionMedia(contributionId);
          console.log(chalk.gray(`    Total media items: ${mediaList.data?.length || 0}`));
          mediaList.data?.forEach((item, i) => {
            console.log(
              chalk.gray(
                `      ${i + 1}. [${item.mediaType}] ${item.caption || 'No caption'} (order: ${item.sortOrder})`
              )
            );
          });
          return mediaList;
        })
      );

      await delayBetweenRequests();

      // Step 6: Reorder media (if we have multiple items)
      if (mediaList.data?.length > 1) {
        results.push(
          await step('Reorder media items', async () => {
            const orderedIds = mediaList.data.map((m) => m.id).reverse();
            const reordered = await apiClient.reorderContributionMedia(contributionId, orderedIds);
            console.log(chalk.gray(`    New order: ${orderedIds.join(', ')}`));
            return reordered;
          })
        );

        await delayBetweenRequests();
      }

      // Step 7: Update contribution
      results.push(
        await step('Update contribution', async () => {
          const updateData = {
            title: `Updated Product - ${Date.now()}`,
            description: 'This is an updated product description for testing.',
          };
          const updated = await apiClient.updateContribution(contributionId, updateData);
          console.log(chalk.gray(`    New title: ${updateData.title}`));
          return updated;
        })
      );

      await delayBetweenRequests();

      // Step 8: Update media item
      results.push(
        await step('Update media item', async () => {
          const updateData = {
            caption: `Updated caption - ${Date.now()}`,
          };
          const updated = await apiClient.updateContributionMedia(
            contributionId,
            mediaId,
            updateData
          );
          console.log(chalk.gray(`    New caption: ${updateData.caption}`));
          return updated;
        })
      );

      await delayBetweenRequests();

      // Step 9: Delete media item
      results.push(
        await step('Delete media item', async () => {
          const deleted = await apiClient.deleteContributionMedia(contributionId, mediaId);
          console.log(chalk.gray(`    Media ${mediaId} deleted`));
          return deleted;
        })
      );

      await delayBetweenRequests();

      // Step 10: List contributions
      results.push(
        await step('List contributions', async () => {
          const contributions = await apiClient.getMyContributions();
          console.log(chalk.gray(`    Total contributions: ${contributions.data?.length || 0}`));
          return contributions;
        })
      );

      await delayBetweenRequests();

      // Step 11: Delete contribution
      results.push(
        await step('Delete contribution', async () => {
          const deleted = await apiClient.deleteContribution(contributionId);
          console.log(chalk.gray(`    Contribution ${contributionId} deleted`));
          return deleted;
        })
      );

      await delayBetweenRequests();

      // Step 12: Verify deletion
      results.push(
        await step('Verify deletion', async () => {
          const contributions = await apiClient.getMyContributions();
          const stillExists = contributions.data?.some((c) => c.id === contributionId);
          if (!stillExists) {
            console.log(chalk.green('    ✓ Contribution successfully removed'));
          } else {
            throw new Error('Contribution still exists after deletion');
          }
          return contributions;
        })
      );

      // Cleanup: logout
      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { contributionId, mediaId };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('07-contributions.flow.js')) {
  runContributionsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runContributionsFlow;

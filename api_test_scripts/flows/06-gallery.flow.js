/**
 * Flow 06: Gallery Management
 *
 * Simulates managing company gallery:
 * 1. Login
 * 2. Upload an image file
 * 3. Add gallery item
 * 4. List gallery
 * 5. Update gallery item
 * 6. Delete gallery item
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { uploadFile } from '../lib/file-uploader.js';
import { generateGalleryItem } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runGalleryFlow(credentials = null) {
  return runFlow(
    'Gallery Management',
    'Upload images and manage company gallery',
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

      // Step 2: Upload image file
      let uploadedFile;
      results.push(
        await step('Upload image file', async () => {
          uploadedFile = await uploadFile(apiClient, 'image', false);
          console.log(chalk.gray(`    File ID: ${uploadedFile.fileId}`));
          return uploadedFile;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      // Step 3: Add gallery item
      let createdGalleryItem;
      results.push(
        await step('Add gallery item', async () => {
          const galleryData = generateGalleryItem(uploadedFile.fileId);
          createdGalleryItem = await apiClient.addGalleryItem(
            galleryData.imageFileId,
            galleryData.description
          );
          console.log(chalk.gray(`    Gallery Item ID: ${createdGalleryItem.data?.id}`));
          console.log(chalk.gray(`    Description: ${galleryData.description}`));
          return createdGalleryItem;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      const galleryItemId = createdGalleryItem.data?.id;

      await delayBetweenRequests();

      // Step 4: List gallery
      results.push(
        await step('List gallery items', async () => {
          const gallery = await apiClient.getMyGallery();
          console.log(chalk.gray(`    Total items: ${gallery.data?.length || 0}`));
          return gallery;
        })
      );

      await delayBetweenRequests();

      // Step 5: Update gallery item
      results.push(
        await step('Update gallery item', async () => {
          const updateData = {
            description: `Updated gallery item - ${Date.now()}`,
          };
          const updated = await apiClient.updateGalleryItem(galleryItemId, updateData);
          console.log(chalk.gray(`    New description: ${updateData.description}`));
          return updated;
        })
      );

      await delayBetweenRequests();

      // Step 6: Delete gallery item
      results.push(
        await step('Delete gallery item', async () => {
          const deleted = await apiClient.deleteGalleryItem(galleryItemId);
          console.log(chalk.gray(`    Gallery item ${galleryItemId} deleted`));
          return deleted;
        })
      );

      await delayBetweenRequests();

      // Step 7: Verify deletion
      results.push(
        await step('Verify deletion', async () => {
          const gallery = await apiClient.getMyGallery();
          const stillExists = gallery.data?.some((g) => g.id === galleryItemId);
          if (!stillExists) {
            console.log(chalk.green('    ✓ Gallery item successfully removed'));
          } else {
            throw new Error('Gallery item still exists after deletion');
          }
          return gallery;
        })
      );

      // Cleanup: logout
      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { galleryItemId };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('06-gallery.flow.js')) {
  runGalleryFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runGalleryFlow;

/**
 * Flow 05: Document Management
 *
 * Simulates managing company documents:
 * 1. Login
 * 2. Upload a document file
 * 3. Create document record
 * 4. List documents
 * 5. Update document
 * 6. Delete document
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { uploadFile } from '../lib/file-uploader.js';
import { generateDocument } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runDocumentsFlow(credentials = null) {
  return runFlow(
    'Document Management',
    'Upload, create, update, and delete company documents',
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

      // Step 2: Upload document file
      let uploadedFile;
      results.push(
        await step('Upload document file', async () => {
          uploadedFile = await uploadFile(apiClient, 'document', false);
          console.log(chalk.gray(`    File ID: ${uploadedFile.fileId}`));
          return uploadedFile;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      await delayBetweenRequests();

      // Step 3: Create document record
      let createdDocument;
      results.push(
        await step('Create document record', async () => {
          const docData = generateDocument(uploadedFile.fileId);
          createdDocument = await apiClient.createDocument(docData);
          console.log(chalk.gray(`    Document ID: ${createdDocument.data?.id}`));
          console.log(chalk.gray(`    Type: ${docData.docType}`));
          console.log(chalk.gray(`    Title: ${docData.title}`));
          return createdDocument;
        })
      );

      if (!results[results.length - 1].success) {
        return;
      }

      const documentId = createdDocument.data?.id;

      await delayBetweenRequests();

      // Step 4: List documents
      results.push(
        await step('List documents', async () => {
          const documents = await apiClient.getMyDocuments();
          console.log(chalk.gray(`    Total documents: ${documents.data?.length || 0}`));
          return documents;
        })
      );

      await delayBetweenRequests();

      // Step 5: Update document
      results.push(
        await step('Update document', async () => {
          const updateData = {
            title: `Updated Certificate - ${Date.now()}`,
            description: 'Updated description for testing',
          };
          const updated = await apiClient.updateDocument(documentId, updateData);
          console.log(chalk.gray(`    New title: ${updateData.title}`));
          return updated;
        })
      );

      await delayBetweenRequests();

      // Step 6: Delete document
      results.push(
        await step('Delete document', async () => {
          const deleted = await apiClient.deleteDocument(documentId);
          console.log(chalk.gray(`    Document ${documentId} deleted`));
          return deleted;
        })
      );

      await delayBetweenRequests();

      // Step 7: Verify deletion
      results.push(
        await step('Verify deletion', async () => {
          const documents = await apiClient.getMyDocuments();
          const stillExists = documents.data?.some((d) => d.id === documentId);
          if (!stillExists) {
            console.log(chalk.green('    ✓ Document successfully removed'));
          } else {
            throw new Error('Document still exists after deletion');
          }
          return documents;
        })
      );

      // Cleanup: logout
      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { documentId };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('05-documents.flow.js')) {
  runDocumentsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runDocumentsFlow;

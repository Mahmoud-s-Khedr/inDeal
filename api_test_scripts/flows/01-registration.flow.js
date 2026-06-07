/**
 * Flow 01: Registration & Onboarding
 *
 * Simulates a new user registering with their company:
 * 1. Get signed URL for document upload
 * 2. Upload company document to R2
 * 3. Register agent + company
 * 4. Verify email using dev debug OTP
 * 5. Initial login
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { uploadFile } from '../lib/file-uploader.js';
import { generateUser, generateCompany } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runRegistrationFlow(customData = null) {
  return runFlow(
    'Registration & Onboarding',
    'Register a new agent with company, upload documents, and complete initial login',
    async (results) => {
      // Clear any existing auth
      apiClient.clearTokens();

      // Get all users from test-data.json
      let testData;
      try {
        testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
      } catch {
        console.log(chalk.red('  ✗ No test data found. Run: npm run generate-data'));
        throw new Error('Test data file not found');
      }

      const users = testData.users;
      const companies = testData.companies;

      const registeredUsers = [];

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        const companyData = companies.find((c) => c.userId === userData.id);

        console.log(chalk.gray(`\n  --- Registering User ${i + 1}/${users.length} ---`));
        console.log(chalk.gray(`  User: ${userData.email}`));
        console.log(chalk.gray(`  Company: ${companyData?.name || 'None'}`));

        if (!companyData) {
          console.log(chalk.yellow(`  ⚠ Skipping user ${userData.email} (No company data)`));
          continue;
        }

        // Step 1: Get upload URL for document
        let uploadedFile;
        results.push(
          await step(`Get document upload URL (${userData.email})`, async () => {
            uploadedFile = await uploadFile(apiClient, 'document', true);
            return uploadedFile;
          })
        );

        if (!results[results.length - 1].success) {
          console.log(
            chalk.yellow('  ⚠ Skipping document attachment, continuing with registration...')
          );
          uploadedFile = null;
        }

        await delayBetweenRequests();

        // Step 2: Register user + company
        let registrationResult;
        results.push(
          await step(`Register agent + company (${userData.email})`, async () => {
            const userPayload = {
              username: userData.username,
              email: userData.email,
              password: userData.password,
              firstName: userData.firstName,
              lastName: userData.lastName,
              jobTitle: userData.jobTitle,
            };

            const companyPayload = {
              name: companyData.name,
              description: companyData.description,
              address: companyData.address,
              phone: companyData.phone,
              website: companyData.website,
              companyType: companyData.companyType,
              companyIndustry: companyData.companyIndustry,
              contacts: companyData.contacts,
              locations: companyData.locations,
              documents: uploadedFile
                ? [
                    {
                      fileId: uploadedFile.fileId,
                      docType: 'license',
                      description: 'Business registration license',
                    },
                  ]
                : [],
            };

            if (companyData.manufacturingStrategy) {
              companyPayload.manufacturingStrategy = companyData.manufacturingStrategy;
            }

            registrationResult = await apiClient.register(userPayload, companyPayload);
            return registrationResult;
          })
        );

        if (!results[results.length - 1].success) {
          console.log(chalk.red(`  ✗ Registration failed for ${userData.email}, skipping login`));
          continue;
        }

        await delayBetweenRequests();

        // Step 3: Verify email
        results.push(
          await step(`Verify email (${userData.email})`, async () => {
            const otp = registrationResult?.data?.debugOtp?.otp;

            if (!otp) {
              throw new Error(
                'Registration response did not include debugOtp. Manual verification is required before login.'
              );
            }

            const verificationResult = await apiClient.verifyEmail(userData.email, otp);
            console.log(chalk.gray('    Verification completed using dev debugOtp'));
            return verificationResult;
          })
        );

        if (!results[results.length - 1].success) {
          console.log(
            chalk.red(`  ✗ Email verification failed for ${userData.email}, skipping login`)
          );
          continue;
        }

        await delayBetweenRequests();

        // Step 4: Attempt login
        results.push(
          await step(`Initial login attempt (${userData.email})`, async () => {
            const loginResult = await apiClient.login(userData.email, userData.password);
            console.log(chalk.green(`    ✓ Login successful! Token received`));
            return loginResult;
          })
        );

        registeredUsers.push({
          user: userData,
          company: companyData,
          registrationResult,
        });
      }

      // Step 5: Auth mode note
      results.push(
        await step('Auth mode (info)', async () => {
          console.log(chalk.gray('    Registration flow uses: register → verify-email → login.'));
          console.log(
            chalk.gray('    Downstream flows depend on registration creating verified users.')
          );
          return { status: 'verified_before_login' };
        })
      );

      // Store created user info for other flows (returning the first one for compatibility)
      return {
        user: registeredUsers[0]?.user,
        company: registeredUsers[0]?.company,
        registrationResult: registeredUsers[0]?.registrationResult,
        allRegisteredUsers: registeredUsers,
      };
    }
  );
}

// Run if executed directly
if (process.argv[1].includes('01-registration.flow.js')) {
  runRegistrationFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runRegistrationFlow;

/**
 * Flow 01: Registration & Onboarding
 * 
 * Simulates a new user registering with their company:
 * 1. Get signed URL for document upload
 * 2. Upload company document to R2
 * 3. Register agent + company
 * 4. (Email verification - requires manual step or mock)
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

            // Load test data or generate new
            let userData, companyData;

            if (customData) {
                userData = customData.user;
                companyData = customData.company;
            } else {
                try {
                    const testData = JSON.parse(readFileSync(config.paths.testData, 'utf-8'));
                    userData = testData.users[0];
                    companyData = testData.companies.find(c => c.userId === userData.id);
                } catch {
                    // Generate fresh data if file doesn't exist
                    userData = generateUser();
                    companyData = generateCompany();
                }
            }

            console.log(chalk.gray(`  User: ${userData.email}`));
            console.log(chalk.gray(`  Company: ${companyData.name}`));

            // Step 1: Get upload URL for document
            let uploadedFile;
            results.push(await step('Get document upload URL', async () => {
                uploadedFile = await uploadFile(apiClient, 'document', true);
                return uploadedFile;
            }));

            if (!results[results.length - 1].success) {
                console.log(chalk.yellow('  ⚠ Skipping document attachment, continuing with registration...'));
                uploadedFile = null;
            }

            await delayBetweenRequests();

            // Step 2: Register user + company
            let registrationResult;
            results.push(await step('Register agent + company', async () => {
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
                    documents: uploadedFile ? [
                        {
                            fileId: uploadedFile.fileId,
                            docType: 'license',
                            description: 'Business registration license',
                        }
                    ] : [],
                };

                // Only include manufacturingStrategy if it's defined
                if (companyData.manufacturingStrategy) {
                    companyPayload.manufacturingStrategy = companyData.manufacturingStrategy;
                }

                registrationResult = await apiClient.register(userPayload, companyPayload);
                return registrationResult;
            }));

            if (!results[results.length - 1].success) {
                console.log(chalk.red('  ✗ Registration failed, cannot continue flow'));
                return;
            }

            await delayBetweenRequests();

            // Step 3: Notify about email verification
            results.push(await step('Email verification (info)', async () => {
                console.log(chalk.yellow('    ⚠ Email verification required'));
                console.log(chalk.gray('    Check email for verification link or update testTokens.emailVerificationToken'));
                console.log(chalk.gray(`    Verification endpoint: GET /auth/verify-email?email=${userData.email}&token=<token>`));
                return { status: 'pending_verification' };
            }));

            await delayBetweenRequests();

            // Step 4: Attempt login (may fail if email not verified)
            results.push(await step('Initial login attempt', async () => {
                try {
                    const loginResult = await apiClient.login(userData.email, userData.password);
                    console.log(chalk.green(`    ✓ Login successful! Token received`));
                    return loginResult;
                } catch (error) {
                    if (error.response?.status === 403 || error.response?.data?.message?.includes('verify')) {
                        console.log(chalk.yellow('    ⚠ Login blocked - email verification required'));
                        return { status: 'email_verification_required' };
                    }
                    throw error;
                }
            }));

            // Store created user info for other flows
            return {
                user: userData,
                company: companyData,
                uploadedFile,
                registrationResult,
            };
        }
    );
}

// Run if executed directly
if (process.argv[1].includes('01-registration.flow.js')) {
    runRegistrationFlow().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

export default runRegistrationFlow;

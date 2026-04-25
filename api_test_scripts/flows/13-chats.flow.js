/**
 * Flow 13: Communication (Chats) Flow
 *
 * Simulates communication between users:
 * 1. Login
 * 2. Get my chats
 * 3. Create a chat
 * 4. Get chat room details
 * 5. Send a chat message
 * 6. Get chat messages
 * 7. Archive chat
 */

import { readFileSync } from 'fs';
import chalk from 'chalk';
import apiClient from '../lib/api-client.js';
import { generateChatMessage } from '../lib/data-generator.js';
import { runFlow, step, delayBetweenRequests } from '../lib/flow-runner.js';
import config from '../config/default.js';

export async function runChatsFlow(credentials = null) {
  return runFlow(
    'Communication (Chats)',
    'Create chats, send messages, and manage rooms',
    async (results) => {
      apiClient.clearTokens();

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

      // Step 2: Get my chats
      results.push(
        await step('Get my chats', async () => {
          const result = await apiClient.getChats();
          console.log(chalk.gray(`    Total chats found: ${result.data?.length || 0}`));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 3: Find a target company and Create a Chat
      let createdChatRoomId;
      results.push(
        await step('Create a chat', async () => {
          // Find a company to chat with
          let targetCompanyId = null;
          const myCompany = await apiClient.getMyCompany();
          const myCompanyId = myCompany.data?.company?.id;

          const testIds = [1, 2, 3];
          for (const testId of testIds) {
            if (testId !== myCompanyId) {
              try {
                const company = await apiClient.getCompany(testId);
                if (company.data) {
                  targetCompanyId = testId;
                  break;
                }
              } catch {
                // Ignore
              }
            }
          }

          if (!targetCompanyId) {
            console.log(chalk.yellow('    ⚠ No target company found to chat with.'));
            throw new Error('No target company found');
          }

          try {
            const result = await apiClient.createChat({
              targetCompanyId,
              subject: 'Inquiry regarding deal',
            });
            createdChatRoomId = result.data?.id || result.data?.chat?.id;
            console.log(chalk.gray(`    Created chat room ID: ${createdChatRoomId}`));
            return result;
          } catch (error) {
            console.log(chalk.yellow('    ⚠ Could not create chat.'));
            throw error;
          }
        })
      );

      // If we couldn't create a chat, see if we have an existing one to test
      if (!createdChatRoomId) {
        const res = await apiClient.getChats();
        const chats = res.data?.data || res.data || [];
        if (chats.length > 0) {
          createdChatRoomId = chats[0].id;
          console.log(chalk.gray(`    Using existing chat room ID: ${createdChatRoomId}`));
        } else {
          console.log(
            chalk.yellow('    ⚠ No chats found to interact with. Skipping remaining steps')
          );
          return;
        }
      }

      await delayBetweenRequests();

      // Step 4: Get chat room details
      results.push(
        await step('Get chat room', async () => {
          const result = await apiClient.getChatRoom(createdChatRoomId);
          console.log(chalk.gray('    Fetched room details successfully'));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 5: Send a message
      const newMessage = generateChatMessage();
      results.push(
        await step('Send a chat message', async () => {
          const result = await apiClient.sendChatMessage(createdChatRoomId, newMessage);
          console.log(chalk.gray('    Message sent successfully'));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 6: Get chat messages
      results.push(
        await step('Get chat messages', async () => {
          const result = await apiClient.getChatMessages(createdChatRoomId);
          console.log(chalk.gray(`    Total messages in room: ${result.data?.length || 0}`));
          return result;
        })
      );

      await delayBetweenRequests();

      // Step 7: Archive Chat (Removed to allow repeated testing)
      // We skip archiving so that subsequent runs can reuse the chat room

      try {
        await apiClient.logout();
      } catch {
        // Ignore
      }

      return { completed: true };
    }
  );
}

if (process.argv[1].includes('13-chats.flow.js')) {
  runChatsFlow().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export default runChatsFlow;

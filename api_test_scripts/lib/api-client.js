/**
 * API Client - Axios wrapper with authentication and logging
 */

import axios from 'axios';
import chalk from 'chalk';
import config from '../config/default.js';

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: `${config.api.baseUrl}/api/${config.api.version}`,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.accessToken = null;
    this.refreshToken = null;

    // Request interceptor for auth and logging
    this.client.interceptors.request.use(
      (req) => {
        if (this.accessToken) {
          req.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        if (config.logging.verbose) {
          console.log(chalk.cyan(`→ ${req.method.toUpperCase()} ${req.url}`));
          if (req.data && config.logging.showResponseBody) {
            console.log(chalk.gray(JSON.stringify(req.data, null, 2)));
          }
        }
        return req;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (res) => {
        if (config.logging.verbose) {
          console.log(chalk.green(`← ${res.status} ${res.statusText}`));
          if (config.logging.showResponseBody && res.data) {
            console.log(chalk.gray(JSON.stringify(res.data, null, 2)));
          }
        }
        return res;
      },
      (error) => {
        if (error.response) {
          console.log(chalk.red(`← ${error.response.status} ${error.response.statusText}`));
          if (error.response.data) {
            console.log(chalk.red(JSON.stringify(error.response.data, null, 2)));
          }
        } else {
          console.log(chalk.red(`← Network Error: ${error.message}`));
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken, refreshToken = null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Clear authentication tokens
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  // ============ AUTH ENDPOINTS ============

  async getRegisterUploadUrl(fileName, fileType, fileSize) {
    const res = await this.client.post('/auth/register/upload-url', {
      fileName,
      fileType,
      fileSize,
    });
    return res.data;
  }

  async register(userData, companyData) {
    const res = await this.client.post('/auth/register', {
      user: userData,
      company: companyData,
    });
    return res.data;
  }

  async login(email, password) {
    const res = await this.client.post('/auth/login', { email, password });
    // Token could be named 'token' or 'accessToken' depending on the endpoint version
    const token = res.data.data?.token || res.data.data?.accessToken;
    if (token) {
      this.setTokens(token, res.data.data?.refreshToken);
    }
    return res.data;
  }

  async logout() {
    const res = await this.client.post('/auth/logout');
    this.clearTokens();
    return res.data;
  }

  async forgotPassword(email) {
    const res = await this.client.post('/auth/forgot-password', { email });
    return res.data;
  }

  async resendForgotPasswordOtp(email) {
    const res = await this.client.post('/auth/resend-forgot-password-otp', { email });
    return res.data;
  }

  async verifyOtp(email, otp) {
    const res = await this.client.post('/auth/verify-otp', { email, otp });
    return res.data;
  }

  async resetPassword(email, otp, password, confirmPassword) {
    const res = await this.client.post('/auth/reset-password', {
      email,
      otp,
      password,
      confirmPassword,
    });
    return res.data;
  }

  // ============ USER ENDPOINTS ============

  async getMe() {
    const res = await this.client.get('/users/me');
    return res.data;
  }

  async updateMe(data) {
    const res = await this.client.put('/users/me', data);
    return res.data;
  }

  async updatePassword(currentPassword, newPassword) {
    const res = await this.client.put('/users/me/password', {
      currentPassword,
      newPassword,
    });
    return res.data;
  }

  async updateProfileImage(profileImageFileId) {
    const res = await this.client.put('/users/me/profile-image', { profileImageFileId });
    return res.data;
  }

  // ============ COMPANY ENDPOINTS ============

  async getMyCompany() {
    const res = await this.client.get('/companies/me');
    return res.data;
  }

  async updateMyCompany(data) {
    const res = await this.client.put('/companies/me', data);
    return res.data;
  }

  async resendForReview() {
    const res = await this.client.post('/companies/me/resend-for-review');
    return res.data;
  }

  // Gallery
  async getMyGallery() {
    const res = await this.client.get('/companies/me/gallery');
    return res.data;
  }

  async addGalleryItem(imageFileId, description) {
    const res = await this.client.post('/companies/me/gallery', {
      imageFileId,
      description,
    });
    return res.data;
  }

  async updateGalleryItem(galleryItemId, data) {
    const res = await this.client.put(`/companies/me/gallery/${galleryItemId}`, data);
    return res.data;
  }

  async deleteGalleryItem(galleryItemId) {
    const res = await this.client.delete(`/companies/me/gallery/${galleryItemId}`);
    return res.data;
  }

  // Documents
  async getMyDocuments() {
    const res = await this.client.get('/companies/me/documents');
    return res.data;
  }

  async createDocument(data) {
    const res = await this.client.post('/companies/me/documents', data);
    return res.data;
  }

  async updateDocument(documentId, data) {
    const res = await this.client.put(`/companies/me/documents/${documentId}`, data);
    return res.data;
  }

  async deleteDocument(documentId) {
    const res = await this.client.delete(`/companies/me/documents/${documentId}`);
    return res.data;
  }

  // Contributions
  async getMyContributions() {
    const res = await this.client.get('/companies/me/contributions');
    return res.data;
  }

  async createContribution(data) {
    const res = await this.client.post('/companies/me/contributions', data);
    return res.data;
  }

  async updateContribution(contributionId, data) {
    const res = await this.client.put(`/companies/me/contributions/${contributionId}`, data);
    return res.data;
  }

  async deleteContribution(contributionId) {
    const res = await this.client.delete(`/companies/me/contributions/${contributionId}`);
    return res.data;
  }

  // Contribution Media
  async getContributionMedia(contributionId) {
    const res = await this.client.get(`/companies/me/contributions/${contributionId}/media`);
    return res.data;
  }

  async addContributionMedia(contributionId, data) {
    const res = await this.client.post(`/companies/me/contributions/${contributionId}/media`, data);
    return res.data;
  }

  async updateContributionMedia(contributionId, mediaId, data) {
    const res = await this.client.put(
      `/companies/me/contributions/${contributionId}/media/${mediaId}`,
      data
    );
    return res.data;
  }

  async deleteContributionMedia(contributionId, mediaId) {
    const res = await this.client.delete(
      `/companies/me/contributions/${contributionId}/media/${mediaId}`
    );
    return res.data;
  }

  async reorderContributionMedia(contributionId, orderedIds) {
    const res = await this.client.put(
      `/companies/me/contributions/${contributionId}/media/reorder`,
      { orderedIds }
    );
    return res.data;
  }

  // ============ PUBLIC COMPANY ENDPOINTS ============

  async getCompany(companyId) {
    const res = await this.client.get(`/companies/${companyId}`);
    return res.data;
  }

  async getCompanyGallery(companyId) {
    const res = await this.client.get(`/companies/${companyId}/gallery`);
    return res.data;
  }

  async getCompanyReviews(companyId) {
    const res = await this.client.get(`/companies/${companyId}/reviews`);
    return res.data;
  }

  async createCompanyReview(companyId, dealId, rating, reviewText) {
    const res = await this.client.post(`/companies/${companyId}/reviews`, {
      dealId,
      rating,
      reviewText,
    });
    return res.data;
  }

  // ============ DEALS ENDPOINTS ============

  async getDeals(params = {}) {
    const res = await this.client.get('/deals', { params });
    return res.data;
  }

  async getDeal(dealId) {
    const res = await this.client.get(`/deals/${dealId}`);
    return res.data;
  }

  async getMyDeals() {
    const res = await this.client.get('/deals/me/deals');
    return res.data;
  }

  async createDeal(data) {
    const res = await this.client.post('/deals', data);
    return res.data;
  }

  async updateDeal(dealId, data) {
    const res = await this.client.put(`/deals/${dealId}`, data);
    return res.data;
  }

  async deleteDeal(dealId) {
    const res = await this.client.delete(`/deals/${dealId}`);
    return res.data;
  }

  // ============ DEAL REQUESTS (APPLICATIONS) ============

  async getMyRequests() {
    const res = await this.client.get('/deals/me/requests');
    return res.data;
  }

  async createDealRequest(dealId, data) {
    const res = await this.client.post(`/deals/${dealId}/requests`, data);
    return res.data;
  }

  async getDealRequests(dealId) {
    const res = await this.client.get(`/deals/${dealId}/requests`);
    return res.data;
  }

  async updateRequestStatus(dealId, requestId, status) {
    const res = await this.client.patch(`/deals/${dealId}/requests/${requestId}/status`, {
      status,
    });
    return res.data;
  }

  async pauseRequest(requestId) {
    const res = await this.client.patch(`/deals/requests/${requestId}/pause`);
    return res.data;
  }

  async cancelRequest(requestId, cancellationReason) {
    const res = await this.client.patch(`/deals/requests/${requestId}/cancel`, {
      cancellationReason,
    });
    return res.data;
  }

  async deleteRequest(requestId) {
    const res = await this.client.delete(`/deals/requests/${requestId}`);
    return res.data;
  }

  // ============ CHATS ENDPOINTS ============

  async getChats() {
    const res = await this.client.get('/chats');
    return res.data;
  }

  async createChat(data) {
    const res = await this.client.post('/chats', data);
    return res.data;
  }

  async getChatRoom(roomId) {
    const res = await this.client.get(`/chats/${roomId}`);
    return res.data;
  }

  async archiveChatRoom(roomId) {
    const res = await this.client.patch(`/chats/${roomId}/archive`);
    return res.data;
  }

  async getChatMessages(roomId, params = {}) {
    const res = await this.client.get(`/chats/${roomId}/messages`, { params });
    return res.data;
  }

  async sendChatMessage(roomId, data) {
    const res = await this.client.post(`/chats/${roomId}/messages`, data);
    return res.data;
  }

  async markChatAsRead(roomId) {
    const res = await this.client.post(`/chats/${roomId}/read`);
    return res.data;
  }

  // ============ FILES ENDPOINTS ============

  async getUploadUrl(fileName, fileType, fileSize) {
    const res = await this.client.post('/files/upload-url', {
      fileName,
      fileType,
      fileSize,
    });
    return res.data;
  }

  // ============ SYSTEM ENDPOINTS ============

  async getSystemStats() {
    const res = await this.client.get('/system/stats');
    return res.data;
  }

  async getSystemConfig() {
    const res = await this.client.get('/system/config');
    return res.data;
  }

  async getHealth() {
    const res = await this.client.get('/health');
    return res.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

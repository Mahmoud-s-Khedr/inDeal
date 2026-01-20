# IN-DEAL
## Software Requirements Specification

**B2B Industrial Deal-Making Platform**

---

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Date** | January 2026 |
| **Status** | Draft |
| **Classification** | Confidential |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Appendix](#6-appendix)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document provides a comprehensive description of the In-Deal platform, a B2B industrial deal-making application designed to connect manufacturing companies, suppliers, and industrial partners. This document defines the functional and non-functional requirements, system constraints, and design specifications necessary for the development team to build the platform.

The intended audience for this document includes project stakeholders, development teams, quality assurance personnel, and business analysts involved in the In-Deal project.

### 1.2 Scope

In-Deal is a comprehensive B2B platform that enables industrial companies to discover potential business partners, request quotations, participate in auctions, and establish business relationships. The platform serves as a marketplace for industrial deals, connecting manufacturers, suppliers, and service providers across various industries.

#### 1.2.1 Key Capabilities

- Company registration with verification workflow for quality assurance
- Comprehensive company portfolio management with galleries, certificates, and contributions
- Advanced deal search with multi-criteria filtering and sorting
- Request for Quotation (RFQ) system for direct deal negotiations
- Auction system for competitive bidding on industrial projects
- Real-time messaging and live chat capabilities
- Rating and review system for trust and reputation building
- Advertisement management for premium visibility
- Multi-language support (English and Arabic)
- Administrative dashboard for platform governance

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| **SRS** | Software Requirements Specification |
| **B2B** | Business-to-Business |
| **RFQ** | Request for Quotation - a formal process for requesting price quotes from suppliers |
| **API** | Application Programming Interface |
| **CRUD** | Create, Read, Update, Delete - basic data operations |
| **Admin** | Administrator - user with elevated privileges for system management |
| **EGP** | Egyptian Pound - currency unit used for cost estimation |
| **UI/UX** | User Interface / User Experience |

### 1.4 References

- IEEE Std 830-1998 - IEEE Recommended Practice for Software Requirements Specifications
- ISO/IEC 25010:2011 - Systems and software Quality Requirements and Evaluation
- GDPR - General Data Protection Regulation guidelines
- WCAG 2.1 - Web Content Accessibility Guidelines

### 1.5 Document Overview

This document is organized into the following sections: Section 2 provides an overall system description including product perspective and user characteristics. Section 3 details all system features and functional requirements. Section 4 covers external interface requirements. Section 5 specifies non-functional requirements including performance, security, and usability. Section 6 provides additional appendices including the development cost breakdown.

---

## 2. Overall Description

### 2.1 Product Perspective

In-Deal is a standalone web and mobile application designed to operate as a centralized B2B marketplace for industrial companies. The system integrates with external services for email delivery, payment processing, and social media authentication while maintaining its own user management, deal processing, and communication infrastructure.

#### 2.1.1 System Context

The platform operates within an ecosystem that includes company administrators who manage business profiles, system administrators who oversee platform operations, and external services that provide supporting functionality such as email notifications and payment processing.

#### 2.1.2 System Interfaces

- **Web Application:** Responsive web interface accessible via modern browsers
- **Mobile Application:** Native iOS and Android applications
- **Admin Dashboard:** Web-based administrative interface for system management
- **Customer Support Dashboard:** Desktop application for support team operations
- **Email Service:** Integration with SMTP servers for transactional emails
- **Payment Gateway:** Integration with payment processors for subscription and advertising fees

### 2.2 Product Functions

The In-Deal platform provides the following major functional areas:

| Functional Area | Description |
|----------------|-------------|
| **Authentication** | User registration, login, password management, and session handling |
| **Company Portfolio** | Company profile management, galleries, certificates, and business contributions |
| **Deal Management** | Search, RFQ processing, and auction functionality |
| **Communication** | Real-time chat, customer support, and notification systems |
| **Ratings & Reviews** | Company rating system and review management |
| **Advertising** | Advertisement creation, management, and billing |
| **Administration** | Platform governance, content moderation, and user management |

### 2.3 User Classes and Characteristics

#### 2.3.1 Company Administrators

Primary users who manage company profiles and conduct business operations on the platform. These users typically have business management experience and require intuitive interfaces for deal discovery and negotiation.

| Attribute | Value |
|-----------|-------|
| **Technical Expertise** | Basic to intermediate computer literacy |
| **Usage Frequency** | Daily to weekly |
| **Primary Tasks** | Profile management, deal search, RFQ submission, auction participation |

#### 2.3.2 System Administrators

Platform operators responsible for approving registrations, managing content, and ensuring platform integrity. These users require comprehensive administrative tools and detailed reporting capabilities.

| Attribute | Value |
|-----------|-------|
| **Technical Expertise** | Intermediate to advanced |
| **Usage Frequency** | Daily |
| **Primary Tasks** | Registration approval, advert management, content moderation, reporting |

#### 2.3.3 Customer Support Staff

Support personnel who assist users with platform issues and inquiries. They utilize dedicated desktop applications for efficient support delivery.

### 2.4 Operating Environment

The In-Deal platform shall operate in the following technical environment:

- **Web browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile platforms:** iOS 14+ and Android 10+
- **Server infrastructure:** Cloud-hosted with auto-scaling capabilities
- **Database:** Relational database with support for complex queries and full-text search
- **Network:** HTTPS encryption for all communications

### 2.5 Design and Implementation Constraints

- The application must support Arabic right-to-left (RTL) text rendering
- All user-generated content must be reviewed before public visibility
- The system must comply with local data protection regulations
- Real-time features require WebSocket support
- Mobile applications must pass respective app store guidelines

### 2.6 Assumptions and Dependencies

#### 2.6.1 Assumptions

- Users have access to stable internet connectivity
- Companies provide accurate information during registration
- System administrators are available during business hours for content review
- Payment gateway services maintain high availability

#### 2.6.2 Dependencies

- Third-party email service for transactional emails
- Payment gateway for subscription and advertising payments
- Cloud infrastructure provider for hosting and scaling
- Push notification services for mobile alerts

---

## 3. System Features

### 3.1 Login and Registration (AUTH)

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Authentication Module | 2 weeks | 4,500 EGP | **Mandatory** |

#### 3.1.1 Login (FR-AUTH-001)

The system shall provide secure authentication for company administrators to access their accounts.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUTH-001.1 | The system shall provide input fields for email address and password |
| FR-AUTH-001.2 | The system shall validate that email and password fields are not empty before submission |
| FR-AUTH-001.3 | The system shall validate email format using standard email regex pattern |
| FR-AUTH-001.4 | The system shall verify credentials against stored user data |
| FR-AUTH-001.5 | The system shall display appropriate error messages for invalid credentials |
| FR-AUTH-001.6 | The system shall implement rate limiting to prevent brute force attacks (max 5 attempts per 15 minutes) |
| FR-AUTH-001.7 | The system shall create a secure session token upon successful authentication |
| FR-AUTH-001.8 | The system shall redirect users to their dashboard upon successful login |

##### Acceptance Criteria

- User can successfully log in with valid credentials within 3 seconds
- Invalid email format shows inline validation error
- Incorrect credentials display "Invalid email or password" message
- Account lockout occurs after 5 failed attempts
- Session persists across browser tabs

---

#### 3.1.2 Company Registration (FR-AUTH-002)

The system shall provide a multi-step registration process for new companies to join the platform.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Registration Data Requirements

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Agent Name | Text | Yes | 2-100 characters |
| Agent Job Title | Text | Yes | 2-50 characters |
| Company Name | Text | Yes | 2-200 characters |
| Company Type | Selection | Yes | From predefined list |
| Company Industry | Selection | Yes | From predefined list |
| Company Website | URL | No | Valid URL format |
| Manufacturing Strategy | Selection | Yes | From predefined list |
| Address | Text | Yes | 5-500 characters |
| Email | Email | Yes | Valid email, unique |
| Phone | Phone | Yes | Valid phone format |
| Documents | Files | Yes | PDF, max 10MB each |
| Password | Password | Yes | Min 8 chars, complexity |

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUTH-002.1 | The system shall provide a multi-step registration wizard with progress indicator |
| FR-AUTH-002.2 | The system shall validate each step before allowing progression |
| FR-AUTH-002.3 | The system shall support file uploads for company documentation (commercial register, tax ID, etc.) |
| FR-AUTH-002.4 | The system shall enforce password complexity requirements (uppercase, lowercase, number, special char) |
| FR-AUTH-002.5 | The system shall send email verification upon registration submission |
| FR-AUTH-002.6 | The system shall queue registration for admin review after email verification |
| FR-AUTH-002.7 | The system shall notify applicant of approval/rejection via email |
| FR-AUTH-002.8 | The system shall provide rejection reason when registration is declined |

##### Business Rules

- Each email address can only be associated with one company account
- Company documents must be reviewed within 48 business hours
- Rejected applications may reapply after addressing feedback
- Password must be changed every 90 days

---

#### 3.1.3 Forgot Password (FR-AUTH-003)

The system shall provide a secure password recovery mechanism for users who have forgotten their credentials.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUTH-003.1 | The system shall provide a "Forgot Password" link on the login page |
| FR-AUTH-003.2 | The system shall send a password reset link to the registered email address |
| FR-AUTH-003.3 | The reset link shall expire after 1 hour |
| FR-AUTH-003.4 | The system shall validate password strength for new password |
| FR-AUTH-003.5 | The system shall require password confirmation (enter twice) |
| FR-AUTH-003.6 | The system shall invalidate all existing sessions upon password reset |
| FR-AUTH-003.7 | The system shall redirect to login page after successful password reset |

---

#### 3.1.4 Pre-Data Collection (FR-AUTH-004)

The system shall optionally collect user preferences and interests to personalize content recommendations.

**Actors:** Company Administrators  
**Priority:** Desirable | **Stability:** Unstable

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-AUTH-004.1 | The system shall present interest selection after first login |
| FR-AUTH-004.2 | The system shall analyze selected interests to customize content feed |
| FR-AUTH-004.3 | The system shall provide a skip option for users who prefer not to share preferences |
| FR-AUTH-004.4 | [Future] The system shall integrate social media scraping for enhanced profiling |

---

### 3.2 Onboarding

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Onboarding Module | 1 day | 0 EGP | **Desirable** |

#### 3.2.1 Onboarding Screen (FR-ONB-001)

The system shall display introductory information to new users upon first application launch.

**Actors:** System  
**Priority:** Desirable | **Stability:** Stable

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-ONB-001.1 | The system shall display onboarding screens only on first launch after app installation |
| FR-ONB-001.2 | The system shall show current platform statistics (number of companies registered) |
| FR-ONB-001.3 | The system shall display number of industry fields represented |
| FR-ONB-001.4 | The system shall show geographic coverage (number of locations) |
| FR-ONB-001.5 | The system shall display deal volume metrics (deals completed over time) |
| FR-ONB-001.6 | The system shall highlight key platform benefits and value propositions |
| FR-ONB-001.7 | The system shall provide skip option to proceed directly to login/registration |

---

### 3.3 Localization

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Localization Module | - | 0 EGP | **Mandatory** |

#### 3.3.1 Language Support (FR-LOC-001)

The system shall support multiple languages to serve a diverse user base.

**Actors:** System  
**Priority:** Mandatory | **Stability:** Stable

##### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-LOC-001.1 | The system shall support English and Arabic languages |
| FR-LOC-001.2 | The system shall default to device/system language setting |
| FR-LOC-001.3 | The system shall default to English if device language is not supported |
| FR-LOC-001.4 | The system shall properly render RTL (right-to-left) layout for Arabic |
| FR-LOC-001.5 | The system shall allow users to change language from settings |
| FR-LOC-001.6 | [Future] The system architecture shall support addition of more languages |

---

### 3.4 Company Portfolio

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Company Portfolio Module | 3 weeks | 7,000 EGP | **Mandatory** |

#### 3.4.1 Resend for Review (FR-PORT-001)

The system shall allow companies to update their documents and resubmit for administrative review.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-PORT-001.1 | The system shall allow editing of company documents after rejection |
| FR-PORT-001.2 | The system shall track revision history of submitted documents |
| FR-PORT-001.3 | The system shall notify admins of resubmission for review |

---

#### 3.4.2 Profile Page / Settings (FR-PORT-002)

The system shall provide a comprehensive profile management interface for users.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-PORT-002.1 | The system shall display user ID, name, email, and profile image |
| FR-PORT-002.2 | The system shall display agent ID and agent name |
| FR-PORT-002.3 | The system shall allow editing of password, profile image, and agent name |
| FR-PORT-002.4 | The system shall allow language preference changes |
| FR-PORT-002.5 | The system shall allow theme preference changes (light/dark mode) |

---

#### 3.4.3 Company Summary (FR-PORT-003)

The system shall allow companies to maintain a business description and achievements summary.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-PORT-003.1 | The system shall provide rich text editor for company summary (max 5000 characters) |
| FR-PORT-003.2 | The summary shall support business description and key achievements |
| FR-PORT-003.3 | Changes to summary shall require admin approval before publication |

---

#### 3.4.4 Company Gallery (FR-PORT-004)

The system shall provide media management capabilities for company portfolios.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-PORT-004.1 | The system shall support image uploads (JPG, PNG, WebP, max 5MB each) |
| FR-PORT-004.2 | The system shall support up to 50 images per company gallery |
| FR-PORT-004.3 | The system shall allow reordering of gallery images via drag-and-drop |
| FR-PORT-004.4 | The system shall generate optimized thumbnails automatically |

---

#### 3.4.5 Company Certificates (FR-PORT-005)

The system shall allow companies to showcase their certifications and credentials.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Certificate Data Model

| Field | Type | Description |
|-------|------|-------------|
| Certificate File | Image/PDF | Scanned certificate document |
| Certificate Title | Text | Name of the certification |
| Issuer | Text | Organization that issued the certificate |
| URL | URL | Link to verify certificate (optional) |

---

#### 3.4.6 Show Company Details (FR-PORT-006)

The system shall display comprehensive company information to visitors.

**Actors:** System  
**Priority:** Mandatory | **Stability:** Stable

##### Display Elements

- Company name, type, industry, and manufacturing strategy
- Company logo/image and website URL
- Business locations with map integration
- Company description and summary
- Gallery images and certificates
- Contact information (with privacy controls)
- Business contributions and achievements
- Average rating and review summary

---

#### 3.4.7 Edit Company Details (FR-PORT-007)

The system shall allow companies to modify their profile information.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Editable Fields

- Manufacturing strategy
- Company website URL
- Business locations (CRUD operations)
- Company description
- Gallery images
- Contact information
- Individual contributions

---

#### 3.4.8 Company Ratings (FR-PORT-008)

The system shall display and manage company ratings and reviews.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-PORT-008.1 | The system shall calculate and display average company rating (1-5 stars) |
| FR-PORT-008.2 | The system shall display rating distribution breakdown |
| FR-PORT-008.3 | The system shall show complete rating history with timestamps |
| FR-PORT-008.4 | The system shall display associated comments/reviews |

---

#### 3.4.9 Contact Information (FR-PORT-009)

The system shall manage company contact information with multiple channels.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Contact Channels

- Primary email address
- Phone numbers (multiple, with labels)
- Social media links (LinkedIn, Facebook, Twitter, etc.)
- Physical business locations with map coordinates

---

#### 3.4.10 Contributions (FR-PORT-010)

The system shall showcase company business contributions and achievements.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Contribution Types

| Type | Description & Fields |
|------|---------------------|
| **Product** | Most popular/successful products - includes media, title, description |
| **Project** | Effective projects - includes media, title, description, and contributor mentions |
| **Deal** | Largest deals and contracts - includes media, title, description |
| **Partnership** | Biggest partnerships - includes partner name, logo, and mention |

##### Media Support

- Images (JPG, PNG, WebP)
- Videos (MP4, max 100MB)
- Documents (PDF, max 10MB)

---

### 3.5 Deals

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Deals Module | 3 weeks | 12,000 EGP | **Mandatory** |

#### 3.5.1 Search a Deal (FR-DEAL-001)

The system shall provide comprehensive search functionality for discovering business opportunities.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-DEAL-001.1 | The system shall provide a search bar with autocomplete suggestions |
| FR-DEAL-001.2 | The system shall support keyword-based full-text search |
| FR-DEAL-001.3 | The system shall support search by company name |
| FR-DEAL-001.4 | The system shall support search by product/service |
| FR-DEAL-001.5 | The system shall save recent searches for quick access |
| FR-DEAL-001.6 | The system shall display search results with relevance ranking |

---

#### 3.5.2 Search Options (FR-DEAL-002)

The system shall provide advanced search criteria for refined results.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Unstable

##### Search Criteria

| Criterion | Description |
|-----------|-------------|
| Keywords | Free-text search terms |
| Products | Product category or specific product search |
| Company Type | Filter by company classification |
| Company Industry | Filter by industry sector |
| Manufacturing Strategy | Filter by production approach |

---

#### 3.5.3 Filters and Sort (FR-DEAL-003)

The system shall provide filtering and sorting options for search results.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Filter Options

- **Rating:** Minimum star rating threshold
- **Location:** Geographic proximity or specific regions
- **Price Range:** Budget constraints for deals

##### Sort Options

- Relevance (default)
- Rating (highest first)
- Price (low to high / high to low)
- Distance (nearest first)
- Date posted (newest first)

---

#### 3.5.4 Request for Quotation (FR-DEAL-004)

The system shall enable companies to request quotes from potential suppliers or partners.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-DEAL-004.1 | The system shall allow companies to send RFQ to specific companies |
| FR-DEAL-004.2 | RFQ shall include product/service specifications and quantity requirements |
| FR-DEAL-004.3 | Target company shall receive notification of incoming RFQ |
| FR-DEAL-004.4 | Target company can review and respond with acceptance or rejection |
| FR-DEAL-004.5 | System shall track RFQ status (pending, accepted, rejected, expired) |
| FR-DEAL-004.6 | Accepted RFQ shall enable direct communication between parties |

---

#### 3.5.5 Auctions (FR-DEAL-005)

The system shall provide auction functionality for competitive bidding on deals.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-DEAL-005.1 | Companies shall be able to publish auction listings for needed deals |
| FR-DEAL-005.2 | Auction listings shall include detailed requirements and deadline |
| FR-DEAL-005.3 | Other companies can submit bids/offers on auction listings |
| FR-DEAL-005.4 | Bids shall include price proposal and value proposition |
| FR-DEAL-005.5 | Auction owner can evaluate bids based on value and price |
| FR-DEAL-005.6 | System shall notify bidders of auction results |
| FR-DEAL-005.7 | Winning bid shall establish deal connection between parties |

---

### 3.6 Ratings

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Ratings Module | 1 day | 2,000 EGP | **Mandatory** |

#### 3.6.1 View Own Ratings (FR-RATE-001)

The system shall allow companies to view ratings received from other companies.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-RATE-001.1 | Companies can view all ratings received on their profile |
| FR-RATE-001.2 | Companies can see detailed comments associated with each rating |
| FR-RATE-001.3 | Ratings shall display the reviewing company name and date |

---

#### 3.6.2 Rate Companies (FR-RATE-002)

The system shall allow companies to rate partners they have conducted deals with.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-RATE-002.1 | Only companies with completed deals can rate each other |
| FR-RATE-002.2 | Rating shall use 1-5 star scale |
| FR-RATE-002.3 | Optional text comment can accompany the rating (max 1000 characters) |
| FR-RATE-002.4 | Ratings are permanent and cannot be deleted (edit within 24 hours) |

---

### 3.7 Customer Support

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Customer Support Module | 1 day | 500 EGP | **Mandatory** |

#### 3.7.1 Contact Us (FR-SUP-001)

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

Display support contact information including email, phone number, and physical address.

---

#### 3.7.2 Support Hours (FR-SUP-002)

**Actors:** System  
**Priority:** Desirable | **Stability:** Stable

Display available customer support hours with timezone indication.

---

#### 3.7.3 Email Support (FR-SUP-003)

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Unstable

Users can send support emails via device email client integration.

---

#### 3.7.4 Live Chat Support (FR-SUP-004)

**Actors:** Company Administrators  
**Priority:** Optional | **Stability:** Stable

Real-time messaging with customer support during available hours. Support staff use dedicated desktop application for response management.

---

#### 3.7.5 Support Dashboard (FR-SUP-005)

**Actors:** System Administrators  
**Priority:** Optional | **Stability:** Stable

Administrative interface for managing support tickets with separate views per user type.

---

### 3.8 Chats

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Chats Module | 2 weeks | 14,000 EGP | **Mandatory** |

#### 3.8.1 Live Chat (FR-CHAT-001)

The system shall provide real-time messaging capabilities between companies.

**Actors:** All Users  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-CHAT-001.1 | The system shall support real-time text messaging via WebSocket connection |
| FR-CHAT-001.2 | Messages shall be delivered within 500ms under normal conditions |
| FR-CHAT-001.3 | The system shall display message read receipts and typing indicators |
| FR-CHAT-001.4 | The system shall support file sharing (images, documents) within chat |
| FR-CHAT-001.5 | Chat history shall be persistent and searchable |
| FR-CHAT-001.6 | The system shall support push notifications for new messages |

---

### 3.9 Advertisements

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Advertisements Module | 3 weeks | 14,000 EGP | **Mandatory** |

#### 3.9.1 Request Advert (FR-ADV-001)

The system shall allow companies to request advertisement placements.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-ADV-001.1 | Companies can submit advertisement requests with description |
| FR-ADV-001.2 | Request shall include associated product/service information |
| FR-ADV-001.3 | Media files (images, videos) can be uploaded for the advertisement |
| FR-ADV-001.4 | System administrators review and approve/reject requests |

---

#### 3.9.2 Advert Options (FR-ADV-002)

The system shall provide configurable advertisement options.

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

##### Configuration Options

- **Duration:** 1 week, 2 weeks, 1 month, 3 months
- **Type:** Banner, Featured listing, Sponsored content
- **Placement:** Homepage, Search results, Category pages, Deal pages

---

#### 3.9.3 Edit Advert (FR-ADV-003)

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

Companies can modify active advertisements. Changes require admin re-approval before going live.

---

#### 3.9.4 Delete Advert (FR-ADV-004)

**Actors:** Company Administrators  
**Priority:** Mandatory | **Stability:** Stable

Companies can delete advertisements before expiration. Pro-rated refund/credit provided for remaining days.

---

#### 3.9.5 System Commission (FR-ADV-005)

**Actors:** System  
**Priority:** Mandatory | **Stability:** Stable

System earns commission from deals that originate from advertisement clicks. Commission rate configurable by admin.

---

#### 3.9.6 Advert Admin Dashboard (FR-ADV-006)

**Actors:** System Administrators  
**Priority:** Mandatory | **Stability:** Stable

Dedicated admin interface for advertisement management with capabilities to approve, reject, pause, and delete advertisements.

---

### 3.10 Admin Dashboard

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| Admin Dashboard Module | - | 9,000 EGP | **Mandatory** |

#### 3.10.1 Registration Management (FR-ADMIN-001)

**Actors:** System Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-ADMIN-001.1 | Admins can view pending registration requests with all submitted data |
| FR-ADMIN-001.2 | Admins can approve registration requests |
| FR-ADMIN-001.3 | Admins can reject requests with reason |
| FR-ADMIN-001.4 | System sends notification emails for approval/rejection |

---

#### 3.10.2 Adverts Management (FR-ADMIN-002)

**Actors:** System Administrators  
**Priority:** Mandatory | **Stability:** Stable

| ID | Requirement |
|----|-------------|
| FR-ADMIN-002.1 | View all advertisement requests and active advertisements |
| FR-ADMIN-002.2 | Approve or reject new advertisement requests |
| FR-ADMIN-002.3 | Review and approve/reject advertisement update requests |
| FR-ADMIN-002.4 | Pause or delete active advertisements |

---

#### 3.10.3 Profile Updates Management (FR-ADMIN-003)

**Actors:** System Administrators  
**Priority:** Mandatory | **Stability:** Stable

Admins can review and approve/reject company profile updates to maintain platform content quality.

---

### 3.11 App Fees (Future)

| Module | Duration | Estimated Cost | Priority |
|--------|----------|----------------|----------|
| App Fees Module | 1 day | 0 EGP | **Optional** |

> **Note:** The following features are planned for future implementation after the initial free year. Stability is Unstable.

#### 3.11.1 App Subscription (FR-FEE-001)

Users pay subscription fees to use the application. The app will be free for the first year after launch.

---

#### 3.11.2 Free Account Limitations (FR-FEE-002)

Free tier users have the following restrictions:

- Auctions require upfront payment
- Fixed rate for applying to auctions
- Limited communication capabilities

---

#### 3.11.3 App Packages (FR-FEE-003)

Premium subscription packages include:

- Search credits allocation
- Advanced search options
- Number of auctions allowed
- Number of auction applications permitted

---

#### 3.11.4 Contact Info Privacy (FR-FEE-004)

Company contact information is hidden by default and only revealed after a deal is accepted between parties.

---

## 4. External Interface Requirements

### 4.1 User Interfaces

The In-Deal platform shall provide the following user interface requirements:

- Responsive design supporting mobile, tablet, and desktop viewports
- Consistent visual language across all platforms (web, iOS, Android)
- Accessibility compliance with WCAG 2.1 Level AA
- Support for left-to-right (LTR) and right-to-left (RTL) layouts
- Dark mode support with user preference persistence
- Touch-friendly interface elements (minimum 44x44px touch targets)
- Loading states and skeleton screens for async operations

### 4.2 Hardware Interfaces

The mobile applications shall interface with device hardware:

- **Camera:** For profile photos and document uploads
- **Storage:** For caching and offline data
- **GPS:** For location-based features (optional)
- **Push notification services:** APNs for iOS, FCM for Android

### 4.3 Software Interfaces

| System | Interface Type | Purpose |
|--------|---------------|---------|
| Email Service | SMTP/API | Transactional emails |
| Payment Gateway | REST API | Subscription payments |
| Cloud Storage | SDK/API | Media file storage |
| Maps Service | JavaScript API | Location display |

### 4.4 Communication Interfaces

- **HTTPS:** All client-server communication encrypted with TLS 1.3
- **WebSocket:** Real-time messaging with secure WSS protocol
- **REST API:** JSON format for all data exchange
- **Push Notifications:** Platform-specific protocols for mobile alerts

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Metric | Target |
|--------|--------|
| Page Load Time | < 3 seconds on 4G connection |
| API Response Time | < 500ms for 95th percentile |
| Message Delivery | < 500ms real-time delivery |
| Search Results | < 2 seconds for complex queries |
| Concurrent Users | Support 10,000 simultaneous users |
| File Upload | Progress indication, resume capability |

### 5.2 Safety Requirements

- Automated backup of all data every 24 hours
- Point-in-time recovery capability for 30 days
- Graceful degradation during partial system failures
- Transaction rollback for failed operations

### 5.3 Security Requirements

#### 5.3.1 Authentication & Authorization

- Password hashing using bcrypt with cost factor 12
- JWT tokens with 24-hour expiration
- Role-based access control (RBAC)
- Multi-factor authentication support (future)

#### 5.3.2 Data Protection

- Encryption at rest for sensitive data (AES-256)
- TLS 1.3 for all data in transit
- PII data masking in logs
- Regular security audits and penetration testing

#### 5.3.3 Input Validation

- Server-side validation for all inputs
- SQL injection prevention via parameterized queries
- XSS protection with content sanitization
- CSRF tokens for state-changing operations

### 5.4 Software Quality Attributes

| Attribute | Target |
|-----------|--------|
| **Availability** | 99.9% uptime (< 8.76 hours downtime/year) |
| **Scalability** | Horizontal scaling to handle 10x growth |
| **Maintainability** | Modular architecture, comprehensive documentation |
| **Testability** | 80% code coverage minimum |
| **Portability** | Containerized deployment (Docker) |

### 5.5 Business Rules

- Registration approval required before account activation
- Only verified companies can participate in deals
- Ratings can only be given after completed transactions
- Advertisement content requires admin approval
- Profile changes require re-verification for sensitive fields

---

## 6. Appendix

### 6.1 Development Cost Summary

| Module | Duration | Cost (EGP) |
|--------|----------|------------|
| Login and Registration | 2 weeks | 4,500 |
| Onboarding | 1 day | 0 |
| Localization | - | 0 |
| Company Portfolio | 3 weeks | 7,000 |
| Deals | 3 weeks | 12,000 |
| Ratings | 1 day | 2,000 |
| Customer Support | 1 day | 500 |
| Chats | 2 weeks | 14,000 |
| Advertisements | 3 weeks | 14,000 |
| Admin Dashboard | - | 9,000 |
| App Fees | 1 day | 0 |
| **TOTAL** | **~15 weeks** | **63,000** |

### 6.2 Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | January 2026 | - | Initial SRS document |

### 6.3 Document Approval

| Role | Name | Signature / Date |
|------|------|------------------|
| Project Sponsor | | |
| Project Manager | | |
| Technical Lead | | |
| QA Lead | | |

---

*End of Document*
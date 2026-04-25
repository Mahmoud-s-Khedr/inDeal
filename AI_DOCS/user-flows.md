# inDeal System API User Flows

This document outlines the logical sequence and dependencies for how users (primarily Company Administrators) interact with the inDeal system APIs. A user must complete earlier steps in the flow (like Registration and Login) before accessing protected resources.

## 1. Authentication & Onboarding Flow

Before accessing any core system features, a user must have an authenticated session.

1.  **Register Company Account (`POST /auth/register`)**
    - **Action:** The company administrator creates a new account.
    - **Data Required:** Agent name, job title, company name, type, industry, website, manufacturing strategy, address, email, phone, uploaded documents, and password.
    - **Dependency:** Must be a new, unregistered email.
2.  **Login (`POST /auth/login`)**
    - **Action:** The user authenticates to the system.
    - **Data Required:** Email and password.
    - **Result:** Returns an authentication token (JWT/Session) used for all subsequent requests.
3.  **Forgot Password Flow (Optional)**
    - **Request Reset (`POST /auth/forgot-password`):** User inputs email to receive a validation code/link.
    - **Validate Account (`POST /auth/validate-reset`):** User submits the validation code.
    - **Reset Password (`POST /auth/reset-password`):** User submits a new strong password and confirmation password.
4.  **Logout (`POST /auth/logout`)**
    - **Action:** Invalidates the current user session.
    - **Dependency:** The user must be currently logged in.

---

## 2. Profile & Portfolio Management Flow

Once authenticated, the user needs to complete and manage their company profile and portfolio before actively participating in deals.

1.  **View/Update Personal Profile (`GET/PUT /profile`)**
    - **Action:** View or edit personal admin details (password, personal image, agent name).
    - **Dependency:** Must be logged in.
2.  **Manage Company Information (`PUT /company/details`)**
    - **Action:** Edit company-level details (manufacturing strategy, website, description).
3.  **Manage Contact Info & Locations (`POST/PUT/DELETE /company/contact`, `/company/locations`)**
    - **Action:** Add or edit emails, phone numbers, social media links, and physical locations.
4.  **Manage Company Portfolio & Summary (`POST/PUT /company/summary`, `/company/gallery`, `/company/certificates`)**
    - **Action:** Add a business summary, upload gallery images, and add certificates (title, date, issuer, URL).
5.  **Manage Contributions (`POST/PUT/DELETE /company/contributions`)**
    - **Action:** Add projects, products, or partnerships to showcase company achievements. Includes media uploads.
6.  **Resend for Review (`POST /company/resend-review`)**
    - **Action:** If account approval is pending or documents were updated, the user submits the updated company details and documents for system review.

---

## 3. Deals Management Flow

With a completed and approved profile, the company can create and manage their own deals on the marketplace.

1.  **Create a Deal (`POST /deals`)**
    - **Action:** Create a new "Supply" or "Demand" deal.
    - **Data Required:** Title, description, images/files, price, and type.
    - **Dependency:** Must not exceed the system's "Max Open Deals" limit for the company.
2.  **Manage Existing Deals (`PUT/DELETE /deals/{id}`)**
    - **Action:** Update deal details, or delete the deal entirely.
3.  **Change Deal Status (`PATCH /deals/{id}/status`)**
    - **Action:** Close a deal (stops accepting new applications) or Reopen a closed deal.
4.  **Search Deals (`GET /deals/search`)**
    - **Action:** Browse and search for deals posted by other companies.
    - **Filters:** Keywords, industry, price range, date/time, and deal type.
    - **Sorting:** By price, date, or number of applications.

---

## 4. Application & Quotation Flow

Users interact with other companies' deals by applying or sending direct quotation requests.

1.  **Apply to a Supply/Demand Deal (`POST /deals/{id}/apply`)**
    - **Action:** Submit a detailed offer/request to another company's open deal.
    - **Data Required:** Extensive details depending on if it's supply or demand (e.g., basic request info, commercial requirements, technical specs, logistics, pricing, availability).
    - **Dependency:** The target deal must be "Open".
2.  **View Apply History & My Requests (`GET /applications/history`, `GET /applications/sent`)**
    - **Action:** View all applications the company has submitted to others, or requests received from others.
3.  **Manage Applications (`PATCH /applications/{id}/status`)**
    - **Action:** Pause or cancel an active application.
    - **Data Required:** If canceling, a cancellation reason must be provided.
4.  **Send Request for Quotation (RFQ) (`POST /rfq`)**
    - **Action:** Send a direct deal/quotation request to a specific company (similar data structure to a supply offer).

---

## 5. Communication Flow

Users can communicate regarding deals and applications.

1.  **Live Chat (`WS /chat` or `POST /chat/messages`)**
    - **Action:** Send and receive real-time messages with other users.
    - **Dependency:** Usually requires an existing connection or application context (e.g., chatting with a deal owner).

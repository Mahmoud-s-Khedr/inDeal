### **Phase 1: Foundation & Identity**
**Total Duration:** ~3 Weeks | **Total Cost:** ~4,000 EGP

#### **1. Authentication & Registration**
* [cite_start]**Timeline:** 2 Weeks [cite: 1]
* [cite_start]**Cost:** 4,000 EGP [cite: 1]
* [cite_start]**Priority:** Mandatory [cite: 1]
* **Description:**
    * [cite_start]User login/registration with email & password validation[cite: 1].
    * [cite_start]Company registration (collecting agent name, job title, industry, strategy, files)[cite: 1].
    * [cite_start]System admins must review registration requests before activation[cite: 1].
    * [cite_start]Password reset functionality[cite: 1].
    * (Desirable) [cite_start]Collect user interests/pre-data for personalization[cite: 1].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new company. Handles text fields + file uploads (Multipart). |
| `POST` | `/api/auth/login` | Authenticate via Email/Password. Returns JWT. |
| `POST` | `/api/auth/forgot-password`| Trigger reset email. |
| `POST` | `/api/auth/reset-password` | Set new password via token. |
| `POST` | `/api/users/interests` | Save user interests for "Pre data" analysis. |

#### **2. Onboarding & Localization**
* [cite_start]**Timeline:** 1 Day [cite: 5]
* [cite_start]**Cost:** 0 EGP [cite: 5]
* [cite_start]**Priority:** Desirable [cite: 5]
* **Description:**
    * [cite_start]Show system stats (companies, locations, deals) on first open[cite: 1].
    * [cite_start]Support English (Default) and Arabic[cite: 6, 7].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/system/stats` | Returns counts: `{ companies: 50, deals: 12, locations: 5 }`. |
| `GET` | `/api/system/config` | Returns localization settings and supported languages. |

---

### **Phase 2: Core Profile & Trust**
**Total Duration:** 3 Weeks | **Total Cost:** 7,000 EGP

#### **3. Company Portfolio Management**
* [cite_start]**Timeline:** 3 Weeks [cite: 9]
* [cite_start]**Cost:** 7,000 EGP [cite: 9]
* [cite_start]**Priority:** Mandatory [cite: 10]
* **Description:**
    * [cite_start]Edit account details (password, profile image) pending admin review[cite: 12].
    * [cite_start]Add contact info (location, social media) and summary[cite: 12].
    * [cite_start]Upload gallery images[cite: 12].
    * [cite_start]List contributions (products, projects, partnerships)[cite: 12].
    * [cite_start]Display reviews and average rating[cite: 12].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/companies/me` | Get private profile details. |
| `PUT` | `/api/companies/me` | Update summary/contact. Triggers `status: pending_review`. |
| `PUT` | `/api/companies/me/avatar` | Upload new profile image (Multipart). |
| `POST` | `/api/companies/me/gallery`| Upload portfolio images. |
| `POST` | `/api/companies/me/contributions` | Add projects/products to profile. |
| `GET` | `/api/companies/:id` | View public profile of another company. |

---

### **Phase 3: The Deal Marketplace**
**Total Duration:** ~3 Weeks | **Total Cost:** 14,000 EGP

#### **4. Deals (Auctions & RFQs)**
* [cite_start]**Timeline:** 3 Weeks [cite: 14]
* [cite_start]**Cost:** 12,000 EGP [cite: 14]
* [cite_start]**Priority:** Mandatory [cite: 16]
* **Description:**
    * [cite_start]**Search:** Keyword search by product/company[cite: 15].
    * [cite_start]**Filters:** Filter by rate, location, price, industry[cite: 16].
    * [cite_start]**RFQs:** Send deal request to specific company (Target accepts/rejects)[cite: 16].
    * [cite_start]**Auctions:** Publish a need; others apply; lowest price/best value wins[cite: 16].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/deals` | Search deals using query params (`?q=steel&minPrice=1000`). |
| `POST` | `/api/deals` | Create a new Auction or RFQ. |
| `GET` | `/api/deals/:id` | View deal details. |
| `POST` | `/api/deals/:id/bid` | Apply to an auction with a price offer. |
| `POST` | `/api/deals/rfq` | Send a private RFQ to a specific company ID. |
| `POST` | `/api/deals/:id/accept-bid` | Close auction by accepting a specific bid ID. |

#### **5. Ratings System**
* [cite_start]**Timeline:** 1 Day [cite: 18]
* [cite_start]**Cost:** 2,000 EGP [cite: 18]
* [cite_start]**Priority:** Mandatory [cite: 19]
* **Description:**
    * [cite_start]Users can rate companies they have dealt with[cite: 19].
    * [cite_start]Users can view their own rates and comments received[cite: 19].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/companies/:id/rates` | Submit a review (Backend check: `deals` table must link users). |
| `GET` | `/api/companies/:id/rates` | Get list of reviews for a company. |

---

### **Phase 4: Communication & Revenue**
**Total Duration:** ~5 Weeks | **Total Cost:** 28,000 EGP

#### **6. Chat System**
* [cite_start]**Timeline:** 2 Weeks [cite: 24]
* [cite_start]**Cost:** 14,000 EGP [cite: 24]
* [cite_start]**Priority:** Mandatory [cite: 28]
* **Description:**
    * [cite_start]Real-time messaging between users[cite: 27].
    * (Technical Note: This uses **Socket.io** heavily, APIs are for history).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chats` | Create a room between Company A and Company B. |
| `GET` | `/api/chats` | List my active conversation threads. |
| `GET` | `/api/chats/:roomId/messages` | Fetch chat history (pagination). |

#### **7. Advertisement Module**
* [cite_start]**Timeline:** 3 Weeks [cite: 32]
* [cite_start]**Cost:** 14,000 EGP [cite: 32]
* [cite_start]**Priority:** Mandatory [cite: 30]
* **Description:**
    * [cite_start]Request ads (description, product, media)[cite: 30].
    * [cite_start]Choose duration, type, and placement[cite: 30].
    * [cite_start]Edit/Delete ads (Delete triggers refund calculation)[cite: 30].
    * [cite_start]System takes a percentage of deals from ads[cite: 30].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ads` | Submit new ad request (Multipart). |
| `GET` | `/api/ads/me` | View my ads and their status (Pending/Active). |
| `PUT` | `/api/ads/:id` | Edit ad details (resets status to `pending`). |
| `DELETE`| `/api/ads/:id` | Remove ad and trigger refund logic. |

---

### **Phase 5: Administration & Support**
**Total Duration:** ~2 Weeks | **Total Cost:** 9,500 EGP

#### **8. Admin Dashboard**
* [cite_start]**Timeline:** Weeks (Assumed 2 based on scope) [cite: 34]
* [cite_start]**Cost:** 9,000 EGP [cite: 34]
* [cite_start]**Priority:** Mandatory [cite: 35]
* **Description:**
    * [cite_start]Accept/Reject Registrations[cite: 35].
    * [cite_start]Accept/Reject/Pause Adverts[cite: 35].
    * [cite_start]Review/Approve Profile Updates[cite: 35].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/registrations` | View pending company signups. |
| `POST` | `/api/admin/registrations/:id`| Action: `{ status: 'approved' | 'rejected' }`. |
| `GET` | `/api/admin/ads` | View pending ad requests. |
| `POST` | `/api/admin/ads/:id` | Action: `{ status: 'active' | 'rejected' }`. |
| `GET` | `/api/admin/updates` | View pending profile changes. |
| `POST` | `/api/admin/updates/:id` | Approve/Reject profile edits. |

#### **9. Customer Support**
* [cite_start]**Timeline:** 1 Day [cite: 21]
* [cite_start]**Cost:** 500 EGP [cite: 21]
* [cite_start]**Priority:** Mandatory [cite: 22]
* **Description:**
    * [cite_start]Show support info (email, phone, hours)[cite: 22].
    * [cite_start]Send emails to support[cite: 22].

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/support/info` | Returns static support contact details. |
| `POST` | `/api/support/ticket` | User submits a help request. |

---

### **Immediate Next Step**
Would you like me to generate the **SQL Migration Script** for the `deals` and `reviews` tables, or should we start coding the **Authentication Controller** (`/api/auth/register`)?
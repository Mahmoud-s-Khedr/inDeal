# Company Portfolio Module — Detailed Implementation Plan
Testing backend base URL: https://api-test.indealeg.com

**Module Duration:** 3 weeks  
**Module Cost:** 7,000 EGP  
**Priority:** Mandatory  
**Release Quality:** Stable

This document defines **everything that will be delivered** for the "Company Portfolio" module, based on the current inDeal backend codebase (Node/Express + Postgres raw SQL + Valkey + Resend).

---

## Implementation Status (as of 2026-01-02)

- [x] Plan drafted (this document)
- [x] DB additions: `users.preferences` + `company_contributions` migration SQL
- [x] DB additive update (v2): certificate metadata + contribution media/details
- [x] Agent portfolio endpoints: gallery CRUD, documents CRUD, contributions CRUD
- [x] Agent workflow: `POST /companies/me/resend-for-review` (sets `underReview`) + optional admin inbox email
- [x] Admin portfolio endpoints: edit company details + summary, gallery/documents/contributions CRUD, reviews listing
- [x] User settings endpoints: profile + password + profile image + preferences
- [x] Bruno requests added for new endpoints
- [ ] Runtime smoke test: apply migration on a real DB and hit endpoints end-to-end

---

## 0) Current State (Already Exists)
The project already implements a baseline portfolio API:

**Company (agent) endpoints** in `src/routes/v1/company.routes.js`
- `GET /api/v1/companies/me` (auth) — returns private company profile
- `PUT /api/v1/companies/me` (auth) — updates company fields
- `POST /api/v1/companies/me/gallery` (auth) — add gallery image
- `GET /api/v1/companies/:id` — public company profile
- `GET /api/v1/companies/:id/gallery` — public gallery
- `GET /api/v1/companies/:id/reviews` — public reviews
- `POST /api/v1/companies/:id/reviews` (auth) — create review

**Admin endpoints** in `src/routes/v1/admin.routes.js`
- `GET /api/v1/admin/companies` — list companies
- `GET /api/v1/admin/companies/pending` — list `underReview` companies with registration documents
- `GET /api/v1/admin/companies/:id` — details + documents + agent
- `PATCH /api/v1/admin/companies/:id/status` — update status
- `POST /api/v1/admin/companies/:id/approve` — approve company
- `POST /api/v1/admin/companies/:id/reject` — reject company
- `POST /api/v1/admin/companies/:id/agent` — change agent

**Database tables already exist** in `AI_DOCS/schema.sql`
- `companies` (core + `contacts jsonb`, `locations jsonb`, `status company_state_enum`)
- `company_gallery` (images)
- `company_documents` (registration documents)
- `company_reviews` (ratings)

---

## 1) Roles & Permissions (for this module)

### 1.1 Agent (company owner)
- Manages **their own** company portfolio (details, contacts, locations, gallery, certificates/documents, contributions).
- Can "resend for review" (submit profile/documents for admin review).

### 1.2 Admin (system admin)
- Can view/edit **any** company portfolio.
- Can edit company documents/details.
- Can trigger a company back to `underReview` when needed.
- Can view ratings history.

---

## 2) Requirements Mapping (What will be delivered)

### A) Resend for Review (Company/Admin)
**Requirement:** Edit company documents and details and resend for review.
- [x] Add explicit endpoint for agent to "submit/resend" their company for review.
- [x] Ensure updates that should require review can set company `status = underReview` (controlled + predictable).
- [x] Send an email notification via Resend to admins when a company resubmits for review (via `COMPANY_REVIEW_NOTIFICATION_EMAIL`, optional).
- [x] (Optional) Confirmation email to the agent.

### B) Profile Page (Settings) (Company)
**Requirement:**
- System show id, name, email, image
- System show agent id, agent name
- Edit password, image and agent name
- Change language and theme

**Delivery:**
- [x] Add `GET /api/v1/users/me` returning: `{ id, firstName, lastName, email, profileImageFileId, preferences: { language, theme } }`.
- [x] Add `PUT /api/v1/users/me` to update: name + preferences.
- [x] Add `PUT /api/v1/users/me/password` to update password.
- [x] Add `PUT /api/v1/users/me/profile-image` to set `users.profile_image` using an existing uploaded file id.

### C) Company Summary (Admin)
**Requirement:** Admins can add company summary representing business description and achievements.

**Delivery (minimal, stable):**
- [x] Use existing `companies.description` as the summary text.
- [x] Admin endpoint to update it: `PUT /api/v1/admin/companies/:id/summary`.
- [x] Achievements are represented by the Contributions feature (Section I).

### D) Company Gallery (Company)
**Requirement:** Show and edit images; show and edit certificates.

**Delivery:**
- [x] Gallery images = `company_gallery`.
- [x] Certificates = `company_documents` with `docType = 'certificate'`.
- [x] Certificate metadata fields: `title`, `issuer`, and `url` (optional) in addition to `fileId`.
- [x] Agent endpoints support list/add/update/delete for both.

### D.1) Company Certificate (Details)
**Requirement:**
- Certificate include file may be image.
- Include text (certificate title), issuer and url.

**Delivery (stable, minimal):**
- [x] Model certificates as `company_documents` rows where `docType='certificate'`.
- [x] Add certificate metadata fields on the document row: `title`, `issuer`, `url`.
- [x] Validation rule (create): when `docType='certificate'`, require `title` + `issuer` + one of `fileId` or `url`.

### E) Show Company Details (System)
**Requirement:** System shows company core details, gallery, contact info, contributions.

**Delivery:**
- [x] Extend the public company profile response (`GET /api/v1/companies/:id`) to include company core fields, gallery, contacts/locations, contributions, and rating summary.

### F) Edit Details (Company)
**Requirement:** Edit manufacturing strategy, website, CRUD on locations, description; edit company gallery; edit contact info; edit each contribution.

**Delivery:**
- [x] Keep `PUT /api/v1/companies/me` for company core fields + contact + locations.
- [x] Add CRUD endpoints for gallery/documents/certificates/contributions.

### G) Rate (Company/Admin)
**Requirement:** display average rate; show all rates history and comments.

**Delivery:**
- [x] Public reviews are already supported.
- [x] Add admin endpoint to fetch reviews for a company (same underlying repo).
- [x] Ensure `GET /api/v1/companies/me` returns `averageRating` + `reviews`.

### H) Contact Info (Company/Admin)
**Requirement:** Admins can add company contact info and location.

**Delivery:**
- [x] Admin endpoints allow updating `contacts` and `locations`.
- [x] Agent endpoints allow updating `contacts` and `locations`.

### I) Contributions (Company/Admin)
**Requirement:** Display company contributions; each has media, title, description, type; categories include products/projects/deals/partnerships.

**Delivery:**
- [x] Add a new table `company_contributions`.
- [x] CRUD endpoints for agent and admin.
- [x] Contribution `type` values are validated using a fixed enum list: `product`, `project`, `deal`, `partnership`.
- [x] Contribution media supports: image, video, and files (via uploaded `fileId`) and optional external `url`.
- [x] Type-specific extra fields are stored in a `details` JSON object (validated as an object; per-type keys may evolve).

---

## 3) Data Model Changes

### 3.1 Postgres
**Add (minimal) `users.preferences`**
- `users.preferences jsonb` to store `{ language: 'en' | 'ar', theme: 'light' | 'dark' }`.

- [x] Implemented in schema docs + migration.

**Add `company_contributions`**
- Columns:
  - `id serial primary key`
  - `company_id int references companies(id)`
  - `media_file_id int references files(id)` (nullable)
  - `media_type varchar(30)` (nullable) — e.g. `image`, `video`, `file`, `url`
  - `media_url varchar(255)` (nullable)
  - `type varchar(30) not null`
  - `title varchar(150) not null`
  - `description text` (nullable)
  - `details jsonb` (nullable) — extra fields for `product/project/partnership`
  - `created_at timestamp default current_timestamp`
  - `updated_at timestamp default current_timestamp`
- Index: `idx_company_contributions_company_id`.

- [x] Implemented in schema docs + migration.

### 3.2 No breaking schema changes
- Schema updates are additive (nullable columns) to keep backward compatibility.
- Certificates are modeled as `company_documents` rows with `doc_type='certificate'`.
- Company summary uses `companies.description`.

### 3.3 Certificate metadata (company_documents)
- Add nullable columns on `company_documents`: `title varchar(150)`, `issuer varchar(150)`, `url varchar(255)`.
- For certificates (`docType='certificate'`), API validation requires `title` + `issuer` and one of `url` or `fileId` on create.

---

## 4) API Surface (Exact Endpoints to implement)

### 4.1 Company (Agent) endpoints
Existing (kept):
- [x] `GET /api/v1/companies/me`
- [x] `PUT /api/v1/companies/me`
- [x] `POST /api/v1/companies/me/gallery`

New (to add):
- [x] `POST /api/v1/companies/me/resend-for-review`

Gallery CRUD:
- [x] `GET /api/v1/companies/me/gallery`
- [x] `PUT /api/v1/companies/me/gallery/:galleryItemId`
- [x] `DELETE /api/v1/companies/me/gallery/:galleryItemId`

Documents/Certificates CRUD:
- [x] `GET /api/v1/companies/me/documents`
- [x] `POST /api/v1/companies/me/documents`
- [x] `PUT /api/v1/companies/me/documents/:documentId`
- [x] `DELETE /api/v1/companies/me/documents/:documentId`

Certificate payload (create):
- `{ fileId?, docType: 'certificate', title, issuer, url?, description? }`
- Rule: require `title`, `issuer`, and one of `fileId` or `url`.

Contributions CRUD:
- [x] `GET /api/v1/companies/me/contributions`
- [x] `POST /api/v1/companies/me/contributions`
- [x] `PUT /api/v1/companies/me/contributions/:contributionId`
- [x] `DELETE /api/v1/companies/me/contributions/:contributionId`

Contribution payload (create/update):
- `mediaFileId?` (existing, kept)
- `mediaType?`: `image | video | file | url`
- `mediaUrl?` (required when `mediaType='url'`)
- `details?` (object) — for type-specific fields (project/product/partnership)

### 4.2 Users (Agent settings) endpoints
New module router: `src/routes/v1/user.routes.js`
- [x] `GET /api/v1/users/me`
- [x] `PUT /api/v1/users/me`
- [x] `PUT /api/v1/users/me/password`
- [x] `PUT /api/v1/users/me/profile-image`

### 4.3 Admin endpoints
Existing (kept): company listing + approval

New (to add):
- [x] `PUT /api/v1/admin/companies/:id/summary`
- [x] `PUT /api/v1/admin/companies/:id` (edit details: strategy, website, locations, description, contacts)

Admin gallery/document/contribution editing:
- [x] `GET /api/v1/admin/companies/:id/gallery`
- [x] `POST /api/v1/admin/companies/:id/gallery`
- [x] `PUT /api/v1/admin/companies/:id/gallery/:galleryItemId`
- [x] `DELETE /api/v1/admin/companies/:id/gallery/:galleryItemId`

- [x] `GET /api/v1/admin/companies/:id/documents`
- [x] `POST /api/v1/admin/companies/:id/documents`
- [x] `PUT /api/v1/admin/companies/:id/documents/:documentId`
- [x] `DELETE /api/v1/admin/companies/:id/documents/:documentId`

- [x] `GET /api/v1/admin/companies/:id/contributions`
- [x] `POST /api/v1/admin/companies/:id/contributions`
- [x] `PUT /api/v1/admin/companies/:id/contributions/:contributionId`
- [x] `DELETE /api/v1/admin/companies/:id/contributions/:contributionId`

Ratings history:
- [x] `GET /api/v1/admin/companies/:id/reviews`

---

## 5) Notifications (Resend)

### 5.1 New environment variable
- `COMPANY_REVIEW_NOTIFICATION_EMAIL` (optional)
  - If set: send review submission emails to this address.
  - If missing: log a warning and continue.

- [x] Implemented in config + documented in README.

### 5.2 Email events
- [x] On `POST /companies/me/resend-for-review`: email to `COMPANY_REVIEW_NOTIFICATION_EMAIL` with company id/name + agent email.

(Stable optional) On admin approval/rejection:
- [x] Email agent to inform status change.

---

## 6) Validation & Security
- Use Zod for all new payloads/params.
- All `/companies/me/*` and `/users/me/*` require auth.
- All `/admin/*` requires auth + role `admin`.
- Contributions and documents are strictly scoped:
  - Agent can only modify their own company’s records.
  - Admin can modify any company’s records.

Additional validation rules (portfolio v2):
- Certificates: when `docType='certificate'`, require `title` + `issuer` and one of `url|fileId` on create.
- Contribution media: if `mediaType='url'`, require a valid `mediaUrl` (http/https). Do not server-fetch URLs (store only).

---

## 7) Testing & Verification
No automated test harness exists yet.

**Manual smoke checks** (Bruno/Postman):
- [ ] Apply migration against a real Postgres instance and verify schema changes.
- [ ] Update profile fields and ensure DB update.
- [ ] Add/edit/delete gallery item.
- [ ] Add/edit/delete certificate (document with `docType='certificate'`).
- [ ] Certificate metadata: create/update `title`, `issuer`, and `url`.
- [ ] Add/edit/delete contribution.
- [ ] Contribution media: test file-based media + URL-based media.
- [ ] Resend-for-review triggers status `underReview` and attempts email.
- [ ] Admin edits a company and confirms edits visible in public profile.

---

## 8) Timeline (3 Weeks)

### Week 1 — Data + Agent Portfolio CRUD
- [x] Add DB changes: `users.preferences`, `company_contributions`.
- [x] Fix `GET /companies/me` response to include full profile (company + gallery + docs + reviews + average + contributions).
- [x] Implement agent gallery CRUD + documents CRUD + contributions CRUD.
- [x] Implement resend-for-review endpoint (status change + optional admin email).
- [ ] (Optional) Add audit log record for resubmission.

### Week 2 — Admin Portfolio Management
- [x] Admin edit company details + summary.
- [x] Admin gallery/documents/contributions CRUD.
- [x] Admin reviews history endpoint.
- [x] Ensure status transitions are consistent (`underReview`, `active`, `rejected`).

### Week 3 — Settings + Stabilization
- [x] Implement user settings endpoints (name/password/profile image + language/theme).
- [x] Update Bruno/Postman collections.
- [x] Hardening: consistent response shape, error handling, validation, and logging.

---

## 9) Deliverables Checklist
- [x] New doc: this file.
- [x] DB schema updates: `AI_DOCS/schema.sql` and a migration SQL file for incremental updates.
- [x] New repositories: contributions + CRUD for documents/gallery if missing.
- [x] New routes/controllers/services: user settings, agent portfolio extended CRUD, admin portfolio edit APIs.
- [x] Resend notification wiring.
- [x] Updated API collections for manual testing.
- [ ] Runtime validation: apply migration + smoke test key endpoints.

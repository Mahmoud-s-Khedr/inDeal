# API Reference

This reference lists every exposed API route under `/api/v1` with their request requirements (params + body). Unless noted, all endpoints return the standard `{ status, message, data }` JSON envelope.

Source of truth: route definitions in `src/routes/v1/*.routes.js`.

## Auth
| Method | Path | Auth | Description | Validation |
| --- | --- | --- | --- | --- |
| POST | `/auth/register/upload-url` | None | Get a signed upload URL for registration file uploads. | `createUploadUrlSchema.body`: `fileName`, `fileType`, `fileSize` (≤ `MAX_FILE_SIZE_BYTES`).
| POST | `/auth/register` | None | Register agent + company in one call. | `registerSchema.body.user`: `username` 3-50, `email`, `password` ≥8, `firstName`, `lastName`, optional `jobTitle`. `registerSchema.body.company`: `name` 1-100, optional `description/address/phone/website`, optional enums `companyType/companyIndustry/manufacturingStrategy`, optional `contacts[]` of `{ type, value }`, optional `locations[]`, optional `documents[]` of `{ fileId, docType?, description? }`.
| POST | `/auth/login` | None | Agent login. | `loginSchema.body`: `email`, `password` (≥8).
| POST | `/auth/admin/login` | None | Admin login. | `loginSchema.body`: `email`, `password` (≥8).
| POST | `/auth/forgot-password` | None | Start password reset (send OTP). | `forgotPasswordSchema.body`: `email`.
| POST | `/auth/resend-forgot-password-otp` | None | Resend OTP for password reset. | `forgotPasswordSchema.body`: `email`.
| POST | `/auth/verify-otp` | None | Validate OTP for password reset. | `verifyOtpSchema.body`: `email`, `otp` (6 digits).
| POST | `/auth/reset-password` | None | Complete password reset. | `resetPasswordSchema.body`: `email`, `otp` (6 digits), `password` ≥8, `confirmPassword` ≥8 (must match). Recent password reuse is rejected.
| POST | `/auth/resend-verification` | None | Ask for new verification email. | `resendVerificationSchema.body`: `email`.
| POST | `/auth/logout` | Required | Revoke current session (`jti`) in Valkey. | No body; uses `Authorization: Bearer <token>`.
| GET | `/auth/verify-email` | None | Email verification landing page (HTML). | `verifyEmailSchema.query`: `email`, `token` (≥16 chars).

## Company (agent)
| Method | Path | Auth | Description | Validation |
| --- | --- | --- | --- | --- |
| GET | `/companies/me` | Required | Agent private company profile (includes gallery, documents, contributions, reviews, `averageRating`). | None.
| PUT | `/companies/me` | Required | Update company core fields + `contacts` + `locations`. | `updateCompanySchema.body`: at least 1 of `name/description/address/phone/website/companyType/companyIndustry/manufacturingStrategy/contacts/locations`.
| POST | `/companies/me/resend-for-review` | Required | Set company status to `underReview` (and send optional emails). | None.
| GET | `/companies/me/gallery` | Required | List gallery items owned by authenticated agent company. | None.
| POST | `/companies/me/gallery` | Required | Create gallery item (image). | `addGalleryItemSchema.body`: `imageFileId`, optional `description`.
| PUT | `/companies/me/gallery/:galleryItemId` | Required | Update gallery item. | `updateGalleryItemSchema`: params `galleryItemId`; body optional `imageFileId`, `description` (at least one).
| DELETE | `/companies/me/gallery/:galleryItemId` | Required | Delete gallery item. | `galleryItemParamsSchema`: params `galleryItemId`.
| GET | `/companies/me/documents` | Required | List company documents/certificates. | None.
| POST | `/companies/me/documents` | Required | Create a document or certificate. | `createDocumentSchema.body`: `fileId?`, `docType?`, optional `description`. If `docType='certificate'`: require `title` + `issuer` and one of `fileId` or `url`.
| PUT | `/companies/me/documents/:documentId` | Required | Update a document/certificate. | `updateDocumentSchema`: params `documentId`; body optional `fileId/docType/title/issuer/url/description` (at least one). Certificate rules are enforced server-side using the existing record.
| DELETE | `/companies/me/documents/:documentId` | Required | Delete a document/certificate. | `documentIdParamsSchema`: params `documentId`.
| GET | `/companies/me/contributions` | Required | List company contributions. | None.
| POST | `/companies/me/contributions` | Required | Create contribution (product/project/deal/partnership). | `createContributionSchema.body`: `type`, `title`, optional `description`, optional `mediaFileId`, optional `mediaType` (`image|video|file|url`), optional `mediaUrl`, optional `details` object. If `mediaType='url'`: require `mediaUrl` and forbid `mediaFileId`. If `mediaType` is `image|video|file`: require `mediaFileId`.
| PUT | `/companies/me/contributions/:contributionId` | Required | Update contribution. | `updateContributionSchema`: params `contributionId`; body optional `type/title/description/mediaFileId/mediaType/mediaUrl/details` (at least one). Media rules are enforced server-side using the existing record.
| DELETE | `/companies/me/contributions/:contributionId` | Required | Delete contribution. | `contributionIdParamsSchema`: params `contributionId`.
| GET | `/companies/:id` | None | Public company profile (includes gallery, contributions, reviews summary). | `companyIdParamsSchema`: params `id` numeric.
| GET | `/companies/:id/gallery` | None | Public company gallery. | `companyIdParamsSchema`: params `id` numeric.
| GET | `/companies/:id/reviews` | None | Public reviews list. | `companyIdParamsSchema`: params `id` numeric.
| POST | `/companies/:id/reviews` | Required | Create review for a company (agent). | `createReviewSchema`: params `id`; body `rating` 1-5, optional `reviewText`.

## Files
| Method | Path | Auth | Description | Validation |
| --- | --- | --- | --- | --- |
| POST | `/files/upload-url` | Required | Request signed Cloudflare R2 upload URL for a file. | `createUploadUrlSchema.body`: `fileName`, `fileType`, `fileSize` (≤ `MAX_FILE_SIZE_BYTES`).

## User settings
(All `/users/*` routes protected by `protect` middleware.)
| Method | Path | Description | Validation |
| --- | --- | --- | --- |
| GET | `/users/me` | Get authenticated user's profile (name, email, preferences, profile image). | none.
| PUT | `/users/me` | Update name and theme/language preference. | `updateMeSchema.body`: at least one of `firstName`, `lastName`, `preferences.language` (en/ar), `preferences.theme` (light/dark).
| PUT | `/users/me/password` | Change password. | `updatePasswordSchema.body`: `currentPassword`, `newPassword` (both ≥6). Reuse prevented.
| PUT | `/users/me/profile-image` | Attach profile image file. | `updateProfileImageSchema.body`: `profileImageFileId`.

## Admin
(All `/admin/*` routes protected by `protect` + `requireRoles('admin')`.)
| Method | Path | Description | Validation |
| --- | --- | --- | --- |
| GET | `/admin/companies` | List companies (all statuses). | none.
| GET | `/admin/companies/pending` | List `underReview` companies. | none.
| GET | `/admin/companies/:id` | Company detail (admin view). | `companyParamsSchema`: params `id` positive integer.
| PUT | `/admin/companies/:id` | Update company core fields + contacts + locations. | `updateCompanySchema`: params `id`; body requires at least one field.
| PUT | `/admin/companies/:id/summary` | Update company summary (stored in `companies.description`). | `updateCompanySummarySchema`: params `id`; body `summary` (min 1).
| PATCH | `/admin/companies/:id/status` | Update company status. | `reviewCompanyStatusSchema`: params `id`; body `status` enum (`active|underReview|rejected|suspended`).
| POST | `/admin/companies/:id/approve` | Approve company. | `companyParamsSchema`: params `id`.
| POST | `/admin/companies/:id/reject` | Reject company. | `companyParamsSchema`: params `id`.
| POST | `/admin/companies/:id/agent` | Reassign company agent. | `changeCompanyAgentSchema`: params `id`; body `agentId` positive integer.
| GET | `/admin/companies/:id/reviews` | List reviews for a company. | `companyParamsSchema`: params `id`.
| GET | `/admin/companies/:id/gallery` | List company gallery. | `companyParamsSchema`: params `id`.
| POST | `/admin/companies/:id/gallery` | Create gallery item. | `createCompanyGalleryItemSchema`: params `id`; body `imageFileId`, optional `description`.
| PUT | `/admin/companies/:id/gallery/:galleryItemId` | Update gallery item. | `updateCompanyGalleryItemSchema`: params `id`, `galleryItemId`; body optional `imageFileId`, `description` (at least one).
| DELETE | `/admin/companies/:id/gallery/:galleryItemId` | Delete gallery item. | `galleryItemParamsSchema`: params `id`, `galleryItemId`.
| GET | `/admin/companies/:id/documents` | List company documents/certificates. | `companyParamsSchema`: params `id`.
| POST | `/admin/companies/:id/documents` | Create document/certificate. | `createCompanyDocumentSchema`: params `id`; body `fileId?`, `docType?`, optional `description`. If `docType='certificate'`: require `title` + `issuer` and one of `fileId` or `url`.
| PUT | `/admin/companies/:id/documents/:documentId` | Update document/certificate. | `updateCompanyDocumentSchema`: params `id`, `documentId`; body optional `fileId/docType/title/issuer/url/description` (at least one). Certificate rules enforced server-side using existing record.
| DELETE | `/admin/companies/:id/documents/:documentId` | Delete document/certificate. | `documentParamsSchema`: params `id`, `documentId`.
| GET | `/admin/companies/:id/contributions` | List company contributions. | `companyParamsSchema`: params `id`.
| POST | `/admin/companies/:id/contributions` | Create contribution. | `createCompanyContributionSchema`: params `id`; body `type`, `title`, optional `description`, optional `mediaFileId`, optional `mediaType` (`image|video|file|url`), optional `mediaUrl`, optional `details`.
| PUT | `/admin/companies/:id/contributions/:contributionId` | Update contribution. | `updateCompanyContributionSchema`: params `id`, `contributionId`; body optional `type/title/description/mediaFileId/mediaType/mediaUrl/details` (at least one). Media rules enforced server-side using existing record.
| DELETE | `/admin/companies/:id/contributions/:contributionId` | Delete contribution. | `contributionParamsSchema`: params `id`, `contributionId`.

## System
| Method | Path | Auth | Description | Validation |
| --- | --- | --- | --- | --- |
| GET | `/system/stats` | None | System stats (counts / overview). | None.
| GET | `/system/config` | None | System config (supported languages, defaults). | None.

## Health
| Method | Path | Auth | Description | Validation |
| --- | --- | --- | --- | --- |
| GET | `/health` | None | Health check. | None.

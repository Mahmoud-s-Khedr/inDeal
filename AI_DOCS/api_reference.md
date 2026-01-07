# API Reference

Complete API reference for `/api/v1` endpoints. All responses use the standard JSON envelope:
```json
{ "status": "success|error", "message": "...", "data": {...} }
```

**Source of truth**: `src/routes/v1/*.routes.js`

---

## Table of Contents
- [Auth](#auth)
- [Company (Agent)](#company-agent)
- [Contribution Media](#contribution-media-new)
- [Files](#files)
- [User Settings](#user-settings)
- [Admin](#admin)
- [System](#system)
- [Health](#health)

---

## Auth

All auth endpoints are public unless noted.

### POST `/auth/register/upload-url`
Get signed URL for file upload during registration.

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024000
}
```

**Response:**
```json
{
  "file": { "id": 1, "fileName": "...", "filePath": "...", "publicUrl": "..." },
  "upload": { "url": "https://...", "method": "PUT", "headers": {...}, "expiresIn": 300 }
}
```

---

### POST `/auth/register`
Register agent + company in one call.

**Request Body:**
```json
{
  "user": {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe",
    "jobTitle": "Manager"
  },
  "company": {
    "name": "Acme Corp",
    "description": "...",
    "address": "...",
    "phone": "+1234567890",
    "website": "https://acme.com",
    "companyType": "manufacturer",
    "companyIndustry": "manufacturing",
    "manufacturingStrategy": "makeToOrder",
    "contacts": [{ "type": "email", "value": "info@acme.com" }],
    "locations": ["Cairo", "Alexandria"],
    "documents": [{ "fileId": 1, "docType": "license", "description": "..." }]
  }
}
```

**Response:** `{ "user": {...}, "company": {...}, "message": "Registration successful" }`

---

### POST `/auth/login`
Agent login.

**Request Body:**
```json
{ "email": "john@example.com", "password": "SecurePass123" }
```

**Response:**
```json
{
  "user": { "id": 1, "email": "...", "firstName": "...", "role": "agent" },
  "accessToken": "eyJ...",
  "refreshToken": "..."
}
```

---

### POST `/auth/admin/login`
Admin login. Same request/response as agent login.

---

### POST `/auth/forgot-password`
Request password reset OTP.

**Request Body:** `{ "email": "john@example.com" }`

**Response:** `{ "message": "OTP sent to email" }`

---

### POST `/auth/resend-forgot-password-otp`
Resend password reset OTP.

**Request Body:** `{ "email": "john@example.com" }`

---

### POST `/auth/verify-otp`
Verify OTP before password reset.

**Request Body:** `{ "email": "john@example.com", "otp": "123456" }`

**Response:** `{ "valid": true }`

---

### POST `/auth/reset-password`
Reset password with OTP.

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "password": "NewSecure123",
  "confirmPassword": "NewSecure123"
}
```

---

### POST `/auth/resend-verification`
Resend email verification link.

**Request Body:** `{ "email": "john@example.com" }`

---

### GET `/auth/verify-email?email=...&token=...`
Email verification (HTML page response).

---

### POST `/auth/logout` 🔐
Revoke current session.

**Headers:** `Authorization: Bearer <token>`

---

## Company (Agent)

All `/companies/me/*` routes require authentication. 🔐

### GET `/companies/me` 🔐
Get authenticated agent's company profile.

**Response:**
```json
{
  "company": {
    "id": 1, "agentId": 5, "name": "...", "description": "...",
    "status": "active", "companyType": "manufacturer", ...
  },
  "gallery": [...],
  "documents": [...],
  "contributions": [...],
  "reviews": [...],
  "averageRating": 4.5
}
```

---

### PUT `/companies/me` 🔐
Update company profile.

**Request Body (at least one field):**
```json
{
  "name": "Updated Name",
  "description": "...",
  "address": "...",
  "phone": "+1234567890",
  "website": "https://...",
  "companyType": "supplier|manufacturer|distributor|...",
  "companyIndustry": "manufacturing|technology|...",
  "manufacturingStrategy": "makeToStock|makeToOrder|...",
  "contacts": [{ "type": "phone", "value": "..." }],
  "locations": ["Cairo"]
}
```

---

### POST `/companies/me/resend-for-review` 🔐
Submit company for review (sets status to `underReview`).

---

### GET `/companies/me/gallery` 🔐
List gallery items.

**Response:** `[{ "id": 1, "companyId": 1, "imageFileId": 5, "description": "...", "uploadedAt": "..." }]`

---

### POST `/companies/me/gallery` 🔐
Add gallery item.

**Request Body:** `{ "imageFileId": 5, "description": "Product photo" }`

---

### PUT `/companies/me/gallery/:galleryItemId` 🔐
Update gallery item.

**Request Body (at least one):** `{ "imageFileId": 6, "description": "..." }`

---

### DELETE `/companies/me/gallery/:galleryItemId` 🔐
Delete gallery item.

---

### GET `/companies/me/documents` 🔐
List documents/certificates.

**Response:**
```json
[{
  "id": 1, "companyId": 1, "fileId": 3, "docType": "certificate",
  "title": "ISO 9001", "issuer": "ISO", "url": null, "description": "...", "uploadedAt": "..."
}]
```

---

### POST `/companies/me/documents` 🔐
Create document.

**Request Body:**
```json
{
  "fileId": 3,
  "docType": "certificate|license|other",
  "title": "ISO 9001",
  "issuer": "ISO Organization",
  "url": "https://...",
  "description": "..."
}
```
> For `docType=certificate`: require `title`, `issuer`, and either `fileId` or `url`.

---

### PUT `/companies/me/documents/:documentId` 🔐
Update document.

**Request Body (at least one):** `{ "fileId": 4, "title": "...", ... }`

---

### DELETE `/companies/me/documents/:documentId` 🔐
Delete document.

---

### GET `/companies/me/contributions` 🔐
List contributions.

**Response:**
```json
[{
  "id": 1, "companyId": 1, "type": "product", "title": "Widget Pro",
  "description": "...", "mediaFileId": 5, "mediaType": "image", "mediaUrl": null,
  "details": {...}, "createdAt": "...", "updatedAt": "..."
}]
```

---

### POST `/companies/me/contributions` 🔐
Create contribution.

**Request Body:**
```json
{
  "type": "product|project|deal|partnership",
  "title": "Widget Pro",
  "description": "...",
  "mediaFileId": 5,
  "mediaType": "image|video|file|url",
  "mediaUrl": "https://youtube.com/...",
  "details": { "price": 100, "specs": {...} }
}
```
> If `mediaType=url`: require `mediaUrl`, forbid `mediaFileId`.
> If `mediaType=image|video|file`: require `mediaFileId`.

---

### PUT `/companies/me/contributions/:contributionId` 🔐
Update contribution (at least one field).

---

### DELETE `/companies/me/contributions/:contributionId` 🔐
Delete contribution.

---

## Contribution Media (NEW)

Manage multiple media items per contribution. All routes require authentication. 🔐

### GET `/companies/me/contributions/:contributionId/media` 🔐
List all media for a contribution.

**Response:**
```json
[{
  "id": 1, "contributionId": 5, "fileId": 10, "mediaType": "image",
  "mediaUrl": null, "sortOrder": 0, "caption": "Front view", "createdAt": "..."
}]
```

---

### POST `/companies/me/contributions/:contributionId/media` 🔐
Add media item.

**Request Body:**
```json
{
  "fileId": 10,
  "mediaType": "image|video|file|url",
  "mediaUrl": "https://...",
  "caption": "Front view",
  "sortOrder": 0
}
```
> If `mediaType=url`: require `mediaUrl`.
> Otherwise: require `fileId`.

---

### PUT `/companies/me/contributions/:contributionId/media/:mediaId` 🔐
Update media item (at least one field).

**Request Body:**
```json
{
  "fileId": 11,
  "mediaType": "video",
  "mediaUrl": "...",
  "caption": "Updated caption",
  "sortOrder": 1
}
```

---

### DELETE `/companies/me/contributions/:contributionId/media/:mediaId` 🔐
Delete media item.

---

### PUT `/companies/me/contributions/:contributionId/media/reorder` 🔐
Reorder media items.

**Request Body:**
```json
{ "orderedIds": [3, 1, 2] }
```

**Response:** Updated media array with new sort orders.

---

## Public Company Endpoints

### GET `/companies/:id`
Public company profile.

---

### GET `/companies/:id/gallery`
Public gallery.

---

### GET `/companies/:id/reviews`
Public reviews list.

---

### POST `/companies/:id/reviews` 🔐
Create review.

**Request Body:** `{ "rating": 5, "reviewText": "Great company!" }`

---

## Files

### POST `/files/upload-url` 🔐
Get signed R2 upload URL.

**Request Body:**
```json
{ "fileName": "image.jpg", "fileType": "image/jpeg", "fileSize": 500000 }
```

**Response:**
```json
{
  "file": {
    "id": 1, "fileName": "image.jpg", "filePath": "uploads/2026-01-06/image-abc.jpg",
    "publicUrl": "https://...", "thumbnailUrl": "https://..._thumb.webp", "mediumUrl": "https://..._medium.webp"
  },
  "upload": { "url": "https://presigned-url...", "method": "PUT", "headers": {...}, "expiresIn": 300 }
}
```

---

## User Settings

All routes require authentication. 🔐

### GET `/users/me` 🔐
Get user profile.

**Response:**
```json
{
  "id": 1, "username": "johndoe", "email": "...", "firstName": "John", "lastName": "Doe",
  "profileImageFileId": 5, "preferences": { "language": "en", "theme": "light" }
}
```

---

### PUT `/users/me` 🔐
Update profile.

**Request Body (at least one):**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "preferences": { "language": "en|ar", "theme": "light|dark" }
}
```

---

### PUT `/users/me/password` 🔐
Change password.

**Request Body:**
```json
{ "currentPassword": "OldPass123", "newPassword": "NewPass123" }
```

---

### PUT `/users/me/profile-image` 🔐
Update profile image.

**Request Body:** `{ "profileImageFileId": 10 }`

---

## Admin

All routes require admin role. 🔐👑

### GET `/admin/companies`
List all companies.

### GET `/admin/companies/pending`
List companies under review.

### GET `/admin/companies/:id`
Company detail.

### PUT `/admin/companies/:id`
Update company.

### PUT `/admin/companies/:id/summary`
Update summary.

**Request Body:** `{ "summary": "Company description..." }`

### PATCH `/admin/companies/:id/status`
Update status.

**Request Body:** `{ "status": "active|underReview|rejected|suspended" }`

### POST `/admin/companies/:id/approve`
Approve company.

### POST `/admin/companies/:id/reject`
Reject company.

### POST `/admin/companies/:id/agent`
Reassign agent.

**Request Body:** `{ "agentId": 5 }`

### GET `/admin/companies/:id/reviews`
List reviews.

### GET/POST/PUT/DELETE `/admin/companies/:id/gallery[/:galleryItemId]`
Gallery CRUD (same schema as agent endpoints).

### GET/POST/PUT/DELETE `/admin/companies/:id/documents[/:documentId]`
Document CRUD (same schema as agent endpoints).

### GET/POST/PUT/DELETE `/admin/companies/:id/contributions[/:contributionId]`
Contribution CRUD (same schema as agent endpoints).

---

## System

### GET `/system/stats`
System statistics.

**Response:** `{ "totalCompanies": 100, "activeCompanies": 85, ... }`

### GET `/system/config`
System configuration.

**Response:** `{ "supportedLanguages": ["en", "ar"], "defaults": {...} }`

---

## Health

### GET `/health`
Health check.

**Response:** `{ "status": "ok", "timestamp": "..." }`

---

## Enum Values Reference

### Company Types
`supplier`, `manufacturer`, `distributor`, `retailer`, `serviceProvider`, `wholesaler`, `eCommerce`, `franchise`, `cooperative`, `holdingCompany`, `consultancy`, `logistics`, `other`

### Industries
`agriculture`, `automotive`, `banking`, `construction`, `education`, `healthcare`, `hospitality`, `manufacturing`, `retail`, `technology`, `telecommunications`, `transportation`, `other`

### Manufacturing Strategies
`makeToStock`, `makeToOrder`, `assembleToOrder`, `engineerToOrder`

### Contribution Types
`product`, `project`, `deal`, `partnership`

### Media Types
`image`, `video`, `file`, `url`

### Company Statuses
`active`, `underReview`, `rejected`, `suspended`

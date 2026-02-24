# inDeal – Frontend & Mobile Integration Guide

> Covers all API changes from the **2026-02-24** backend release.
> For each change: new request shape, new response shape, breaking changes, and migration actions.

---

## Table of Contents

1. [Public company documents endpoint](#1-public-company-documents-endpoint)
2. [Resolved image URLs in chat responses](#2-resolved-image-urls-in-chat-responses)
3. [Clear company logo via PUT /companies/me](#3-clear-company-logo-via-put-companiesme)
4. [Delete user profile image](#4-delete-user-profile-image)
5. [Project contributions without contributors](#5-project-contributions-without-contributors)
6. [Rejection reason in emails](#6-rejection-reason-in-emails)
7. [Document expiry date in registration](#7-document-expiry-date-in-registration)
8. [Chat message encryption (transparent)](#8-chat-message-encryption-transparent)
9. [Clear manufacturingStrategy via PUT /companies/me](#9-clear-manufacturingstrategy-via-put-companiesme)
10. [Registration docType prefix enforcement](#10-registration-doctype-prefix-enforcement)
11. [Breaking changes summary](#11-breaking-changes-summary)

---

## 1. Public company documents endpoint

### New endpoint

```
GET /api/v1/companies/:id/documents
```

No authentication required.

### Response

```json
[
  {
    "id": 12,
    "companyId": 5,
    "fileId": 34,
    "fileUrl": "https://pub-xxx.r2.dev/uploads/doc.pdf",
    "docType": "brochure",
    "description": "Product catalogue 2025",
    "uploadedAt": "2025-11-01T10:00:00.000Z"
  }
]
```

### Notes

- Returns only **non-registration** documents. Documents uploaded at registration time (those stored with a `registration:` prefix internally) are always excluded.
- `fileUrl` is a fully-qualified public URL, or `null` if no file is attached.
- `docType` is the plain label without any internal prefix.

---

## 2. Resolved image URLs in chat responses

### What changed

Chat endpoints previously returned raw integer file IDs for company logos and user profile images. They now return resolved HTTP URLs alongside the original ID fields.

### Affected endpoints

- `GET /api/v1/chats` — room list
- `GET /api/v1/chats/:roomId` — single room
- `GET /api/v1/chats/:roomId/messages` — message list
- WebSocket events: `chat:message`, `chat:ready`

### Room object — `otherCompany` field

```jsonc
// Before
"otherCompany": {
  "id": 3,
  "name": "Acme Corp",
  "logoFileId": 17
}

// After
"otherCompany": {
  "id": 3,
  "name": "Acme Corp",
  "logoFileId": 17,
  "logoUrl": "https://pub-xxx.r2.dev/logos/acme.png"   // new
}
```

### Message object — `agent` and `company` fields

```jsonc
// Before
"agent": {
  "id": 9,
  "firstName": "Sara",
  "lastName": "Ali",
  "profileImageFileId": 22
},
"company": {
  "id": 3,
  "name": "Acme Corp",
  "logoFileId": 17
}

// After
"agent": {
  "id": 9,
  "firstName": "Sara",
  "lastName": "Ali",
  "profileImageFileId": 22,
  "profileImageUrl": "https://pub-xxx.r2.dev/avatars/sara.jpg"  // new
},
"company": {
  "id": 3,
  "name": "Acme Corp",
  "logoFileId": 17,
  "logoUrl": "https://pub-xxx.r2.dev/logos/acme.png"            // new
}
```

### Migration notes

- **Non-breaking** — the raw `*FileId` fields are still present.
- Use `logoUrl` / `profileImageUrl` directly in `<img src>` without a separate file-fetch call.
- Both URL fields are `null` when no image is set.

---

## 3. Clear company logo via `PUT /companies/me`

### What changed

The dedicated `DELETE /companies/me/logo` endpoint **has been removed**. Logo deletion is now handled by the existing `PUT /companies/me` endpoint by sending `logoFileId: null`.

### Request

```
PUT /api/v1/companies/me
Authorization: Bearer <token>
Content-Type: application/json
```

| Intent               | Body                     |
| -------------------- | ------------------------ |
| Set a new logo       | `{ "logoFileId": 42 }`   |
| Clear the logo       | `{ "logoFileId": null }` |
| Leave logo unchanged | omit `logoFileId`        |

### Response (unchanged shape)

```json
{
  "company": {
    "id": 5,
    "name": "My Company",
    "logoFileId": null,
    "logoUrl": null
  }
}
```

### Migration — **breaking change**

| Old call                           | New call                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| `DELETE /api/v1/companies/me/logo` | `PUT /api/v1/companies/me` with `{ "logoFileId": null }` |

The `DELETE` route now returns `404`. Update any calls to it before deploying.

---

## 4. Delete user profile image

### New endpoint

```
DELETE /api/v1/users/me/profile-image
Authorization: Bearer <token>
```

No request body needed.

### Response

```json
{
  "id": 9,
  "username": "sara_ali",
  "email": "sara@example.com",
  "profileImageFileId": null,
  "profileImageUrl": null
}
```

### Notes

- To set a profile image, continue using `PUT /api/v1/users/me/profile-image` with `{ "profileImageFileId": <id> }`.

---

## 5. Project contributions without contributors

### What changed

Creating or updating a contribution with `type: "project"` no longer requires a `contributors` array.

### Before (rejected with 400)

```json
{
  "type": "project",
  "title": "Warehouse Fit-Out"
}
```

### After (accepted)

```json
{
  "type": "project",
  "title": "Warehouse Fit-Out"
}
```

### Notes

- **Non-breaking** — requests that include `contributors` continue to work.
- Applies to both `POST /api/v1/companies/me/contributions` and `PUT /api/v1/companies/me/contributions/:id`.

---

## 6. Rejection reason in emails

### What changed

Three admin endpoints now accept an optional `reason` field. When provided, the reason is included in the rejection email sent to the agent.

### A. Reject a company

```
POST /api/v1/admin/companies/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "Incomplete documentation — please resubmit with a valid trade licence."
}
```

### B. Change company status to rejected

```
PATCH /api/v1/admin/companies/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "rejected",
  "reason": "Duplicate account detected."
}
```

### C. Reject a pending profile update

```
POST /api/v1/admin/companies/pending-updates/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "The updated address could not be verified."
}
```

### Notes

- **Non-breaking** — `reason` is optional (max 500 chars). Omitting it sends a generic rejection email.
- The reason is also stored in `companies.rejection_reason` in the database.

---

## 7. Document expiry date in registration

### What changed

`POST /api/v1/auth/register` and the resubmit endpoint now accept an `expiryDate` field per document.

### Request — documents array

```json
{
  "user": { "...": "..." },
  "company": {
    "documents": [
      {
        "fileId": 34,
        "docType": "trade_licence",
        "description": "Valid until 2027",
        "expiryDate": "2027-06-30"
      },
      {
        "fileId": 35,
        "docType": "passport"
      }
    ]
  }
}
```

### Document field reference

| Field         | Type             | Required | Notes                                               |
| ------------- | ---------------- | -------- | --------------------------------------------------- |
| `fileId`      | positive integer | yes      |                                                     |
| `docType`     | string (max 100) | no       | Must **not** start with `"registration:"`           |
| `description` | string (max 255) | no       |                                                     |
| `expiryDate`  | ISO date string  | no       | e.g. `"2027-06-30"` or `"2027-06-30T00:00:00.000Z"` |

### Notes

- **Non-breaking** — existing integrations that omit `expiryDate` continue to work.
- `expiryDate` is stored and returned in document listing responses.

---

## 8. Chat message encryption (transparent)

### What changed

All new messages are stored AES-256-GCM encrypted in the database. **This is fully transparent to clients.**

### Impact

- No request or response shape changes.
- No client-side changes required.
- The API decrypts messages before returning them.

### Note for direct DB access / admin panels

Rows in `chat_messages.message_text` now contain `enc::<base64>` strings instead of plaintext. Always read message content through the API.

---

## 9. Clear `manufacturingStrategy` via `PUT /companies/me`

### What changed

`manufacturingStrategy` now accepts `null` to clear the field.

### Request

```
PUT /api/v1/companies/me
Authorization: Bearer <token>
Content-Type: application/json
```

| Intent          | Body                                         |
| --------------- | -------------------------------------------- |
| Set strategy    | `{ "manufacturingStrategy": "makeToStock" }` |
| Clear strategy  | `{ "manufacturingStrategy": null }`          |
| Leave unchanged | omit `manufacturingStrategy`                 |

### Valid values

```
makeToStock | makeToOrder | assembleToOrder | engineerToOrder
```

Any other string returns `400`. Sending `null` is now valid and clears the field.

### Notes

- **Non-breaking** — omitting the field leaves the value unchanged as before.

---

## 10. Registration `docType` prefix enforcement

### What changed

`docType` in registration and resubmit document payloads now **rejects** values that start with `"registration:"`. The server always adds that prefix before storing — clients must supply the plain label only.

### Correct

```json
{ "fileId": 34, "docType": "passport" }
// stored as: registration:passport
```

### Incorrect — now returns 400

```json
{ "fileId": 34, "docType": "registration:passport" }
// 400: docType must not start with "registration:"
```

### Migration — potentially breaking

Only affects clients that were manually prefixing `docType` with `"registration:"`. Remove the prefix from those values.

Clients that pass plain labels (`"passport"`, `"trade_licence"`, etc.) or omit `docType` entirely are unaffected.

---

## 11. Breaking changes summary

| #   | Endpoint                                                  | Change                                                            | Action required                                                        |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 10  | `POST /api/v1/auth/register` `POST /api/v1/auth/resubmit` | `docType` values starting with `"registration:"` now return `400` | Remove the `"registration:"` prefix from any `docType` values you send |

All other changes are additive (new optional request fields, new response fields, or new endpoints) and require no migration.

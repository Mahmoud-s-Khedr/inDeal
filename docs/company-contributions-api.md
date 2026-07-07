# Company Contributions API — Frontend Guide

Base path: `/api/v1/companies`
All endpoints require a valid `Authorization: Bearer <token>` header (authenticated company agent).

---

## Data Model

### Contribution object (returned by all endpoints)

```json
{
  "id": 1,
  "companyId": 42,
  "type": "product",
  "title": "Industrial Pump Series X",
  "description": "High-pressure pumps for oil & gas.",
  "mediaFileId": 7,
  "mediaFileUrl": "https://cdn.example.com/file.jpg",
  "mediaType": "image",
  "media": [],
  "details": {},
  "locations": ["Riyadh", "Dammam"],
  "socialMediaLinks": [{ "platform": "linkedin", "url": "https://linkedin.com/..." }],
  "partner": null,
  "partnerName": null,
  "contributors": ["Ahmed Al-Farsi"],
  "tags": ["pumps", "oil-gas"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Contribution Media object (from media sub-endpoints)

```json
{
  "id": 5,
  "contributionId": 1,
  "fileId": 12,
  "fileUrl": "https://cdn.example.com/photo.jpg",
  "mediaType": "image",
  "mediaUrl": null,
  "caption": "Product overview",
  "sortOrder": 0,
  "createdAt": "2024-01-15T10:31:00Z"
}
```

---

## Enums

| Field       | Allowed values                              |
| ----------- | ------------------------------------------- |
| `type`      | `product`, `project`, `deal`, `partnership` |
| `mediaType` | `image`, `video`, `file`, `url`             |

---

## Endpoints

### 1. List My Contributions

```
GET /api/v1/companies/me/contributions
```

**Response 200**

```json
{
  "status": "success",
  "message": "Company contributions fetched",
  "data": [
    /* array of Contribution objects */
  ]
}
```

---

### 2. Create Contribution

```
POST /api/v1/companies/me/contributions
Content-Type: application/json
```

#### Required fields

| Field   | Type   | Notes                       |
| ------- | ------ | --------------------------- |
| `type`  | string | One of the type enums above |
| `title` | string | 1–150 characters            |

#### Optional fields

| Field              | Type                  | Notes                                                                                |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `description`      | string                | Free text                                                                            |
| `mediaFileId`      | number                | ID of a pre-uploaded file (required when `mediaType` is `image`, `video`, or `file`) |
| `mediaType`        | string                | One of the mediaType enums                                                           |
| `mediaUrl`         | string (URL)          | Max 255 chars. Only allowed when `mediaType` is `url`                                |
| `locations`        | string[]              | List of location strings                                                             |
| `socialMediaLinks` | `{ platform, url }[]` | Social links for this contribution                                                   |
| `partnerId`        | number                | Optional partner company id. Supported for partnership contributions                 |
| `partnerName`      | string                | Max 100 chars. **Required when `type` is `partnership`**                             |
| `contributors`     | string[]              | Contributor names                                                                    |
| `tags`             | string[]              | Arbitrary tags                                                                       |
| `details`          | object                | Arbitrary extra data (merged with the above fields in the DB)                        |

#### Business rules

- `partnerId` or `partnerName` **must** be provided when `type === "partnership"`.
- `mediaUrl` is **only** valid when `mediaType === "url"`.
- When `mediaType === "url"`: `mediaUrl` is required, `mediaFileId` must **not** be sent.
- When `mediaType` is `image`, `video`, or `file`: `mediaFileId` is required, `mediaUrl` must **not** be sent.
- `mediaType` and `mediaFileId`/`mediaUrl` are optional together — omit both to create a text-only contribution.

#### Partnership response shape

When a contribution is a partnership, responses return a canonical nested partner object:

```json
"partner": {
  "id": 123,
  "name": "Saudi Aramco",
  "logoFileId": 45,
  "logoUrl": "https://cdn.example.com/aramco.png"
}
```

For non-partnership contributions, `partner` is `null`.

For backward compatibility, responses also currently include:

- `partnerId`
- `partnerName`
- `partnerLogoFileId`
- `partnerLogoUrl`

#### Example — text-only product contribution

```json
POST /api/v1/companies/me/contributions
{
  "type": "product",
  "title": "Industrial Pump Series X",
  "description": "High-pressure pumps for oil & gas.",
  "tags": ["pumps", "oil-gas"],
  "locations": ["Riyadh"]
}
```

#### Example — product with an uploaded image

```json
{
  "type": "product",
  "title": "Industrial Pump Series X",
  "mediaType": "image",
  "mediaFileId": 7
}
```

#### Example — project with an external video URL

```json
{
  "type": "project",
  "title": "Pipeline Upgrade 2024",
  "mediaType": "url",
  "mediaUrl": "https://youtube.com/watch?v=abc123"
}
```

#### Example — partnership contribution

```json
{
  "type": "partnership",
  "title": "Joint Venture with Aramco",
  "partnerName": "Saudi Aramco",
  "description": "Strategic supply agreement signed 2024."
}
```

#### Example — partnership contribution using `partnerId`

```json
{
  "type": "partnership",
  "title": "Joint Venture with Aramco",
  "partnerId": 123,
  "description": "Strategic supply agreement signed 2024."
}
```

**Response 201**

```json
{
  "status": "success",
  "message": "Company contribution created",
  "data": {
    "id": 9,
    "companyId": 42,
    "type": "partnership",
    "title": "Joint Venture with Aramco",
    "description": "Strategic supply agreement signed 2024.",
    "mediaFileId": null,
    "mediaFileUrl": null,
    "mediaType": null,
    "media": [],
    "details": {
      "partnerId": 123
    },
    "locations": [],
    "socialMediaLinks": [],
    "partner": {
      "id": 123,
      "name": "Saudi Aramco",
      "logoFileId": 45,
      "logoUrl": "https://cdn.example.com/aramco.png"
    },
    "partnerId": 123,
    "partnerName": "Saudi Aramco",
    "partnerLogoFileId": 45,
    "partnerLogoUrl": "https://cdn.example.com/aramco.png",
    "contributors": [],
    "tags": [],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 3. Update Contribution

```
PUT /api/v1/companies/me/contributions/:contributionId
Content-Type: application/json
```

At least one field must be provided. All fields are optional.

**Media type switching rules:**

- Switching **to** `url`: send `mediaType: "url"` + `mediaUrl`. The server clears `mediaFileId`.
- Switching **away from** `url`: send the new `mediaType` (`image`/`video`/`file`) + `mediaFileId`. The server clears `mediaUrl`.
- Updating `mediaUrl` without resending `mediaType` is allowed only if the existing contribution already has `mediaType === "url"`.
- Updating `mediaFileId` without resending `mediaType` is allowed only if the existing contribution is **not** `url`-typed.

**Response 200**

```json
{
  "status": "success",
  "message": "Company contribution updated",
  "data": {
    /* updated Contribution object */
  }
}
```

---

### 4. Delete Contribution

```
DELETE /api/v1/companies/me/contributions/:contributionId
```

**Response 200**

```json
{
  "status": "success",
  "message": "Company contribution deleted",
  "data": {
    /* deleted Contribution object */
  }
}
```

---

## Contribution Media Sub-endpoints

Each contribution can have **multiple** separate media items (gallery-like). These are independent of the single `mediaFileId`/`mediaUrl` on the contribution itself.

### 5. List Contribution Media

```
GET /api/v1/companies/me/contributions/:contributionId/media
```

Items are returned ordered by `sortOrder ASC`.

**Response 200**

```json
{
  "status": "success",
  "message": "Contribution media fetched",
  "data": [
    /* array of Contribution Media objects */
  ]
}
```

---

### 6. Add Contribution Media

```
POST /api/v1/companies/me/contributions/:contributionId/media
Content-Type: application/json
```

| Field       | Type         | Required    | Notes                                      |
| ----------- | ------------ | ----------- | ------------------------------------------ |
| `mediaType` | string       | Yes         | One of the mediaType enums                 |
| `fileId`    | number       | Conditional | Required when `mediaType` is **not** `url` |
| `mediaUrl`  | string (URL) | Conditional | Required when `mediaType` is `url`         |
| `caption`   | string       | No          | Max 255 chars                              |
| `sortOrder` | number       | No          | Non-negative integer. Defaults to `0`      |

**Response 201** — returns a Contribution Media object.

---

### 7. Update Contribution Media

```
PUT /api/v1/companies/me/contributions/:contributionId/media/:mediaId
Content-Type: application/json
```

At least one field must be provided. All fields are optional.

---

### 8. Delete Contribution Media

```
DELETE /api/v1/companies/me/contributions/:contributionId/media/:mediaId
```

---

### 9. Reorder Contribution Media

```
PUT /api/v1/companies/me/contributions/:contributionId/media/reorder
Content-Type: application/json
```

**Body**

```json
{
  "orderedIds": [5, 3, 8, 1]
}
```

- `orderedIds` — array of media IDs in the desired display order (index 0 = `sortOrder` 0).
- The array must contain at least 1 ID.
- IDs not belonging to this contribution are silently ignored.

**Response 200** — returns the full re-ordered media array.

---

## Error Responses

All errors follow the same envelope:

```json
{
  "status": "error",
  "message": "Human-readable error description"
}
```

| HTTP Status | Cause                                         |
| ----------- | --------------------------------------------- |
| 400         | Validation failure or business rule violation |
| 401         | Missing or invalid token                      |
| 403         | Resource belongs to a different company       |
| 404         | Contribution or media item not found          |
| 409         | Duplicate (e.g. review already submitted)     |

---

## Typical Frontend Workflow

1. **Upload file first** (via the Files API) to get a `fileId`.
2. **Create contribution** with `mediaFileId: <fileId>` and the appropriate `mediaType`.
3. (Optional) **Add additional media** via `POST .../media` for a multi-image gallery on that contribution.
4. Use **reorder** to let users drag-and-drop the media gallery.
5. Use **update** to patch only changed fields — no need to re-send the full object.

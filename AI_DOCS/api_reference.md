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
- [Deals](#deals)
- [Chat](#chat)
- [Ads](#ads)
- [Support](#support)
- [Files](#files)
- [User Settings](#user-settings)
- [Device Tokens](#device-tokens-push-notifications)
- [Admin](#admin)
- [System](#system)
- [Notifications](#notifications-new)
- [Health](#health)

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
  },
  "company": {
    "name": "Acme Corp",
    "description": "...",
    "address": "...",
    "website": "https://acme.com",
    "companyType": "manufacturer",
    "companyIndustry": "manufacturing",
    "manufacturingStrategy": "makeToOrder",
    "contacts": [{ "type": "email", "value": "info@acme.com" }],
    "documents": [{ "fileId": 1, "docType": "license", "description": "..." }]
  }
```

## **Response:** `{ "user": {...}, "company": {...}, "message": "Registration successful" }`

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
  "socialMediaLinks": [{ "platform": "linkedin", "url": "https://..." }],
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
[
  {
    "id": 1,
    "companyId": 1,
    "fileId": 3,
    "docType": "certificate",
    "title": "ISO 9001",
    "issuer": "ISO",
    "url": null,
    "description": "...",
    "uploadedAt": "..."
  }
]
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
  "tags": ["Tag1", "Tag2"],
  "details": { "price": 100, "partnerName": "Partner Co", "contributors": [...] }
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
[
  {
    "id": 1,
    "contributionId": 5,
    "fileId": 10,
    "mediaType": "image",
    "mediaUrl": null,
    "sortOrder": 0,
    "caption": "Front view",
    "createdAt": "..."
  }
]
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

### GET `/companies/search`

Search companies (public).

**Query Parameters:**

- `keyword` — Search by name/description
- `companyType` — Company type enum
- `companyIndustry` — Industry enum
- `manufacturingStrategy` — Strategy enum
- `location` — Location string
- `status` — Company status enum
- `limit` (default: 20), `offset` (default: 0)

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

## Deals

The marketplace core. Create auctions/RFQs, submit bids, and manage deal lifecycle.

### GET `/deals`

Search/list deals with filters.

**Query Parameters:**

- `keyword` — Search in name/description
- `dealType` — `auction` | `rfq`
- `status` — `open` | `closed` | `negotiating` | `archived`
- `industry` — Filter by company industry
- `minValue`, `maxValue` — Price range
- `limit` (default: 20), `offset` (default: 0)

**Response:**

```json
{
  "deals": [
    { "id": 1, "dealName": "...", "dealType": "auction", "dealValue": 5000, "companyName": "..." }
  ],
  "pagination": { "total": 50, "limit": 20, "offset": 0, "hasMore": true }
}
```

---

### GET `/deals/:id`

View deal details.

**Response:**

```json
{
  "id": 1,
  "companyId": 5,
  "dealName": "Steel Supply RFQ",
  "dealDescription": "...",
  "dealValue": 10000,
  "dealType": "rfq",
  "status": "open",
  "companyName": "Acme Corp",
  "companyIndustry": "manufacturing"
}
```

---

### POST `/deals` 🔐

Create new deal.

**Request Body:**

```json
{
  "dealName": "Steel Supply RFQ",
  "dealDescription": "Looking for steel suppliers...",
  "dealValue": 10000,
  "dealType": "auction|rfq"
}
```

---

### PUT `/deals/:id` 🔐

Update own deal.

**Request Body (at least one):**

```json
{
  "dealName": "Updated Name",
  "dealDescription": "...",
  "dealValue": 15000,
  "status": "closed"
}
```

---

### DELETE `/deals/:id` 🔐

Archive own deal (sets status to `archived`).

---

### GET `/deals/me/deals` 🔐

List my published deals.

**Query Parameters:** `status`, `limit`, `offset`

---

### GET `/deals/me/requests` 🔐

List my submitted bids/requests.

**Query Parameters:** `status`, `limit`, `offset`

---

### POST `/deals/:id/requests` 🔐

Submit bid/request on a deal.

**Request Body:**

```json
{
  "requestDetails": "We can provide...",
  "requestOffer": 8500
}
```

---

### GET `/deals/:id/requests` 🔐

View requests on my deal (as owner).

**Response:**

```json
{
  "requests": [
    { "id": 1, "applicantCompanyName": "...", "requestOffer": 8500, "status": "pending" }
  ],
  "stats": { "total": 5, "pending": 3, "accepted": 1, "lowestOffer": 7000 }
}
```

---

### PATCH `/deals/:dealId/requests/:requestId/status` 🔐

Accept or reject a request (as deal owner).

**Request Body:** `{ "status": "accepted|rejected" }`

---

### DELETE `/deals/requests/:requestId` 🔐

Withdraw my bid/request.

---

## Chat

Real-time 1-on-1 B2B messaging between companies. The chat system uses a **single-socket architecture** where users are automatically subscribed to all their chat rooms upon connection—no manual join/leave required.

All routes require authentication. 🔐

### Architecture Overview

- **Single socket per user**: One WebSocket connection handles all B2B and support chats
- **Auto-subscription**: On connect, user automatically joins all active chat rooms
- **No manual join/leave**: Users cannot leave B2B rooms (1-on-1 only)
- **Mid-session room creation**: When a new room is created via REST, both parties are auto-subscribed and notified

---

### REST Endpoints

#### GET `/chats` 🔐

List all chat rooms for the authenticated user's company.

**When to use:** On app launch to populate the chat list UI, or to refresh the list after returning from background.

**Query Parameters:**

| Parameter | Type   | Default  | Description                                   |
| --------- | ------ | -------- | --------------------------------------------- |
| `status`  | string | `active` | Filter by room status: `active` or `archived` |
| `limit`   | number | 20       | Max rooms to return                           |
| `offset`  | number | 0        | Pagination offset                             |

**Response:**

```json
[
  {
    "id": 1,
    "companyAId": 1,
    "companyBId": 5,
    "otherCompany": {
      "id": 5,
      "name": "Acme Corp",
      "logo": "https://cdn.../logo.jpg"
    },
    "status": "active",
    "createdAt": "2026-01-15T08:00:00Z",
    "lastMessage": "Thanks for your offer",
    "lastMessageAt": "2026-01-19T10:30:00Z",
    "unreadCount": 2
  }
]
```

---

#### POST `/chats` 🔐

Create a new chat room with another company, or retrieve the existing room if one already exists.

**When to use:**

- User clicks "Message" button on a company profile
- User wants to start a conversation from a deal listing
- Initiating contact with a potential business partner

**Request Body:**

```json
{ "targetCompanyId": 5 }
```

**Response:**

- `201 Created` — New room created (both parties auto-subscribed via WebSocket)
- `200 OK` — Existing room returned

```json
{
  "id": 1,
  "companyAId": 1,
  "companyBId": 5,
  "otherCompany": {
    "id": 5,
    "name": "Acme Corp",
    "logo": "https://cdn.../logo.jpg"
  },
  "status": "active",
  "createdAt": "2026-01-25T10:00:00Z",
  "lastMessage": null,
  "lastMessageAt": null,
  "unreadCount": 0
}
```

**Important:** When a new room is created, the server automatically:

1. Subscribes both companies' connected sockets to the new room
2. Emits `chat:room:new` event to both parties

---

#### GET `/chats/:roomId` 🔐

Get details of a specific chat room.

**When to use:** When navigating to a chat room to get full room metadata before loading messages.

**Response:** Same structure as room object in `GET /chats`

---

#### PATCH `/chats/:roomId/archive` 🔐

Archive a chat room. Archived rooms are hidden from the active list but messages are preserved.

**When to use:** User wants to clean up their chat list without deleting conversation history.

**Note:** Archived rooms are excluded from auto-subscription on connect.

---

#### GET `/chats/:roomId/messages` 🔐

Get paginated message history for a room.

**When to use:**

- Initial load when opening a chat room
- Loading older messages when user scrolls up (infinite scroll)
- Syncing messages after reconnection

**Query Parameters:**

| Parameter | Type   | Default | Description                                  |
| --------- | ------ | ------- | -------------------------------------------- |
| `limit`   | number | 50      | Max messages to return                       |
| `offset`  | number | 0       | Pagination offset (ignored if cursor used)   |
| `before`  | number | -       | Get messages before this message ID (cursor) |
| `after`   | number | -       | Get messages after this message ID (cursor)  |

**Pagination Strategy:**

- For initial load: Use `limit=50` (most recent messages)
- For infinite scroll up: Use `before={oldestMessageId}` to load older messages
- For syncing new messages: Use `after={newestMessageId}`

**Response:**

```json
{
  "messages": [
    {
      "id": 1,
      "roomId": 1,
      "messageText": "Hello!",
      "sentAt": "2026-01-19T10:30:00Z",
      "readAt": null,
      "isRead": false,
      "agent": {
        "id": 9,
        "firstName": "John",
        "lastName": "Doe",
        "profileImage": "https://..."
      },
      "company": {
        "id": 5,
        "name": "Acme",
        "logo": "https://..."
      },
      "attachment": {
        "id": 5,
        "fileName": "doc.pdf",
        "publicUrl": "https://cdn.../uploads/...",
        "mimeType": "application/pdf",
        "size": 102400
      }
    }
  ],
  "pagination": {
    "mode": "cursor",
    "total": 50,
    "limit": 50,
    "offset": 0,
    "hasMore": true,
    "nextCursor": 1
  }
}
```

---

#### POST `/chats/:roomId/messages` 🔐

Send a message via REST API.

**When to use:** Fallback when WebSocket is unavailable (poor network, reconnecting). Prefer Socket.io `chat:message` for real-time delivery.

**Request Body:**

```json
{
  "messageText": "Hello, interested in your deal!",
  "attachmentFileId": 5
}
```

> At least one of `messageText` or `attachmentFileId` required.

**Attachment workflow:**

1. Upload file via `POST /files/upload-url`
2. Include returned `fileId` as `attachmentFileId`

---

#### POST `/chats/:roomId/read` 🔐

Mark messages as read. Updates read receipts and unread counts.

**When to use:**

- User opens a chat room (mark all as read)
- User scrolls through unread messages
- App comes to foreground with chat visible

**Request Body:**

```json
{ "messageId": 123 }
```

| Field       | Required | Description                                                                                  |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| `messageId` | No       | Mark this message and all before it as read. If omitted, marks ALL messages in room as read. |

**Response:**

```json
{
  "roomId": 1,
  "messageId": 123,
  "readCount": 25,
  "unreadCount": 0
}
```

---

### Socket.io Events

Real-time chat via WebSocket with automatic room subscription.

#### Connection

```javascript
const socket = io('wss://api.indeal.com', {
  auth: { token: 'eyJ...' },
  transports: ['websocket', 'polling'],
});
```

**On successful connection, the server automatically:**

1. Joins the socket to `user:{userId}` room (for notifications)
2. Joins the socket to `company:{companyId}` room (for new room notifications)
3. Fetches all active B2B chat rooms and joins each `room:{roomId}`
4. Fetches active support chat room (if any) and joins `support:room:{roomId}`
5. Emits `chat:ready` event with room IDs

---

#### Events (Server → Client)

| Event           | Payload                                                   | When Emitted                                                   | How to Handle                                          |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `chat:ready`    | `{ b2bRoomIds: number[], supportRoomId: number \| null }` | Immediately after connection, once auto-subscription completes | Store room IDs locally; safe to start sending messages |
| `chat:room:new` | `{ roomId: number, room: object }`                        | When another user creates a room with you via REST API         | Add room to chat list UI; socket already subscribed    |
| `chat:message`  | Full message object (see below)                           | When any message is sent to a room you're in                   | Display in chat UI; update last message in room list   |
| `chat:typing`   | `{ roomId, userId, isTyping }`                            | When other user starts/stops typing                            | Show/hide typing indicator                             |
| `chat:read`     | `{ roomId, companyId, messageId?, unreadCount }`          | When other party reads messages                                | Update read receipts UI; show "seen" status            |
| `chat:error`    | `{ message, code? }`                                      | On validation or authorization errors                          | Show error toast; handle specific error codes          |

**`chat:message` payload structure:**

```json
{
  "id": 123,
  "roomId": 1,
  "messageText": "Hello!",
  "sentAt": "2026-01-25T10:30:00Z",
  "readAt": null,
  "isRead": false,
  "agent": {
    "id": 9,
    "firstName": "John",
    "lastName": "Doe",
    "profileImage": "https://..."
  },
  "company": {
    "id": 5,
    "name": "Acme Corp",
    "logo": "https://..."
  },
  "attachment": {
    "id": 5,
    "fileName": "proposal.pdf",
    "publicUrl": "https://cdn.indeal.com/uploads/...",
    "mimeType": "application/pdf",
    "size": 102400
  }
}
```

---

#### Events (Client → Server)

| Event          | Payload                                       | When to Emit                              | Server Response                   |
| -------------- | --------------------------------------------- | ----------------------------------------- | --------------------------------- |
| `chat:message` | `{ roomId, messageText?, attachmentFileId? }` | User sends a message                      | Broadcasts `chat:message` to room |
| `chat:typing`  | `{ roomId, isTyping: boolean }`               | User starts/stops typing (debounce 300ms) | Broadcasts `chat:typing` to room  |
| `chat:read`    | `{ roomId, messageId? }`                      | User views messages                       | Broadcasts `chat:read` to room    |

**Sending a message:**

```javascript
// Text only
socket.emit('chat:message', {
  roomId: 1,
  messageText: 'Hello!',
});

// With attachment (upload file first)
socket.emit('chat:message', {
  roomId: 1,
  messageText: 'See attached proposal',
  attachmentFileId: 5,
});

// Attachment only
socket.emit('chat:message', {
  roomId: 1,
  attachmentFileId: 5,
});
```

---

#### Error Codes

| Code              | Message                 | Cause                   | Resolution              |
| ----------------- | ----------------------- | ----------------------- | ----------------------- |
| `ROOM_NOT_FOUND`  | Room not found          | Invalid roomId          | Verify room exists      |
| `UNAUTHORIZED`    | Not authorized          | User not member of room | Check room membership   |
| `INVALID_PAYLOAD` | Missing required fields | Bad event payload       | Check payload structure |
| `MESSAGE_EMPTY`   | Message cannot be empty | No text or attachment   | Provide content         |

---

## Ads

Advertisement management with analytics tracking.

### GET `/ads/active`

Get active ads for display (public, auto-tracks impressions).

**Query Parameters:** `location` (`homepage_banner`|`sidebar`|`search_result`), `type` (`banner`|`video`|`sponsored_listing`), `limit`

**Response:**

```json
[
  {
    "id": 1,
    "companyId": 5,
    "companyName": "Acme Corp",
    "title": "Premium Steel",
    "content": "...",
    "imageUrl": "https://cdn.../ad.jpg",
    "targetUrl": "https://..."
  }
]
```

---

### GET `/ads/:id/click`

Record click and redirect to target URL (public).

---

### GET `/ads/me` 🔐

List my advertisements.

**Query Parameters:** `status` (`pending`|`active`|`rejected`|`paused`|`completed`), `limit`, `offset`

---

### POST `/ads` 🔐

Create advertisement (pending review).

**Request Body:**

```json
{
  "title": "Premium Steel Supply",
  "content": "Best prices for industrial steel",
  "imageFileId": 5,
  "targetUrl": "https://example.com/promo",
  "location": "homepage_banner",
  "type": "banner",
  "startDate": "2026-02-01",
  "endDate": "2026-02-28"
}
```

---

### GET `/ads/:id` 🔐

View my ad details.

### PUT `/ads/:id` 🔐

Update my ad (resets to `pending` if content changed).

### DELETE `/ads/:id` 🔐

Delete my ad.

---

### GET `/ads/:id/analytics` 🔐

Get analytics for my ad.

**Query Parameters:** `startDate`, `endDate`

**Response:**

```json
{
  "totals": { "impressions": 5000, "clicks": 150, "ctr": "3.00" },
  "daily": [{ "date": "2026-01-19", "impressions": 500, "clicks": 15 }]
}
```

---

### Admin Ad Endpoints 🔒

| Method | Endpoint                | Description                                |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/admin/ads`            | List all ads (filter by status, companyId) |
| GET    | `/admin/ads/:id`        | Ad details with analytics                  |
| PATCH  | `/admin/ads/:id/status` | Approve/reject/pause ad                    |

**Status values:** `pending`, `active`, `rejected`, `paused`, `completed`

---

## Support

Customer support ticket system.

### GET `/support/info`

Get support contact information (public).

**Response:**

```json
{
  "email": "support@indeal.com",
  "phone": "+20 123 456 7890",
  "hours": "Sunday - Thursday, 9:00 AM - 5:00 PM (EET)",
  "address": "Cairo, Egypt",
  "responseTime": "24-48 hours"
}
```

---

### POST `/support/tickets`

Submit a support ticket (works with or without authentication).

**Request Body:**

```json
{
  "subject": "Issue with my deal listing",
  "message": "I'm having trouble with...",
  "email": "user@example.com",
  "priority": "medium"
}
```

**Priority values:** `low`, `medium`, `high`, `urgent`

---

### GET `/support/tickets` 🔐

List my support tickets.

**Query Parameters:** `status` (`open`|`in_progress`|`resolved`|`closed`), `limit`, `offset`

---

### GET `/support/tickets/:id` 🔐

Get ticket details with responses.

---

### Live Support Chat (FR-SUP-004)

All routes require authentication. 🔐

#### POST `/support/chat` 🔐

Start a support chat.

**Response:**

```json
{
  "id": 15,
  "status": "waiting",
  "startedAt": "2026-01-25T10:00:00Z",
  "endedAt": null,
  "messageCount": 0,
  "user": { "id": 1, "firstName": "John", "lastName": "Doe", "email": "john@example.com" },
  "company": { "id": 5, "name": "Acme Corp" },
  "assignedAdmin": null
}
```

---

#### GET `/support/chat` 🔐

Get active support chat (or `null` if none).

---

#### GET `/support/chat/:roomId/messages` 🔐

List messages in a support chat room.

**Query Parameters:** `limit`, `offset`

---

#### POST `/support/chat/:roomId/messages` 🔐

Send a message to support.

**Request Body:** `{ "message": "Hello, I need help." }`

---

#### Support Chat Socket.io Events

Real-time support chat via WebSocket. Uses the same connection as B2B chat—**no separate connection needed**.

**Architecture:**

- Support room is auto-joined on socket connect (if user has an active support chat)
- When user creates a new support chat via REST, socket is auto-subscribed
- No manual `support:join` required

---

**Events (Server → Client):**

| Event                  | Payload                                                                                  | When Emitted                            | How to Handle                         |
| ---------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| `support:room:new`     | `{ roomId }`                                                                             | When user creates support chat via REST | Update UI to show active support chat |
| `support:message`      | `{ id, roomId, messageText, isFromSupport, sentAt, agent: { id, firstName, lastName } }` | New message in support chat             | Display in support chat UI            |
| `support:typing`       | `{ roomId, userId, isAdmin, isTyping }`                                                  | Admin starts/stops typing               | Show typing indicator                 |
| `support:admin:joined` | `{ roomId, admin: { id, firstName, lastName } }`                                         | Admin accepts the chat                  | Show "Connected to {admin.firstName}" |
| `support:queue:update` | `{ waitingCount }`                                                                       | Queue position changes (admins only)    | Update queue UI                       |
| `support:error`        | `{ message }`                                                                            | On errors                               | Show error message                    |

---

**Events (Client → Server):**

| Event                  | Payload                | When to Emit                 | Notes                        |
| ---------------------- | ---------------------- | ---------------------------- | ---------------------------- |
| `support:message`      | `{ roomId, text }`     | User sends support message   | Requires active support room |
| `support:typing`       | `{ roomId, isTyping }` | User typing (debounce 300ms) | Optional but improves UX     |
| `support:admin:accept` | `{ roomId }`           | Admin takes a waiting chat   | Admin/support role only      |

---

**User Flow:**

1. User creates support chat via `POST /support/chat`
2. Server auto-subscribes socket and emits `support:room:new`
3. User waits for admin (status: `waiting`)
4. Admin accepts → `support:admin:joined` emitted
5. Conversation proceeds via `support:message` events
6. Admin closes chat via REST endpoint

---

### Admin Support Endpoints 🔒

| Method | Endpoint                       | Description                |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/admin/tickets`               | List all tickets           |
| GET    | `/admin/tickets/:id`           | Ticket details             |
| PATCH  | `/admin/tickets/:id`           | Update status/notes        |
| POST   | `/admin/tickets/:id/responses` | Add response (sends email) |

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
  "id": 1,
  "username": "johndoe",
  "email": "...",
  "firstName": "John",
  "lastName": "Doe",
  "profileImageFileId": 5,
  "preferences": { "language": "en", "theme": "light" }
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

## Device Tokens (Push Notifications)

All routes require authentication. 🔐

### GET `/users/me/devices` 🔐

List registered device tokens.

**Response:**

```json
[
  {
    "id": 1,
    "token": "fcm_token_here",
    "deviceType": "ios",
    "deviceInfo": { "model": "iPhone 15", "os": "iOS 18", "appVersion": "1.0.0" },
    "createdAt": "2026-01-20T10:00:00.000Z"
  }
]
```

---

### POST `/users/me/devices` 🔐

Register a device token.

**Request Body:**

```json
{
  "token": "fcm_token_here",
  "deviceType": "ios|android|web",
  "deviceInfo": { "model": "iPhone 15", "os": "iOS 18", "appVersion": "1.0.0" }
}
```

---

### DELETE `/users/me/devices` 🔐

Unregister a device token.

**Request Body:** `{ "token": "fcm_token_here" }`

---

## Admin

All routes require admin role. 🔐👑

### GET `/admin/companies`

List all companies.

### GET `/admin/companies/pending`

List companies under review.

### GET `/admin/companies/pending-updates`

List all pending profile updates.

**Query Parameters:** `limit`, `offset`, `status`

### GET `/admin/companies/pending-updates/:id`

Get pending update details.

### POST `/admin/companies/pending-updates/:id/approve`

Approve pending update.

### POST `/admin/companies/pending-updates/:id/reject`

Reject pending update.

**Request Body:** `{ "reason": "Incomplete documentation" }`

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

### PATCH `/admin/agents/:id/email`

Dev-only: change agent email.

**Request Body:** `{ "email": "agent@company.com" }`

### GET `/admin/companies/:id/reviews`

List reviews.

### GET/POST/PUT/DELETE `/admin/companies/:id/gallery[/:galleryItemId]`

Gallery CRUD (same schema as agent endpoints).

### GET/POST/PUT/DELETE `/admin/companies/:id/documents[/:documentId]`

Document CRUD (same schema as agent endpoints).

### GET/POST/PUT/DELETE `/admin/companies/:id/contributions[/:contributionId]`

Contribution CRUD (same schema as agent endpoints).

### GET `/admin/deals`

List all deals.

**Query Parameters:** `status`, `limit`, `offset`

### GET `/admin/deals/:id`

Deal details with requests and stats.

### PATCH `/admin/deals/:id/status`

Moderate deal status.

**Request Body:** `{ "status": "open|closed|negotiating|archived" }`

---

### Admin Support Live Chat Endpoints 🔒

| Method | Endpoint                          | Description                     |
| ------ | --------------------------------- | ------------------------------- |
| GET    | `/admin/support/chats`            | List all support chats          |
| GET    | `/admin/support/chats/waiting`    | List waiting queue (unassigned) |
| GET    | `/admin/support/chats/:id`        | Support chat details            |
| POST   | `/admin/support/chats/:id/assign` | Assign admin to chat            |
| POST   | `/admin/support/chats/:id/close`  | Close support chat              |

---

## System

### GET `/system/stats`

System statistics.

**Response:**

```json
{ "companies": 0, "deals": 0, "locations": 0 }
```

### GET `/system/config`

System configuration.

**Response:**

```json
{
  "defaultLanguage": "en",
  "languages": [
    { "code": "en", "label": "English", "default": true },
    { "code": "ar", "label": "Arabic", "default": false }
  ]
}
```

---

## Notifications (NEW)

All routes require authentication. 🔐

### GET `/notifications` 🔐

List notifications (paginated).

**Query Parameters:** `limit` (default: 50), `offset` (default: 0)

**Response:**

```json
{
  "items": [
    {
      "id": 10,
      "type": "COMPANY_STATUS_CHANGE",
      "title": "Application Submitted",
      "message": "Your company profile has been submitted for review.",
      "isRead": false,
      "metadata": { "companyId": 123, "status": "underReview" },
      "createdAt": "2026-01-20T10:00:00.000Z"
    }
  ],
  "unreadCount": 5
}
```

---

### PUT `/notifications/read-all` 🔐

Mark all notifications as read.

---

### PUT `/notifications/:id/read` 🔐

Mark a notification as read.

---

### DELETE `/notifications/:id` 🔐

Delete a notification.

---

### DELETE `/notifications/read` 🔐

Delete all read notifications.

---

## Health

### GET `/health`

Health check.

**Response:**

```json
{ "status": "ok", "uptime": 123.45, "timestamp": "..." }
```

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

### Deal Types

`auction`, `rfq`

### Deal Statuses

`open`, `closed`, `negotiating`, `archived`

### Deal Request Statuses

`pending`, `accepted`, `rejected`, `withdrawn`

# Notification Integration Guide

This guide details how to integrate with the inDeal Notification System, covering REST API endpoints, real-time Socket.IO events, and data retention policies.

## 1. REST API

All notification endpoints require authentication (Bearer Token).

### 1.1 List Notifications (`GET /api/v1/notifications`)

Retrieves a paginated list of notifications for the current user.

**Request:**
```http
GET /api/v1/notifications?limit=20&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 10,
        "type": "COMPANY_STATUS_CHANGE",
        "title": "Application Submitted",
        "message": "Your company profile has been submitted for review.",
        "isRead": false,
        "metadata": {
          "companyId": 123,
          "status": "underReview"
        },
        "createdAt": "2026-01-20T10:00:00.000Z"
      }
    ],
    "unreadCount": 5
  }
}
```

### 1.2 Mark as Read (`PUT /api/v1/notifications/:id/read`)

Marks a specific notification as read.

**Request:**
```http
PUT /api/v1/notifications/10/read
Authorization: Bearer <token>
```

### 1.3 Mark All as Read (`PUT /api/v1/notifications/read-all`)

Marks all notifications for the user as read.

**Request:**
```http
PUT /api/v1/notifications/read-all
Authorization: Bearer <token>
```

### 1.4 Delete Notification (`DELETE /api/v1/notifications/:id`)

Deletes a specific notification.

**Request:**
```http
DELETE /api/v1/notifications/10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 10,
    "type": "COMPANY_STATUS_CHANGE",
    "title": "Application Submitted",
    "message": "Your company profile has been submitted for review.",
    "isRead": true,
    "metadata": { ... },
    "createdAt": "2026-01-20T10:00:00.000Z"
  }
}
```

### 1.5 Delete All Read (`DELETE /api/v1/notifications/read`)

Deletes all read notifications for the current user.

**Request:**
```http
DELETE /api/v1/notifications/read
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "deleted": 15
  }
}
```

---

## 2. Real-time (Socket.IO)

The backend emits real-time events when a new notification is created.

> **Note:** Socket.IO is disabled by default. Set `ENABLE_SOCKETIO=true` to enable real-time notifications.

### 2.1 Connection

The client must connect with the JWT token in the `auth` object.

```javascript
/* Client-side example */
import { io } from "socket.io-client";

const socket = io("https://api.indeal.com", {
  auth: {
    token: "YOUR_JWT_TOKEN"
  }
});

socket.on("connect", () => {
  console.log("Connected to Real-time Notification Service");
});
```

### 2.2 Listening for Notifications

Listen for the `notification:new` event.

```javascript
socket.on("notification:new", (notification) => {
  console.log("New Notification Received:", notification);
  
  // Example Payload:
  // {
  //   "id": 11,
  //   "type": "DEAL_REQUEST_RECEIVED",
  //   "title": "New Request on Your Deal",
  //   "message": "Acme Corp has submitted a request on \"Office Equipment\"",
  //   "isRead": false,
  //   "metadata": { "dealId": 5, "requestId": 12 },
  //   "createdAt": "..."
  // }
  
  // Update UI badge count or show toast
  updateBadgeCount();
  showToast(notification.title);
});
```

### 2.3 Rooms

*   Upon connection, the server automatically joins the socket to a private room: `user:{userId}`.
*   All notifications targeted at a specific user are emitted to this room.
*   No manual `join` event is required from the client side for notifications.

---

## 3. Notification Types

All notification types are defined in `src/constants/notificationTypes.js`:

| Type | Description |
|------|-------------|
| `COMPANY_STATUS_CHANGE` | When company profile status changes (submitted, approved, rejected) |
| `DEAL_REQUEST_RECEIVED` | A company has submitted a request on your deal |
| `DEAL_REQUEST_ACCEPTED` | Your deal request was accepted |
| `DEAL_REQUEST_REJECTED` | Your deal request was rejected |
| `DEAL_UPDATE` | General deal status updates |
| `CHAT_MESSAGE` | Fallback notification when user is offline (future) |
| `SUPPORT_TICKET_REPLY` | Admin replied to a support ticket |

---

## 4. Data Retention Policy

To prevent database bloat, old notifications are automatically cleaned up:

| Status | Retention Period |
|--------|-----------------|
| Read notifications | 90 days |
| Unread notifications | 180 days |

The cleanup job runs weekly (Sunday at 4:00 AM). These values can be configured via environment variables:

```bash
NOTIFICATION_RETENTION_READ_DAYS=90
NOTIFICATION_RETENTION_UNREAD_DAYS=180
```

---

## 5. Creating Notifications (Backend)

To create a notification from a service:

```javascript
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

await notificationService.createNotification({
  userId: 123,
  type: NOTIFICATION_TYPES.DEAL_REQUEST_RECEIVED,
  title: 'New Request on Your Deal',
  message: 'Acme Corp has submitted a request on "Office Equipment"',
  metadata: {
    dealId: 5,
    requestId: 12,
    applicantCompanyName: 'Acme Corp',
  },
});
```

This will:
1. Insert the notification into the database
2. Emit a real-time `notification:new` event via Socket.IO (if enabled)

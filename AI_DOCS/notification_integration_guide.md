# Notification Integration Guide

This guide details how to integrate with the inDeal Notification System, covering both REST API endpoints and real-time Socket.IO events.

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

---

## 2. Real-time (Socket.IO)

The backend emits real-time events when a new notification is created.

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
  //   "type": "DEAL_UPDATE",
  //   "title": "New Bid Received",
  //   "message": "Company X has placed a bid on your deal.",
  //   "isRead": false,
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

Common notification types include:

*   `COMPANY_STATUS_CHANGE`: When company profile status changes (e.g., submitted, approved, rejected).
*   `DEAL_UPDATE`: Updates related to deals (new status).
*   `DEAL_REQUEST`: New bid or request on a deal.
*   `CHAT_MESSAGE`: (handled via separate Chat events, but may generate notification fallback).

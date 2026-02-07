# Chat Integration Guide

Complete guide for integrating inDeal real-time chat into web and mobile apps.

---

## Overview

The chat system provides:

- **REST API** for room management and message history
- **Socket.io** for real-time messaging with **automatic room subscription**
- **File attachments** using signed R2 URLs
- **Support chat** integrated into the same socket connection

### Key Architecture Principles

| Principle                | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| **Single Socket**        | One WebSocket connection handles all B2B chats AND support chat  |
| **Auto-Subscription**    | On connect, user automatically joins ALL their active chat rooms |
| **No Manual Join/Leave** | Users cannot leave B2B rooms (1-on-1 permanent conversations)    |
| **Mid-Session Updates**  | New rooms created via REST auto-subscribe connected sockets      |

---

## Authentication

All chat endpoints require a valid JWT token.

```javascript
// Headers for REST API
headers: {
  'Authorization': 'Bearer <JWT_TOKEN>',
  'Content-Type': 'application/json'
}

// Socket.io authentication
const socket = io('wss://api.indeal.com', {
  auth: { token: '<JWT_TOKEN>' }
});
```

---

## REST API Endpoints

Base URL: `https://api.indeal.com/api/v1`

### Rooms

| Method | Endpoint                 | Description     | When to Use                         |
| ------ | ------------------------ | --------------- | ----------------------------------- |
| GET    | `/chats`                 | List my rooms   | App launch, refresh chat list       |
| POST   | `/chats`                 | Create/get room | "Message" button on company profile |
| GET    | `/chats/:roomId`         | Room details    | Opening a specific chat             |
| PATCH  | `/chats/:roomId/archive` | Archive room    | User hides a conversation           |

### Messages

| Method | Endpoint                  | Description         | When to Use                      |
| ------ | ------------------------- | ------------------- | -------------------------------- |
| GET    | `/chats/:roomId/messages` | Get messages        | Initial load, infinite scroll    |
| POST   | `/chats/:roomId/messages` | Send message (REST) | Fallback when socket unavailable |
| POST   | `/chats/:roomId/read`     | Mark messages read  | User opens chat, scrolls through |

---

## When to Use REST vs Socket.io

| Action               | Use REST               | Use Socket.io           |
| -------------------- | ---------------------- | ----------------------- |
| Create new chat room | ✅ `POST /chats`       | ❌                      |
| Send message         | ⚠️ Fallback only       | ✅ `chat:message`       |
| Receive messages     | ❌ Polling inefficient | ✅ `chat:message` event |
| Load message history | ✅ `GET /messages`     | ❌                      |
| Typing indicator     | ❌                     | ✅ `chat:typing`        |
| Mark as read         | ✅ or Socket           | ✅ `chat:read`          |
| Get chat list        | ✅ `GET /chats`        | ❌                      |

---

## Socket.io Integration

### Connection Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOCKET CONNECTION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Client connects with JWT token                               │
│     ↓                                                            │
│  2. Server authenticates user                                    │
│     ↓                                                            │
│  3. Server auto-joins socket to:                                 │
│     • user:{userId}         → personal notifications             │
│     • company:{companyId}   → new room notifications             │
│     • room:{id} (for each active B2B room)                       │
│     • support:room:{id}     → active support chat (if any)       │
│     ↓                                                            │
│  4. Server emits `chat:ready` with all room IDs                  │
│     ↓                                                            │
│  5. Client ready to send/receive messages                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Web (JavaScript/TypeScript)

```javascript
import { io } from 'socket.io-client';

class ChatClient {
  socket = null;
  b2bRoomIds = [];
  supportRoomId = null;
  isReady = false;

  connect(token) {
    this.socket = io('wss://api.indeal.com', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    // ─────────────────────────────────────────────────────────
    // CONNECTION EVENTS
    // ─────────────────────────────────────────────────────────

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      // Wait for chat:ready before sending messages
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      this.isReady = false;
      // Socket.io will auto-reconnect
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      if (error.message.includes('Authentication')) {
        // Token expired - redirect to login
        window.location.href = '/login';
      }
    });

    // ─────────────────────────────────────────────────────────
    // CHAT READY - Called after auto-subscription completes
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:ready', ({ b2bRoomIds, supportRoomId }) => {
      console.log('✅ Chat ready!', { b2bRoomIds, supportRoomId });
      this.b2bRoomIds = b2bRoomIds;
      this.supportRoomId = supportRoomId;
      this.isReady = true;

      // Now safe to send messages, load UI, etc.
      this.onReady?.();
    });

    // ─────────────────────────────────────────────────────────
    // NEW ROOM CREATED - Someone started a chat with you
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:room:new', (room) => {
      console.log('📬 New chat room:', room.id);
      this.b2bRoomIds.push(room.id);

      // Add to chat list UI, show notification
      this.onNewRoom?.(room);
    });

    // ─────────────────────────────────────────────────────────
    // INCOMING MESSAGE
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:message', (message) => {
      console.log('💬 Message received:', message);
      // {
      //   id, roomId, messageText, sentAt,
      //   senderUserId, senderFirstName, senderLastName,
      //   senderProfileImage, senderCompanyId, senderCompanyName,
      //   isRead, readAt, attachment?
      // }

      this.onMessage?.(message);
    });

    // ─────────────────────────────────────────────────────────
    // TYPING INDICATOR
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:typing', ({ roomId, userId, isTyping }) => {
      this.onTyping?.(roomId, userId, isTyping);
    });

    // ─────────────────────────────────────────────────────────
    // READ RECEIPTS
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:read', ({ roomId, companyId, messageId, unreadCount }) => {
      // Other party read your messages
      this.onReadReceipt?.(roomId, companyId, messageId, unreadCount);
    });

    // ─────────────────────────────────────────────────────────
    // SUPPORT CHAT EVENTS
    // ─────────────────────────────────────────────────────────

    this.socket.on('support:room:new', ({ roomId }) => {
      console.log('🎧 Support room created:', roomId);
      this.supportRoomId = roomId;
      this.onSupportRoomCreated?.(roomId);
    });

    this.socket.on('support:message', (message) => {
      this.onSupportMessage?.(message);
    });

    this.socket.on('support:admin:joined', ({ roomId, admin }) => {
      console.log(`🎧 Support agent ${admin.firstName} joined`);
      this.onSupportAdminJoined?.(roomId, admin);
    });

    // ─────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────

    this.socket.on('chat:error', ({ message, code }) => {
      console.error('Chat error:', message, code);
      this.onError?.(message, code);
    });

    this.socket.on('support:error', ({ message }) => {
      console.error('Support error:', message);
      this.onError?.(message);
    });
  }

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────

  sendMessage(roomId, messageText, attachmentFileId = null) {
    if (!this.isReady) {
      console.warn('Socket not ready, message queued');
      // Optionally queue for later
      return false;
    }

    const payload = { roomId };
    if (messageText) payload.messageText = messageText;
    if (attachmentFileId) payload.attachmentFileId = attachmentFileId;

    this.socket.emit('chat:message', payload);
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // TYPING INDICATOR (with debounce)
  // ─────────────────────────────────────────────────────────

  typingTimeouts = {};

  sendTyping(roomId, isTyping) {
    // Clear existing timeout for this room
    if (this.typingTimeouts[roomId]) {
      clearTimeout(this.typingTimeouts[roomId]);
    }

    this.socket.emit('chat:typing', { roomId, isTyping });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      this.typingTimeouts[roomId] = setTimeout(() => {
        this.socket.emit('chat:typing', { roomId, isTyping: false });
      }, 3000);
    }
  }

  // ─────────────────────────────────────────────────────────
  // MARK AS READ
  // ─────────────────────────────────────────────────────────

  markAsRead(roomId, messageId = null) {
    const payload = { roomId };
    if (messageId) payload.messageId = messageId;

    this.socket.emit('chat:read', payload);
  }

  // ─────────────────────────────────────────────────────────
  // SUPPORT CHAT
  // ─────────────────────────────────────────────────────────

  sendSupportMessage(roomId, text) {
    this.socket.emit('support:message', { roomId, text });
  }

  sendSupportTyping(roomId, isTyping) {
    this.socket.emit('support:typing', { roomId, isTyping });
  }

  // ─────────────────────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────────────────────

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.isReady = false;
    this.b2bRoomIds = [];
    this.supportRoomId = null;
  }
}

// Usage
const chat = new ChatClient();
chat.onReady = () => console.log('Chat system ready!');
chat.onMessage = (msg) => addMessageToUI(msg);
chat.onNewRoom = (room) => addRoomToList(room);
chat.connect(localStorage.getItem('accessToken'));
```

### React Native / Mobile

```javascript
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ChatService {
  socket = null;
  isReady = false;
  b2bRoomIds = [];
  supportRoomId = null;

  // Event callbacks
  onReady = null;
  onMessage = null;
  onNewRoom = null;
  onTyping = null;
  onError = null;

  async connect() {
    const token = await AsyncStorage.getItem('accessToken');

    this.socket = io('wss://api.indeal.com', {
      auth: { token },
      transports: ['websocket'], // Mobile: websocket only for better performance
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Wait for ready
    this.socket.on('chat:ready', ({ b2bRoomIds, supportRoomId }) => {
      this.isReady = true;
      this.b2bRoomIds = b2bRoomIds;
      this.supportRoomId = supportRoomId;
      this.onReady?.();
    });

    // Handle new rooms
    this.socket.on('chat:room:new', (room) => {
      this.b2bRoomIds.push(room.id);
      this.onNewRoom?.(room);
    });

    // Handle messages
    this.socket.on('chat:message', (message) => {
      this.onMessage?.(message);
    });

    // Handle typing
    this.socket.on('chat:typing', ({ roomId, userId, isTyping }) => {
      this.onTyping?.(roomId, userId, isTyping);
    });

    // Handle errors
    this.socket.on('chat:error', ({ message }) => {
      this.onError?.(message);
    });

    return this.socket;
  }

  sendMessage(roomId, messageText, attachmentFileId) {
    if (!this.isReady) return false;

    this.socket?.emit('chat:message', {
      roomId,
      ...(messageText && { messageText }),
      ...(attachmentFileId && { attachmentFileId }),
    });
    return true;
  }

  sendTyping(roomId, isTyping) {
    this.socket?.emit('chat:typing', { roomId, isTyping });
  }

  markAsRead(roomId, messageId) {
    this.socket?.emit('chat:read', { roomId, ...(messageId && { messageId }) });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.isReady = false;
  }
}

export default new ChatService();
```

---

## Sending Attachments

### Step 1: Upload File

```javascript
// Get signed upload URL
const uploadResponse = await fetch('/api/v1/files/upload-url', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  }),
});

const {
  data: { file: fileRecord, upload },
} = await uploadResponse.json();

// Upload to R2
await fetch(upload.url, {
  method: 'PUT',
  headers: upload.headers,
  body: file, // File or Blob
});

// fileRecord.id is your attachmentFileId
```

### Step 2: Send Message with Attachment

```javascript
// Via Socket.io
socket.emit('chat:message', {
  roomId: 1,
  messageText: 'Check this document', // optional
  attachmentFileId: fileRecord.id,
});

// Via REST API
await fetch(`/api/v1/chats/${roomId}/messages`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({
    messageText: 'Check this document', // optional
    attachmentFileId: fileRecord.id,
  }),
});
```

### Displaying Attachments

```javascript
// Attachment object structure
{
  id: 5,
  fileName: "document.pdf",
  filePath: "uploads/2026-01-19/document-abc123.pdf",
  publicUrl: "https://cdn.indeal.com/uploads/2026-01-19/document-abc123.pdf",
  mimeType: "application/pdf",
  size: 102400
}

// Display based on type
function renderAttachment(attachment) {
  if (!attachment) return null;

  const isImage = attachment.mimeType?.startsWith('image/');

  if (isImage) {
    return <img src={attachment.publicUrl} alt={attachment.fileName} />;
  }

  return (
    <a href={attachment.publicUrl} download={attachment.fileName}>
      📎 {attachment.fileName}
    </a>
  );
}
```

---

## Socket.io Events Reference

### Server → Client Events

| Event                  | Payload                                                                                  | Description                | When to Handle                        |
| ---------------------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------- |
| `chat:ready`           | `{ b2bRoomIds: number[], supportRoomId: number \| null }`                                | Auto-subscription complete | Store room IDs, enable send           |
| `chat:room:new`        | Room object (same schema as `GET /chats/:roomId`)                                        | New room created with you  | Add to chat list, show notification   |
| `chat:message`         | Message object                                                                           | New message received       | Display in chat UI                    |
| `chat:typing`          | `{ roomId, userId, isTyping }`                                                           | Typing indicator           | Show/hide typing UI                   |
| `chat:read`            | `{ roomId, companyId, messageId?, unreadCount }`                                         | Read receipt               | Update "seen" status                  |
| `chat:error`           | `{ message, code? }`                                                                     | Error occurred             | Show error toast                      |
| `support:room:new`     | `{ roomId }`                                                                             | Support room created       | Update support UI                     |
| `support:message`      | `{ id, roomId, messageText, isFromSupport, sentAt, agent: { id, firstName, lastName } }` | Support message received   | Display in support chat               |
| `support:admin:joined` | `{ roomId, admin: { id, firstName, lastName } }`                                         | Admin assigned             | Show "Connected to {admin.firstName}" |
| `support:typing`       | `{ roomId, userId, isAdmin, isTyping }`                                                  | Support typing             | Show typing indicator                 |
| `support:error`        | `{ message }`                                                                            | Support error              | Show error toast                      |

### Client → Server Events

| Event                  | Payload                                       | Description          | When to Emit                  |
| ---------------------- | --------------------------------------------- | -------------------- | ----------------------------- |
| `chat:message`         | `{ roomId, messageText?, attachmentFileId? }` | Send B2B message     | User sends message            |
| `chat:typing`          | `{ roomId, isTyping }`                        | Typing indicator     | User typing (debounce!)       |
| `chat:read`            | `{ roomId, messageId? }`                      | Mark as read         | User views messages           |
| `support:message`      | `{ roomId, text }`                            | Send support message | User sends to support         |
| `support:typing`       | `{ roomId, isTyping }`                        | Support typing       | User typing in support        |
| `support:admin:accept` | `{ roomId }`                                  | Accept waiting chat  | Admin takes chat (admin only) |

---

## Message Pagination

Use cursor-based pagination for efficient infinite scroll.

```javascript
class MessageLoader {
  messages = [];
  hasMore = true;
  isLoading = false;

  async loadInitial(roomId) {
    // Load most recent 50 messages
    const { messages, pagination } = await this.fetchMessages(roomId, { limit: 50 });
    this.messages = messages;
    this.hasMore = pagination.hasMore;
    return messages;
  }

  async loadOlder(roomId) {
    if (!this.hasMore || this.isLoading) return [];

    this.isLoading = true;
    const oldestId = this.messages[this.messages.length - 1]?.id;

    const { messages, pagination } = await this.fetchMessages(roomId, {
      limit: 50,
      before: oldestId, // Cursor: get messages before this ID
    });

    this.messages = [...this.messages, ...messages];
    this.hasMore = pagination.hasMore;
    this.isLoading = false;
    return messages;
  }

  async fetchMessages(roomId, params) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/v1/chats/${roomId}/messages?${query}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    return (await res.json()).data;
  }
}

// Usage with infinite scroll
const loader = new MessageLoader();
await loader.loadInitial(roomId);

// When user scrolls to top
chatContainer.onscroll = async () => {
  if (chatContainer.scrollTop < 100) {
    await loader.loadOlder(roomId);
  }
};
```

### Pagination Parameters

| Parameter | Description                | Use Case                                 |
| --------- | -------------------------- | ---------------------------------------- |
| `limit`   | Max messages (default: 50) | Control batch size                       |
| `offset`  | Skip N messages            | Traditional pagination (not recommended) |
| `before`  | Messages before this ID    | Infinite scroll UP (older)               |
| `after`   | Messages after this ID     | Sync new messages after reconnect        |

> **Note:** When using `before` or `after`, `offset` is ignored.

---

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);

  if (error.message.includes('Authentication')) {
    // Token expired or invalid
    // Clear local storage, redirect to login
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  } else if (error.message.includes('timeout')) {
    // Network issue - socket.io will auto-retry
    showToast('Connection lost. Reconnecting...');
  }
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server kicked us (e.g., token revoked)
    socket.connect(); // Won't auto-reconnect, must manually reconnect
  }
  // Other reasons auto-reconnect
});
```

### Chat Errors

```javascript
socket.on('chat:error', ({ message, code }) => {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      // Remove room from local list, refresh
      break;
    case 'UNAUTHORIZED':
      // User removed from room? Refresh room list
      break;
    case 'MESSAGE_EMPTY':
      // Validation error - show to user
      showToast('Please enter a message');
      break;
    default:
      showToast(message || 'Something went wrong');
  }
});
```

### Reconnection Handling

```javascript
socket.on('connect', () => {
  if (wasDisconnected) {
    // Reconnected! Server auto-resubscribes to all rooms
    // Wait for chat:ready then sync any missed messages

    socket.once('chat:ready', async ({ b2bRoomIds }) => {
      for (const roomId of b2bRoomIds) {
        await syncMissedMessages(roomId);
      }
    });
  }
});

async function syncMissedMessages(roomId) {
  const lastMessageId = getLastLocalMessageId(roomId);
  if (!lastMessageId) return;

  const { messages } = await fetch(
    `/api/v1/chats/${roomId}/messages?after=${lastMessageId}&limit=100`
  )
    .then((r) => r.json())
    .then((d) => d.data);

  // Add missed messages to UI
  messages.forEach((msg) => addMessageToUI(msg));
}
```

---

## Best Practices

### Do's ✅

| Practice                                 | Why                                   |
| ---------------------------------------- | ------------------------------------- |
| Wait for `chat:ready` before sending     | Ensures socket is subscribed to rooms |
| Debounce typing events (300ms)           | Prevents flooding server              |
| Use cursor pagination (`before`/`after`) | More efficient than offset            |
| Cache messages locally                   | Enables offline viewing, faster loads |
| Show optimistic updates                  | Better UX - show message immediately  |
| Handle reconnection gracefully           | Sync missed messages after reconnect  |

### Don'ts ❌

| Anti-Pattern                       | Why                            |
| ---------------------------------- | ------------------------------ |
| Manual `chat:join` events          | Auto-subscription handles this |
| Polling for new messages           | Use socket events instead      |
| Sending without checking `isReady` | Messages may fail silently     |
| Large file uploads (>5MB)          | Will be rejected               |
| Typing events without debounce     | Floods server, poor UX         |

### Optimistic Updates

Show messages immediately for better UX:

```javascript
function sendMessage(roomId, text) {
  // 1. Create optimistic message
  const optimisticMsg = {
    id: `temp-${Date.now()}`,
    roomId,
    messageText: text,
    sentAt: new Date().toISOString(),
    senderUserId: currentUser.id,
    senderFirstName: currentUser.firstName,
    isPending: true, // Local flag
  };

  // 2. Add to UI immediately
  addMessageToUI(optimisticMsg);

  // 3. Send via socket
  socket.emit('chat:message', { roomId, messageText: text });
}

// 4. When server confirms, update the message
socket.on('chat:message', (message) => {
  if (message.senderUserId === currentUser.id) {
    // Replace optimistic message with real one
    replaceOptimisticMessage(message);
  } else {
    addMessageToUI(message);
  }
});
```

---

## Flutter (Dart) Integration

Add the `socket_io_client` package to your `pubspec.yaml`:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
  http: ^1.1.0
  shared_preferences: ^2.2.2
```

### Chat Service

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class ChatMessage {
  final int id;
  final int roomId;
  final String? messageText;
  final String sentAt;
  final String? readAt;
  final bool isRead;
  final ChatAgent agent;
  final ChatCompany company;
  final ChatAttachment? attachment;

  ChatMessage({
    required this.id,
    required this.roomId,
    this.messageText,
    required this.sentAt,
    this.readAt,
    required this.isRead,
    required this.agent,
    required this.company,
    this.attachment,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'],
      roomId: json['roomId'],
      messageText: json['messageText'],
      sentAt: json['sentAt'],
      readAt: json['readAt'],
      isRead: json['isRead'] ?? false,
      agent: ChatAgent.fromJson(json['agent']),
      company: ChatCompany.fromJson(json['company']),
      attachment: json['attachment'] != null
        ? ChatAttachment.fromJson(json['attachment'])
        : null,
    );
  }
}

class ChatAgent {
  final int id;
  final String firstName;
  final String lastName;
  final String? profileImage;

  ChatAgent({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.profileImage,
  });

  factory ChatAgent.fromJson(Map<String, dynamic> json) {
    return ChatAgent(
      id: json['id'],
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      profileImage: json['profileImage'],
    );
  }

  String get fullName => '$firstName $lastName'.trim();
}

class ChatAttachment {
  final int id;
  final String fileName;
  final String? publicUrl;
  final String? mimeType;
  final int? size;

  ChatAttachment({
    required this.id,
    required this.fileName,
    this.publicUrl,
    this.mimeType,
    this.size,
  });

  factory ChatAttachment.fromJson(Map<String, dynamic> json) {
    return ChatAttachment(
      id: json['id'],
      fileName: json['fileName'],
      publicUrl: json['publicUrl'],
      mimeType: json['mimeType'],
      size: json['size'],
    );
  }
}

class ChatRoom {
  final int id;
  final int companyAId;
  final int companyBId;
  final ChatCompany? otherCompany;
  final String status;
  final String? lastMessage;
  final String? lastMessageAt;
  final int unreadCount;

  ChatRoom({
    required this.id,
    required this.companyAId,
    required this.companyBId,
    this.otherCompany,
    required this.status,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
  });

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    return ChatRoom(
      id: json['id'],
      companyAId: json['companyAId'],
      companyBId: json['companyBId'],
      otherCompany: json['otherCompany'] != null
        ? ChatCompany.fromJson(json['otherCompany'])
        : null,
      status: json['status'] ?? 'active',
      lastMessage: json['lastMessage'],
      lastMessageAt: json['lastMessageAt'],
      unreadCount: json['unreadCount'] ?? 0,
    );
  }
}

class ChatCompany {
  final int id;
  final String name;
  final String? logo;

  ChatCompany({required this.id, required this.name, this.logo});

  factory ChatCompany.fromJson(Map<String, dynamic> json) {
    return ChatCompany(
      id: json['id'],
      name: json['name'] ?? '',
      logo: json['logo'],
    );
  }
}

/// ChatService - Single socket for all B2B + Support chats
///
/// Usage:
/// 1. Call connect() on app startup
/// 2. Wait for onReady callback before sending messages
/// 3. No need to manually join rooms - auto-subscribed on connect
class ChatService {
  static const String _baseUrl = 'wss://api.indeal.com';
  IO.Socket? _socket;

  // State
  bool _isReady = false;
  List<int> _b2bRoomIds = [];
  int? _supportRoomId;

  // Getters
  bool get isReady => _isReady;
  bool get isConnected => _socket?.connected ?? false;
  List<int> get b2bRoomIds => List.unmodifiable(_b2bRoomIds);
  int? get supportRoomId => _supportRoomId;

  // Callbacks
  Function()? onConnected;
  Function()? onDisconnected;
  Function()? onReady;
  Function(ChatMessage)? onMessageReceived;
  Function(ChatRoom)? onNewRoomReceived;
  Function(int roomId, int userId, bool isTyping)? onTypingUpdate;
  Function(int roomId, int companyId, int? messageId, int unreadCount)? onReadReceipt;
  Function(String error)? onError;

  // Support chat callbacks
  Function(int roomId)? onSupportRoomCreated;
  Function(Map<String, dynamic>)? onSupportMessageReceived;
  Function(int roomId, Map<String, dynamic> admin)? onSupportAdminJoined;

  /// Connect to chat server
  /// Call this on app startup after user authentication
  Future<void> connect() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken') ?? '';

    _socket = IO.io(_baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'auth': {'token': token},
      'reconnection': true,
      'reconnectionAttempts': 10,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax': 5000,
    });

    _setupEventListeners();
    _socket!.connect();
  }

  void _setupEventListeners() {
    // ─────────────────────────────────────────────────────────
    // CONNECTION EVENTS
    // ─────────────────────────────────────────────────────────

    _socket!.onConnect((_) {
      print('✅ Chat socket connected');
      onConnected?.call();
      // Wait for chat:ready before considering fully ready
    });

    _socket!.onDisconnect((_) {
      print('❌ Chat socket disconnected');
      _isReady = false;
      onDisconnected?.call();
    });

    _socket!.onConnectError((error) {
      print('❌ Connection error: $error');
      onError?.call(error.toString());
    });

    // ─────────────────────────────────────────────────────────
    // CHAT READY - Auto-subscription complete
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:ready', (data) {
      _b2bRoomIds = List<int>.from(data['b2bRoomIds'] ?? []);
      _supportRoomId = data['supportRoomId'];
      _isReady = true;
      print('✅ Chat ready! Rooms: $_b2bRoomIds, Support: $_supportRoomId');
      onReady?.call();
    });

    // ─────────────────────────────────────────────────────────
    // NEW ROOM - Someone created a chat with you
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:room:new', (data) {
      final room = ChatRoom.fromJson(Map<String, dynamic>.from(data));
      _b2bRoomIds.add(room.id);
      onNewRoomReceived?.call(room);
    });

    // ─────────────────────────────────────────────────────────
    // MESSAGES
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:message', (data) {
      final message = ChatMessage.fromJson(Map<String, dynamic>.from(data));
      onMessageReceived?.call(message);
    });

    // ─────────────────────────────────────────────────────────
    // TYPING
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:typing', (data) {
      onTypingUpdate?.call(
        data['roomId'] as int,
        data['userId'] as int,
        data['isTyping'] as bool,
      );
    });

    // ─────────────────────────────────────────────────────────
    // READ RECEIPTS
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:read', (data) {
      onReadReceipt?.call(
        data['roomId'] as int,
        data['companyId'] as int,
        data['messageId'] as int?,
        data['unreadCount'] as int,
      );
    });

    // ─────────────────────────────────────────────────────────
    // SUPPORT CHAT EVENTS
    // ─────────────────────────────────────────────────────────

    _socket!.on('support:room:new', (data) {
      _supportRoomId = data['roomId'] as int;
      onSupportRoomCreated?.call(_supportRoomId!);
    });

    _socket!.on('support:message', (data) {
      onSupportMessageReceived?.call(Map<String, dynamic>.from(data));
    });

    _socket!.on('support:admin:joined', (data) {
      final admin = data['admin'] as Map<String, dynamic>;
      onSupportAdminJoined?.call(
        data['roomId'] as int,
        admin,
      );
    });

    // ─────────────────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────────────────

    _socket!.on('chat:error', (data) {
      onError?.call(data['message'] ?? 'Unknown error');
    });

    _socket!.on('support:error', (data) {
      onError?.call(data['message'] ?? 'Support error');
    });
  }

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────

  /// Send a B2B chat message
  /// Returns false if socket not ready
  bool sendMessage(int roomId, {String? messageText, int? attachmentFileId}) {
    if (!_isReady || (messageText == null && attachmentFileId == null)) {
      return false;
    }

    _socket?.emit('chat:message', {
      'roomId': roomId,
      if (messageText != null) 'messageText': messageText,
      if (attachmentFileId != null) 'attachmentFileId': attachmentFileId,
    });
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // TYPING INDICATOR
  // ─────────────────────────────────────────────────────────

  /// Send typing indicator (debounce on your end!)
  void sendTyping(int roomId, bool isTyping) {
    _socket?.emit('chat:typing', {'roomId': roomId, 'isTyping': isTyping});
  }

  // ─────────────────────────────────────────────────────────
  // MARK AS READ
  // ─────────────────────────────────────────────────────────

  /// Mark messages as read
  /// If messageId is null, marks ALL messages in room as read
  void markAsRead(int roomId, {int? messageId}) {
    _socket?.emit('chat:read', {
      'roomId': roomId,
      if (messageId != null) 'messageId': messageId,
    });
  }

  // ─────────────────────────────────────────────────────────
  // SUPPORT CHAT
  // ─────────────────────────────────────────────────────────

  /// Send a support chat message
  void sendSupportMessage(int roomId, String text) {
    _socket?.emit('support:message', {'roomId': roomId, 'text': text});
  }

  /// Send typing indicator in support chat
  void sendSupportTyping(int roomId, bool isTyping) {
    _socket?.emit('support:typing', {'roomId': roomId, 'isTyping': isTyping});
  }

  // ─────────────────────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────────────────────

  /// Disconnect from chat server
  /// Call this on logout
  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _isReady = false;
    _b2bRoomIds = [];
    _supportRoomId = null;
  }
}
```

### Usage Example - Chat Screen

```dart
class ChatScreen extends StatefulWidget {
  final int roomId;
  const ChatScreen({super.key, required this.roomId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ChatService _chatService = ChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isOtherTyping = false;
  Timer? _typingTimer;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  Future<void> _initChat() async {
    // Setup callbacks
    _chatService.onMessageReceived = (message) {
      if (message.roomId == widget.roomId) {
        setState(() => _messages.insert(0, message));
        // Mark as read when viewing
        _chatService.markAsRead(widget.roomId, messageId: message.id);
      }
    };

    _chatService.onTypingUpdate = (roomId, userId, isTyping) {
      if (roomId == widget.roomId) {
        setState(() => _isOtherTyping = isTyping);
      }
    };

    _chatService.onError = (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error)),
      );
    };

    _chatService.onReady = () {
      print('Chat ready! Can send messages now.');
      // Load message history via REST
      _loadMessages();
    };

    await _chatService.connect();
  }

  Future<void> _loadMessages() async {
    // Load initial messages via REST API
    // See FileUploadService example for HTTP calls
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty || !_chatService.isReady) return;

    final success = _chatService.sendMessage(
      widget.roomId,
      messageText: text,
    );

    if (success) {
      _messageController.clear();
      _stopTyping();
    }
  }

  void _onTextChanged(String text) {
    if (text.isNotEmpty) {
      _chatService.sendTyping(widget.roomId, true);

      // Auto-stop typing after 3 seconds
      _typingTimer?.cancel();
      _typingTimer = Timer(const Duration(seconds: 3), _stopTyping);
    }
  }

  void _stopTyping() {
    _chatService.sendTyping(widget.roomId, false);
    _typingTimer?.cancel();
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    // Don't disconnect here - service is shared
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          if (!_chatService.isConnected)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Icon(Icons.cloud_off, color: Colors.red),
            ),
        ],
      ),
      body: Column(
        children: [
          // Typing indicator
          if (_isOtherTyping)
            Container(
              padding: const EdgeInsets.all(8),
              color: Colors.grey[200],
              child: const Row(
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text('Typing...', style: TextStyle(fontStyle: FontStyle.italic)),
                ],
              ),
            ),

          // Messages list
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              reverse: true,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _MessageBubble(message: msg);
              },
            ),
          ),

          // Input
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(blurRadius: 4, color: Colors.black12)],
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.attach_file),
                  onPressed: _pickAttachment,
                ),
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                    ),
                    onChanged: _onTextChanged,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  color: Theme.of(context).primaryColor,
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _pickAttachment() {
    // Implement file picker + upload
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundImage: message.agent.profileImage != null
          ? NetworkImage(message.agent.profileImage!)
          : null,
        child: message.agent.profileImage == null
          ? Text(message.agent.firstName.isNotEmpty
              ? message.agent.firstName[0]
              : '?')
          : null,
      ),
      title: Text(message.messageText ?? '[Attachment]'),
      subtitle: Text('${message.agent.fullName} • ${message.company.name}'),
      trailing: message.attachment != null
        ? IconButton(
            icon: const Icon(Icons.attach_file),
            onPressed: () {
              // Open attachment URL
            },
          )
        : null,
    );
  }
}
```

### Uploading Attachments in Flutter

````dart
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:convert';

class FileUploadService {
  static const String _apiBase = 'https://api.indeal.com/api/v1';

  /// Upload a file and return the file ID for chat attachment
  ///
  /// Usage:
  /// ```dart
  /// final fileId = await FileUploadService.uploadFile(file, token);
  /// if (fileId != null) {
  ///   chatService.sendMessage(roomId, attachmentFileId: fileId);
  /// }
  /// ```
  static Future<int?> uploadFile(File file, String token) async {
    try {
      // Step 1: Get signed upload URL from our API
      final fileName = file.path.split('/').last;
      final fileSize = await file.length();
      final mimeType = _getMimeType(fileName);

      final response = await http.post(
        Uri.parse('$_apiBase/files/upload-url'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'fileName': fileName,
          'fileType': mimeType,
          'fileSize': fileSize,
        }),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Failed to get upload URL: ${response.body}');
      }

      final data = jsonDecode(response.body)['data'];
      final fileId = data['file']['id'] as int;
      final uploadUrl = data['upload']['url'] as String;
      final uploadHeaders = Map<String, String>.from(data['upload']['headers'] ?? {});

      // Step 2: Upload file directly to R2 storage
      final uploadResponse = await http.put(
        Uri.parse(uploadUrl),
        headers: {
          'Content-Type': mimeType,
          ...uploadHeaders,
        },
        body: await file.readAsBytes(),
      );

      if (uploadResponse.statusCode != 200) {
        throw Exception('Failed to upload file to storage');
      }

      return fileId;
    } catch (e) {
      print('Upload error: $e');
      return null;
    }
  }

  static String _getMimeType(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }
}
````

---

## Support Chat Integration

Support chat uses the **same socket connection** as B2B chat. No separate connection needed.

### Creating a Support Chat

```javascript
// Via REST API - creates support room and auto-subscribes socket
const response = await fetch('/api/v1/support/chat', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
});

const { data: room } = await response.json();
// { id: 15, status: 'waiting', createdAt: '...' }

// Socket is automatically subscribed via support:room:new event
socket.on('support:room:new', ({ roomId }) => {
  console.log('Support room created:', roomId);
});
```

### Support Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPPORT CHAT FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User calls POST /support/chat                                │
│     ↓                                                            │
│  2. Server creates room (status: waiting)                        │
│     ↓                                                            │
│  3. Server auto-subscribes socket, emits support:room:new        │
│     ↓                                                            │
│  4. User waits in queue, can send messages                       │
│     ↓                                                            │
│  5. Admin accepts → support:admin:joined emitted                 │
│     ↓                                                            │
│  6. Conversation via support:message events                      │
│     ↓                                                            │
│  7. Admin closes chat via REST                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sending Support Messages

```javascript
// Check if user has active support room
if (chat.supportRoomId) {
  socket.emit('support:message', {
    roomId: chat.supportRoomId,
    text: 'Hello, I need help with...',
  });
}

// Listen for responses
socket.on('support:message', (message) => {
  // { id, roomId, messageText, isFromSupport, sentAt, agent: { id, firstName, lastName } }
  if (message.isFromSupport) {
    // Message from support agent
    console.log(`${message.agent.firstName}: ${message.messageText}`);
  } else {
    // Your own message (confirmation)
  }
});
```

---

## Complete Integration Checklist

### App Startup

- [ ] Connect socket with JWT token
- [ ] Wait for `chat:ready` event before enabling send
- [ ] Store `b2bRoomIds` and `supportRoomId` locally

### Chat List Screen

- [ ] Load rooms via `GET /chats`
- [ ] Listen for `chat:room:new` to add new rooms
- [ ] Listen for `chat:message` to update last message preview
- [ ] Show unread counts from room data

### Chat Room Screen

- [ ] Load history via `GET /chats/:roomId/messages`
- [ ] Send messages via `socket.emit('chat:message', ...)`
- [ ] Listen for `chat:message` for incoming messages
- [ ] Implement typing indicator with debounce
- [ ] Mark messages as read when viewed
- [ ] Handle infinite scroll for older messages

### Attachments

- [ ] Upload via `POST /files/upload-url` + PUT to R2
- [ ] Include `attachmentFileId` in message
- [ ] Display based on mime type (image vs file)
- [ ] Show upload progress

### Error Handling

- [ ] Handle `chat:error` events
- [ ] Handle connection errors
- [ ] Implement reconnection sync

### Support Chat

- [ ] Create via `POST /support/chat`
- [ ] Auto-subscribe via `support:room:new`
- [ ] Handle `support:admin:joined` event
- [ ] Send/receive via `support:message`

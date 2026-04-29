# Socket API Docs

This document describes the realtime Socket.IO API.

## Generated Spec

- AsyncAPI JSON: `/api/v1/socket-docs.json`

## Connection

- Protocol: `socket.io`
- Auth: JWT bearer token via handshake
  - `socket.handshake.auth.token`
  - or `Authorization: Bearer <token>` header

## Events

### Client -> Server

#### `chat:message`

Send a chat message.

Payload:

```json
{
  "roomId": 123,
  "text": "hello",
  "messageText": "hello",
  "attachmentFileId": 456
}
```

Notes:

- `roomId` is required.
- Use either `text` or `messageText`.
- `attachmentFileId` is optional.

#### `chat:read`

Mark room messages as read.

Payload:

```json
{
  "roomId": 123,
  "messageId": 789
}
```

Notes:

- `roomId` is required.
- `messageId` is optional.

#### `chat:typing`

Emit typing state.

Payload:

```json
{
  "roomId": 123,
  "isTyping": true
}
```

### Server -> Client

#### `chat:ready`

Emitted after connection and auto-join flow.

Payload:

```json
{
  "b2bRoomIds": [1, 2, 3],
  "error": null
}
```

#### `chat:message`

Broadcasted chat message payload.

Payload:

- Dynamic object from backend chat message model.

#### `chat:read`

Broadcasted read receipt update.

Payload:

```json
{
  "roomId": 123,
  "companyId": 45,
  "messageId": 789,
  "unreadCount": 0
}
```

#### `chat:typing`

Broadcasted typing indicator.

Payload:

```json
{
  "roomId": 123,
  "userId": 99,
  "companyId": 45,
  "isTyping": true
}
```

#### `chat:error`

Server-side validation or processing error.

Payload:

```json
{
  "message": "Invalid chat:message payload",
  "code": 400
}
```

#### `chat:room:new`

Emitted when a new room is created/subscribed.

Payload:

```json
{
  "id": 321
}
```

#### `notification:new`

User notification payload.

Payload:

- Dynamic object from notification producer.

#### `support:room:new`

Emitted when user is subscribed to support room.

Payload:

```json
{
  "roomId": 77
}
```

## Source of Truth

- Socket contracts are defined in:
  - `src/core/contracts/socket/events.js`
- AsyncAPI generation is implemented in:
  - `src/core/contracts/socket/registry.js`

# Chat Integration Guide

Complete guide for integrating inDeal real-time chat into web and mobile apps.

---

## Overview

The chat system provides:

- **REST API** for room management and message history
- **Socket.io** for real-time messaging
- **File attachments** using signed R2 URLs

---

## Authentication

All chat endpoints require a valid JWT token.

```javascript
// Headers for REST API
headers: {
  'Authorization': 'Bearer <JWT_TOKEN>',
  'Content-Type': 'application/json'
}
```

---

## REST API Endpoints

Base URL: `https://api.indeal.com/api/v1`

### Rooms

| Method | Endpoint                 | Description     |
| ------ | ------------------------ | --------------- |
| GET    | `/chats`                 | List my rooms   |
| POST   | `/chats`                 | Create/get room |
| GET    | `/chats/:roomId`         | Room details    |
| PATCH  | `/chats/:roomId/archive` | Archive room    |

### Messages

| Method | Endpoint                  | Description         |
| ------ | ------------------------- | ------------------- |
| GET    | `/chats/:roomId/messages` | Get messages        |
| POST   | `/chats/:roomId/messages` | Send message (REST) |

---

## Socket.io Integration

### Web (JavaScript/TypeScript)

```javascript
import { io } from 'socket.io-client';

// Connect with authentication
const socket = io('wss://api.indeal.com', {
  auth: { token: localStorage.getItem('accessToken') },
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message);
  // Handle auth errors - redirect to login
});

// Join a room
function joinRoom(roomId) {
  socket.emit('chat:join', { roomId });
}

socket.on('chat:joined', ({ roomId }) => {
  console.log('Joined room:', roomId);
});

// Send a message
function sendMessage(roomId, text, attachmentFileId = null) {
  socket.emit('chat:message', {
    roomId,
    text,
    attachmentFileId, // optional
  });
}

// Receive messages
socket.on('chat:message', (message) => {
  console.log('New message:', message);
  // {
  //   id: 123,
  //   roomId: 1,
  //   messageText: "Hello!",
  //   sentAt: "2026-01-19T10:30:00Z",
  //   senderFirstName: "John",
  //   senderLastName: "Doe",
  //   attachment: { id: 5, fileName: "doc.pdf", filePath: "uploads/..." } // if present
  // }
});

// Typing indicator
function sendTyping(roomId, isTyping) {
  socket.emit('chat:typing', { roomId, isTyping });
}

socket.on('chat:typing', ({ roomId, userId, isTyping }) => {
  // Show/hide typing indicator
});

// Error handling
socket.on('chat:error', ({ message }) => {
  console.error('Chat error:', message);
});

// Leave room
function leaveRoom(roomId) {
  socket.emit('chat:leave', { roomId });
}

// Disconnect
function disconnect() {
  socket.disconnect();
}
```

### React Native / Mobile

```javascript
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ChatService {
  socket = null;

  async connect() {
    const token = await AsyncStorage.getItem('accessToken');

    this.socket = io('wss://api.indeal.com', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    return this.socket;
  }

  joinRoom(roomId) {
    this.socket?.emit('chat:join', { roomId });
  }

  sendMessage(roomId, text, attachmentFileId) {
    this.socket?.emit('chat:message', {
      roomId,
      text,
      attachmentFileId,
    });
  }

  onMessage(callback) {
    this.socket?.on('chat:message', callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
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
  text: 'Check this document', // optional
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

### Client → Server

| Event          | Payload                                | Description      |
| -------------- | -------------------------------------- | ---------------- |
| `chat:join`    | `{ roomId }`                           | Join room        |
| `chat:leave`   | `{ roomId }`                           | Leave room       |
| `chat:message` | `{ roomId, text?, attachmentFileId? }` | Send message     |
| `chat:typing`  | `{ roomId, isTyping }`                 | Typing indicator |

### Server → Client

| Event          | Payload                                                     | Description         |
| -------------- | ----------------------------------------------------------- | ------------------- |
| `chat:joined`  | `{ roomId }`                                                | Joined confirmation |
| `chat:left`    | `{ roomId }`                                                | Left confirmation   |
| `chat:message` | `{ id, roomId, messageText, attachment?, sender*, sentAt }` | New message         |
| `chat:typing`  | `{ roomId, userId, isTyping }`                              | Typing update       |
| `chat:error`   | `{ message }`                                               | Error               |

---

## Message Pagination

```javascript
// Fetch older messages
const res = await fetch(`/api/v1/chats/${roomId}/messages?limit=50&before=${oldestMessageId}`, {
  headers: { Authorization: 'Bearer ' + token },
});

const { data } = await res.json();
// {
//   messages: [...],
//   pagination: { total, limit, offset, hasMore }
// }
```

---

## Error Handling

```javascript
// Connection errors
socket.on('connect_error', (error) => {
  if (error.message === 'Authentication required') {
    // Redirect to login
  }
});

// Chat errors
socket.on('chat:error', ({ message }) => {
  // Show toast/alert
  showNotification(message, 'error');
});
```

---

## Best Practices

1. **Reconnection**: Socket.io handles reconnection automatically
2. **Message caching**: Cache messages locally for offline viewing
3. **Optimistic updates**: Show message immediately, update on confirmation
4. **Typing debounce**: Debounce typing events (300ms recommended)
5. **File size limits**: Max 5MB per attachment
6. **Supported formats**: Images (jpg, png, webp), PDF, documents

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
  final String senderFirstName;
  final String senderLastName;
  final ChatAttachment? attachment;

  ChatMessage({
    required this.id,
    required this.roomId,
    this.messageText,
    required this.sentAt,
    required this.senderFirstName,
    required this.senderLastName,
    this.attachment,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'],
      roomId: json['roomId'],
      messageText: json['messageText'],
      sentAt: json['sentAt'],
      senderFirstName: json['senderFirstName'] ?? '',
      senderLastName: json['senderLastName'] ?? '',
      attachment: json['attachment'] != null
        ? ChatAttachment.fromJson(json['attachment'])
        : null,
    );
  }
}

class ChatAttachment {
  final int id;
  final String fileName;
  final String? publicUrl;

  ChatAttachment({required this.id, required this.fileName, this.publicUrl});

  factory ChatAttachment.fromJson(Map<String, dynamic> json) {
    return ChatAttachment(
      id: json['id'],
      fileName: json['fileName'],
      publicUrl: json['publicUrl'],
    );
  }
}

class ChatService {
  static const String _baseUrl = 'wss://api.indeal.com';
  IO.Socket? _socket;

  Function(ChatMessage)? onMessageReceived;
  Function(int roomId, int userId, bool isTyping)? onTypingUpdate;
  Function(String error)? onError;
  Function()? onConnected;
  Function()? onDisconnected;

  /// Connect to chat with JWT token
  Future<void> connect() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken') ?? '';

    _socket = IO.io(_baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'auth': {'token': token},
    });

    _socket!.onConnect((_) {
      print('✅ Chat connected');
      onConnected?.call();
    });

    _socket!.onDisconnect((_) {
      print('❌ Chat disconnected');
      onDisconnected?.call();
    });

    _socket!.onConnectError((error) {
      print('❌ Connection error: $error');
      onError?.call(error.toString());
    });

    // Listen for messages
    _socket!.on('chat:message', (data) {
      final message = ChatMessage.fromJson(Map<String, dynamic>.from(data));
      onMessageReceived?.call(message);
    });

    // Listen for typing
    _socket!.on('chat:typing', (data) {
      onTypingUpdate?.call(
        data['roomId'] as int,
        data['userId'] as int,
        data['isTyping'] as bool,
      );
    });

    // Listen for errors
    _socket!.on('chat:error', (data) {
      onError?.call(data['message'] ?? 'Unknown error');
    });

    _socket!.connect();
  }

  /// Join a chat room
  void joinRoom(int roomId) {
    _socket?.emit('chat:join', {'roomId': roomId});
  }

  /// Leave a chat room
  void leaveRoom(int roomId) {
    _socket?.emit('chat:leave', {'roomId': roomId});
  }

  /// Send a message (text and/or attachment)
  void sendMessage(int roomId, {String? text, int? attachmentFileId}) {
    if (text == null && attachmentFileId == null) return;

    _socket?.emit('chat:message', {
      'roomId': roomId,
      if (text != null) 'text': text,
      if (attachmentFileId != null) 'attachmentFileId': attachmentFileId,
    });
  }

  /// Send typing indicator
  void sendTyping(int roomId, bool isTyping) {
    _socket?.emit('chat:typing', {'roomId': roomId, 'isTyping': isTyping});
  }

  /// Disconnect from chat
  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  bool get isConnected => _socket?.connected ?? false;
}
```

### Usage in Widget

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
  final List<ChatMessage> _messages = [];
  bool _isOtherTyping = false;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  Future<void> _initChat() async {
    _chatService.onMessageReceived = (message) {
      setState(() => _messages.insert(0, message));
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

    await _chatService.connect();
    _chatService.joinRoom(widget.roomId);
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _chatService.sendMessage(widget.roomId, text: text);
    _messageController.clear();
  }

  @override
  void dispose() {
    _chatService.leaveRoom(widget.roomId);
    _chatService.disconnect();
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: Column(
        children: [
          if (_isOtherTyping)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: Text('Typing...', style: TextStyle(fontStyle: FontStyle.italic)),
            ),
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return ListTile(
                  title: Text(msg.messageText ?? '[Attachment]'),
                  subtitle: Text('${msg.senderFirstName} ${msg.senderLastName}'),
                  trailing: msg.attachment != null
                    ? const Icon(Icons.attach_file)
                    : null,
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(hintText: 'Message...'),
                    onChanged: (_) => _chatService.sendTyping(widget.roomId, true),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

### Uploading Attachments in Flutter

```dart
import 'package:http/http.dart' as http;
import 'dart:io';

class FileUploadService {
  static const String _apiBase = 'https://api.indeal.com/api/v1';

  /// Upload a file and return the file ID for chat attachment
  static Future<int?> uploadFile(File file, String token) async {
    try {
      // Step 1: Get signed upload URL
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
        throw Exception('Failed to get upload URL');
      }

      final data = jsonDecode(response.body)['data'];
      final fileId = data['file']['id'] as int;
      final uploadUrl = data['upload']['url'] as String;

      // Step 2: Upload file to R2
      final uploadResponse = await http.put(
        Uri.parse(uploadUrl),
        headers: {'Content-Type': mimeType},
        body: await file.readAsBytes(),
      );

      if (uploadResponse.statusCode != 200) {
        throw Exception('Failed to upload file');
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
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}

// Usage: Send attachment in chat
Future<void> sendAttachment(File file) async {
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('accessToken') ?? '';

  final fileId = await FileUploadService.uploadFile(file, token);
  if (fileId != null) {
    _chatService.sendMessage(widget.roomId, attachmentFileId: fileId);
  }
}
```

Testing backend base URL: https://api-test.indealeg.com

Here is the definitive, final list of technologies for your project. I have updated this list to reflect your specific engineering choices: **Valkey** (instead of Redis), **Raw SQL**, and **Firebase (FCM)** (to support the Mobile App).

### **1. Core Backend & API**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Node.js** | **Runtime Environment** | Executes JavaScript on the server. Its event-driven model is essential for handling thousands of concurrent connections (like chat and live bidding) without crashing. |
| **Express.js** | **Web Framework** | Manages HTTP routes, middleware pipelines, and API endpoints. It is the "spine" that connects your business logic to the internet. |

### **2. Database & Data Access**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **PostgreSQL** | **Primary Database** | The "Source of Truth." Stores structured data (Companies, Deals) and handles complex relationships and JSONB data types efficiently. |
| **pg (node-postgres)** | **Database Driver** | The client that connects Node to Postgres. You chose this to write **Raw SQL**, giving you maximum control over query performance and security. |

### **3. Async Processing (Queues & Caching)**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Valkey** | **In-Memory Store** | The open-source, high-performance replacement for Redis. It holds the **Job Queue** data and acts as the **Pub/Sub** layer to scale Socket.io across multiple servers. |
| **BullMQ** | **Job Queue Manager** | Decouples heavy tasks (like sending emails) from the main API. It pushes tasks to Valkey so they can be processed in the background without freezing the user interface. |
| **Ioredis** | **Valkey Client** | The library your Node.js code uses to talk to the Valkey server. |

### **4. Real-Time Communication**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Socket.io** | **WebSocket Engine** | Handles instant, bi-directional communication for **Chat** and **Live Deal Updates** when the app/web is open. |
| **@socket.io/redis-adapter**| **Scaling Adapter** | Uses Valkey Pub/Sub to pass messages between different API servers, ensuring users can chat even if they are connected to different containers. |

### **5. File Storage (Cloud)**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Cloudflare R2** | **Object Storage** | Stores binary files (Images, PDFs). It is S3-compatible but has **zero egress fees**, which keeps your freelance hosting costs predictable. |
| **@aws-sdk/client-s3**| **Storage SDK** | The standard library used to upload/download files to R2. |

### **6. Notifications (Mobile & Web Bridge)**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Firebase Admin SDK** | **Push Gateway** | The bridge for cross-platform notifications. It automatically handles **APNs** (iOS), **FCM** (Android), and **Web Push** (Browsers) with a single code call. |
| **Resend** | **Email Service** | API-based transactional email with deliverability tooling and analytics. |

### **7. Security & Validation**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Zod** | **Data Validation** | Validates incoming data shapes (e.g., ensuring `price` is a number) before it touches your SQL. Critical for preventing runtime errors. |
| **Bcryptjs** | **Encryption** | Hashes passwords with salt before storing them, ensuring user security even if the DB is leaked. |
| **JSON Web Token (JWT)**| **Authentication** | Stateless "access badges" that verify a user's identity on every request without needing a database lookup. |
| **Helmet** | **HTTP Security** | Hardens your server by setting secure HTTP headers (protecting against XSS, clickjacking). |

### **8. Utilities**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Multer** | **File Middleware** | Temporarily handles `multipart/form-data` uploads in RAM so they can be streamed to Cloudflare R2. |
| **Morgan** | **Logger** | Logs every HTTP request to the console, essential for debugging development issues. |

### **9. DevOps & Infrastructure**
| Technology | The Job | Why this choice? |
| :--- | :--- | :--- |
| **Docker** | **Containerization** | Packages the App, Postgres, and Valkey into isolated environments that run identically on your laptop and the server. |
| **Docker Compose** | **Orchestration** | Spins up the entire infrastructure (DB, Queue, App) with a single command (`docker-compose up`). |

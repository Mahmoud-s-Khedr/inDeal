# inDeal - B2B Marketplace Platform

**inDeal** is a specialized B2B marketplace designed to connect companies and agents through transparent Auctions and Requests for Quotations (RFQs). It facilitates direct deals, real-time communication, and targeted advertising within the industrial and commercial sectors.

## 🚀 Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express | High-performance API server. |
| **Database** | PostgreSQL | Primary relational database (Raw SQL). |
| **Caching/Queue** | Valkey | Redis alternative for Job Queues & Pub/Sub. |
| **Real-time** | Socket.io | Instant messaging and live updates. |
| **Storage** | Cloudflare R2 | S3-compatible object storage for files. |
| **Notifications** | Firebase (FCM) | Push notifications for mobile & web. |

## 📂 Project Structure

```
inDeal/
├── src/
│   ├── config/         # Database & App Config
│   ├── controllers/    # Request Handlers
│   ├── middlewares/    # Express Middlewares
│   ├── routes/         # API Route definitions (versioned)
│   ├── app.js          # Express App Setup
│   └── server.js       # Entry Point
├── AI_DOCS/            # AI & Project Documentation
│   ├── AI_MEM.md       # Project Context & Memory
│   ├── schema.sql      # Database Schema Definition
│   ├── tech_stack.md   # Technology Choices
│   └── plan.md         # Implementation Roadmap
├── .env                # Environment Variables (Not committed)
├── docker-compose.yml  # Infrastructure Config
└── package.json        # Dependencies
```

## 🛠️ Getting Started

### Prerequisites
*   **Node.js**: v18+
*   **Docker**: For running PostgreSQL and Valkey locally.

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repo-url>
    cd inDeal
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Copy the example environment file (create one if missing):
    ```bash
    cp .env.example .env
    ```
    All environment variables are validated with Zod via `src/config/env.js`. Refer to `.env.example` for the full list, including `LOG_LEVEL`, Redis/Valkey credentials, Cloudflare R2 (S3) settings, Firebase service account keys, and SMTP/email configuration.

4.  **Start the Docker Stack**
    Build the API image and boot the development stack (API + Postgres + Valkey):
    ```bash
    docker compose up --build -d
    ```

5.  **Initialize Database**
    Run the schema script to create tables:
    ```bash
    npm run db:schema
    ```

6.  **Run the Server (Optional, outside Docker)**
    If you prefer running the API directly on your machine:
    ```bash
    npm run dev
    ```

## 🌐 API Routing
- All HTTP endpoints are mounted under `/api/v1` via the routers defined in `src/routes`.
- Health monitoring lives in `src/routes/v1/health.routes.js`, while system metadata/config endpoints are in `src/routes/v1/system.routes.js`.
- Controllers respond through `src/utils/response.js` to keep payloads consistent.

## 🔐 Authentication API
- `POST /api/v1/auth/register` — accepts `{ user, company }` payloads to create an agent user and pending company profile in a single transaction; `company.documents` must reference uploaded file IDs (via `/files/upload-url`) so admins can review supporting paperwork.
- `POST /api/v1/auth/login` — verifies email/password and returns a JWT plus the associated company record.
- Requests are validated with Zod schemas (`src/validations/auth.validation.js`) and responses include `{ token, user, company }`.

## 🏢 Company Portfolio API
- `GET /api/v1/companies/me` — authenticated company profile (contacts, gallery, reviews, rating) for the logged-in agent.
- `PUT /api/v1/companies/me` — update descriptive/contact data; supports JSON `contacts` and `locations`.
- `POST /api/v1/companies/me/gallery` — add gallery entries by referencing existing file IDs.
- `GET /api/v1/companies/:id` — public profile with gallery + reviews; dedicated `/:id/gallery` and `/:id/reviews` endpoints are also available.
- `POST /api/v1/companies/:id/reviews` — authenticated reviewers can rate other companies (1–5 stars) with optional review text.

## 📤 File Uploads (Cloudflare R2)
- `POST /api/v1/files/upload-url` — authenticated agents request a signed `PUT` URL, upload directly to Cloudflare R2, and receive the created `files` row (with its `id`) to reference in subsequent APIs (gallery, avatars, ads, etc.). The signed URL TTL (`R2_SIGNED_URL_TTL_SECONDS`) and max file size cap (`R2_MAX_FILE_SIZE_BYTES`) are configurable via environment variables (defaults: 5 minutes, 20 MB).

## 🐳 Docker Development & Testing
- `docker compose up --build -d` starts the API plus its Postgres and Valkey dependencies.
- Follow logs via `docker compose logs -f api`.
- Execute automated tests inside a disposable container:
  ```bash
  docker compose --profile test run --rm api-tests
  ```
  (The default `npm test` script is a placeholder and will fail until tests are implemented.)

## 📖 Documentation
Detailed documentation is maintained in the `AI_DOCS` directory:
*   [**Architecture & Tech Stack**](AI_DOCS/tech_stack.md)
*   [**Implementation Plan**](AI_DOCS/plan.md)
*   [**Database Schema**](AI_DOCS/schema.sql)

## 🧪 Postman Collection
Import `postman/inDeal.postman_collection.json` to test the Auth and Company APIs locally. Configure the `base_url`, `auth_token`, and `company_id` variables inside Postman before running the requests.

## ⚖️ License
Private Proprietary Software.

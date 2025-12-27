# inDeal: Project Memory
Testing backend base URL: https://api-test.indealeg.com

## 1. Project Overview
**inDeal** is a B2B marketplace platform connecting companies for deals (Auctions/RFQs), facilitating messaging, and allowing advertising.
- **Target Audience**: B2B Agents and Companies.
- **Core Value**: Direct communication, transparent auctions, and agent-centric profiles.

## 2. Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (Raw SQL with `pg` driver)
- **Async/Queue**: Valkey (Redis alternative) + BullMQ
- **Real-time**: Socket.io (with `@socket.io/redis-adapter` via Valkey)
- **Storage**: Cloudflare R2
- **Notifications**: Firebase (FCM/System) + Resend

## 3. Database Status (`schema.sql`)
- **State**: **Finalized** (Refactored with best practices).
- **Key Features**:
    - **Strict Typing**: Uses `ENUM` for all status/type fields (`user_role_enum`, `deal_status_enum`, etc.).
    - **Constraints**: Enforces `agent_id` uniqueness (One Agent per Company).
    - **Safety**: `CHECK (company_a_id < company_b_id)` prevents duplicate Chat Rooms.
    - **Performance**: Full Indexing coverage for Foreign Keys and JSONB columns.

## 4. Current Progress
- [x] Define Tech Stack (`tech_stack.md`)
- [x] Design Database Schema (`schema.sql`)
- [x] Refactor Schema (ENUMs, Indexes, Reviews)
- [x] Create Implementation Plan (`plan.md`)
- [x] Initialize Node.js Project & Infrastructure (Docker, Express, DB Config)
- [x] Harden project initialization (typed env loader, logger, Valkey/S3/Firebase/Resend clients, graceful server bootstrap)
- [x] Establish API routing skeleton (`/api/v1` with health & system endpoints)
- [x] Containerize development & testing (Dockerfile, docker-compose stack with Postgres/Valkey/test profile)
- [x] Implement initial authentication (register/login controllers, Zod validation, repositories, JWT issuance)
- [x] Build Company Portfolio Management APIs (profiles, gallery, reviews)
- [x] Implement direct-to-R2 file upload flow (signed PUT URLs + files table integration)
- [x] Capture company registration documents (stored as `company_documents` linked to uploaded files)
- [x] Instrument detailed HTTP logging (request/response metadata, bodies, auth context) + Postman collection for regression testing
- [x] Replace Nodemailer with Resend (env + mailer config + docs)
- [ ] **Next Step**: Implement Deals module (list/create, bids, reviews linkage)

## 5. Critical Decisions Log
- **No ORM**: We are using **Raw SQL** for maximum control and performance.
- **Localization**: UI localization planned; Schema stores text in single columns (UTF-8) for user content.
- **One Agent Policy**: Strictly enforced at DB level (`companies.agent_id` UNIQUE).

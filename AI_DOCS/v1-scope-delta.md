# V1 Scope Delta (Remove vs Add)

## Remove From V1

Baseline: `AI_DOCS/v1-target.md` only. The items below are currently implemented but outside v1 target scope and are candidates for hard removal from v1.

### 1) Ads module

- What to remove:
  - Public and authenticated ads endpoints under `/api/v1/ads/*`.
  - Admin ad moderation under `/api/v1/admin/ads/*`.
  - Ad analytics/click tracking behaviors.
- API surface affected:
  - `src/routes/v1/ad.routes.js`
  - Ads routes inside `src/routes/v1/admin.routes.js`
- Data model affected:
  - `advertisements`, `ad_analytics_daily`, `ad_click_events` in `AI_DOCS/schema.sql`.

### 2) Notifications and device tokens

- What to remove:
  - Notification read/list/delete endpoints under `/api/v1/notifications/*`.
  - Device token registration endpoints under `/api/v1/users/me/devices*`.
  - Push-notification delivery plumbing (FCM integration and cleanup jobs).
- API surface affected:
  - `src/routes/v1/notification.routes.js`
  - Device endpoints in `src/routes/v1/user.routes.js`
- Data model affected:
  - `notifications` table.
  - `fcm_device_tokens` and related indexes from migrations.

### 3) Admin control plane

- What to remove:
  - Full admin API namespace under `/api/v1/admin/*` (dashboard/moderation/company/deal/ad/ticket controls).
- API surface affected:
  - `src/routes/v1/admin.routes.js`
- Data model affected:
  - No single table removal required just for route deletion, but this also detaches admin-only workflows over company/deal/support/ads.

### 4) Support ticketing and support live chat

- What to remove:
  - Ticket CRUD endpoints under `/api/v1/support/tickets*`.
  - Live support chat endpoints under `/api/v1/support/chat*`.
- API surface affected:
  - `src/routes/v1/support.routes.js` (ticket + support chat portions).
- Data model affected:
  - `support_tickets`, `support_ticket_responses`.
  - Support live chat tables from migrations (`support_chat_rooms`, `support_chat_messages`).

### 5) Out-of-scope auth extras

- What to remove:
  - Admin auth endpoint `/api/v1/auth/admin/login`.
  - Email verification/resend endpoints: `/api/v1/auth/verify-email`, `/api/v1/auth/resend-verification`.
  - Advanced multi-device session controls not required by v1 target.
- API surface affected:
  - `src/routes/v1/auth.routes.js` (admin login + verify/resend endpoints).
- Data model affected:
  - Session table structures used for advanced session management (`user_sessions` and associated indexes).

### 6) Pending-update workflow and multi-agent company model

- What to remove:
  - Company pending-update approval workflow.
  - Multi-agent company assignment model for v1.
- API surface affected:
  - Pending update endpoints in `src/routes/v1/admin.routes.js`.
- Data model affected:
  - `profile_pending_updates` (migration-driven).
  - `company_agents` table (if strict single-agent v1 model is enforced).

### 7) Non-v1 jobs and persistence tied to removed scope

- What to remove:
  - Jobs that exist primarily for removed modules (notification cleanup and related task workers).
  - Supporting persistence for removed operational concerns.
- API surface affected:
  - No direct endpoint, internal job/runtime behavior.
- Data model affected:
  - `audit_logs` and `email_logs` if enforcing strict v1-only persistence footprint.

---

## Add/Update For V1

This section captures v1-target use cases, their current state, and what must be added/updated. Each use case appears once.

### Traceability Matrix (v1 target)

| V1 Area           | V1 Use Case                                  | Current State | Delta Decision                                                                                              |
| ----------------- | -------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| Auth              | Login                                        | Implemented   | Keep as-is for v1                                                                                           |
| Auth              | Company Register                             | Partial       | Add missing registration fields and alignment checks                                                        |
| Auth              | Forget Password                              | Implemented   | Keep as-is for v1                                                                                           |
| Localization      | EN/AR + system-default fallback              | Partial       | Update default-language behavior to follow system language with English fallback                            |
| Company Portfolio | Resend for review                            | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Profile page (settings)                      | Partial       | Ensure returned/updated fields include v1 profile settings contract (including language/theme expectations) |
| Company Portfolio | Company summary                              | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Company gallery                              | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Company certificate                          | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Show company details                         | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Edit details                                 | Partial       | Ensure all v1-editable fields are consistently writable/readable                                            |
| Company Portfolio | Contact info                                 | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Contributions                                | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Contributions media                          | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Project contribution type                    | Partial       | Ensure contributor mentions are stored/served in v1-compatible structure                                    |
| Company Portfolio | Product contribution type                    | Implemented   | Keep as-is for v1                                                                                           |
| Company Portfolio | Partnership contribution type                | Partial       | Add/normalize partner logo + mention semantics                                                              |
| Deals             | Create deal                                  | Partial       | Replace `auction/rfq` with `supply/demand`; add images/files attachments                                    |
| Deals             | Manage my deals                              | Partial       | Add explicit reopen/close workflow parity and keep delete/update/archive semantics coherent                 |
| Deals             | Max deals limits                             | Missing       | Add server-side max-open-deals enforcement                                                                  |
| Deals             | Search a deal                                | Partial       | Add date/time filter and sort by price/date/application count (asc/desc)                                    |
| Deals             | Apply offer for in supply                    | Missing       | Implement full structured supply payload schema                                                             |
| Deals             | Apply offer for in demand                    | Missing       | Implement full structured demand payload schema                                                             |
| Deals             | Apply history + pause/cancel with reason     | Missing       | Add pause/cancel actions and required cancel reason field                                                   |
| Deals             | Request for quotation (RFQ) structure parity | Missing       | Implement RFQ payload using supply-structure contract                                                       |
| Deals             | My requests                                  | Implemented   | Keep listing, extend payload fields/status transitions per new model                                        |
| Customer Support  | Contact us                                   | Implemented   | Keep support info endpoint                                                                                  |
| Customer Support  | Show available support hours                 | Implemented   | Keep support hours in support info response                                                                 |
| Customer Support  | Email support redirect behavior              | Missing       | Replace ticket-centric behavior with email app redirect contract                                            |
| Chats             | Live chat                                    | Implemented   | Keep real-time chat feature for v1                                                                          |

### Required API and DB updates for v1 completion

### A) Deals model alignment

- API updates needed:
  - Revise `/api/v1/deals` create/update payloads to support `supply/demand` and attachments.
  - Revise `/api/v1/deals` search query contract for date/time and sorting options.
- DB updates needed:
  - Change deal type enum/domain from `auction/rfq` to v1 `supply/demand`.
  - Add attachment linkage for deals (join table or JSON reference model).
  - Add open-deal-limit policy source (config or company-level limit field).

### B) Deal request payload alignment

- API updates needed:
  - Replace simple `{ requestDetails, requestOffer }` with structured supply/demand/RFQ schemas.
  - Add request lifecycle endpoints/fields for pause/cancel/cancelReason.
- DB updates needed:
  - Add structured request payload storage (normalized columns and/or JSONB with validated shape).
  - Add pause/cancel status representation and `cancel_reason` storage.

### C) Company contribution parity updates

- API updates needed:
  - Enforce partnership payload/response contract to include partner logo + mention semantics.
- DB updates needed:
  - Add fields/relations needed for partner logo reference if not representable in current details schema.

### D) Support behavior alignment (v1 target)

- API updates needed:
  - Keep `/api/v1/support/info` (contact + hours).
  - Replace ticket endpoints with lightweight email-support redirect contract.
- DB updates needed:
  - Remove support ticket/live-chat tables once ticket/chat support module is dropped from v1.

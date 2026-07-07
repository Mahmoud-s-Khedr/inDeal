# inDeal Admin Dashboard — Implementation Plan

## Background

inDeal is a Node.js/Express B2B marketplace backend. The platform has three user roles
(`agent`, `admin`, `support`) already defined in the database schema and a `requireRoles`
middleware ready to use. However, **admin control-plane APIs were explicitly descoped from
V1** (see `AI_DOCS/v1-scope-delta.md` §3) and have never been built inside the current
codebase. This plan adds a first-class `admin` module that follows the exact same
architectural patterns used by every other module in `src/modules/`, **plus a standalone
single-page UI** that talks directly to those new endpoints.

---

## Goals

1. [x] Expose a dedicated `/api/v1/admin/*` namespace protected exclusively to `ADMIN` (and,
       where relevant, `SUPPORT`) role users.
2. [x] Provide endpoints for five core dashboard areas: Users, Companies, Deals, Analytics
       / Stats, and Email Logs.
3. [x] Reuse existing repositories wherever possible; only add new admin-specific repository
       methods when a feature genuinely requires a new query.
4. [x] Keep zero breaking changes to any existing public or agent-facing API.
5. [x] Ship a lightweight, self-contained frontend SPA inside `admin-ui/` at the project root
       that serves the dashboard visually.

### Current Status

- [x] Phase 1 backend admin module is implemented and mounted.
- [x] Phase 1 SPA is implemented under `admin-ui/` and served by the Express app.
- [x] HTTP contract coverage, swagger coverage, architecture tests, and focused admin tests were run successfully.
- [ ] Database-backed admin integration flows are only partially verified locally because the local `indeal` database was not available during the last test run.
- [ ] Full manual UI validation remains to be completed in a running browser session.

---

## Part A — Backend API

### Architectural Constraints

| Concern           | Decision                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code organisation | New `src/modules/admin/` module; same `controller / service / repository / routes / validation / mappers` sub-structure as all other modules           |
| Authentication    | `protect` middleware (existing) + `requireRoles('admin')` or `requireRoles('admin', 'support')`                                                        |
| Routing           | Register `adminModule.router` at `/admin` inside `src/app/routing/v1.js`                                                                               |
| Validation        | Zod schemas in `src/modules/admin/validation/admin.validation.js`                                                                                      |
| Data access       | Prisma + raw `pg` pool — same dual pattern the codebase already uses                                                                                   |
| Response shape    | `sendResponse()` helper from `src/core/http/response.js`                                                                                               |
| Error handling    | `AppError` + `catchAsync` — same as all other controllers                                                                                              |
| Logging           | Existing `pino`-based logger via `src/shared/utils/logger.js`                                                                                          |
| Swagger           | Annotate all new routes with JSDoc `@swagger` blocks (the project enforces 100% swagger coverage via `scripts/verify-swagger-coverage.js`)             |
| HTTP contracts    | Add contract entries in `src/core/contracts/http/modules/admin.contracts.js` (mirroring the pattern in `auth.contracts.js`, `deal.contracts.js`, etc.) |

### Proposed Backend Module Structure

```
src/modules/admin/
├── index.js                          ← exports { router }
├── routes/
│   └── admin.routes.js
├── controller/
│   ├── user.admin.controller.js
│   ├── company.admin.controller.js
│   ├── deal.admin.controller.js
│   ├── analytics.admin.controller.js
│   └── emailLog.admin.controller.js
├── service/
│   ├── user.admin.service.js
│   ├── company.admin.service.js
│   ├── deal.admin.service.js
│   ├── analytics.admin.service.js
│   └── emailLog.admin.service.js
├── repository/
│   ├── user.admin.repository.js
│   ├── company.admin.repository.js
│   ├── deal.admin.repository.js
│   ├── analytics.admin.repository.js
│   └── emailLog.admin.repository.js
├── validation/
│   └── admin.validation.js
└── mappers/
    └── admin.mappers.js
```

### Proposed API Surface — `/api/v1/admin`

All routes require `protect` + `requireRoles('admin')` unless noted.

#### 1. Users

| Method       | Path                      | Roles          | Description                                                               |
| ------------ | ------------------------- | -------------- | ------------------------------------------------------------------------- |
| [x] `GET`    | `/admin/users`            | admin, support | Paginated list with filters: `role`, `status`, `keyword`, `page`, `limit` |
| [x] `GET`    | `/admin/users/:id`        | admin, support | Full user detail (includes company summary)                               |
| [x] `PATCH`  | `/admin/users/:id/status` | admin          | Change user status (`pending` → `verified` → `suspended`)                 |
| [x] `PATCH`  | `/admin/users/:id/role`   | admin          | Promote/demote user role (`agent` ↔ `support` ↔ `admin`)                  |
| [ ] `DELETE` | `/admin/users/:id`        | admin          | Removed from Phase 1 implementation                                       |

#### 2. Companies

| Method       | Path                          | Roles          | Description                                                                       |
| ------------ | ----------------------------- | -------------- | --------------------------------------------------------------------------------- |
| [x] `GET`    | `/admin/companies`            | admin, support | Paginated list with filters: `status`, `company_type`, `keyword`, `page`, `limit` |
| [x] `GET`    | `/admin/companies/:id`        | admin, support | Full company detail with agent info                                               |
| [x] `PATCH`  | `/admin/companies/:id/status` | admin          | Approve (`active`) / suspend / reject (with `rejectionReason`) a company          |
| [ ] `DELETE` | `/admin/companies/:id`        | admin          | Removed from Phase 1 implementation                                               |

#### 3. Deals

| Method       | Path                      | Roles          | Description                                                                                  |
| ------------ | ------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| [x] `GET`    | `/admin/deals`            | admin, support | Paginated list with filters: `status`, `deal_type`, `company_id`, `keyword`, `page`, `limit` |
| [x] `GET`    | `/admin/deals/:id`        | admin, support | Full deal detail including attachments and request count                                     |
| [x] `PATCH`  | `/admin/deals/:id/status` | admin          | Force-set deal status (`open`, `closed`, `archived`)                                         |
| [ ] `DELETE` | `/admin/deals/:id`        | admin          | Not implemented in Phase 1; deal status mutation is implemented instead                      |

#### 4. Analytics / Stats

| Method    | Path                             | Roles          | Description                                                                        |
| --------- | -------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| [x] `GET` | `/admin/analytics/overview`      | admin, support | Platform-wide counters: total users, companies, deals, deal requests, active chats |
| [x] `GET` | `/admin/analytics/registrations` | admin, support | New user/company registrations over time (`period`: `7d`, `30d`, `90d`)            |
| [x] `GET` | `/admin/analytics/deals`         | admin, support | Deal creation and status distribution over time                                    |
| [x] `GET` | `/admin/analytics/requests`      | admin, support | Deal request volume and status breakdown                                           |

#### 5. Email Logs

| Method    | Path                    | Roles          | Description                                                                     |
| --------- | ----------------------- | -------------- | ------------------------------------------------------------------------------- |
| [x] `GET` | `/admin/email-logs`     | admin, support | Paginated list with filters: `status`, `template`, `recipient`, `page`, `limit` |
| [x] `GET` | `/admin/email-logs/:id` | admin, support | Full log entry detail                                                           |

### Detailed Backend Implementation Steps

**Step 1 — Scaffold the module skeleton** `[x]`

- Create all directories and `src/modules/admin/index.js` that exports `{ router }`.

**Step 2 — Validation schemas (`admin.validation.js`)** `[x]`

- `listUsersSchema`, `userIdParamsSchema`, `updateUserStatusSchema`, `updateUserRoleSchema`
- `listCompaniesSchema`, `companyIdParamsSchema`, `updateCompanyStatusSchema`
- `listDealsSchema`, `dealIdParamsSchema`, `updateDealStatusSchema`
- `analyticsPeriodSchema` (`period` enum: `7d`, `30d`, `90d`)
- `listEmailLogsSchema`, `emailLogIdParamsSchema`

**Step 3 — Repositories** `[x]`

- [x] `user.admin.repository.js`
- [x] `company.admin.repository.js`
- [x] `deal.admin.repository.js`
- [x] `analytics.admin.repository.js`
- [x] `emailLog.admin.repository.js`

**Step 4 — Services** `[x]` — thin orchestration: call repository, enforce business rules (no self-demotion, at-least-one-admin guard), throw `AppError` on violations, return mapped output.

**Step 5 — Controllers** `[x]` — `catchAsync` + `sendResponse`, one function per endpoint.

**Step 6 — Routes (`admin.routes.js`)** `[x]` — `router.use(protect)` + `router.use(requireRoles('admin','support'))` as base; individual write routes narrow further to `requireRoles('admin')`.

**Step 7 — Register in the router** `[x]` — Add `mountRouter(router, '/admin', adminModule.router)` in `src/app/routing/v1.js`.

**Step 8 — HTTP Contracts** `[x]` — Create `src/core/contracts/http/modules/admin.contracts.js` and register it in `src/core/contracts/http/registry.js`.

**Step 9 — Swagger JSDoc** `[x]` — Swagger/contract coverage is passing through the middleware-driven contract system and verification scripts.

**Step 10 — Tests** `[~]` — focused unit and integration tests were added; DB-backed integration coverage is partially blocked locally by missing database.

### Pagination Convention

```json
{
  "status": "success",
  "message": "...",
  "data": {
    "items": [...],
    "pagination": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
  }
}
```

---

## Part B — Admin UI (Frontend SPA)

### Technology Choices

| Concern      | Decision                                         | Rationale                                                                                                                    |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Vite + vanilla JS** (no framework)             | Zero dependency footprint; fast to scaffold; no separate build pipeline needed to integrate with the existing Express server |
| Styling      | **Vanilla CSS** with CSS custom properties       | Full control, no Tailwind compile step, consistent with the project's JS-first philosophy                                    |
| Charts       | **Chart.js** (CDN)                               | Lightweight, zero build config, covers bar/line/doughnut charts for analytics                                                |
| HTTP client  | `fetch` API                                      | Native, no extra dependency                                                                                                  |
| Routing      | Hash-based (`#/users`, `#/companies`, etc.)      | No server config needed; the SPA is served as a static file                                                                  |
| Auth storage | `localStorage` (token key: `indeal_admin_token`) | Simple; the token is already a JWT returned by the existing login endpoint                                                   |

### UI Location

```
admin-ui/
├── index.html          ← Single HTML shell (nav, sidebar, main content mount)
├── index.css           ← Design tokens, layout, component styles
└── app.js              ← All JS: router, API client, page renderers
```

The Express server will serve this directory as static files under `/admin-ui` — one line
added to `src/app/index.js`:

```js
app.use('/admin-ui', express.static(path.join(__dirname, '../../admin-ui')));
```

> The UI can alternatively be deployed as a separate static site (Cloudflare Pages, etc.)
> pointing at the same API. That decision does not affect the file structure.

### Pages / Screens

#### Login (`#/login`)

- [x] Email + password form.
- [x] Calls `POST /api/v1/auth/login`; stores the returned token in `localStorage`.
- [x] On success, reads `role` from `res.body.data.user.role`; redirects to `#/dashboard` if
      role is `admin` or `support`, otherwise shows "Access denied".
- [x] Redirects here automatically if no token is found or any API call returns `401`.

#### Dashboard / Overview (`#/dashboard`) — default route

- [x] Stat cards: Total Users · Total Companies · Total Deals · Total Deal Requests · Active Chats.
- [x] Bar chart — registrations over last 30 days (users + companies on same chart).
- [x] Doughnut chart — deals by status.
- [x] Bar chart — deal requests by status.
- [x] All data sourced from `/admin/analytics/*` endpoints.

#### Users (`#/users`)

- [x] Searchable, filterable table (columns: ID, Name, Email, Role, Status, Joined).
- [x] Filters: role/status selectors.
- [x] Per-row action menu: **Change Status** and **Change Role**.
- [ ] Delete action is not implemented in Phase 1.
- [x] Click row → drawer/modal showing full user detail + linked company.

#### Companies (`#/companies`)

- [x] Searchable table (columns: ID, Name, Type, Industry, Status, Agent, Created).
- [x] Status filter.
- [x] Per-row action menu: **Approve**, **Suspend**, **Reject** (reject uses a prompt-driven reason input in current implementation).
- [x] Click row → drawer showing full company profile fields.

#### Deals (`#/deals`)

- [x] Searchable table (columns: ID, Name, Type, Status, Company, Value, Created).
- [x] Status + type filters.
- [x] Per-row action menu: **Change Status**.
- [ ] Delete action is not implemented in Phase 1.
- [x] Click row → drawer with deal detail + request count badge.

#### Email Logs (`#/email-logs`)

- [x] Read-only table (columns: ID, Recipient, Template, Status, Attempts, Sent At, Created At).
- [x] Status + template filters.
- [x] Click row → modal/drawer showing full log entry (subject, error field if failed).

### Design System (CSS Tokens)

```css
:root {
  /* Palette — dark neutral base with a teal accent */
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  --color-border: #2a2d3e;
  --color-accent: #2dd4bf; /* teal-400 */
  --color-accent-dim: #14b8a6;
  --color-text: #e2e8f0;
  --color-text-muted: #64748b;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #22c55e;

  /* Status badge colours */
  --badge-pending: #854d0e; /* amber-900 */
  --badge-verified: #14532d; /* green-900 */
  --badge-suspended: #7f1d1d; /* red-900 */
  --badge-active: #14532d;
  --badge-open: #1e3a5f; /* blue-900 */
  --badge-closed: #374151;
  --badge-archived: #374151;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

### Layout

```
┌────────────────────────────────────────────┐
│  TOPBAR  (logo · breadcrumb · logout btn)  │
├──────────┬─────────────────────────────────┤
│          │                                 │
│ SIDEBAR  │        MAIN CONTENT             │
│          │  (stat cards / table / charts)  │
│ Dashboard│                                 │
│ Users    │                                 │
│ Companies│                                 │
│ Deals    │                                 │
│ Email    │                                 │
│ Logs     │                                 │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

- Sidebar collapses to icon-only on viewport < 1024 px.
- Tables are horizontally scrollable on mobile.
- Drawers (detail panels) slide in from the right and overlay the content.
- Confirm dialogs are centered modals with a red "Confirm" button.

### JS Architecture (`app.js`)

```
app.js
├── CONFIG               { API_BASE, TOKEN_KEY }
├── api(path, opts)      fetch wrapper: injects Bearer token, parses JSON, throws on non-2xx
├── auth                 { getToken, setToken, clearToken, decodeRole }
├── router               hash-change listener → renders the matching page
├── pages/
│   ├── login()          renders login form, handles submit
│   ├── dashboard()      fetches analytics, renders stat cards + charts
│   ├── users()          fetches + renders user table, wires filters/actions
│   ├── companies()      fetches + renders company table, wires filters/actions
│   ├── deals()          fetches + renders deal table, wires filters/actions
│   └── emailLogs()      fetches + renders email log table
└── components/
    ├── sidebar()        renders nav links, highlights active route
    ├── table(cols, rows, onAction)   generic reusable table renderer
    ├── pagination(meta, onChange)    renders previous/next + page count
    ├── badge(value, map)             status badge helper
    ├── drawer(title, contentHtml)    right-side detail panel
    └── confirm(message, onConfirm)   confirmation modal
```

### Authentication Flow in the UI

```
User visits /admin-ui/
      │
      ▼
Has localStorage token?
 No  → render #/login
 Yes → decode JWT → role is admin/support?
         No  → clear token → render #/login ("Access denied")
         Yes → render #/dashboard
                    │
                    ▼
             Every API call wraps the token
             401 response → clearToken() → redirect #/login
```

### UI Implementation Steps

**Step 1** `[x]` — Create `admin-ui/` directory with `index.html`, `index.css`, `app.js`.

**Step 2** `[x]` — `index.html`: static shell with sidebar nav, topbar, `<main id="app">` mount
point, Chart.js CDN script tag, Inter font from Google Fonts.

**Step 3** `[x]` — `index.css`: CSS tokens (above), layout grid (sidebar + main),
table/card/badge/drawer/modal base styles, dark theme, subtle hover/transition animations.

**Step 4** `[x]` — `app.js` core plumbing: `api()` fetch wrapper, hash router, `auth` helpers.

**Step 5** `[x]` — Login page: form render + submit handler + role guard.

**Step 6** `[x]` — Dashboard page: parallel fetch of all four analytics endpoints, stat cards,
three charts (Chart.js instances stored in a `charts` map so they can be destroyed on
re-render).

**Step 7** `[x]` — Users page: table with search debounce (300 ms), filter badges, pagination,
per-row action menu (status change, role change).

**Step 8** `[x]` — Companies page: same table pattern, status actions include a "Reject" path
that opens a reason-input modal before calling the API.

**Step 9** `[x]` — Deals page: same table pattern, status force-set dropdown.

**Step 10** `[x]` — Email Logs page: read-only table, click-to-detail modal.

**Step 11** `[x]` — Wire `express.static` in the backend to serve `admin-ui/` at `/admin-ui`.

**Step 12** `[~]` — Responsive implementation exists; manual browser verification is still pending.

---

## Security Considerations

| Risk                         | Mitigation                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privilege escalation         | `requireRoles('admin')` is applied per-route server-side; the UI hides write actions for `support` role but the backend is the authoritative guard |
| Self-demotion / orphan admin | Service layer checks that at least one active admin remains before role or status changes                                                          |
| Mass-delete                  | Hard deletes are admin-only; all destructive actions require a confirm dialog in the UI                                                            |
| Audit trail                  | All mutating admin actions are logged with `logger.info` including `actorId`, `targetId`, and the change made                                      |
| Token exposure               | Token is kept in `localStorage`; the admin UI should only be accessed over HTTPS in production                                                     |
| CORS                         | No change needed; admin clients use the same API base URL under the existing CORS config                                                           |

---

## Open Questions

The following decisions should be confirmed before implementation begins.

1. [x] **Admin authentication flow** — Reuse the existing `POST /auth/login`
       (using their `email` + `password`, which already returns role in the JWT)? Or is a
       dedicated `POST /admin/auth/login` endpoint preferred for separation of concerns?

2. [x] **Soft-delete vs. hard-delete** — Phase 1 excludes delete endpoints for
       `users` and `companies`.

3. [x] **Support role scope** — `support` is implemented as read-only across the admin dashboard.

4. [x] **Company approval workflow** — Company status changes now trigger the existing email
       service/template path for admin moderation updates.

5. **Analytics granularity** — Should the time-series endpoints return data bucketed by
   day, week, or expose both via a query param? What is the maximum lookback period?
   Current implementation: day buckets with `7d`, `30d`, `90d`.

6. **Rate limiting** — Should admin routes be exempt from any rate limiting added later,
   or share a stricter per-IP limit?

7. [x] **UI hosting** — The admin UI is currently served by the same Express server as a static
       directory at `/admin-ui`.

---

## Verification Plan

### Automated

```bash
# Backend unit tests
node --test --test-force-exit tests/unit/admin*.test.js

# Backend integration tests
node --test --test-force-exit tests/integration/admin*.test.js

# Swagger coverage (must remain 100%)
node scripts/verify-swagger-coverage.js

# HTTP contract coverage
node scripts/verify-http-contract-coverage.js
```

### Manual (Backend)

- Login as `admin` role user → call each endpoint → confirm `200` responses with correct data shapes.
- Login as `agent` role user → call admin endpoints → confirm `403` responses.
- Login as `support` role user → call write endpoints → confirm `403` responses.
- Confirm existing public and agent-facing endpoints remain unaffected.
- Status: partially automated, but local end-to-end auth-backed execution was skipped when the `indeal` DB was unavailable.

### Manual (UI)

- Open `http://localhost:<port>/admin-ui/` in browser.
- Attempt to navigate without token → redirects to login.
- Login with admin credentials → lands on dashboard with stat cards + charts rendered.
- Login with non-admin credentials → "Access denied" shown.
- Navigate each section: tables load, pagination works, filters narrow results.
- Perform a status change on a user → row badge updates without full page reload.
- Perform a company reject → reason modal appears, submission sends correct payload.
- Delete a deal → confirm dialog appears; confirm → row disappears.
- Resize to mobile viewport → sidebar collapses, tables scroll horizontally.
- Status: still pending manual browser verification.

---

## Files Changed / Created Summary

### New Files — Backend

| File                                                         | Purpose                        |
| ------------------------------------------------------------ | ------------------------------ |
| `src/modules/admin/index.js`                                 | Module entry point             |
| `src/modules/admin/routes/admin.routes.js`                   | All admin route definitions    |
| `src/modules/admin/controller/user.admin.controller.js`      | User CRUD controllers          |
| `src/modules/admin/controller/company.admin.controller.js`   | Company management controllers |
| `src/modules/admin/controller/deal.admin.controller.js`      | Deal management controllers    |
| `src/modules/admin/controller/analytics.admin.controller.js` | Analytics controllers          |
| `src/modules/admin/controller/emailLog.admin.controller.js`  | Email log controllers          |
| `src/modules/admin/service/user.admin.service.js`            | User business logic            |
| `src/modules/admin/service/company.admin.service.js`         | Company business logic         |
| `src/modules/admin/service/deal.admin.service.js`            | Deal business logic            |
| `src/modules/admin/service/analytics.admin.service.js`       | Analytics aggregation          |
| `src/modules/admin/service/emailLog.admin.service.js`        | Email log business logic       |
| `src/modules/admin/repository/user.admin.repository.js`      | User queries                   |
| `src/modules/admin/repository/company.admin.repository.js`   | Company queries                |
| `src/modules/admin/repository/deal.admin.repository.js`      | Deal queries                   |
| `src/modules/admin/repository/analytics.admin.repository.js` | Analytics queries              |
| `src/modules/admin/repository/emailLog.admin.repository.js`  | Email log queries              |
| `src/modules/admin/validation/admin.validation.js`           | All Zod schemas                |
| `src/modules/admin/mappers/admin.mappers.js`                 | Response shape mappers         |
| `src/core/contracts/http/modules/admin.contracts.js`         | HTTP contracts                 |
| `tests/unit/admin/*.test.js`                                 | Unit tests (one per service)   |
| `tests/integration/admin/*.test.js`                          | Integration tests              |

### New Files — Frontend

| File                  | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `admin-ui/index.html` | SPA shell: sidebar nav, topbar, `<main>` mount, CDN tags  |
| `admin-ui/index.css`  | Full design system: tokens, layout, tables, cards, modals |
| `admin-ui/app.js`     | All JS: router, API client, page renderers, components    |

### Modified Files

| File                                  | Change                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| `src/app/routing/v1.js`               | Import and mount `adminModule.router` at `/admin`        |
| `src/core/contracts/http/registry.js` | Register `admin.contracts.js`                            |
| `src/app/index.js`                    | Add `express.static` to serve `admin-ui/` at `/admin-ui` |

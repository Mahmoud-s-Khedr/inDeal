# Deals Flow Backend Review

This document explains the live backend Deals flow implemented under `/api/v1/deals`. It is grounded in the current code in `src/modules/deal`, the shared auth/response/error middleware, the persistence model in `prisma/schema.prisma`, and the Deals migrations:

- `prisma/migrations/20260607043000_deals_alignment_hardening/migration.sql`
- `prisma/migrations/20260614103000_deals_request_contract_alignment/migration.sql`

It describes the actual backend behavior, even where that behavior is broader or more specific than older integration guides.

## 1. High-Level Lifecycle

### Actors

- Public user: can browse and search public deals.
- Authenticated agent with company context: can create/manage owned deals and submit requests.
- Deal owner company: owns the deal and reviews incoming requests.
- Applicant company: submits either a deal-scoped request or a supply-only direct company-to-company request.

### Core states from the live code

- Deal status: `open | closed | archived`
- Request status: `pending | paused | accepted | rejected | canceled`
- Request type: `inSupply | inDemand | direct`

### End-to-end deal lifecycle

1. A signed-in agent with `req.user.company.id` creates a deal through `POST /api/v1/deals`.
2. The backend verifies the company exists and is `active`, validates any attachment `fileId`s, acquires a PostgreSQL advisory transaction lock keyed by company ID, checks the per-company open-deal cap, inserts the deal with `status = open`, replaces deal attachments, commits, then returns the normalized deal DTO.
3. Public users discover deals through `GET /api/v1/deals` or `GET /api/v1/deals/:id`.
4. If `GET /api/v1/deals` receives a valid bearer token, `optionalAuth` adds company context and the search excludes deals owned by the caller’s own company. Without a valid token, the exclusion does not apply.
5. The owner can list, update, close, reopen, or archive their deals via `GET /api/v1/deals/me/deals`, `PUT /api/v1/deals/:id`, and `DELETE /api/v1/deals/:id`.
6. Another active company can submit a deal-scoped request on an `open` deal through `POST /api/v1/deals/:id/requests`. The request becomes `pending`.
7. An active company can also send a direct request not tied to a specific deal through `POST /api/v1/deals/direct-requests`. This also creates a `pending` request.
8. The applicant can review its own outgoing requests through:
   - `GET /api/v1/deals/me/requests` as the canonical outgoing-history endpoint across deal-scoped and direct requests
   - `GET /api/v1/deals/me/applications` as a compatibility alias filtered to deal-scoped `inDemand` requests
9. The applicant can pause or cancel its own request:
   - `PATCH /api/v1/deals/requests/:requestId/pause`
   - `PATCH /api/v1/deals/requests/:requestId/cancel`
   - `DELETE /api/v1/deals/requests/:requestId` as a legacy alias for cancel
10. The deal owner can review incoming requests through `GET /api/v1/deals/:id/requests`.
11. The deal owner can accept or reject only `pending` requests through `PATCH /api/v1/deals/:dealId/requests/:requestId/status`.
12. Accepting or rejecting a request updates only the request status. It does not automatically change the deal status.
13. After status change, the backend triggers a non-blocking email notification to the applicant company email if one exists.
14. Separately, an authenticated company can email a deal owner’s agent through `POST /api/v1/deals/send-email`, provided the sender is not contacting its own deal.

### Important runtime rules

- Authenticated deal routes depend on `req.user.company.id`; if absent, controllers throw `Company context required` with `403`.
- Only `active` companies can create deals or submit requests.
- Public search defaults to `status = open` if the client does not provide a `status` filter.
- Own-company deal exclusion in public search happens only when `optionalAuth` successfully resolves the bearer token.
- Open-deal caps are enforced in service code with `pg_advisory_xact_lock(companyId)` plus an open-deal count check inside a transaction.
- Active request uniqueness is enforced twice:
  - service-level pre-checks using repository lookups
  - DB-level partial unique indexes for active requests
- The active uniqueness window is `pending | paused | accepted`.

## 2. Cross-Cutting API Behavior

### Route mount path

The deals router is mounted at:

- `/api/v1/deals`

This comes from:

- `src/app/routing/index.js` -> `/v1`
- `src/app/routing/v1.js` -> `/deals`

### Success envelope

All successful Deals responses use the shared `sendResponse` helper and return:

```json
{
  "status": "success",
  "message": "Human-readable message",
  "data": {},
  "token": "optional rotated access token"
}
```

Notes:

- `token` is only present when authenticated middleware rotated or preserved `res.locals.accessToken`.
- Response DTO validation may be applied via the HTTP contract registry before the response is sent.

### Error envelope

In production, operational errors return:

```json
{
  "status": "fail|error",
  "message": "Error message"
}
```

Notes:

- `AppError` instances drive the status code and message.
- In development, the error middleware returns a richer payload including `error` and `stack`, so the external error contract is environment-sensitive.

### Authentication model

- `optionalAuth` is used only on `GET /deals`.
  - Invalid or missing tokens are ignored.
  - If a valid token belongs to an agent with a company, the route can exclude the caller’s own company from search results.
- `protect` is used on all authenticated Deals routes.
  - Requires a bearer token.
  - Validates the user still exists.
  - Infers session type from user agent.
  - Verifies the session JTI.
  - May rotate the token if it is near expiry or expired within the allowed rotation path.
  - Attaches `req.user.company` for `agent` users via `companyRepository.findByAgentId`.

### Attachment and file model

- Deals and requests do not upload binary files directly.
- API payloads reference previously created files using `fileId`.
- Attachments are validated through `fileRepository.findByIds`.
- Invalid file references return `400: One or more attachments reference invalid file IDs`.
- Deal attachments are stored in `deal_attachments`.
- Request attachments are stored in `deal_request_attachments`.
- Response attachments are enriched through batched file lookups and `publicUrl` derivation from stored file paths.

### Persistence model

The Deals backend writes to:

- `deals`
- `deal_attachments`
- `deal_requests`
- `deal_request_supply_details`
- `deal_request_demand_details`
- `deal_request_attachments`

Important DB invariants:

- `deal_request_supply_details.request_id` is unique.
- `deal_request_demand_details.request_id` is unique.
- Partial unique index `uq_deal_requests_active_in_supply` prevents more than one active in-supply request per `(deal_id, applicant_company_id)`.
- Partial unique index `uq_deal_requests_active_direct` prevents more than one active direct request per `(applicant_company_id, target_company_id)`.
- The migration also auto-canceled historical duplicate active requests before creating those indexes.

## 3. Endpoint-by-Endpoint Breakdown

---

## GET `/api/v1/deals`

### Endpoint & purpose

Searches public deals. It supports optional authentication so signed-in users do not see their own company’s deals.

### Request payload

- Auth: optional bearer token
- Query:
  - `keyword?: string <= 200`
  - `dealType?: supply | demand`
  - `status?: open | closed | archived`
  - `industry?: agriculture | automotive | banking | construction | education | healthcare | hospitality | manufacturing | retail | technology | telecommunications | transportation | other`
  - `minValue?: number`
  - `maxValue?: number`
  - `createdFrom?: date`
  - `createdTo?: date`
  - `sortBy?: price | date | applications`
  - `sortOrder?: asc | desc`
  - `limit?: 1..100` default `20`
  - `offset?: >= 0` default `0`

### Business logic

- `optionalAuth` tries to resolve the user and their company.
- Controller passes `excludeCompanyId = req.user?.company?.id || null`.
- Service defaults `status` to `open` when omitted.
- Repository queries `deals` joined to `companies`, filtering to `companies.status = 'active'`.
- Keyword search uses PostgreSQL normalized text, Arabic and simple full-text ranking, plus trigram similarity.
- Request counts are joined through a grouped subquery on `deal_requests`.
- Sorting:
  - by relevance when `keyword` is present
  - otherwise by the requested sort column or `created_at`
- After the list query, the service loads all deal attachments for the result set, then resolves each attachment’s file URL.
- A separate `countSearch` query computes `pagination.total`.

### Response payload

Success:

```json
{
  "status": "success",
  "message": "Deals fetched",
  "data": {
    "items": [
      {
        "id": 1,
        "companyId": 5,
        "dealName": "Steel Supply Q3",
        "dealDescription": "Monthly steel supply for Q3",
        "dealValue": 20000,
        "dealType": "supply",
        "status": "open",
        "applicationsCount": 2,
        "createdAt": "ISO date",
        "updatedAt": "ISO date",
        "companyName": "Acme",
        "companyLogo": 12,
        "companyType": "manufacturer",
        "companyIndustry": "manufacturing",
        "companyAddress": "Cairo",
        "companyStatus": "active",
        "attachments": []
      }
    ],
    "pagination": {
      "total": 10,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

Common errors:

- `400` validation errors for malformed query params

---

## GET `/api/v1/deals/:id`

### Endpoint & purpose

Fetches a single deal by ID.

### Request payload

- Params:
  - `id: positive integer`

### Business logic

- Controller calls `dealService.getDealById`.
- Service loads the deal via `dealRepository.findById`.
- Repository joins `companies` and request-count aggregate.
- If not found, service throws `404: Deal not found`.
- Service then loads and enriches attachments.

### Response payload

Success:

- Standard envelope with one normalized deal DTO in `data`

Common errors:

- `404: Deal not found`
- `400` if `id` fails validation

---

## GET `/api/v1/deals/me/deals`

### Endpoint & purpose

Lists deals owned by the authenticated user’s company.

### Request payload

- Auth: required
- Query:
  - `keyword?: string <= 200`
  - `status?: open | closed | archived`
  - `limit?: 1..100` default `50`
  - `offset?: >= 0` default `0`

### Business logic

- Controller requires company context.
- Service calls `dealRepository.findByCompanyId(companyId, filters)` and `countByCompanyId(companyId, filters)`.
- If `status` is omitted, repository excludes `archived`.
- Keyword search uses the same text-search pattern as public deals, but only across owned deals.
- Repository returns rows ordered by relevance or creation date.
- Service enriches attachments for each returned deal.

### Response payload

Success:

- Standard envelope with:
  - `data.items: DealDto[]`
  - `data.pagination`

Common errors:

- `401` when unauthenticated
- `403: Company context required`
- `400` validation errors

---

## POST `/api/v1/deals`

### Endpoint & purpose

Creates a new deal for the authenticated user’s company.

### Request payload

- Auth: required
- Body:
  - `dealName: string 1..100`
  - `dealDescription?: string <= 5000`
  - `dealValue?: positive number`
  - `dealType: supply | demand`
  - `attachments?: [{ fileId, kind, sortOrder }]` max `20`
- Attachment `kind`:
  - `image | file`

### Business logic

- Controller requires company context.
- Service loads the company with `companyRepository.findById`.
- Fails if:
  - company does not exist
  - company status is not `active`
- Validates all attachment `fileId`s exist.
- Opens a DB transaction.
- Acquires `pg_advisory_xact_lock(companyId)`.
- Counts open deals through `dealRepository.countOpenByCompanyId`.
- Enforces `MAX_OPEN_DEALS_PER_COMPANY` from env.
- Inserts into `deals` with:
  - requested fields
  - forced `status = open`
- Replaces deal attachments in `deal_attachments`.
- Commits transaction.
- Enriches attachment URLs and returns the normalized deal.

### Response payload

Success:

- Standard envelope with created deal DTO in `data`

Common errors:

- `403: Company context required`
- `404: Company not found`
- `403: Company must be active to create deals`
- `400: Open deal limit reached (...)`
- `400: One or more attachments reference invalid file IDs`

---

## PUT `/api/v1/deals/:id`

### Endpoint & purpose

Updates a deal owned by the authenticated user’s company.

### Request payload

- Auth: required
- Params:
  - `id: positive integer`
- Body: at least one field required
  - `dealName?: string 1..100`
  - `dealDescription?: string <= 5000`
  - `dealValue?: positive number | null`
  - `dealType?: supply | demand`
  - `status?: open | closed | archived`
  - `attachments?: [{ fileId, kind, sortOrder }]` max `20`

### Business logic

- Loads the deal via `findById`.
- Fails if the deal does not exist or the caller does not own it.
- If `attachments` is present, validates file IDs.
- Starts a DB transaction.
- If transitioning from non-open to `open`, calls `ensureCanTransitionToOpen`:
  - takes advisory lock on company ID
  - recounts open deals
  - blocks reopen if the cap is already reached
- Updates allowed deal fields via `dealRepository.updateById`.
- If `attachments` is provided, `replaceForDeal` deletes all existing deal attachments and inserts the new list.
- Commits and returns the updated normalized deal.

### Response payload

Success:

- Standard envelope with updated deal DTO in `data`

Common errors:

- `404: Deal not found`
- `403: Unauthorized to update this deal`
- `400: Open deal limit reached (...)` when reopening
- `400: One or more attachments reference invalid file IDs`
- `400` validation error when body is empty

Important semantic detail:

- `attachments` omitted means keep existing attachments.
- `attachments: []` means clear all attachments.

---

## DELETE `/api/v1/deals/:id`

### Endpoint & purpose

Archives a deal owned by the authenticated user’s company.

### Request payload

- Auth: required
- Params:
  - `id: positive integer`

### Business logic

- Loads the deal.
- Verifies ownership.
- Calls `dealRepository.archiveDeal`, which updates `status = archived`.
- Loads and returns the archived deal with enriched attachments.

### Response payload

Success:

- Standard envelope with archived deal DTO in `data`

Common errors:

- `404: Deal not found`
- `403: Unauthorized to archive this deal`

---

## GET `/api/v1/deals/me/requests`

### Endpoint & purpose

Lists outgoing requests for the authenticated applicant company across deal-scoped and direct request flows.

### Request payload

- Auth: required
- Query:
  - `keyword?: string <= 200`
  - `status?: pending | paused | accepted | rejected | canceled`
  - `requestType?: direct | inSupply | inDemand`
  - `limit?: 1..100` default `50`
  - `offset?: >= 0` default `0`

### Business logic

- Controller requires company context.
- Service maps filters into repository behavior:
  - no `requestType`: include all outgoing deal-scoped requests and direct requests
  - `requestType = direct`: only direct requests
  - `requestType = inSupply`: only deal-scoped supply requests
  - `requestType = inDemand`: only deal-scoped demand applications
- Repository queries `deal_requests` left-joined to `deals`, owner company, and target company.
- Keyword search includes request summary, cancel reason, deal name, owner company name, and target company name.
- Service enriches:
  - supply details from `deal_request_supply_details`
  - demand details from `deal_request_demand_details`
  - request attachments from `deal_request_attachments`
  - attachment file URLs

### Response payload

Success:

- Standard envelope with:
  - `data.items: DealRequestDto[]`
  - `data.pagination`

Common errors:

- `401` unauthenticated
- `403: Company context required`
- `400` validation errors

---

## GET `/api/v1/deals/me/applications`

### Endpoint & purpose

Lists outgoing deal-scoped `inDemand` requests for the authenticated applicant company as a compatibility alias over the canonical outgoing-history model.

### Request payload

- Auth: required
- Query:
  - `keyword?: string <= 200`
  - `status?: pending | paused | accepted | rejected | canceled`
  - `limit?: 1..100` default `50`
  - `offset?: >= 0` default `0`

### Business logic

- Controller requires company context.
- Service applies compatibility filters:
  - `requestType = inDemand`
  - `includeDirect = false`
- Repository and enrichment path otherwise match `GET /deals/me/requests`.

### Response payload

Success:

- Standard envelope with:
  - `data.items: DealRequestDto[]`
  - `data.pagination`

Common errors:

- `401` unauthenticated
- `403: Company context required`
- `400` validation errors

---

## POST `/api/v1/deals/direct-requests`

### Endpoint & purpose

Creates a direct company-to-company request not tied to a specific deal.

### Request payload

- Auth: required
- Body:
  - `targetCompanyId: positive integer`
  - `supplyDetails: required`
  - `attachments?: [{ fileId, sortOrder }]` max `20`

Structured detail payloads:

- `supplyDetails` includes:
  - `category`: `packing | containers | rawMaterial | industrialEquipment | foodAndBeverage | chemicals | textileAndApparel | electronicsAndComponents | constructionMaterials | services`
  - `supplyType`: `inStock | assembleToOrder | makeToOrder | engineeringToOrder | mixed`
  - `qualityLevel`: `standard | industrialGuide | foodGrade | pharmaceuticalGrade | exportQuality | other`
  - `deliveryMethodPreference`: `supplierDelivers | buyerCollects | thirdParty`
  - pricing, logistics, specifications, certification, packaging, and notes fields

Validation rules:

- `requestKind` is not part of the public request body.
- `requestType` is not part of the public request body.
- `demandDetails` is not allowed.
- Direct requests are supply-only.

### Business logic

- Loads target company and applicant company.
- Fails if:
  - target company does not exist
  - target company is not `active`
  - sender targets its own company
  - applicant company is missing or not `active`
- Checks for an existing active direct request with the same `(applicant_company_id, target_company_id)`.
- Validates attachment file IDs.
- Starts a DB transaction.
- Inserts into `deal_requests` with:
  - `deal_id = null`
  - `target_company_id = payload.targetCompanyId`
  - `request_type = direct`
  - summary text in `request_details`
  - inferred numeric offer in `request_offer`
  - `status = pending`
- Upserts supply details only.
- Replaces request attachments.
- Commits.
- If PostgreSQL raises `23505` on `uq_deal_requests_active_direct`, service maps it to a user-friendly duplicate error.

### Response payload

Success:

- Standard envelope with one enriched `DealRequestDto`

Common errors:

- `404: Target company not found`
- `400: Target company must be active to receive direct requests`
- `400: Cannot send direct request to your own company`
- `403: Your company must be active to submit requests`
- `400: You already have an active direct request for this company`
- `400: One or more attachments reference invalid file IDs`

---

## POST `/api/v1/deals/:id/requests`

### Endpoint & purpose

Creates a deal-scoped request against an `open` deal.

### Request payload

- Auth: required
- Params:
  - `id: deal ID`
- Body:
  - `requestType: inSupply | inDemand`
  - `supplyDetails?` required for `inSupply`
  - `demandDetails?` required for `inDemand`
  - `attachments?: [{ fileId, sortOrder }]` max `20`

Validation rules:

- `requestType` is required.
- `requestType = direct` is rejected by tests and schema.
- `requestType = inSupply` requires `supplyDetails` and forbids `demandDetails`.
- `requestType = inDemand` requires `demandDetails` and forbids `supplyDetails`.
- `requestKind` is not part of the public request body.

Structured detail payloads use the same enum/value contract as `POST /api/v1/deals/direct-requests`.

### Business logic

- Loads the deal.
- Fails if:
  - deal does not exist
  - deal status is not `open`
  - applicant is the same company as the deal owner
- Loads applicant company and requires `active`.
- Checks for an existing active request on `(deal_id, applicant_company_id)`.
- Validates file IDs.
- Starts a DB transaction.
- Inserts into `deal_requests` with:
  - `deal_id = :id`
  - `target_company_id = null`
  - `request_type = payload.requestType`
  - summary text in `request_details`
  - inferred numeric offer in `request_offer`
  - `status = pending`
- Upserts demand details for `inDemand`, else supply details for `inSupply`.
- Replaces request attachments.
- Commits.
- If PostgreSQL raises `23505` on `uq_deal_requests_active_in_supply`, service maps it to `You already have a request on this deal`.
- No owner notification email is sent on request creation.

### Response payload

Success:

- Standard envelope with one enriched `DealRequestDto`

Common errors:

- `404: Deal not found`
- `400: Deal is not open for requests`
- `400: Cannot submit request on your own deal`
- `403: Your company must be active to submit requests`
- `400: You already have a request on this deal`
- `400: One or more attachments reference invalid file IDs`

---

## GET `/api/v1/deals/:id/requests`

### Endpoint & purpose

Lets the deal owner list requests submitted on one deal, along with request stats.

### Request payload

- Auth: required
- Params:
  - `id: deal ID`
- Query:
  - `keyword?: string <= 200`
  - `status?: pending | paused | accepted | rejected | canceled`
  - `limit?: 1..100` default `50`
  - `offset?: >= 0` default `0`

### Business logic

- Loads the deal and verifies ownership.
- Repository loads deal requests joined to applicant company details.
- Default ordering without keyword groups results by status priority:
  - pending
  - paused
  - accepted
  - rejected
  - canceled
- Keyword search switches ordering to relevance score then creation time.
- Service also loads aggregate stats with:
  - counts by status
  - `MIN(request_offer)`
  - `MAX(request_offer)`
  - `AVG(request_offer)`
- Enriches each request with typed details and attachments.

### Response payload

Success:

```json
{
  "status": "success",
  "message": "Deal requests fetched",
  "data": {
    "items": [],
    "pagination": {
      "total": 0,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    },
    "stats": {
      "total": 0,
      "pending": 0,
      "paused": 0,
      "accepted": 0,
      "rejected": 0,
      "canceled": 0,
      "lowestOffer": null,
      "highestOffer": null,
      "averageOffer": null
    }
  }
}
```

Common errors:

- `404: Deal not found`
- `403: Unauthorized to view requests for this deal`

---

## PATCH `/api/v1/deals/:dealId/requests/:requestId/status`

### Endpoint & purpose

Lets the deal owner accept or reject a `pending` request on their deal.

### Request payload

- Auth: required
- Params:
  - `dealId: positive integer`
  - `requestId: positive integer`
- Body:
  - `status: accepted | rejected`

### Business logic

- Loads deal and verifies ownership.
- Loads request by ID.
- Fails if:
  - request does not exist
  - request does not belong to this deal
  - request status is not `pending`
- Updates `deal_requests.status`.
- Does not update the parent deal status.
- Triggers `notifyApplicantOfStatusChange(request, newStatus)` asynchronously.
  - The promise is intentionally not awaited.
  - Errors are logged and do not fail the API response.
- Enriches and returns the updated request.

### Response payload

Success:

- Standard envelope with updated request DTO in `data`

Common errors:

- `404: Deal not found`
- `403: Unauthorized to update requests for this deal`
- `404: Request not found`
- `400: Request does not belong to this deal`
- `400: Request is <status> and cannot be accepted/rejected`

---

## PATCH `/api/v1/deals/requests/:requestId/pause`

### Endpoint & purpose

Lets the applicant pause its own `pending` request.

### Request payload

- Auth: required
- Params:
  - `requestId: positive integer`

### Business logic

- Loads request by ID.
- Verifies `request.applicant_company_id === caller company`.
- Only allows pausing when current status is `pending`.
- Updates:
  - `status = paused`
  - `paused_at = NOW()`
  - `paused_by_company_id = caller company`
  - `updated_at = NOW()`
- Enriches and returns the paused request.

### Response payload

Success:

- Standard envelope with updated request DTO in `data`

Common errors:

- `404: Request not found`
- `403: Unauthorized to pause this request`
- `400: Only pending requests can be paused. Current status: ...`

---

## PATCH `/api/v1/deals/requests/:requestId/cancel`

### Endpoint & purpose

Lets the applicant cancel its own request with a required reason.

### Request payload

- Auth: required
- Params:
  - `requestId: positive integer`
- Body:
  - `cancelReason: string 3..1000`

### Business logic

- Requires a non-empty trimmed `cancelReason`.
- Loads request by ID.
- Verifies applicant ownership.
- Only allows canceling when current status is `pending` or `paused`.
- Updates:
  - `status = canceled`
  - `canceled_at = NOW()`
  - `canceled_by_company_id = caller company`
  - `cancel_reason = trimmed reason`
  - `updated_at = NOW()`
- Enriches and returns the canceled request.

### Response payload

Success:

- Standard envelope with updated request DTO in `data`

Common errors:

- `400: cancelReason is required`
- `404: Request not found`
- `403: Unauthorized to cancel this request`
- `400: Only pending or paused requests can be canceled. Current status: ...`

---

## DELETE `/api/v1/deals/requests/:requestId`

### Endpoint & purpose

Legacy alias for canceling a request.

### Request payload

- Auth: required
- Params:
  - `requestId: positive integer`
- Query or body:
  - `cancelReason: string 3..1000`

### Business logic

- Validation requires `cancelReason` in either query or body.
- Controller extracts the reason from body first, then query.
- Service delegates directly to `cancelRequest`.
- Behavior, status checks, and DB updates are identical to the cancel endpoint.

### Response payload

Success:

- Standard envelope with updated request DTO in `data`

Common errors:

- Same as `PATCH /deals/requests/:requestId/cancel`

---

## POST `/api/v1/deals/send-email`

### Endpoint & purpose

Sends an email to the owner agent of a deal.

### Request payload

- Auth: required
- Body:
  - `dealId: positive integer`
  - `subject: trimmed string 1..200`
  - `message: trimmed string 1..5000`
  - `contactInfo?: trimmed string <= 500`

### Business logic

- Loads the deal.
- Rejects attempts to contact one’s own deal.
- Loads:
  - sender company via `companyRepository.findById`
  - owner company plus agent email via `findByIdWithAgentEmail`
- Fails if sender or owner company is missing, or owner agent email is absent.
- Escapes HTML in subject, message, contact info, sender company name, and deal name.
- Uses `sendMail` to send both text and HTML email content.
- Logs successful delivery metadata.

### Response payload

Success:

- Standard envelope with `data = null`

Common errors:

- `404: Deal not found`
- `400: Cannot send email to your own deal`
- `404: Sender company not found`
- `404: Deal owner company not found`
- `400: Deal owner agent does not have an email configured`

## 4. Architecture Review

### Confirmed implementation characteristics

- The live Deals module includes both direct requests and `send-email`; this is broader than a simple public-deal/request flow.
- Request acceptance/rejection does not mutate the deal status.
- Status-change applicant notifications are asynchronous and non-blocking.
- Request creation does not notify the deal owner.
- Attachment updates are replacement-based, not merge-based.

### Risks and review findings

1. API consistency is now standardized

- Deals list endpoints return structured objects with `items` and `pagination`.
- Owner request listings return `stats` alongside `items` and `pagination`.
- Clients can rely on one list-envelope pattern across the Deals module.

2. Attachment enrichment

- Deal and request list queries batch-load attachment rows efficiently.
- File URL enrichment is batched through `fileRepository.findByIds(...)` rather than one lookup per attachment.
- Remaining performance cost is dominated by the search and listing queries themselves.

3. Query-cost risk

- Deal and request search rely on:
  - text normalization
  - Arabic and simple tsvector ranking
  - trigram similarity
  - grouped request-count subqueries
- These query shapes may become expensive under higher cardinality or wide pagination windows.

4. Environment-sensitive error contract

- Development mode returns stack traces and full error objects.
- Production mode returns the compact operational error envelope.
- External consumers may observe different error shapes across environments.

5. Optional-auth search behavior can change visibility

- Own-company deals are excluded only if `optionalAuth` successfully resolves a valid token.
- Missing or invalid tokens silently fall back to anonymous search behavior.

6. Lifecycle constraints are asymmetric by role

- Owner can only accept/reject `pending`.
- Applicant can only pause `pending`.
- Applicant can only cancel `pending | paused`.
- This is coherent in code, but it should be treated as an explicit product rule because the lifecycle is not symmetric.

7. Open-deal cap is protected in service code, not as a DB constraint

- The cap is enforced with advisory locking plus count checks.
- This is stronger than a naive pre-check and is correct for the current shape, but it remains an application-managed invariant rather than a DB-native constraint.

8. Duplicate-request prevention is defense-in-depth

- Service pre-checks improve UX by returning domain-specific errors early.
- Partial unique indexes are the real concurrency-safe enforcement layer.
- This is a good pattern, but the implementation depends on preserving both layers.

9. Direct request and deal-scoped request flows share one request table

- This keeps the model unified, but clients must reason about nullable deal fields and `requestType`-specific semantics.
- The response DTO surface is therefore broader than any single route’s write contract.

10. Update semantics are easy to misuse

- Because attachment replacement is destructive, clients must send the full desired attachment list whenever they include `attachments` on update.
- Partial attachment patches are not supported.

## 5. Verification Notes

This review reflects the live implementation verified against:

- route inventory and mount path in `src/app/routing/index.js`, `src/app/routing/v1.js`, and `src/modules/deal/routes/deal.routes.js`
- request validation in `src/modules/deal/validation/deal.validation.js`
- shared response and error envelopes in `src/core/http/response.js` and `src/core/middleware/errorMiddleware.js`
- auth behavior in `src/core/middleware/authMiddleware.js` and `src/core/middleware/optionalAuthMiddleware.js`
- service logic in `src/modules/deal/service/deal.service.js`
- repository query behavior in:
  - `src/modules/deal/repository/deal.repository.js`
  - `src/modules/deal/repository/dealRequest.repository.js`
  - `src/modules/deal/repository/dealAttachment.repository.js`
  - `src/modules/deal/repository/dealRequestDetails.repository.js`
- DB model and invariants in:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260607043000_deals_alignment_hardening/migration.sql`
  - `prisma/migrations/20260614103000_deals_request_contract_alignment/migration.sql`
- tests:
  - `tests/unit/deal.request.validation.test.js`
  - `tests/unit/deal.direct-request.service.test.js`
  - `tests/unit/deal.service-open-limit.test.js`

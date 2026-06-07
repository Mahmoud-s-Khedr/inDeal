# Deals Section Review

## Title and review scope

This review covers the backend deals area against the deals section in `AI_DOCS/INDEAL SRS Phase 1-2.pdf` as the primary source of truth. The scope includes `src/modules/deal`, the deals data model in `prisma/schema.prisma`, the HTTP contract registration, and the current test and flow coverage.

This is an `SRS + code risks` review, not a strict compliance checklist only. Findings below include both requirement drift and implementation risks that would affect correctness, maintainability, or release confidence.

## SRS deals summary

From the PDF deals section (`AI_DOCS/INDEAL SRS Phase 1-2.pdf`, extracted lines 318-540), the deals scope requires:

- Deal creation with title, description, images/files, price, and type (`supply` or `demand`).
- Deal management: delete, update, close so nobody can apply, and reopen so people can apply again.
- A max number of open deals per company.
- Public deal search by keyword, industry, price, date/time, and type, with sorting by price, date/time, and number of applies ascending and descending.
- Three applicant flows:
  - apply offer for `in supply`
  - apply offer for `in demand`
  - request for quotation with the same data as the `in supply` offer
- Applicant lifecycle support to see applied requests, pause and cancel a request, and provide a cancel reason.
- “My requests” visibility for requests the company sends.

The SRS also defines specific field-level data capture requirements:

- `in supply` requests include category, quantity, delivery location/date, pricing preferences, incoterms, bulk discount expectation, supply type, technical specifications, logistics/timing, notes, and attachments.
- `in demand` offers include availability, pricing, discount tiers, MOQ, stock/production quantities, lead times, RFQ match fields, commercial terms, notes, and attachments.

## Current implementation summary

### API surface

Current deals routes in `src/modules/deal/routes/deal.routes.js` expose:

- `GET /deals`
- `GET /deals/:id`
- `GET /deals/me/deals`
- `POST /deals`
- `PUT /deals/:id`
- `DELETE /deals/:id`
- `GET /deals/me/requests`
- `GET /deals/me/applications`
- `POST /deals/send-email`
- `POST /deals/direct-requests`
- `POST /deals/:id/requests`
- `GET /deals/:id/requests`
- `PATCH /deals/:dealId/requests/:requestId/status`
- `PATCH /deals/requests/:requestId/pause`
- `PATCH /deals/requests/:requestId/cancel`
- `DELETE /deals/requests/:requestId`

This is broader than the PDF. The live module adds:

- direct company-to-company requests
- split applicant inboxes: `applications` vs `requests`
- structured request detail tables
- deal-owner email contact endpoint

### Service behavior

The service in `src/modules/deal/service/deal.service.js` implements:

- deal creation with active-company gate and open-deal limit enforcement
- deal update, archive, and reopen via status updates
- public deal search with filters and pagination
- deal-scoped requests with request kinds `supply`, `demand`, and `rfq`
- direct requests to a target company
- owner accept/reject of requests
- applicant pause/cancel/withdraw
- outbound email to the deal owner

### Data model

The schema in `prisma/schema.prisma` uses:

- `Deal` with free-form string `deal_type` and `status`
- `DealRequest` with free-form string `request_kind`, `request_type`, and `status`
- separate tables for supply-side request details and demand-side request details
- separate attachment tables for deals and requests

The structure is capable of storing richer request details than the PDF requires, but many of the important business invariants are enforced only in service code, not at the database level.

## Findings by severity

### Critical

No critical findings were identified from this review pass.

### High

#### High: Accepted deals can still receive more requests after moving to `negotiating`

- Severity: High
- Evidence:
  - `createDealRequest` allows requests when deal status is either `open` or `negotiating` in `src/modules/deal/service/deal.service.js:455-462`.
  - accepting a request automatically moves the deal to `negotiating` in `src/modules/deal/service/deal.service.js:668-694`.
  - the SRS only defines explicit requestability around `open`, `close`, and `reopen`; it does not say `negotiating` remains requestable (`AI_DOCS/INDEAL SRS Phase 1-2.pdf` extracted lines 358-361).
- Impact:
  - Once an owner accepts one request, the system still allows additional companies to submit new requests on the same deal.
  - This can create conflicting negotiations and weakens the meaning of the status transition triggered by acceptance.
- Recommendation:
  - Restrict request creation to `open` only, or explicitly define in product requirements that `negotiating` remains requestable.
  - Add unit and integration coverage for requestability by deal status.

#### High: Duplicate-request and open-limit rules are race-prone because they are enforced only in service logic

- Severity: High
- Evidence:
  - open-deal limit is checked before insert in `src/modules/deal/service/deal.service.js:275-317`.
  - duplicate active requests are checked before insert in `src/modules/deal/service/deal.service.js:473-476` and `530-553`.
  - the schema stores statuses and types as strings and does not define database uniqueness for “one active request per applicant/deal” or “one active direct request per applicant/target” in `prisma/schema.prisma:249-280`.
  - `Deal` also has no database-side constraint for max open deals per company in `prisma/schema.prisma:214-233`.
- Impact:
  - Concurrent requests can bypass the application-level pre-checks and create duplicate active requests or exceed the open-deal limit.
  - These are core business invariants; violating them would be hard to repair after the fact.
- Recommendation:
  - Add database constraints or transactional locking for the critical invariants.
  - At minimum, use stronger transaction isolation or explicit row/company locking around open-limit and duplicate-request creation paths.

#### High: The route contract for `POST /deals/:id/requests` accepts `requestType=direct`, but the service silently forces `inSupply`

- Severity: High
- Evidence:
  - `createDealRequestSchema` accepts `requestType` from `['direct', 'inSupply']` in `src/modules/deal/validation/deal.validation.js:193-240`.
  - the unit test explicitly confirms that this schema accepts `requestType: 'direct'` on the deal-scoped endpoint in `tests/unit/deal.request.validation.test.js:108-133`.
  - the service ignores the input and hardcodes `requestType: 'inSupply'` in `src/modules/deal/service/deal.service.js:485-493`.
- Impact:
  - The public contract says one thing while the service does another.
  - Clients can send a payload the validator accepts, yet the backend mutates the meaning of the request without surfacing that mismatch.
- Recommendation:
  - Tighten the schema so `POST /deals/:id/requests` only accepts `inSupply`, or remove `requestType` from that endpoint entirely.
  - Add response-contract tests for endpoint-specific discriminator handling.

### Medium

#### Medium: The implemented request-detail model diverges from the PDF in several material fields

- Severity: Medium
- Evidence:
  - the PDF requires `supply type` values `in stock`, `make to order`, and `either` (`AI_DOCS/INDEAL SRS Phase 1-2.pdf` extracted lines 427-428), while validation allows `inStock`, `assembleToOrder`, `makeToOrder`, and `engineerToOrder` in `src/modules/deal/validation/deal.validation.js:63-64`.
  - the PDF includes `Color / finish` under technical specifications (`AI_DOCS/INDEAL SRS Phase 1-2.pdf` extracted lines 429-434), but that field is not modeled; the test now rejects it in `tests/unit/deal.request.validation.test.js:69-82`.
  - the PDF includes `stock delivery time` for `in demand` offers (`AI_DOCS/INDEAL SRS Phase 1-2.pdf` extracted lines 468-469), but the field is not modeled; the test rejects it in `tests/unit/deal.request.validation.test.js:83-94`.
  - validation also adds values not present in the PDF, such as `qualityLevel=other` and `specsMatchRfq=partial` in `src/modules/deal/validation/deal.validation.js:68-77` and `120-129`.
- Impact:
  - Frontend teams implementing from the PDF will not get a 1:1 payload contract from the backend.
  - Some SRS-required information cannot be persisted, while some backend-only fields have no product approval in the source document.
- Recommendation:
  - Decide whether the backend or the PDF is the intended source for field design.
  - Align the payload model and documentation, then add explicit schema tests for every SRS field and enum.

#### Medium: The current applicant segmentation (`my requests` vs `my applications`) is an implementation invention, not a PDF concept

- Severity: Medium
- Evidence:
  - the SRS only mentions “apply history” and “my requests” in broad terms (`AI_DOCS/INDEAL SRS Phase 1-2.pdf` extracted lines 491-539).
  - the code introduces two separate endpoints, `GET /deals/me/requests` and `GET /deals/me/applications`, in `src/modules/deal/routes/deal.routes.js:55-64`.
  - the segmentation is implemented by mapping `requestKinds ['supply', 'rfq']` into `my requests` and `requestKinds ['demand']` into `my applications` in `src/modules/deal/service/deal.service.js:640-666`.
  - the test suite only verifies the filter wiring, not product correctness, in `tests/unit/deal.direct-request.service.test.js:226-237`.
- Impact:
  - The split is non-obvious and not discoverable from the PDF alone.
  - It increases product drift risk and can confuse consumers about where RFQs, supply offers, and demand offers belong.
- Recommendation:
  - Document the segmentation as an explicit product rule or collapse it into one clearer endpoint/filter model.
  - Add acceptance tests around the intended UX taxonomy.

#### Medium: The live module contains non-SRS extensions that materially expand deals scope

- Severity: Medium
- Evidence:
  - direct requests are exposed via `POST /direct-requests` in `src/modules/deal/routes/deal.routes.js:69-74` and implemented in `src/modules/deal/service/deal.service.js:530-605`.
  - deal-owner email contact is exposed via `POST /send-email` in `src/modules/deal/routes/deal.routes.js:66-67` and implemented in `src/modules/deal/service/deal.service.js:758-853`.
  - these capabilities do not appear in the PDF deals scope extracted from lines 318-540.
- Impact:
  - The backend has moved beyond the approved SRS boundary without a corresponding source-of-truth update.
  - This makes planning, QA, and client implementation harder because the documented module boundary is no longer stable.
- Recommendation:
  - Either promote these features into the product spec or mark them explicitly as post-SRS extensions in maintained docs.

#### Medium: Request creation does not notify the deal owner, despite owner-review workflow expectations

- Severity: Medium
- Evidence:
  - `createDealRequest` persists the request and returns it but sends no owner notification in `src/modules/deal/service/deal.service.js:455-528`.
  - there is an explicit unit test asserting that no email is sent on request creation in `tests/unit/deal.direct-request.service.test.js:313-326`.
  - the owner is only notified indirectly if the applicant uses the separate `send-email` endpoint in `src/modules/deal/service/deal.service.js:758-853`.
- Impact:
  - Incoming requests rely on polling rather than event-driven awareness.
  - That weakens the owner review flow and increases the chance that submitted requests are missed.
- Recommendation:
  - Decide whether new-request notification is required.
  - If yes, add notification on request creation and cover it with service tests.

### Low

#### Low: Test and implementation have already drifted on the deal-owner email template

- Severity: Low
- Evidence:
  - the HTML now says `New message on your deal` in `src/modules/deal/service/deal.service.js:803-844`.
  - the unit test still expects `New Deal Message` in `tests/unit/deal.direct-request.service.test.js:296-311`.
  - the current test run fails on that expectation.
- Impact:
  - This does not break runtime behavior directly, but it reduces trust in the suite and hides real regressions behind noise.
- Recommendation:
  - Update the test to match the intended template, or restore the template copy if the test represents the desired wording.

#### Low: Deals test flow only covers CRUD/search and misses the request lifecycle entirely

- Severity: Low
- Evidence:
  - the scripted deals flow only exercises login, create, get my deals, update, search, and delete in `api_test_scripts/flows/11-deals.flow.js:1-139`.
  - it does not cover apply, pause, cancel, accept, reject, reopen, or direct requests.
- Impact:
  - The most business-sensitive part of the deals module is unrepresented in the highest-level flow coverage.
- Recommendation:
  - Extend the flow or add separate scenario scripts for request lifecycle behavior and status transitions.

## SRS coverage matrix

| Requirement                                                    | Implemented           | Gap / Notes                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------- |
| Create deal with title, description, images/files, price, type | Partially             | Implemented through `POST /deals` with attachments and type; attachments are structured and typed in code, which is acceptable, but only if that contract is documented.                   |
| Delete deal                                                    | Partially             | `DELETE /deals/:id` exists, but behavior is archive-by-status, not physical deletion (`src/modules/deal/routes/deal.routes.js:48-49`, `src/modules/deal/service/deal.service.js:440-452`). |
| Update deal                                                    | Yes                   | `PUT /deals/:id` supports name, description, value, type, status, attachments.                                                                                                             |
| Close deal so nobody can apply                                 | Partially             | Status `closed` exists and request creation rejects non-`open`/`negotiating`, but there is no dedicated close endpoint or explicit close workflow beyond generic update.                   |
| Reopen deal so people can apply again                          | Yes                   | `PUT /deals/:id` can change status back to `open`, with open-limit recheck.                                                                                                                |
| Max open deals per company                                     | Yes, with risk        | Enforced in service code, but not protected against concurrency at the database level.                                                                                                     |
| Search deals by keyword, industry, price, date/time, type      | Yes                   | Implemented via query filters in `searchDealsSchema` and repository search.                                                                                                                |
| Sort by price, date/time, number of applies asc/desc           | Yes                   | Implemented via `sortBy` = `price                                                                                                                                                          | date | applications`and`sortOrder`. |
| Apply offer for `in supply`                                    | Yes, with field drift | Endpoint and data model exist, but some PDF fields/enums differ from the live schema.                                                                                                      |
| Apply offer for `in demand`                                    | Yes, with field drift | Endpoint and data model exist, but some PDF fields are missing or renamed.                                                                                                                 |
| Request for quotation uses same data as in-supply offer        | Mostly                | `rfq` is implemented and reuses the supply-side detail structure.                                                                                                                          |
| Applicant can see applied requests                             | Partially             | Implemented, but split across `my requests` and `my applications`, which is not defined by the PDF.                                                                                        |
| Applicant can pause request                                    | Yes                   | Implemented via `PATCH /deals/requests/:requestId/pause`.                                                                                                                                  |
| Applicant can cancel request and provide reason                | Yes                   | Implemented via `PATCH /deals/requests/:requestId/cancel` and legacy delete alias.                                                                                                         |
| My requests visibility                                         | Partially             | Implemented, but taxonomy and endpoint split differ from the PDF.                                                                                                                          |

## Test coverage assessment

### Deal-focused unit coverage that exists

- Request validation tests:
  - `tests/unit/deal.request.validation.test.js`
  - Covers request detail enum handling, field rejection, requestType validation, direct request schema, and email payload validation.
- Open-deal limit tests:
  - `tests/unit/deal.service-open-limit.test.js`
  - Covers create-blocking at max open deals and reopen behavior.
- Direct request and deal email service tests:
  - `tests/unit/deal.direct-request.service.test.js`
  - Covers direct request creation, duplicate direct request rejection, endpoint segmentation filter wiring, email failure cases, and one assertion about no owner notification on request creation.

### Important behaviors not well covered

- No unit tests were identified for:
  - successful deal-scoped request creation across all request kinds with persisted detail rows
  - owner accept/reject state transitions
  - whether accepting one request should block further applications
  - applicant pause/cancel authorization and invalid transitions
  - archive/close/reopen behavior end to end
  - attachment replacement behavior on deals and requests
  - concurrency-sensitive invariants such as duplicate active requests and max open deals
- `api_test_scripts/flows/11-deals.flow.js` only covers:
  - login
  - create deal
  - get my deals
  - update deal
  - search deals
  - delete/archive deal
- The scripted flow does not cover:
  - request creation
  - request acceptance/rejection
  - pause/cancel/withdraw
  - reopen/close semantics
  - direct requests
  - deal-owner email

### Current test-run noise observed during review

From the current local test run used as evidence:

- unrelated failing test: `tests/unit/auth.debug-otp.test.js`
- failing deals-related test: `tests/unit/deal.direct-request.service.test.js` due to outdated email-template expectation
- repeated Redis connection warnings in the test environment

These failures and warnings reduce the signal quality of the suite and should be cleaned up before relying on it for release gating.

## Recommended next actions

1. Clarify product intent for deal requestability after acceptance:
   - decide whether `negotiating` should accept new requests
   - update service logic and tests accordingly
2. Fix the endpoint contract drift on `POST /deals/:id/requests`:
   - disallow `requestType=direct` at validation level for deal-scoped requests
3. Reconcile the request payload model with the PDF:
   - align field list and enum values, especially `supplyType`, `color/finish`, and `stock delivery time`
4. Move critical invariants closer to the database:
   - protect against duplicate active requests and open-limit races
5. Decide whether direct requests and deal-owner email are in official scope:
   - either update the SRS or mark them as post-SRS extensions in maintained docs
6. Expand tests and scenario coverage:
   - add request lifecycle integration coverage
   - add status-transition coverage for close/reopen/accept/reject
   - fix the current failing email-template assertion

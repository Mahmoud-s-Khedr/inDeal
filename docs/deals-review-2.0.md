# Deals Module Gap Analysis Against SRS

## Scope and Source of Truth

This report compares the current backend implementation of the Deals module against the `Deals` section of the attached SRS only.

- Authoritative requirements source: attached SRS, Deals section.
- Authoritative implementation source: live code in this repository.
- Existing repo markdown docs are not treated as requirements.
- Cross-module logic is included only where it directly changes Deals behavior.

Primary implementation evidence reviewed:

- `src/modules/deal` routes, validation, controller, service, repositories
- `prisma/schema.prisma`
- `src/core/contracts/http/modules/deal.contracts.js`
- deal-focused unit tests in `tests/unit`

## SRS Requirements Baseline

The SRS Deals section requires these capabilities:

1. Create deal with title, description, images/files, price, and type (`supply` or `demand`).
2. Manage my deals: update, delete, close, reopen.
3. Enforce a maximum number of open deals per company.
4. Search deals by keyword, industry, price, date/time, and type, with sorting by price, date/time, and number of applies ascending and descending.
5. Apply on supply deals with the specified supply-side request fields.
6. Apply on demand deals with the specified demand-side offer fields.
7. Support RFQ using the same data as the supply-side request.
8. Show apply history and allow pause and cancel with cancel reason.
9. Show my requests for requests the company sends.

## Findings

### Deviations

#### 1. Supply-side request contract uses different enum values than the SRS for several fields

- Severity: High
- Requirement: `Apply offer for in supply` defines these enum sets:
  - `supply type`: `in stock`, `make to order`, `either`
  - `delivery method preference`: `supplier delivers`, `buyer collects`, `third party`
  - `quality level`: `standard`, `industrial guide`, `food grade`, `pharmaceutical grade`, `export quality`
- Current implementation: The backend requires camelCase enum values instead of the SRS wording.
- Gap type: Deviation
- Evidence:
  - `supplyType`: `inStock | makeToOrder | either`: `src/modules/deal/validation/deal.validation.js:63`
  - `deliveryMethodPreference`: `supplierDelivers | buyerCollects | thirdParty`: `src/modules/deal/validation/deal.validation.js:74-76`
  - `qualityLevel`: `standard | industrialGuide | foodGrade | pharmaceuticalGrade | exportQuality`: `src/modules/deal/validation/deal.validation.js:68-70`
  - Same storage shape is persisted in the supply details table: `prisma/schema.prisma:283-315`
- Impact: A client built directly from the SRS payload vocabulary will not validate against the live backend contract.

#### 2. Demand-side request contract omits SRS availability values and adds a backend-only value

- Severity: High
- Requirement: `Apply offer for in demand` defines `availability type` as `in stock`, `assemble to order`, `make to order`, `engineering to order`, and `mixed`.
- Current implementation: The backend accepts only `inStock`, `makeToOrder`, and `mixed`.
- Gap type: Deviation
- Evidence:
  - Validation enum is `['inStock', 'makeToOrder', 'mixed']`: `src/modules/deal/validation/deal.validation.js:92`
  - Same value is stored as free-form string in the demand details table: `prisma/schema.prisma:317-348`
- Impact: Two SRS values are missing from the API contract, and the accepted values use a different wire format than the SRS.

#### 3. Demand-side RFQ match field uses different values than the SRS

- Severity: Medium
- Requirement: `Apply offer for in demand` defines `specs match RFQ?` as `exact` and `partial`.
- Current implementation: The backend accepts `yes`, `no`, and `partial`.
- Gap type: Deviation
- Evidence:
  - Validation enum is `['yes', 'no', 'partial']`: `src/modules/deal/validation/deal.validation.js:97`
  - Stored field is free-form string `specs_match_rfq`: `prisma/schema.prisma:333`
- Impact: The backend contract does not align with the SRS meaning or values for RFQ match confirmation.

#### 4. “My requests” and “apply history” are split into two backend concepts not defined by the SRS

- Severity: Medium
- Requirement: The SRS defines `Apply history` and `My requests`, but does not split the applicant view into separate request buckets by kind.
- Current implementation: The backend creates two different inboxes:
  - `GET /deals/me/requests` for `supply` and `rfq`, plus direct requests
  - `GET /deals/me/applications` for `demand` requests only
- Gap type: Deviation
- Evidence:
  - Separate routes exist: `src/modules/deal/routes/deal.routes.js:64-73`
  - `getMyRequests` filters to `requestKinds = ['supply', 'rfq']` and may include direct requests: `src/modules/deal/service/deal.service.js:664-678`
  - `getMyApplications` filters to `requestKinds = ['demand']` and `requestType = 'inSupply'`: `src/modules/deal/service/deal.service.js:680-690`
  - Validation supports `requestType` filtering on `my requests`: `src/modules/deal/validation/deal.validation.js:320-337`
- Impact: The SRS describes applicant visibility as functional capability, but the live API imposes backend-specific taxonomy that a spec-driven client would not expect.

### Undocumented Additions

#### 1. Direct company-to-company requests exist outside the SRS deals scope

- Severity: High
- Requirement: The SRS Deals section defines applications against deals plus RFQ, but does not define direct requests to a target company without a deal.
- Current implementation: The backend supports `POST /deals/direct-requests` with its own target company flow.
- Gap type: Undocumented Addition
- Evidence:
  - Direct requests route: `src/modules/deal/routes/deal.routes.js:78-84`
  - Validation requires `targetCompanyId` and `requestType = 'direct'`: `src/modules/deal/validation/deal.validation.js:219-264`
  - Service creates a request with `dealId: null` and `requestType: 'direct'`: `src/modules/deal/service/deal.service.js:550-629`
  - Schema supports nullable `deal_id` plus `target_company_id`: `prisma/schema.prisma:249-280`
- Impact: The live product supports a materially broader deals workflow than the SRS describes.

#### 2. Manual email-to-deal-owner messaging exists as a deals feature

- Severity: Medium
- Requirement: The Deals SRS does not define a manual email messaging flow to the deal owner.
- Current implementation: Authenticated users can send a formatted email to the deal owner through `POST /deals/send-email`.
- Gap type: Undocumented Addition
- Evidence:
  - Route exists: `src/modules/deal/routes/deal.routes.js:75-76`
  - Service sends email using company and agent email lookups: `src/modules/deal/service/deal.service.js:777-872`
  - Validation schema exists for the payload in the module validator: `src/modules/deal/validation/deal.validation.js:358-369`
- Impact: This introduces extra communication behavior and email dependencies not captured in the SRS.

#### 3. Owner-side request statistics are returned with request listings

- Severity: Low
- Requirement: The SRS says companies can see requests on their deals, but does not define aggregate request analytics.
- Current implementation: `getDealRequests` returns per-deal statistics including counts by status and offer aggregates.
- Gap type: Undocumented Addition
- Evidence:
  - Service returns `stats` with totals and low/high/average offer values: `src/modules/deal/service/deal.service.js:640-660`
  - This behavior depends on repository statistics for owner request views: `src/modules/deal/service/deal.service.js:640-643`
- Impact: The API surface includes analytics behavior that clients would not infer from the SRS.

#### 4. Applicant status-change email notifications are automatically sent

- Severity: Low
- Requirement: The Deals SRS requires accepting or rejecting requests, but does not define notification delivery.
- Current implementation: Accepting or rejecting a request triggers a non-blocking email to the applicant if an email exists.
- Gap type: Undocumented Addition
- Evidence:
  - Status update triggers notification: `src/modules/deal/service/deal.service.js:712-717`
  - Email body generation is implemented in `notifyApplicantOfStatusChange`: `src/modules/deal/service/deal.service.js:874-890`
- Impact: The backend performs side effects beyond the SRS flow and introduces email-delivery behavior into request lifecycle changes.

## Coverage Matrix

| SRS Use Case              | Status                     | Notes                                                                                                           |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Create deal               | Implemented                | Supports title, description, value, type, and attachments.                                                      |
| Manage my deals: update   | Implemented                | Supported through `PUT /deals/:id`.                                                                             |
| Manage my deals: delete   | Implemented                | Delete route is implemented as archive behavior by current product decision.                                    |
| Manage my deals: close    | Implemented                | Supported through status update to `closed`.                                                                    |
| Manage my deals: reopen   | Implemented                | Supported through status update to `open`, with open-limit recheck.                                             |
| Max deals limits          | Implemented                | Enforced in service logic during create and reopen.                                                             |
| Search a deal             | Implemented                | Filters and sorts exist for keyword, industry, price, date/time, type, and sort order.                          |
| Apply offer for in supply | Implemented with Deviation | Flow exists, but several enum values differ from the SRS.                                                       |
| Apply offer for in demand | Implemented with Deviation | Flow exists, but availability and RFQ-match enums differ from the SRS.                                          |
| Apply history             | Implemented with Deviation | Supported through `me/requests`, `me/applications`, pause, and cancel, but split taxonomy differs from the SRS. |
| Request for quotation     | Implemented                | RFQ is supported and reuses supply-side details.                                                                |
| My requests               | Implemented with Deviation | Visibility exists, but the API splits request history into backend-specific buckets.                            |

## Key Risks / Notes

- The biggest SRS drift is not missing endpoints; it is contract drift in request payload values and request-history semantics.
- The codebase has already expanded beyond the SRS through direct requests, owner email messaging, and lifecycle notifications.
- Open-deal-limit enforcement is implemented in service logic and guarded with transaction locking during create and reopen, but the SRS does not define whether this rule should also be visible through dedicated status or quota APIs.

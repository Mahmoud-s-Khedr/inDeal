# Mobile Integration Guide: Deals + Applications/Requests

Audience: Mobile engineers (iOS/Android/React Native/Flutter)  
Scope: Deals and Applications/Requests APIs only  
Base URL: `/api/v1`

This guide is aligned with the current backend contracts in:

- `src/modules/deal/routes/deal.routes.js`
- `src/modules/deal/validation/deal.validation.js`
- `src/modules/deal/service/deal.service.js`

---

## 1) Endpoint Matrix

### Public

| Method | Endpoint     | Purpose           |
| ------ | ------------ | ----------------- |
| GET    | `/deals`     | Search/list deals |
| GET    | `/deals/:id` | Get deal details  |

### Authenticated (Company User)

| Method | Endpoint                                    | Purpose                                            |
| ------ | ------------------------------------------- | -------------------------------------------------- |
| GET    | `/deals/me/deals`                           | List my published deals                            |
| POST   | `/deals`                                    | Create a deal                                      |
| PUT    | `/deals/:id`                                | Update my deal                                     |
| DELETE | `/deals/:id`                                | Archive my deal                                    |
| GET    | `/deals/me/applications`                    | List my submitted offers only                      |
| GET    | `/deals/me/requests`                        | List my requests (deal requests + direct requests) |
| POST   | `/deals/direct-requests`                    | Create direct company-to-company request           |
| POST   | `/deals/:id/requests`                       | Submit in-supply request to a deal                 |
| GET    | `/deals/:id/requests`                       | Owner: list requests on my deal                    |
| PATCH  | `/deals/:dealId/requests/:requestId/status` | Owner: accept/reject request                       |
| PATCH  | `/deals/requests/:requestId/pause`          | Applicant: pause own request                       |
| PATCH  | `/deals/requests/:requestId/cancel`         | Applicant: cancel own request                      |
| DELETE | `/deals/requests/:requestId`                | Applicant: withdraw alias (legacy cancel path)     |

---

## 2) Flow Walkthroughs

## 2.1 Deal Owner Flow

1. Discover and inspect deals

- `GET /deals`
- `GET /deals/:id`

2. Create deal

- `POST /deals`
- Requires authenticated company context
- Company must be `active`
- Open-deal limit enforced

3. Manage own deal

- `GET /deals/me/deals`
- `PUT /deals/:id`
- `DELETE /deals/:id` (archive behavior)

4. Review incoming requests

- `GET /deals/:id/requests`

5. Decide request outcome

- `PATCH /deals/:dealId/requests/:requestId/status` with `accepted` or `rejected`
- Accepting a request moves deal status to `negotiating`

## 2.2 Applicant Flow

1. Submit request (two paths)

- In-supply to deal: `POST /deals/:id/requests`
- Direct to company: `POST /deals/direct-requests`

2. Track submitted offers (Applications tab)

- `GET /deals/me/applications`
- Server-side filter: `requestType=inSupply` and `requestKind=demand`

3. Track requests (Requests tab)

- `GET /deals/me/requests`
- Includes:
  - in-supply requests (`requestKind in [supply, rfq]`)
  - direct requests (`requestType=direct`)
- Optional query filter: `requestType=direct|inSupply`

4. Control own request lifecycle

- Pause: `PATCH /deals/requests/:requestId/pause`
- Cancel: `PATCH /deals/requests/:requestId/cancel`
- Withdraw alias: `DELETE /deals/requests/:requestId`

---

## 3) Canonical Payload Contracts

## 3.1 Create Deal

`POST /deals`

```json
{
  "dealName": "Steel Supply Q3",
  "dealDescription": "Monthly steel supply for Q3",
  "dealValue": 20000,
  "dealType": "supply",
  "attachments": [{ "fileId": 123, "kind": "file", "sortOrder": 0 }]
}
```

Rules:

- `dealType`: `supply` | `demand`
- `attachments.kind`: `image` | `file`

## 3.2 Create In-Supply Deal Request

`POST /deals/:id/requests`

```json
{
  "requestKind": "rfq",
  "requestType": "inSupply",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "assembleToOrder",
    "qualityLevel": "other",
    "qualityLevelOtherText": "Aerospace grade"
  },
  "attachments": [{ "fileId": 321, "sortOrder": 0 }]
}
```

Rules:

- Endpoint normalizes `requestType` to `inSupply`
- `requestKind`: `supply` | `demand` | `rfq`
- For `requestKind = demand`: `demandDetails` required, `supplyDetails` forbidden
- For `requestKind = supply|rfq`: `supplyDetails` required, `demandDetails` forbidden

## 3.3 Create Direct Request

`POST /deals/direct-requests`

```json
{
  "targetCompanyId": 45,
  "requestKind": "rfq",
  "requestType": "direct",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "assembleToOrder"
  },
  "attachments": [{ "fileId": 999, "sortOrder": 0 }]
}
```

Rules:

- `requestType` must be `direct`
- `targetCompanyId` required and must reference an active company
- Cannot target own company
- Same requestKind/detail rules as deal-scoped requests

---

## 4) Enums and Validation Rules

### 4.1 Supply Type

Allowed:

- `inStock`
- `assembleToOrder`
- `makeToOrder`
- `engineerToOrder`

### 4.2 Quality Level

Allowed:

- `standard`
- `industrialGuide`
- `foodGrade`
- `pharmaceuticalGrade`
- `exportQuality`
- `other`

Conditional rule:

- If `qualityLevel = other` -> `qualityLevelOtherText` is required
- If `qualityLevel != other` -> `qualityLevelOtherText` must not be provided

### 4.3 Removed/Rejected Fields

Do not send these fields in request details:

- `stockDeliveryTime`
- `colorFinish`

---

## 5) Response Shape Mapping (Mobile Models)

## 5.1 Deal Object (`GET /deals`, `GET /deals/:id`, `GET /deals/me/deals`)

```json
{
  "id": 10,
  "companyId": 5,
  "dealName": "Steel Supply Q3",
  "dealDescription": "Monthly steel supply",
  "dealValue": 20000,
  "dealType": "supply",
  "status": "open",
  "applicationsCount": 3,
  "createdAt": "2026-05-06T12:00:00.000Z",
  "updatedAt": "2026-05-06T12:30:00.000Z",
  "companyName": "Acme Metals",
  "companyLogo": "https://...",
  "companyType": "manufacturer",
  "companyIndustry": "manufacturing",
  "companyAddress": "...",
  "companyStatus": "active",
  "attachments": []
}
```

## 5.2 Request Object (`/deals/me/*`, `/deals/:id/requests`)

```json
{
  "id": 77,
  "dealId": 10,
  "applicantCompanyId": 8,
  "requestKind": "rfq",
  "requestType": "inSupply",
  "requestDetails": "Supply request: Steel coils",
  "requestOffer": 1750,
  "status": "pending",
  "createdAt": "2026-05-06T13:00:00.000Z",
  "updatedAt": "2026-05-06T13:00:00.000Z",
  "dealName": "Steel Supply Q3",
  "dealOwnerCompanyId": 5,
  "ownerCompanyName": "Acme Metals",
  "targetCompanyId": null,
  "targetCompanyName": null,
  "supplyDetails": null,
  "demandDetails": null,
  "attachments": []
}
```

For direct requests, `dealId` and deal-derived fields may be `null`, and `targetCompany*` fields are populated.

Owner-list response (`GET /deals/:id/requests`) data shape:

```json
{
  "requests": ["...request objects..."],
  "stats": {
    "total": 10,
    "pending": 4,
    "paused": 1,
    "accepted": 2,
    "rejected": 2,
    "canceled": 1,
    "lowestOffer": 1200,
    "highestOffer": 2400,
    "averageOffer": 1800
  }
}
```

---

## 6) Behavior Rules and Edge Cases

- One active in-supply request per applicant company per deal is enforced (`pending|paused|accepted`).
- One active direct request per applicant company/target company pair is enforced (`pending|paused|accepted`).
- In-supply request creation rejected for:
  - own deal application
  - non-requestable deal status (`open` or `negotiating` required)
  - inactive applicant company
- Direct request creation rejected for:
  - self-targeting
  - inactive/missing target company
  - inactive applicant company
- Status transitions:
  - Owner can accept/reject only when request is `pending`
  - Applicant can pause only when request is `pending`
  - Applicant can cancel only when request is `pending` or `paused`

---

## 7) Error Handling Matrix

| HTTP | Typical Backend Message                                                                     | When It Happens                           | Mobile Action                              |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| 400  | `Deal is not open for requests`                                                             | Applying to non-requestable deal          | Refresh deal details; disable apply button |
| 400  | `You already have a request on this deal`                                                   | Duplicate active in-supply request        | Redirect to existing request/list          |
| 400  | `You already have an active direct request for this company`                                | Duplicate direct request                  | Redirect to existing request/list          |
| 400  | `Target company must be active to receive direct requests`                                  | Direct target not active                  | Disable direct action and show reason      |
| 400  | `Request is ... and cannot be accepted/rejected`                                            | Invalid owner transition                  | Refresh list/status controls               |
| 400  | `Only pending requests can be paused...`                                                    | Invalid pause transition                  | Refresh request state; hide pause          |
| 400  | `Only pending or paused requests can be canceled...`                                        | Invalid cancel transition                 | Refresh request state; hide cancel         |
| 400  | `Validation Error: ...`                                                                     | Payload/schema issue                      | Map to field-level errors                  |
| 403  | `Unauthorized ...` / `Company context required`                                             | Wrong actor/company or no company context | Re-check role/company context              |
| 403  | `Company must be active to create deals` / `Your company must be active to submit requests` | Company status constraint                 | Show blocking status message               |
| 404  | `Deal not found` / `Request not found` / `Target company not found`                         | Stale/missing resource                    | Refresh list and navigate back             |

---

## 8) HTTP Integration Examples

## 8.1 Search Deals

```http
GET /api/v1/deals?status=open&dealType=supply&limit=20&offset=0
Authorization: Bearer <token>
```

## 8.2 Create In-Supply Request

```http
POST /api/v1/deals/10/requests
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "requestKind": "rfq",
  "requestType": "inSupply",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder"
  }
}
```

## 8.3 Create Direct Request

```http
POST /api/v1/deals/direct-requests
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "targetCompanyId": 45,
  "requestKind": "rfq",
  "requestType": "direct",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder"
  }
}
```

## 8.4 List My Applications

```http
GET /api/v1/deals/me/applications?status=pending&limit=20&offset=0
Authorization: Bearer <token>
```

## 8.5 List My Requests (direct only)

```http
GET /api/v1/deals/me/requests?requestType=direct&limit=20&offset=0
Authorization: Bearer <token>
```

## 8.6 Accept Request (Owner)

```http
PATCH /api/v1/deals/10/requests/77/status
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "status": "accepted" }
```

## 8.7 Cancel Request (Applicant)

```http
PATCH /api/v1/deals/requests/77/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "cancelReason": "Pricing no longer valid" }
```

---

## 9) Delta from Archived Guide (Important)

Do **not** use `AI_DOCS/archive/deals_integration_guide.md` as source of truth for mobile implementation. Key changes:

- New split endpoints:
  - `/deals/me/applications` (offers only)
  - `/deals/me/requests` (requests + direct)
- New direct endpoint:
  - `/deals/direct-requests`
- `requestType` discriminator enforced by endpoint semantics (`direct` vs `inSupply`)
- Structured request details enforced (`supplyDetails`/`demandDetails`) by `requestKind`
- Enum updates:
  - `supplyType` includes `assembleToOrder` and `engineerToOrder`
  - `qualityLevel` includes `other` with conditional `qualityLevelOtherText`
- Removed fields rejected: `stockDeliveryTime`, `colorFinish`
- Request lifecycle statuses include `paused` and `canceled` (not legacy `withdrawn`)

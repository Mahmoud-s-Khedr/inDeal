# Mobile Integration Guide: Deals + Applications/Requests

Audience: Mobile engineers (iOS/Android/React Native/Flutter)  
Scope: Deals and Applications/Requests APIs only  
Base URL: `/api/v1`

---

## 1) Endpoint Matrix

### Public

| Method | Endpoint     | Purpose                                                   |
| ------ | ------------ | --------------------------------------------------------- |
| GET    | `/deals`     | Search/list deals; optional auth hides caller-owned deals |
| GET    | `/deals/:id` | Get one deal                                              |

### Authenticated (Company User)

| Method | Endpoint                                    | Purpose                                     |
| ------ | ------------------------------------------- | ------------------------------------------- |
| GET    | `/deals/me/deals`                           | List my deals; archived excluded by default |
| POST   | `/deals`                                    | Create deal                                 |
| PUT    | `/deals/:id`                                | Update own deal                             |
| DELETE | `/deals/:id`                                | Archive own deal                            |
| GET    | `/deals/me/applications`                    | List submitted in-supply demand offers      |
| GET    | `/deals/me/requests`                        | List submitted requests and direct requests |
| POST   | `/deals/direct-requests`                    | Create direct company-to-company request    |
| POST   | `/deals/send-email`                         | Send email to a deal owner                  |
| POST   | `/deals/:id/requests`                       | Create deal-scoped in-supply request        |
| GET    | `/deals/:id/requests`                       | Owner: list requests on my deal             |
| PATCH  | `/deals/:dealId/requests/:requestId/status` | Owner: accept or reject request             |
| PATCH  | `/deals/requests/:requestId/pause`          | Applicant: pause own request                |
| PATCH  | `/deals/requests/:requestId/cancel`         | Applicant: cancel own request               |
| DELETE | `/deals/requests/:requestId`                | Applicant: withdraw alias for cancel        |

---

## 2) Shared Response Envelope

All successful deals APIs return:

```json
{
  "status": "success",
  "message": "Human readable success message",
  "data": {}
}
```

Notes:

- `status` is always `success` on success responses.
- `message` varies by endpoint.
- `data` holds the endpoint payload and may be an object, array, or `null`.
- `token` is only included when middleware sets `res.locals.accessToken`; deals APIs should not assume it is present.

---

## 3) Shared DTOs

### 3.1 DealAttachmentDto

```json
{
  "id": 401,
  "fileId": 123,
  "kind": "file",
  "sortOrder": 0,
  "createdAt": "2026-06-07T10:00:00.000Z",
  "fileUrl": "https://cdn.example.com/files/123.pdf"
}
```

Fields:

- `id`: number
- `fileId`: number
- `kind`: `image | file`
- `sortOrder`: number
- `createdAt`: ISO datetime
- `fileUrl`: string or `null`

### 3.2 RequestAttachmentDto

```json
{
  "id": 901,
  "fileId": 321,
  "sortOrder": 0,
  "createdAt": "2026-06-07T10:05:00.000Z",
  "fileUrl": "https://cdn.example.com/files/321.pdf"
}
```

Fields:

- `id`: number
- `fileId`: number
- `sortOrder`: number
- `createdAt`: ISO datetime
- `fileUrl`: string or `null`

### 3.3 SupplyDetailsDto

```json
{
  "productServiceName": "Steel coils",
  "category": "rawMaterial",
  "quantityRequired": 500,
  "deliveryLocation": "Alexandria, Egypt",
  "deliveryDate": "2026-07-01T00:00:00.000Z",
  "targetPrice": 1500,
  "currency": "USD",
  "paymentTermsPreference": "30% advance, balance on delivery",
  "incoterm": "FOB",
  "bulkDiscountExpectation": "Volume-based pricing preferred",
  "supplyType": "makeToOrder",
  "keySpecifications": "Galvanized, 0.8mm",
  "material": "Carbon steel",
  "dimensionsSize": "1250mm x coil",
  "certificationsRequired": "ISO 9001",
  "qualityLevel": "industrialGuide",
  "maxLeadTimeAccepted": "21 days",
  "deliveryMethodPreference": "supplierDelivers",
  "packagingRequirements": "Export-safe wrapping",
  "specialConditionsNotes": "Inspection certificate required"
}
```

Key enums:

- `category`: `packing | containers | rawMaterial | industrialEquipment | foodAndBeverage | chemicals | textileAndApparel | electronicsAndComponents | constructionMaterials | services`
- `incoterm`: `EXW | CIF | FOB | DAP | DDP`
- `supplyType`: `inStock | assembleToOrder | makeToOrder | engineeringToOrder | mixed`
- `qualityLevel`: `standard | industrialGuide | foodGrade | pharmaceuticalGrade | exportQuality | other`
- `deliveryMethodPreference`: `supplierDelivers | buyerCollects | thirdParty`

### 3.4 DemandDetailsDto

```json
{
  "productServiceName": "Plastic caps",
  "availableQuantity": 10000,
  "offerValidityDays": 30,
  "unitPrice": 0.18,
  "currency": "USD",
  "totalPrice": 1800,
  "volumeDiscountTiers": ["5000+: 3%", "10000+: 5%"],
  "moq": 1000,
  "availabilityType": "mixed",
  "quantityInStock": 4000,
  "maxProduceQuantity": 12000,
  "productionLeadTime": "14 days",
  "specsMatchRfq": "partial",
  "differencesFromRfq": "Cap liner differs from requested brand",
  "materialOffered": "HDPE",
  "dimensions": "28mm",
  "certificationsHeld": "FDA",
  "paymentTerms": "Net 30",
  "deliveryTerms": "DAP",
  "warrantyPolicy": "Replacement for defects within 15 days",
  "returnPolicy": "Returns accepted within 15 days",
  "exclusivityConfidentiality": "Quote confidential for 30 days",
  "additionalNotes": "Sample available on request"
}
```

Key enums:

- `availabilityType`: `inStock | assembleToOrder | makeToOrder | engineeringToOrder | mixed`
- `specsMatchRfq`: `exact | partial`
- `deliveryTerms`: `EXW | CIF | FOB | DAP | DDP`

### 3.5 DealDto

```json
{
  "id": 10,
  "companyId": 5,
  "dealName": "Steel Supply Q3",
  "dealDescription": "Monthly steel supply for Q3",
  "dealValue": 20000,
  "dealType": "supply",
  "status": "open",
  "applicationsCount": 3,
  "createdAt": "2026-06-07T10:00:00.000Z",
  "updatedAt": "2026-06-07T10:30:00.000Z",
  "companyName": "Acme Metals",
  "companyLogo": "https://cdn.example.com/logo/acme.png",
  "companyType": "manufacturer",
  "companyIndustry": "manufacturing",
  "companyAddress": "6th of October, Egypt",
  "companyStatus": "active",
  "attachments": []
}
```

Notes:

- `dealValue` may be `null`
- `status`: `open | closed | archived`
- `attachments`: `DealAttachmentDto[]`

### 3.6 DealRequestDto

```json
{
  "id": 77,
  "dealId": 10,
  "applicantCompanyId": 8,
  "requestType": "inSupply",
  "requestDetails": "Supply request: Steel coils",
  "requestOffer": 1500,
  "status": "pending",
  "canceledAt": null,
  "canceledByCompanyId": null,
  "cancelReason": null,
  "pausedAt": null,
  "pausedByCompanyId": null,
  "createdAt": "2026-06-07T11:00:00.000Z",
  "updatedAt": "2026-06-07T11:00:00.000Z",
  "dealName": "Steel Supply Q3",
  "dealOwnerCompanyId": 5,
  "applicantCompanyName": "Delta Trading",
  "applicantCompanyLogo": "https://cdn.example.com/logo/delta.png",
  "applicantCompanyType": "trader",
  "applicantIndustry": "retail",
  "dealType": "supply",
  "dealValue": 20000,
  "dealStatus": "open",
  "ownerCompanyName": "Acme Metals",
  "targetCompanyId": null,
  "targetCompanyName": null,
  "targetCompanyLogo": null,
  "targetCompanyType": null,
  "targetCompanyIndustry": null,
  "supplyDetails": null,
  "demandDetails": null,
  "attachments": []
}
```

Notes:

- `requestType`: `inSupply | inDemand | direct`
- `status`: `pending | paused | accepted | rejected | canceled`
- direct requests may have `dealId`, `dealName`, `dealOwnerCompanyId`, `dealType`, `dealValue`, and `dealStatus` as `null`
- `supplyDetails`: `SupplyDetailsDto | null`
- `demandDetails`: `DemandDetailsDto | null`
- `attachments`: `RequestAttachmentDto[]`

### 3.7 PaginationDto

```json
{
  "total": 54,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### 3.8 DealRequestStatsDto

```json
{
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
```

### 3.9 ErrorResponseDto

Representative error shape:

```json
{
  "status": "error",
  "message": "Deal not found"
}
```

Notes:

- Validation errors may use a validation-specific message string.
- Some error middleware may add extra metadata; mobile should reliably depend on `status` and `message`.

---

## 4) Endpoint Contracts

## 4.1 GET `/deals`

Purpose: Search public deals. Optional auth context excludes deals owned by the caller's company.  
Auth: Optional

### Path Params DTO

None.

### Query DTO

```json
{
  "keyword": "steel",
  "dealType": "supply",
  "status": "open",
  "industry": "manufacturing",
  "minValue": 1000,
  "maxValue": 50000,
  "createdFrom": "2026-06-01T00:00:00.000Z",
  "createdTo": "2026-06-30T23:59:59.000Z",
  "sortBy": "date",
  "sortOrder": "desc",
  "limit": 20,
  "offset": 0
}
```

Optional fields:

- `keyword`: string
- `dealType`: `supply | demand`
- `status`: `open | closed | archived`
- `industry`: `agriculture | automotive | banking | construction | education | healthcare | hospitality | manufacturing | retail | technology | telecommunications | transportation | other`
- `minValue`: number
- `maxValue`: number
- `createdFrom`: date
- `createdTo`: date
- `sortBy`: `price | date | applications`
- `sortOrder`: `asc | desc`
- `limit`: number, default `20`, max `100`
- `offset`: number, default `0`

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deals fetched",
  "data": {
    "deals": ["DealDto"],
    "pagination": "PaginationDto"
  }
}
```

### Data DTO

```json
{
  "deals": ["DealDto"],
  "pagination": "PaginationDto"
}
```

### Sample Request

```http
GET /api/v1/deals?keyword=steel&dealType=supply&limit=2&offset=0
Authorization: Bearer <token>
```

Notes:

- If `status` is omitted, service defaults search to `open`.
- Signed-in users should not see their own company's deals in results.

## 4.2 GET `/deals/:id`

Purpose: Fetch one deal.  
Auth: Public

### Path Params DTO

```json
{
  "id": 10
}
```

### Query DTO

None.

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deal details fetched",
  "data": "DealDto"
}
```

### Data DTO

`DealDto`

### Sample Request

```http
GET /api/v1/deals/10
```

## 4.3 GET `/deals/me/deals`

Purpose: List owned deals.  
Auth: Required

### Path Params DTO

None.

### Query DTO

```json
{
  "keyword": "steel",
  "status": "open",
  "limit": 50,
  "offset": 0
}
```

Optional fields:

- `keyword`: string
- `status`: `open | closed | archived`
- `limit`: number, default `50`, max `100`
- `offset`: number, default `0`

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "My deals fetched",
  "data": ["DealDto"]
}
```

### Data DTO

`DealDto[]`

### Sample Request

```http
GET /api/v1/deals/me/deals?limit=20&offset=0
Authorization: Bearer <token>
```

Notes:

- If `status` is omitted, archived deals are excluded by default.
- `status=archived` returns archived-only results.

## 4.4 POST `/deals`

Purpose: Create a new deal.  
Auth: Required

### Path Params DTO

None.

### Query DTO

None.

### Request Body DTO

```json
{
  "dealName": "Steel Supply Q3",
  "dealDescription": "Monthly steel supply for Q3",
  "dealValue": 20000,
  "dealType": "supply",
  "attachments": [
    {
      "fileId": 123,
      "kind": "file",
      "sortOrder": 0
    }
  ]
}
```

Fields:

- `dealName`: string, required, max `100`
- `dealDescription`: string, optional, max `5000`
- `dealValue`: positive number, optional
- `dealType`: `supply | demand`
- `attachments`: optional array, max `20`

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deal created successfully",
  "data": "DealDto"
}
```

### Data DTO

`DealDto`

### Sample Request

```http
POST /api/v1/deals
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "dealName": "Steel Supply Q3",
  "dealDescription": "Monthly steel supply for Q3",
  "dealValue": 20000,
  "dealType": "supply",
  "attachments": [
    {
      "fileId": 123,
      "kind": "file",
      "sortOrder": 0
    }
  ]
}
```

Notes:

- Created deals start with `status = open`.
- Company must be active.
- Open-deal limit is enforced.

## 4.5 PUT `/deals/:id`

Purpose: Update one owned deal.  
Auth: Required

### Path Params DTO

```json
{
  "id": 10
}
```

### Query DTO

None.

### Request Body DTO

```json
{
  "dealDescription": "Updated supply scope for Q3",
  "dealValue": 22000,
  "status": "closed",
  "attachments": [
    {
      "fileId": 123,
      "kind": "file",
      "sortOrder": 0
    }
  ]
}
```

Allowed fields:

- `dealName`: string
- `dealDescription`: string
- `dealValue`: positive number or `null`
- `dealType`: `supply | demand`
- `status`: `open | closed | archived`
- `attachments`: array of attachment inputs

At least one field is required.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deal updated successfully",
  "data": "DealDto"
}
```

### Data DTO

`DealDto`

### Sample Request

```http
PUT /api/v1/deals/10
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "dealDescription": "Updated supply scope for Q3",
  "dealValue": 22000,
  "status": "closed"
}
```

Notes:

- Reopening to `open` is subject to the company open-deal limit.
- Only the owning company can update the deal.

## 4.6 DELETE `/deals/:id`

Purpose: Archive one owned deal.  
Auth: Required

### Path Params DTO

```json
{
  "id": 10
}
```

### Query DTO

None.

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deal archived successfully",
  "data": "DealDto"
}
```

### Data DTO

`DealDto`

### Sample Request

```http
DELETE /api/v1/deals/10
Authorization: Bearer <token>
```

## 4.7 GET `/deals/me/applications`

Purpose: List submitted demand offers only.  
Auth: Required

### Path Params DTO

None.

### Query DTO

```json
{
  "keyword": "caps",
  "status": "pending",
  "limit": 50,
  "offset": 0
}
```

Optional fields:

- `keyword`: string
- `status`: `pending | paused | accepted | rejected | canceled`
- `limit`: number, default `50`, max `100`
- `offset`: number, default `0`

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "My applications fetched",
  "data": ["DealRequestDto"]
}
```

### Data DTO

`DealRequestDto[]`

### Sample Request

```http
GET /api/v1/deals/me/applications?status=pending&limit=20&offset=0
Authorization: Bearer <token>
```

Notes:

- This endpoint is already server-filtered to deal-scoped `requestType=inDemand`.

## 4.8 GET `/deals/me/requests`

Purpose: List submitted request records plus direct requests.  
Auth: Required

### Path Params DTO

None.

### Query DTO

```json
{
  "keyword": "steel",
  "status": "pending",
  "requestType": "direct",
  "limit": 50,
  "offset": 0
}
```

Optional fields:

- `keyword`: string
- `status`: `pending | paused | accepted | rejected | canceled`
- `requestType`: `direct | inSupply | inDemand`
- `limit`: number, default `50`, max `100`
- `offset`: number, default `0`

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "My requests fetched",
  "data": ["DealRequestDto"]
}
```

### Data DTO

`DealRequestDto[]`

### Sample Request

```http
GET /api/v1/deals/me/requests?requestType=direct&limit=20&offset=0
Authorization: Bearer <token>
```

Notes:

- Without `requestType`, this endpoint includes deal requests plus direct requests.
- With `requestType=inSupply`, this endpoint returns deal-scoped supply requests only.
- With `requestType=inDemand`, this endpoint returns deal-scoped demand applications only.

## 4.9 POST `/deals/direct-requests`

Purpose: Create a direct request to another company.  
Auth: Required

### Path Params DTO

None.

### Query DTO

None.

### Request Body DTO

```json
{
  "targetCompanyId": 45,
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder",
    "targetPrice": 1500
  },
  "attachments": [
    {
      "fileId": 321,
      "sortOrder": 0
    }
  ]
}
```

Fields:

- `targetCompanyId`: positive number, required
- `supplyDetails`: required
- `attachments`: optional array, max `20`

Rules:

- `requestType` must not be sent in the request body.
- `requestKind` must not be sent.
- `demandDetails` is not allowed.
- Direct requests are supply-only.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Direct request submitted successfully",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
POST /api/v1/deals/direct-requests
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "targetCompanyId": 45,
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder",
    "targetPrice": 1500
  },
  "attachments": [
    {
      "fileId": 321,
      "sortOrder": 0
    }
  ]
}
```

Notes:

- Cannot target own company.
- Target company must exist and be active.
- One active direct request per applicant/target pair is enforced.
- Successful responses still return `requestType: direct`.

## 4.10 POST `/deals/send-email`

Purpose: Send an email to a deal owner.  
Auth: Required

### Path Params DTO

None.

### Query DTO

None.

### Request Body DTO

```json
{
  "dealId": 10,
  "subject": "Need clarification on delivery schedule",
  "message": "Please share your expected weekly shipment cadence.",
  "contactInfo": "buyer@example.com | +20 100 000 0000"
}
```

Fields:

- `dealId`: positive number, required
- `subject`: string, required, max `200`
- `message`: string, required, max `5000`
- `contactInfo`: string, optional, max `500`

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Email sent successfully",
  "data": null
}
```

### Data DTO

`null`

### Sample Request

```http
POST /api/v1/deals/send-email
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "dealId": 10,
  "subject": "Need clarification on delivery schedule",
  "message": "Please share your expected weekly shipment cadence.",
  "contactInfo": "buyer@example.com | +20 100 000 0000"
}
```

## 4.11 POST `/deals/:id/requests`

Purpose: Create a deal-scoped request.  
Auth: Required

### Path Params DTO

```json
{
  "id": 10
}
```

### Query DTO

None.

### Request Body DTO

```json
{
  "requestType": "inSupply",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder",
    "targetPrice": 1500
  },
  "attachments": [
    {
      "fileId": 321,
      "sortOrder": 0
    }
  ]
}
```

Rules:

- `requestType` is required.
- `requestType = inSupply` requires `supplyDetails` and forbids `demandDetails`.
- `requestType = inDemand` requires `demandDetails` and forbids `supplyDetails`.
- `requestKind` is not part of the public request body.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Request submitted successfully",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
POST /api/v1/deals/10/requests
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "requestType": "inDemand",
  "demandDetails": {
    "productServiceName": "Plastic caps",
    "availabilityType": "mixed",
    "unitPrice": 0.18
  },
  "attachments": [
    {
      "fileId": 321,
      "sortOrder": 0
    }
  ]
}
```

Supply alternative:

```json
{
  "requestType": "inSupply",
  "supplyDetails": {
    "productServiceName": "Steel coils",
    "category": "rawMaterial",
    "supplyType": "makeToOrder",
    "targetPrice": 1500
  },
  "attachments": [
    {
      "fileId": 321,
      "sortOrder": 0
    }
  ]
}
```

Notes:

- The target deal must be `open`.
- The applicant cannot request on its own deal.
- One active request per applicant per deal is enforced.

## 4.12 GET `/deals/:id/requests`

Purpose: Owner view of all requests on one deal.  
Auth: Required

### Path Params DTO

```json
{
  "id": 10
}
```

### Query DTO

```json
{
  "keyword": "delta",
  "status": "pending",
  "limit": 50,
  "offset": 0
}
```

Optional fields:

- `keyword`: string
- `status`: `pending | paused | accepted | rejected | canceled`
- `limit`: number, default `50`, max `100`
- `offset`: number, default `0`

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Deal requests fetched",
  "data": {
    "requests": ["DealRequestDto"],
    "stats": "DealRequestStatsDto"
  }
}
```

### Data DTO

```json
{
  "requests": ["DealRequestDto"],
  "stats": "DealRequestStatsDto"
}
```

### Sample Request

```http
GET /api/v1/deals/10/requests?status=pending&limit=20&offset=0
Authorization: Bearer <token>
```

Notes:

- Only the owning company may access this endpoint.

## 4.13 PATCH `/deals/:dealId/requests/:requestId/status`

Purpose: Owner accepts or rejects one pending request.  
Auth: Required

### Path Params DTO

```json
{
  "dealId": 10,
  "requestId": 77
}
```

### Query DTO

None.

### Request Body DTO

```json
{
  "status": "accepted"
}
```

Allowed:

- `status`: `accepted | rejected`

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Request accepted",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
PATCH /api/v1/deals/10/requests/77/status
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "status": "accepted"
}
```

Notes:

- Only `pending` requests can be accepted or rejected.
- Accepting a request updates request status only; it does not move the deal into another status automatically.

## 4.14 PATCH `/deals/requests/:requestId/pause`

Purpose: Applicant pauses one pending request.  
Auth: Required

### Path Params DTO

```json
{
  "requestId": 77
}
```

### Query DTO

None.

### Request Body DTO

None.

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Request paused",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
PATCH /api/v1/deals/requests/77/pause
Authorization: Bearer <token>
```

Notes:

- Only `pending` requests can be paused.

## 4.15 PATCH `/deals/requests/:requestId/cancel`

Purpose: Applicant cancels one pending or paused request.  
Auth: Required

### Path Params DTO

```json
{
  "requestId": 77
}
```

### Query DTO

None.

### Request Body DTO

```json
{
  "cancelReason": "Pricing no longer valid"
}
```

Fields:

- `cancelReason`: string, required, min `3`, max `1000`

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Request canceled",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
PATCH /api/v1/deals/requests/77/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "cancelReason": "Pricing no longer valid"
}
```

Notes:

- Only `pending` or `paused` requests can be canceled.

## 4.16 DELETE `/deals/requests/:requestId`

Purpose: Legacy withdraw alias for canceling a request.  
Auth: Required

### Path Params DTO

```json
{
  "requestId": 77
}
```

### Query DTO

```json
{
  "cancelReason": "Pricing no longer valid"
}
```

### Request Body DTO

```json
{
  "cancelReason": "Pricing no longer valid"
}
```

Rules:

- `cancelReason` is required and may be supplied in query or body
- body value takes precedence if both are supplied

### Success Response Envelope DTO

```json
{
  "status": "success",
  "message": "Request withdrawn",
  "data": "DealRequestDto"
}
```

### Data DTO

`DealRequestDto`

### Sample Request

```http
DELETE /api/v1/deals/requests/77?cancelReason=Pricing%20no%20longer%20valid
Authorization: Bearer <token>
```

---

## 5) Behavior Rules

- One active in-supply request per applicant company per deal is enforced for `pending | paused | accepted`.
- One active direct request per applicant company and target company is enforced for `pending | paused | accepted`.
- Deal-scoped requests require the target deal to be `open`.
- Applicant company must be active to create requests.
- Creating or reopening a deal to `open` is subject to the company open-deal limit.
- Accepting a request does not automatically change the parent deal status.

---

## 6) Shared Error Handling Matrix

| HTTP | Typical Message                                                        | When It Happens                          |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------- |
| 400  | `Deal is not open for requests`                                        | Applying to a non-open deal              |
| 400  | `You already have a request on this deal`                              | Duplicate active in-supply request       |
| 400  | `You already have an active direct request for this company`           | Duplicate direct request                 |
| 400  | `Target company must be active to receive direct requests`             | Direct target not active                 |
| 400  | `Request is ... and cannot be accepted/rejected`                       | Invalid owner status transition          |
| 400  | `Only pending requests can be paused. Current status: ...`             | Invalid pause transition                 |
| 400  | `Only pending or paused requests can be canceled. Current status: ...` | Invalid cancel transition                |
| 400  | `cancelReason is required`                                             | Missing cancel reason on cancel/withdraw |
| 400  | `Validation Error: ...`                                                | Schema validation failure                |
| 403  | `Company context required`                                             | Authenticated route without company      |
| 403  | `Company must be active to create deals`                               | Company status blocks deal creation      |
| 403  | `Your company must be active to submit requests`                       | Company status blocks request creation   |
| 403  | `Unauthorized ...`                                                     | Wrong owner/applicant for resource       |
| 404  | `Deal not found`                                                       | Deal missing                             |
| 404  | `Request not found`                                                    | Request missing                          |
| 404  | `Target company not found`                                             | Direct-request target missing            |

---

## 7) Notes for Mobile

- Treat `GET /deals` as public, but expect different results for signed-in users because own-company deals are filtered out.
- Treat `GET /deals/me/deals` as non-archived by default; use explicit `status=archived` when the archived tab needs server-side filtering.
- For direct requests, several deal-derived fields are `null`; render against `targetCompany*` instead.
- For request lists, choose rendering from `supplyDetails` or `demandDetails` based on `requestType`.
- Do not use deprecated assumptions from archived docs:
  - no public `requestKind`
  - no deal-scoped `requestType=direct`
  - no direct-request demand flow
  - no removed request-detail fields

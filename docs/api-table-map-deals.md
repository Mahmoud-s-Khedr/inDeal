Here is the finalized write map for the Deals tables in [schema.prisma](/home/mk/Projects/freelance/mohand/inDeal/prisma/schema.prisma:214), based on the current validation, service, and repository code.

**`deals`**
| Column | Written by API | Source of value |
|---|---|---|
| `id` | DB only | auto-increment |
| `company_id` | `POST /api/v1/deals` | `req.user.company.id` |
| `deal_name` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.dealName` |
| `deal_description` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.dealDescription` |
| `deal_value` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.dealValue` |
| `deal_type` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.dealType` |
| `status` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id`, `DELETE /api/v1/deals/:id` | create forces `open`; update uses `body.status`; delete sets `archived` |
| `created_at` | DB only | default `now()` |
| `updated_at` | DB + update APIs | default `now()`, then touched on update/archive |

Notes:

- `POST /api/v1/deals` always creates with `status = 'open'`.
- `PUT /api/v1/deals/:id` can change `status` to `open | closed | archived`.
- `DELETE /api/v1/deals/:id` is a soft archive, not a hard delete.

**`deal_attachments`**
| Column | Written by API | Source of value |
|---|---|---|
| `id` | DB only | auto-increment |
| `deal_id` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | created/updated deal ID |
| `file_id` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.attachments[].fileId` |
| `kind` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.attachments[].kind` |
| `sort_order` | `POST /api/v1/deals`, `PUT /api/v1/deals/:id` | `body.attachments[].sortOrder` |
| `created_at` | DB only | default `now()` |

Notes:

- These APIs use replacement semantics.
- If `attachments` is sent on update, old rows are deleted first, then the new list is inserted.

**`deal_requests`**
| Column | Written by API | Source of value |
|---|---|---|
| `id` | DB only | auto-increment |
| `deal_id` | `POST /api/v1/deals/:id/requests`, `POST /api/v1/deals/direct-requests` | deal-scoped request uses route param `:id`; direct request stores `null` |
| `applicant_company_id` | both request-create APIs | `req.user.company.id` |
| `target_company_id` | `POST /api/v1/deals/direct-requests` | `body.targetCompanyId`; deal-scoped request stores `null` |
| `request_kind` | both request-create APIs | internally derived by backend: `inDemand -> demand`; `inSupply -> supply`; `direct -> supply` |
| `request_type` | both request-create APIs | deal-scoped request uses `body.requestType` (`inSupply | inDemand`); direct request is backend-controlled `direct` |
| `request_details` | both request-create APIs | generated summary from details, not raw client field |
| `request_offer` | both request-create APIs | inferred from details |
| `status` | both request-create APIs, `PATCH /api/v1/deals/:dealId/requests/:requestId/status`, `PATCH /api/v1/deals/requests/:requestId/pause`, `PATCH /api/v1/deals/requests/:requestId/cancel`, `DELETE /api/v1/deals/requests/:requestId` | create starts `pending`; later updated to `accepted`, `rejected`, `paused`, or `canceled` |
| `canceled_at` | cancel/withdraw APIs | set when canceled |
| `canceled_by_company_id` | cancel/withdraw APIs | caller company ID |
| `cancel_reason` | cancel/withdraw APIs | `body.cancelReason` or query/body for withdraw alias |
| `paused_at` | pause API | set when paused |
| `paused_by_company_id` | pause API | caller company ID |
| `created_at` | DB only | default `now()` |
| `updated_at` | DB + lifecycle APIs | updated on status changes |

How `request_details` is derived:

- `requestType = inDemand` -> `"Demand offer: <productServiceName>"`
- direct request -> `"Direct request: <productServiceName>"`
- `requestType = inSupply` -> `"Supply request: <productServiceName>"`

How `request_offer` is derived:

- `inDemand` -> `demandDetails.unitPrice`
- `inSupply` and `direct` -> `supplyDetails.targetPrice`

**`deal_request_supply_details`**
Written for deal-scoped `requestType = inSupply` and for direct requests.

| Column                            | Written by API                           | Source of value                              |
| --------------------------------- | ---------------------------------------- | -------------------------------------------- |
| `id`                              | DB only                                  | auto-increment                               |
| `request_id`                      | both request-create APIs                 | created `deal_requests.id`                   |
| `product_service_name`            | in-supply deal requests, direct requests | `supplyDetails.productServiceName`           |
| `category`                        | in-supply deal requests, direct requests | `supplyDetails.category`                     |
| `quantity_required`               | in-supply deal requests, direct requests | `supplyDetails.quantityRequired`             |
| `delivery_location`               | in-supply deal requests, direct requests | `supplyDetails.deliveryLocation`             |
| `delivery_date`                   | in-supply deal requests, direct requests | `supplyDetails.deliveryDate`                 |
| `target_price`                    | in-supply deal requests, direct requests | `supplyDetails.targetPrice`                  |
| `currency`                        | in-supply deal requests, direct requests | `supplyDetails.currency`                     |
| `payment_terms_preference`        | in-supply deal requests, direct requests | `supplyDetails.paymentTermsPreference`       |
| `incoterm`                        | in-supply deal requests, direct requests | `supplyDetails.incoterm`                     |
| `bulk_discount_expectation`       | in-supply deal requests, direct requests | `supplyDetails.bulkDiscountExpectation`      |
| `supply_type`                     | in-supply deal requests, direct requests | `supplyDetails.supplyType`                   |
| `key_specifications`              | in-supply deal requests, direct requests | `supplyDetails.keySpecifications`            |
| `material`                        | in-supply deal requests, direct requests | `supplyDetails.material`                     |
| `dimensions_size`                 | in-supply deal requests, direct requests | `supplyDetails.dimensionsSize`               |
| `certifications_required`         | in-supply deal requests, direct requests | `supplyDetails.certificationsRequired`       |
| `quality_level`                   | in-supply deal requests, direct requests | `supplyDetails.qualityLevel`                 |
| `other_quality_level_description` | in-supply deal requests, direct requests | `supplyDetails.otherQualityLevelDescription` |
| `max_lead_time_accepted`          | in-supply deal requests, direct requests | `supplyDetails.maxLeadTimeAccepted`          |
| `delivery_method_preference`      | in-supply deal requests, direct requests | `supplyDetails.deliveryMethodPreference`     |
| `packaging_requirements`          | in-supply deal requests, direct requests | `supplyDetails.packagingRequirements`        |
| `special_conditions_notes`        | in-supply deal requests, direct requests | `supplyDetails.specialConditionsNotes`       |
| `created_at`                      | DB only                                  | default `now()`                              |
| `updated_at`                      | DB + upsert                              | updated on conflict/update path              |

**`deal_request_demand_details`**
Written only for deal-scoped `requestType = inDemand`. Never written for direct requests.

| Column                        | Written by API                                | Source of value                            |
| ----------------------------- | --------------------------------------------- | ------------------------------------------ |
| `id`                          | DB only                                       | auto-increment                             |
| `request_id`                  | deal-scoped `POST /api/v1/deals/:id/requests` | created `deal_requests.id`                 |
| `product_service_name`        | deal-scoped `inDemand` requests               | `demandDetails.productServiceName`         |
| `available_quantity`          | deal-scoped `inDemand` requests               | `demandDetails.availableQuantity`          |
| `offer_validity_days`         | deal-scoped `inDemand` requests               | `demandDetails.offerValidityDays`          |
| `unit_price`                  | deal-scoped `inDemand` requests               | `demandDetails.unitPrice`                  |
| `currency`                    | deal-scoped `inDemand` requests               | `demandDetails.currency`                   |
| `total_price`                 | deal-scoped `inDemand` requests               | `demandDetails.totalPrice`                 |
| `volume_discount_tiers`       | deal-scoped `inDemand` requests               | `demandDetails.volumeDiscountTiers`        |
| `moq`                         | deal-scoped `inDemand` requests               | `demandDetails.moq`                        |
| `availability_type`           | deal-scoped `inDemand` requests               | `demandDetails.availabilityType`           |
| `quantity_in_stock`           | deal-scoped `inDemand` requests               | `demandDetails.quantityInStock`            |
| `max_produce_quantity`        | deal-scoped `inDemand` requests               | `demandDetails.maxProduceQuantity`         |
| `production_lead_time`        | deal-scoped `inDemand` requests               | `demandDetails.productionLeadTime`         |
| `specs_match_rfq`             | deal-scoped `inDemand` requests               | `demandDetails.specsMatchRfq`              |
| `differences_from_rfq`        | deal-scoped `inDemand` requests               | `demandDetails.differencesFromRfq`         |
| `material_offered`            | deal-scoped `inDemand` requests               | `demandDetails.materialOffered`            |
| `dimensions`                  | deal-scoped `inDemand` requests               | `demandDetails.dimensions`                 |
| `certifications_held`         | deal-scoped `inDemand` requests               | `demandDetails.certificationsHeld`         |
| `payment_terms`               | deal-scoped `inDemand` requests               | `demandDetails.paymentTerms`               |
| `delivery_terms`              | deal-scoped `inDemand` requests               | `demandDetails.deliveryTerms`              |
| `warranty_policy`             | deal-scoped `inDemand` requests               | `demandDetails.warrantyPolicy`             |
| `return_policy`               | deal-scoped `inDemand` requests               | `demandDetails.returnPolicy`               |
| `exclusivity_confidentiality` | deal-scoped `inDemand` requests               | `demandDetails.exclusivityConfidentiality` |
| `additional_notes`            | deal-scoped `inDemand` requests               | `demandDetails.additionalNotes`            |
| `created_at`                  | DB only                                       | default `now()`                            |
| `updated_at`                  | DB + upsert                                   | updated on conflict/update path            |

**`deal_request_attachments`**
| Column | Written by API | Source of value |
|---|---|---|
| `id` | DB only | auto-increment |
| `request_id` | both request-create APIs | created `deal_requests.id` |
| `file_id` | both request-create APIs | `attachments[].fileId` |
| `sort_order` | both request-create APIs | `attachments[].sortOrder` |
| `created_at` | DB only | default `now()` |

## API-to-table summary

| API                                                      | Tables written                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/deals`                                     | `deals`, `deal_attachments`                                                                                                        |
| `PUT /api/v1/deals/:id`                                  | `deals`, optionally `deal_attachments`                                                                                             |
| `DELETE /api/v1/deals/:id`                               | `deals` only                                                                                                                       |
| `POST /api/v1/deals/:id/requests`                        | `deal_requests`, `deal_request_supply_details` or `deal_request_demand_details` based on `requestType`, `deal_request_attachments` |
| `POST /api/v1/deals/direct-requests`                     | `deal_requests`, `deal_request_supply_details`, `deal_request_attachments`                                                         |
| `PATCH /api/v1/deals/:dealId/requests/:requestId/status` | `deal_requests` only                                                                                                               |
| `PATCH /api/v1/deals/requests/:requestId/pause`          | `deal_requests` only                                                                                                               |
| `PATCH /api/v1/deals/requests/:requestId/cancel`         | `deal_requests` only                                                                                                               |
| `DELETE /api/v1/deals/requests/:requestId`               | `deal_requests` only                                                                                                               |

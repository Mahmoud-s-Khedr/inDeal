# Deals User Flow

## Roles

- **Publisher (Deal Owner):** Creates and manages deals, reviews requests, accepts/rejects.
- **Applicant (Bidder):** Browses deals, submits requests, can withdraw own requests.
- **System:** Sends notifications on key events.

## Statuses

- **Deal:** open, negotiating, closed, archived
- **Request:** pending, accepted, rejected, withdrawn

## Owner flow

1. Create deal → status open.
   - APIs: POST /api/v1/deals
2. Receive requests → each request pending.
   - APIs: GET /api/v1/deals/:id/requests
3. Accept or reject requests.
   - Accept → request accepted; deal can move to negotiating.
   - Reject → request rejected; deal stays open/negotiating.
   - APIs: PATCH /api/v1/deals/:dealId/requests/:requestId/status
4. Close deal when complete → status closed.
   - APIs: PUT /api/v1/deals/:id (status = closed)
5. Archive when no longer active → status archived.
   - APIs: DELETE /api/v1/deals/:id

## Applicant flow

1. Browse deals and view details.
   - APIs: GET /api/v1/deals, GET /api/v1/deals/:id
2. Submit request → status pending.
   - APIs: POST /api/v1/deals/:id/requests
3. Withdraw own request (only while pending) → status withdrawn.
   - APIs: DELETE /api/v1/deals/requests/:requestId
4. If accepted, proceed in negotiating, then deal closes.
   - APIs (status visibility): GET /api/v1/deals/:id, GET /api/v1/deals/me/requests

## Notifications

- New request received → publisher.
  - APIs: POST /api/v1/deals/:id/requests triggers notification
- Request accepted/rejected/withdrawn → applicant/publisher.
  - APIs: PATCH /api/v1/deals/:dealId/requests/:requestId/status
  - APIs: DELETE /api/v1/deals/requests/:requestId
- Deal status changes → both parties.
  - APIs: PUT /api/v1/deals/:id, DELETE /api/v1/deals/:id

## Review eligibility

- Only accepted deals can be reviewed.
- Deal status must be open, negotiating, or closed (not archived).
- One review per deal/company pair.
- No self-reviews.
- APIs: POST /api/v1/companies/:id/reviews (requires dealId), GET /api/v1/companies/:id/reviews

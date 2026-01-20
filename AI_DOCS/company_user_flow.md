## Company Routes (Base: `/api/v1/companies`)

This document explains how users interact with company profiles and portfolio features. It separates actions for authenticated company agents (managing their own data) and public visitors (view-only access).

### Agent flow (auth)
Authenticated company agents manage their own company profile, assets, and portfolio. These endpoints are used by the logged-in company owner/agent only.
- `GET /me`
- `PUT /me`
- `POST /me/resend-for-review`

**Gallery CRUD**
Use these to manage company gallery images shown on the public profile.
- `GET /me/gallery`
- `POST /me/gallery`
- `PUT /me/gallery/:galleryItemId`
- `DELETE /me/gallery/:galleryItemId`

**Documents CRUD**
Company documents include certificates or licenses. These endpoints let agents add, update, or remove them.
- `GET /me/documents`
- `POST /me/documents`
- `PUT /me/documents/:documentId`
- `DELETE /me/documents/:documentId`

**Contributions CRUD**
Contributions represent products, projects, partnerships, or deals. These are displayed as portfolio items.
- `GET /me/contributions`
- `POST /me/contributions`
- `PUT /me/contributions/:contributionId`
- `DELETE /me/contributions/:contributionId`

**Contribution media CRUD + reorder**
Each contribution can have multiple media items (images, videos, files, or URLs). Reorder changes the display order.
- `GET /me/contributions/:contributionId/media`
- `POST /me/contributions/:contributionId/media`
- `PUT /me/contributions/:contributionId/media/:mediaId`
- `DELETE /me/contributions/:contributionId/media/:mediaId`
- `PUT /me/contributions/:contributionId/media/reorder`

### Public flow
Public visitors (or other companies) can view a company’s profile, gallery, and reviews without authentication.
- `GET /:id`
- `GET /:id/gallery`
- `GET /:id/reviews`

### Review creation
Reviews are created by authenticated companies and are tied to a specific deal.
- `POST /:id/reviews`
  - Body:
    - `dealId` (required)
    - `rating` (required, 1–5)
    - `reviewText` (optional)

**Eligibility rules**
These rules ensure reviews are tied to real business relationships and prevent duplicate or self-reviews.
- Deal must be accepted.
- Deal status must be `open`, `negotiating`, or `closed`.
- One review per deal/company pair.
- No self-reviews.

# inDeal API Reference (V1 Target)

Base URL prefix: `/api/v1`

## Auth

- `POST /auth/register/upload-url`
- `POST /auth/register`
- `POST /auth/resubmit`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/resend-forgot-password-otp`
- `POST /auth/verify-otp`
- `POST /auth/reset-password`

## Users

- `GET /users/me`
- `PUT /users/me`
- `PUT /users/me/password`
- `PUT /users/me/profile-image`
- `DELETE /users/me/profile-image`

## Companies

- `GET /companies/search`
- `GET /companies/me`
- `PUT /companies/me`
- `GET/POST/PUT/DELETE /companies/me/gallery[/:galleryItemId]`
- `GET/POST/PUT/DELETE /companies/me/documents[/:documentId]`
- `GET/PUT/DELETE /companies/me/registration-documents[/:registrationDocumentId]`
- `GET/POST/PUT/DELETE /companies/me/contributions[/:contributionId]`
- `GET/POST/PUT/DELETE /companies/me/contributions/:contributionId/media[/:mediaId]`
- `PUT /companies/me/contributions/:contributionId/media/reorder`
- `GET /companies/:id`
- `GET /companies/:id/gallery`
- `GET /companies/:id/reviews`
- `POST /companies/:id/reviews`
- `GET /companies/:id/documents`

## Files

- `POST /files/upload-url`

## Deals

- `GET /deals`
- `GET /deals/:id`
- `GET /deals/me/deals`
- `POST /deals`
- `PUT /deals/:id`
- `DELETE /deals/:id`
- `GET /deals/me/requests`
- `GET /deals/me/applications`
- `POST /deals/direct-requests`
- `POST /deals/:id/requests`
- `GET /deals/:id/requests`
- `PATCH /deals/:dealId/requests/:requestId/status`
- `PATCH /deals/requests/:requestId/pause`
- `PATCH /deals/requests/:requestId/cancel`
- `DELETE /deals/requests/:requestId`

## Chats

- `GET /chats`
- `POST /chats`
- `GET /chats/:roomId`
- `PATCH /chats/:roomId/archive`
- `GET /chats/:roomId/messages`
- `POST /chats/:roomId/messages`
- `POST /chats/:roomId/read`

## Support

- `GET /support/info`
- `GET /support/email-redirect`

## System/Health

- `GET /system/*`
- `GET /health`
